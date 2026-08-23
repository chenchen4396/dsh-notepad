// dsh-notepad — host half (runs in the dsh host process).
//
// Owns the single source of truth for prompt data: a Markdown file named
// prompts.md in the USER data directory:
//
//   $DSH_HOME/dsh-notepad/prompts.md   (default: ~/.dsh/…)
//
// The package directory would be read-only or ephemeral for npm-installed
// plugins (pnpm store), so user data must never live inside it. The
// package's own prompts.md is only a SEED: on first run (no user file yet)
// it is migrated once, then all reads/writes go to the user file.
//
// Exposes two browser routes:
//
//   GET /api/dsh-notepad/prompts
//     → 200 { ok: true, prompts: [...], md: '<file content>' }
//       (the file is created with the seed/default document when missing)
//   PUT /api/dsh-notepad/prompts   body { prompts: [...] }
//     → 200 { ok: true, md: '<serialized content>' }
//
// The browser half never touches the file directly — the host serializes /
// parses through prompts-md.js, the single place that owns the format.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePrompts, serializePrompts, defaultDocument } from './prompts-md.js'

/** User data directory for this plugin (under the dsh home). */
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

/** The live data file: user-scoped, survives upgrades and reinstallations. */
const PROMPTS_FILE = join(DSH_HOME, 'dsh-notepad', 'prompts.md')

/** Pre-rename data location; migrated once when the new file is missing. */
const LEGACY_PROMPTS_FILE = join(DSH_HOME, 'dsh-prompt-assistant', 'prompts.md')

/** Seed file inside the package (read-only migration source). */
const SEED_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts.md')

/**
 * One-time migration from the pre-rename location (~/.dsh/dsh-prompt-assistant/
 * prompts.md): copies the user's data over unless the new file already exists
 * (never overwrites). No-op when there is no legacy file.
 */
async function migrateLegacyData() {
  try {
    const legacy = await readFile(LEGACY_PROMPTS_FILE, 'utf8')
    try {
      await readFile(PROMPTS_FILE, 'utf8')
      return // new location already has data — keep legacy untouched
    } catch {
      // new location empty — adopt the legacy file
    }
    await mkdir(dirname(PROMPTS_FILE), { recursive: true })
    await writeFile(PROMPTS_FILE, legacy, 'utf8')
    console.log('[dsh-notepad] migrated prompts.md from', LEGACY_PROMPTS_FILE)
  } catch {
    // no legacy file — nothing to migrate
  }
}

/**
 * Ensure the user data file exists: created from the package seed on first
 * run, otherwise written fresh with the default document. Never touches the
 * package directory after that.
 */
async function ensureDataFile() {
  await migrateLegacyData()
  try {
    await readFile(PROMPTS_FILE, 'utf8')
    return
  } catch {
    // missing — fall through to creation
  }
  await mkdir(dirname(PROMPTS_FILE), { recursive: true })
  let seed = defaultDocument()
  try {
    seed = await readFile(SEED_FILE, 'utf8')
    console.log('[dsh-notepad] seeded prompts.md from package', SEED_FILE)
  } catch {
    // no seed available; use the default document
  }
  await writeFile(PROMPTS_FILE, seed, 'utf8')
}

/** Cap on JSON request bodies (a prompt library is small). */
const MAX_BODY_BYTES = 1024 * 1024

/** One JSON response. */
function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

/** GET handler: read + parse the user data file (seed it when missing). */
async function handleGet(_, res) {
  try {
    await ensureDataFile()
    const md = await readFile(PROMPTS_FILE, 'utf8')
    writeJson(res, 200, { ok: true, prompts: parsePrompts(md), md })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** PUT handler: validate body, serialize, write prompts.md. */
async function handlePut(req, res) {
  try {
    const body = await readJsonBody(req)
    if (body === undefined || !Array.isArray(body.prompts)) {
      writeJson(res, 400, { ok: false, error: 'expected JSON body { prompts: [...] }' })
      return
    }
    await ensureDataFile()
    const md = serializePrompts(body.prompts)
    await writeFile(PROMPTS_FILE, md, 'utf8')
    writeJson(res, 200, { ok: true, md })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** POST handler: restore the user data file from the package seed,
 * backing up the current content first (prompts.backup-<stamp>.md). */
async function handleReset(_, res) {
  try {
    let seed
    try {
      seed = await readFile(SEED_FILE, 'utf8')
    } catch {
      seed = defaultDocument() // no seed available — restore to an empty doc
    }
    // Best-effort backup of whatever the user has now.
    try {
      const current = await readFile(PROMPTS_FILE, 'utf8')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      await writeFile(`${PROMPTS_FILE}.backup-${stamp}`, current, 'utf8')
    } catch {
      // no current file (or unreadable) — nothing to back up
    }
    await mkdir(dirname(PROMPTS_FILE), { recursive: true })
    await writeFile(PROMPTS_FILE, seed, 'utf8')
    writeJson(res, 200, { ok: true, prompts: parsePrompts(seed), md: seed })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** The routes this plugin contributes to the web server. */
function makeRoutes() {
  return [
    {
      kind: 'exact',
      path: '/api/dsh-notepad/prompts',
      handler: (req, res) => {
        if (req.method === 'GET') return handleGet(req, res)
        if (req.method === 'PUT') return handlePut(req, res)
        res.writeHead(405)
        res.end()
      },
    },
    {
      kind: 'exact',
      path: '/api/dsh-notepad/reset',
      handler: (req, res) => {
        if (req.method === 'POST') return handleReset(req, res)
        res.writeHead(405)
        res.end()
      },
    },
  ]
}

export const name = 'notepad'
export const inject = ['webServer']

export function apply(ctx) {
  console.log('[dsh-notepad] host half loaded, prompts.md at', PROMPTS_FILE)
  // ctx.effect runs the callback immediately; the returned function is the
  // unload cleanup — routes must be registered INSIDE the callback.
  ctx.effect(() => {
    const disposers = makeRoutes().map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'notepad: routes')
}

// Re-exported for tests (not part of the plugin contract).
export { parsePrompts, serializePrompts, defaultDocument }