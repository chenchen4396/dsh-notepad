// dsh-notepad — host half (runs in the dsh host process).
//
// Owns the single source of truth for note data: a JSON file named
// notes.json in the USER data directory:
//
//   $DSH_HOME/dsh-notepad/notes.json   (default: ~/.dsh/…)
//
// The package directory would be read-only or ephemeral for npm-installed
// plugins (pnpm store), so user data must never live inside it. The
// package's own notes.json is only a SEED: on first run (no user file yet)
// it is migrated once, then all reads/writes go to the user file.
//
// The data file of record is exactly notes.json — that is all the plugin
// ever reads or writes (first development; no legacy formats exist).
//
// Exposes three browser routes (the note-library route is served on both
// the new /notes path and the historical /prompts path, so a page cached
// from an older plugin version keeps working during an upgrade):
//
//   GET /api/dsh-notepad/notes   (alias: /api/dsh-notepad/prompts)
//     → 200 { ok: true, notes: [...], json: '<file content>' }
//       (the file is created with the seed/default document when missing)
//   PUT /api/dsh-notepad/notes   body { notes: [...] }
//     → 200 { ok: true }
//   POST /api/dsh-notepad/import    body { text, filename? }
//     → 200 { ok: true, format: 'json'|'md'|'text'|'empty'|'unknown', notes: [...] }
//       (parses a foreign note file — JSON export / Markdown library / plain
//        text — WITHOUT touching the store; merging/replacing happens via PUT)
//   POST /api/dsh-notepad/reset
//     → 200 { ok: true, notes: [...] }  (restores the package seed, backs
//       up the current file as notes.json.backup-<stamp> first)
//
// The browser half never touches the file directly — the host serializes /
// parses through notes-json.js (the notes.json format) and importer.js
// (foreign files).

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseJsonDocument, serializeJsonDocument, defaultJsonDocument } from './notes-json.js'
import { parseImport } from './importer.js'

/** User data directory for this plugin (under the dsh home). */
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

/** The live data file: user-scoped, survives upgrades and reinstallations. */
const NOTES_FILE = join(DSH_HOME, 'dsh-notepad', 'notes.json')

/** Seed file inside the package (first-run source). */
const SEED_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'notes.json')

/**
 * Ensure the user data file exists: notes.json already there → done;
 * otherwise write the package seed (or the default document).
 * Never touches the package directory after that.
 */
async function ensureDataFile() {
  try {
    await readFile(NOTES_FILE, 'utf8')
    return
  } catch {
    // missing — create it
  }
  await mkdir(dirname(NOTES_FILE), { recursive: true })
  let seed = defaultJsonDocument()
  try {
    seed = await readFile(SEED_FILE, 'utf8')
    console.log('[dsh-notepad] seeded notes.json from package', SEED_FILE)
  } catch {
    // no seed available; use the default document
  }
  await writeFile(NOTES_FILE, seed, 'utf8')
}

/** Cap on JSON request bodies (a note library is small). */
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
    const json = await readFile(NOTES_FILE, 'utf8')
    writeJson(res, 200, { ok: true, notes: parseJsonDocument(json).notes, json })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** PUT handler: validate body, serialize, write notes.json. */
async function handlePut(req, res) {
  try {
    const body = await readJsonBody(req)
    if (body === undefined || !Array.isArray(body.notes)) {
      writeJson(res, 400, { ok: false, error: 'expected JSON body { notes: [...] }' })
      return
    }
    await ensureDataFile()
    await writeFile(NOTES_FILE, serializeJsonDocument(body.notes), 'utf8')
    writeJson(res, 200, { ok: true })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/**
 * POST handler: parse a foreign note file chosen by the user (somebody
 * else's export) into normalized notes. Pure parse — it never writes the
 * store; the client decides merge vs. replace and saves via PUT.
 */
async function handleImport(req, res) {
  try {
    const body = await readJsonBody(req)
    if (body === undefined || typeof body.text !== 'string') {
      writeJson(res, 400, { ok: false, error: 'expected JSON body { text, filename? }' })
      return
    }
    const result = parseImport(body.text, typeof body.filename === 'string' ? body.filename : undefined)
    writeJson(res, 200, { ok: true, ...result })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** POST handler: restore the user data file from the package seed,
 * backing up the current content first (notes.json.backup-<stamp>). */
async function handleReset(_, res) {
  try {
    let seed
    try {
      seed = await readFile(SEED_FILE, 'utf8')
    } catch {
      seed = defaultJsonDocument() // no seed available — restore to an empty doc
    }
    // Best-effort backup of whatever the user has now.
    try {
      const current = await readFile(NOTES_FILE, 'utf8')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      await writeFile(`${NOTES_FILE}.backup-${stamp}`, current, 'utf8')
    } catch {
      // no current file (or unreadable) — nothing to back up
    }
    await mkdir(dirname(NOTES_FILE), { recursive: true })
    await writeFile(NOTES_FILE, seed, 'utf8')
    writeJson(res, 200, { ok: true, notes: parseJsonDocument(seed).notes })
  } catch (error) {
    writeJson(res, 500, { ok: false, error: String(error?.message ?? error) })
  }
}

/** The routes this plugin contributes to the web server. */
function makeRoutes() {
  // The note-library handler is registered on both the new /notes path and
  // the historical /prompts alias (old pages in flight during an upgrade).
  const libraryHandler = (req, res) => {
    if (req.method === 'GET') return handleGet(req, res)
    if (req.method === 'PUT') return handlePut(req, res)
    res.writeHead(405)
    res.end()
  }
  return [
    {
      kind: 'exact',
      path: '/api/dsh-notepad/notes',
      handler: libraryHandler,
    },
    {
      kind: 'exact',
      path: '/api/dsh-notepad/prompts',
      handler: libraryHandler,
    },
    {
      kind: 'exact',
      path: '/api/dsh-notepad/import',
      handler: (req, res) => {
        if (req.method === 'POST') return handleImport(req, res)
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
  console.log('[dsh-notepad] host half loaded, notes.json at', NOTES_FILE)
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
export { parseJsonDocument, serializeJsonDocument, defaultJsonDocument, SCHEMA_VERSION, hashId } from './notes-json.js'
export { parseImport } from './importer.js'