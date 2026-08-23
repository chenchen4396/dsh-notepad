/**
 * prompts-md — the single source of truth for the dsh-notepad data
 * format: a Markdown file inside the plugin package (prompts.md).
 *
 * Format (parse and serialize are exact inverses):
 *
 *   # 提示词库
 *
 *   <!-- comments are ignored -->
 *
 *   ## 分类名
 *
 *   ### 标题（可为空，解析为 （无标题））
 *
 *   内容行...
 *   更多内容行...
 *
 * IDs are derived (hash of category+title+content), so hand-editing the file
 * never breaks React keys and round-trips stay stable.
 */

/** Stable short hash for prompt IDs (djb2, hex). */
function hashId(input) {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0
  return h.toString(16)
}

const TITLE_FALLBACK = '（无标题）'

/** Trim leading/trailing blank lines of a content block. */
function trimBlock(lines) {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === '') start++
  while (end > start && lines[end - 1].trim() === '') end--
  return lines.slice(start, end)
}

/**
 * Parse the markdown document into the prompt array.
 * @param md - file content.
 * @returns [{ id, category, title, content }]
 */
export function parsePrompts(md) {
  const prompts = []
  let category = '未分类'
  let item = null
  let pending = null // {category, title, lines}

  const flush = () => {
    if (pending === null) return
    const content = trimBlock(pending.lines).join('\n')
    if (content !== '') {
      prompts.push(buildPrompt(pending.category, pending.title, content))
    }
    pending = null
  }

  for (const raw of String(md ?? '').split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (/^\s*<!--/.test(line)) continue // comment line
    const cat = /^##(?!#)\s*(.*)$/.exec(line)
    if (cat) {
      flush()
      category = cat[1].trim() || '未分类'
      continue
    }
    const head = /^###(?!#)\s*(.*)$/.exec(line)
    if (head) {
      flush()
      pending = { category, title: head[1].trim() || TITLE_FALLBACK, lines: [] }
      continue
    }
    if (/^#\s/.test(line)) continue // document title
    if (pending === null) {
      if (line.trim() === '') continue
      pending = { category, title: TITLE_FALLBACK, lines: [] }
    }
    pending.lines.push(line)
  }
  flush()
  return prompts
}

function buildPrompt(category, title, content) {
  category = category.trim() === '' ? '未分类' : category.trim()
  title = title.trim() === '' ? TITLE_FALLBACK : title.trim()
  return {
    id: hashId(`${category}\u0000${title}\u0000${content}`),
    category,
    title,
    content,
  }
}

/** Serialize the prompt array back into the markdown document. */
export function serializePrompts(prompts) {
  const list = Array.isArray(prompts) ? prompts : []
  // Ordering: categories in first-seen order (so reordering and hand edits
  // of the document persist); prompts keep their given order within each
  // category.
  const byCategory = new Map()
  for (const p of list) {
    const c = (p.category ?? '').trim() === '' ? '未分类' : p.category.trim()
    if (!byCategory.has(c)) byCategory.set(c, [])
    byCategory.get(c).push(p)
  }
  const parts = [
    '# 提示词库',
    '',
    '<!-- 本文件由 dsh-notepad 自动维护；格式：## 分类 / ### 标题 / 内容。可手动编辑，刷新后生效。 -->',
    '',
  ]
  for (const category of byCategory.keys()) {
    parts.push(`## ${category}`)
    for (const p of byCategory.get(category)) {
      const title = (p.title ?? '').trim() === '' ? '' : p.title.trim()
      const content = String(p.content ?? '').replace(/\r\n/g, '\n').trim()
      parts.push('', `### ${title}`, '', content, '')
    }
    parts.push('')
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** The default document written when prompts.md does not exist yet. */
export function defaultDocument() {
  return serializePrompts([])
}