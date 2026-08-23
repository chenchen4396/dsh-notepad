/**
 * importer — classify + parse a foreign file chosen by the user (usually
 * somebody else's note file) into dsh-notepad notes. Two cases:
 *
 *   - JSON: the dsh-notepad export format — {"version":1,"notes":[…]}, or a
 *     bare array of { category, title, content } entries from another tool.
 *                                                                      → format 'json'
 *   - Anything else (plain .md / .txt / …): becomes ONE note, the file name
 *     (without extension) as title.                                  → format 'text'
 *
 * Returns { format, notes } where notes are fully normalized
 * ({ id, category, title, content } with derived ids, so re-importing the
 * same file stays dedup-able). `format: 'empty'` / `'unknown'` signal a
 * blank file, or JSON that is not a note library.
 */

import { parseJsonDocument, hashId } from './notes-json.js'

export function parseImport(text, filename) {
  const src = String(text ?? '')
  if (src.trim() === '') return { format: 'empty', notes: [] }

  // JSON first: the file starts with { or [ — try the export format.
  const first = src.trimStart()[0]
  if (first === '{' || first === '[') {
    try {
      const parsed = JSON.parse(src)
      if (Array.isArray(parsed) || (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.notes))) {
        const { notes } = parseJsonDocument(parsed)
        return { format: 'json', notes }
      }
      // Valid JSON but not a note library — refuse rather than guess.
      return { format: 'unknown', notes: [] }
    } catch {
      // Not JSON after all — fall through to plain-text handling.
    }
  }

  // Plain note file → a single note; the file name becomes the title.
  const content = src.trim()
  const base = String(filename ?? '').replace(/\.[^.]+$/, '').trim()
  const title = base === '' ? '导入的笔记' : base
  const note = {
    id: hashId(`未分类\u0000${title}\u0000${content}`),
    category: '未分类',
    title,
    content,
  }
  return { format: 'text', notes: [note] }
}