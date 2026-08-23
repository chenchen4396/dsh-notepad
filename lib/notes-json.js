/**
 * notes-json — the runtime data format for dsh-notepad: a JSON file named
 * notes.json in the USER data directory:
 *
 *   $DSH_HOME/dsh-notepad/notes.json   (default: ~/.dsh/…)
 *
 *   {
 *     "version": 1,
 *     "notes": [
 *       { "id": "…", "category": "…", "title": "…", "content": "…", "updatedAt": 1712345678901 }
 *     ]
 *   }
 *
 * The version field is reserved for future format migrations; unknown keys
 * are ignored on read. The parser recognizes ONLY the `notes` array (or a
 * bare JSON array of { category, title, content } objects for foreign
 * exports) — other shapes are refused. Entries without ids get one derived
 * from their content, so re-imports of the same content stay stable and
 * dedup-able.
 *
 * Parse and serialize are exact inverses for normalized documents.
 */

/** Current schema version written into every serialized document. */
export const SCHEMA_VERSION = 1

/** Stable short hash for note IDs (djb2, hex). */
export function hashId(input) {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0
  return h.toString(16)
}

const TITLE_FALLBACK = '（无标题）'

/**
 * Normalize one raw entry into a well-formed note. Empty content is
 * rejected (returns null) — a note without content is useless.
 */
function normalizeNote(item) {
  if (item === null || typeof item !== 'object') return null
  const content = String(item.content ?? '').trim()
  if (content === '') return null
  const category = String(item.category ?? '').trim() === '' ? '未分类' : String(item.category ?? '').trim()
  const title = String(item.title ?? '').trim() === '' ? TITLE_FALLBACK : String(item.title ?? '').trim()
  const id = typeof item.id === 'string' && item.id.trim() !== '' ? item.id.trim() : hashId(`${category}\u0000${title}\u0000${content}`)
  const note = { id, category, title, content }
  if (typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)) note.updatedAt = item.updatedAt
  return note
}

/**
 * Parse a JSON document (string or already-parsed value) into the notes
 * array. Returns { version, notes, skipped } — `skipped` counts entries
 * dropped for empty content. A document in the wrong shape yields version
 * null and an empty list.
 */
export function parseJsonDocument(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { version: null, notes: [], skipped: 0 }
    }
  }
  let list
  if (Array.isArray(data)) list = data
  else if (data !== null && typeof data === 'object' && Array.isArray(data.notes)) list = data.notes
  else return { version: null, notes: [], skipped: 0 }

  const notes = []
  let skipped = 0
  for (const item of list) {
    const note = normalizeNote(item)
    if (note === null) skipped += 1
    else notes.push(note)
  }
  const version =
    data !== null && typeof data === 'object' && typeof data.version === 'number' ? data.version : null
  return { version, notes, skipped }
}

/** Serialize the notes array into the canonical JSON document. */
export function serializeJsonDocument(notes) {
  const list = Array.isArray(notes) ? notes : []
  return JSON.stringify({ version: SCHEMA_VERSION, notes: list }, null, 2) + '\n'
}

/** The default document written when notes.json does not exist yet. */
export function defaultJsonDocument() {
  return serializeJsonDocument([])
}