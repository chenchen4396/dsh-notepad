// Smoke tests for dsh-notepad:
//  1. notes-json.js: JSON data format round-trips and normalization.
//  2. importer.js: foreign-file classification (json / plain text).
//  3. client bundle: module contract + settings.section registration.
//  4. host half: routes registered with the webServer service + re-exports.
//  5. host end-to-end: real handlers over fake user homes — seeding,
//     existing-file usage, and the import / PUT / GET / reset flow.

import assert from 'node:assert/strict'
import {
  parseJsonDocument, serializeJsonDocument, defaultJsonDocument, SCHEMA_VERSION, hashId,
} from './lib/notes-json.js'
import { parseImport } from './lib/importer.js'

// ── 1. JSON data format ────────────────────────────────────────────────────

const sample = [
  { id: 'x1', category: '示例', title: '代码审查助手', content: '第一行\n\n空行分隔\n第三行' },
  { id: 'x2', category: '示例', title: '（无标题）', content: '简短内容' },
  { id: 'x3', category: '未分类', title: '未分类条目', content: '无分类' },
]

// 1a. serialize → parse round-trip.
const docText = serializeJsonDocument(sample)
assert.equal(JSON.parse(docText).version, SCHEMA_VERSION, 'document carries the schema version')
assert.ok('notes' in JSON.parse(docText), 'document uses the notes field')
assert.equal(!('prompts' in JSON.parse(docText)), true, 'document no longer uses the prompts field')
const back = parseJsonDocument(docText)
assert.equal(back.notes.length, 3, 'json round-trip count')
assert.deepEqual(back.notes.map(n => n.category), ['示例', '示例', '未分类'])
assert.deepEqual(back.notes.map(n => n.title), ['代码审查助手', '（无标题）', '未分类条目'])
assert.deepEqual(back.notes.map(n => n.content), ['第一行\n\n空行分隔\n第三行', '简短内容', '无分类'])
assert.deepEqual(back.notes.map(n => n.id), ['x1', 'x2', 'x3'], 'ids kept')

// 1b. parse → serialize is idempotent for normalized docs.
assert.equal(serializeJsonDocument(back.notes), docText, 'serialize(parse(x)) === x for canonical docs')

// 1c. foreign docs: bare array, blank category/title normalization, empty
// content skipped, custom ids and updatedAt kept, unknown keys dropped.
const foreign = parseJsonDocument(JSON.stringify([
  { category: '  ', title: '', content: '  无标题内容  ' },
  { category: 'A', title: 'T', content: 'X', id: 'custom', updatedAt: 123, extra: 'drop-me' },
  { content: '   ' },
]))
assert.equal(foreign.version, null, 'bare array has no version')
assert.equal(foreign.skipped, 1, 'empty content skipped')
assert.equal(foreign.notes.length, 2)
assert.deepEqual(foreign.notes[0], {
  id: hashId('未分类\u0000（无标题）\u0000无标题内容'),
  category: '未分类',
  title: '（无标题）',
  content: '无标题内容',
})
assert.equal(foreign.notes[1].id, 'custom')
assert.equal(foreign.notes[1].updatedAt, 123)
assert.equal('extra' in foreign.notes[1], false, 'unknown keys dropped')

// 1d. wrong shape / broken JSON → empty + version null (no throw).
assert.deepEqual(parseJsonDocument('{"foo":1}').notes, [])
assert.deepEqual(parseJsonDocument('not json').notes, [])
assert.deepEqual(parseJsonDocument(null).notes, [])
// Only the `notes` array is recognized — the old `prompts` key is refused.
assert.deepEqual(parseJsonDocument('{"version":1,"prompts":[]}').notes, [])

// 1e. default document parses to an empty list.
assert.deepEqual(parseJsonDocument(defaultJsonDocument()).notes, [])

// ── 2. importer: classify + parse foreign files ────────────────────────────

// 2a. dsh-notepad JSON export (notes field).
const jsonImport = parseImport(serializeJsonDocument(sample))
assert.equal(jsonImport.format, 'json')
assert.equal(jsonImport.notes.length, 3)

// 2b. bare-array JSON export from another tool.
const bareImport = parseImport('[{"category":"A","title":"B","content":"C"}]', 'other.json')
assert.equal(bareImport.format, 'json')
assert.equal(bareImport.notes[0].id, hashId('A\u0000B\u0000C'), 'derived id stable')

// 2c. valid JSON that is not a note library → refused.
assert.equal(parseImport('{"foo": [1,2]}', 'x.json').format, 'unknown')

// 2d. any non-JSON file (md / txt / …) → one note, filename becomes the
// title — no special Markdown handling anymore.
const txtImport = parseImport('# 我的想法\n\n## 小节\n\n随便写点什么\n第二段', '灵感笔记.md')
assert.equal(txtImport.format, 'text')
assert.deepEqual(txtImport.notes[0], {
  id: hashId('未分类\u0000灵感笔记\u0000# 我的想法\n\n## 小节\n\n随便写点什么\n第二段'),
  category: '未分类',
  title: '灵感笔记',
  content: '# 我的想法\n\n## 小节\n\n随便写点什么\n第二段',
})

// 2e. no filename → generic title; blank file → empty.
const noName = parseImport('hello world')
assert.equal(noName.format, 'text')
assert.equal(noName.notes[0].title, '导入的笔记')
assert.equal(parseImport('   ').format, 'empty')
assert.equal(parseImport('').notes.length, 0)

// ── 3. client bundle contract ──────────────────────────────────────────────

const store = { _m: {} }
const registrations = {}
const captured = {}
globalThis.localStorage = {
  getItem(k) { return store._m[k] ?? null },
  setItem(k, v) { store._m[k] = String(v) },
}
globalThis.document = {
  createElement: () => ({ appendChild() {}, remove() {}, select() {}, style: {} }),
  head: { appendChild() {} },
  body: { appendChild() {} },
}
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  __ModuleLoader__: {
    load({ id, factory }) {
      captured.loadedId = id
      captured.module = factory(spec => {
        if (spec === 'react') {
          // Per-consumer snapshots in NotesSection call order:
          // list → source → extra categories.
          let storeCalls = 0
          const seedList = [
            { id: 's1', category: '测试', title: '标题', content: '内容'.repeat(80), updatedAt: 1 },
            { id: 's2', category: '', title: '（无标题）', content: '短内容', updatedAt: 2 },
          ]
          return {
            createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
            useEffect: () => {},
            useRef: () => ({}),
            useState: v => [v, () => {}],
            useSyncExternalStore: () => {
              storeCalls += 1
              // Snapshot consumption order in this bundle: NotesSection
              // takes list → source → chips; NotesQuickAccess then takes
              // the list again (4th call).
              if (storeCalls === 1) return seedList // notes
              if (storeCalls === 2) return 'file' // source
              if (storeCalls === 3) return [{ name: '空分类A', count: 0 }, { name: '测试', count: 1 }] // chips snapshot
              return seedList // NotesQuickAccess list
            },
          }
        }
        if (spec === 'react-dom/client') {
          return { createRoot: () => ({ render() {}, unmount() {} }) }
        }
        throw new Error('unexpected require: ' + spec)
      })
    },
  },
}
// The host file API, as the browser would see it (empty library).
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, notes: [] }) })

await import('./lib/client.js')

const mod = captured.module
assert.equal(captured.loadedId, 'dsh-notepad')
assert.deepEqual(mod.inject, ['slots'])
const fakeCtx = {
  effect(cb) { return cb() }, // cordis semantics: callback runs now, return = cleanup
  slots: {
    inject(key, cb) { registrations[key] = cb },
    register(entry, component) { captured.entry = entry; captured.component = component; return () => {} },
  },
}
mod.apply(fakeCtx)
assert.deepEqual(Object.keys(registrations).sort(), ['conversation.input.left', 'settings.section'])
registrations['settings.section']()
assert.equal(captured.entry.name, 'settings.section')
assert.equal(captured.entry.id, 'notepad')
assert.equal(captured.entry.label, '随身笔记')
// Render the section once: catches TDZ/ordering crashes.
const tree = captured.component()
assert.ok(tree !== null && typeof tree === 'object', 'section renders a tree')
assert.equal(tree.type, 'div', 'section root is a div')
assert.equal(typeof captured.component, 'function')

// Compose the rendered tree: the toolbar buttons (新建/分类管理/导入/导出/
// 恢复默认值) and the hidden file input must be present.
const buttonLabels = []
const collectButtons = node => {
  if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return
  for (const c of node.children) {
    if (c && typeof c === 'object' && c.type === 'button') {
      const text = (Array.isArray(c.children) ? c.children.filter(x => typeof x === 'string') : []).join('')
      if (text !== '') buttonLabels.push(text)
    }
    collectButtons(c)
  }
}
collectButtons(tree)
for (const label of ['＋ 新建笔记', '✎ 分类管理', '📥 导入', '📤 导出', '恢复默认值']) {
  assert.ok(buttonLabels.includes(label), `toolbar has ${label}`)
}

// Composer quick access: registers the conversation.input.left seat and
// renders with the zone props (inputActions / useInput).
registrations['conversation.input.left']()
assert.equal(captured.entry.name, 'conversation.input.left')
assert.equal(captured.entry.id, 'notepad')
const seat = captured.component({ inputActions: { setDraft() {}, submit() {} }, useInput: () => '' })
assert.ok(seat !== null && typeof seat === 'object', 'composer seat renders a tree')
assert.equal(typeof seat.type, 'function', 'composer seat is the quick-access component')
const seatRoot = seat.type(seat.props)
assert.equal(seatRoot.type, 'div', 'composer seat root is a div')

// ── 4. host half route registration ────────────────────────────────────────

const routes = []
const hostCtx = {
  webServer: { register: route => { routes.push(route); return () => {} } },
  effect(cb) { return cb() },
}
const host = await import('./lib/index.js')
host.apply(hostCtx)
assert.equal(routes.length, 4)
assert.deepEqual(routes.map(r => r.path).sort(), [
  '/api/dsh-notepad/import',
  '/api/dsh-notepad/notes',
  '/api/dsh-notepad/prompts', // legacy alias — old pages keep working
  '/api/dsh-notepad/reset',
])
assert.ok(routes.every(r => r.kind === 'exact' && typeof r.handler === 'function'))
// Host re-exports the format modules (same implementations).
assert.equal(host.parseJsonDocument, parseJsonDocument)
assert.equal(host.serializeJsonDocument, serializeJsonDocument)
assert.equal(host.parseImport, parseImport)

// ── 5. host end-to-end: real handlers over fake user homes ─────────────────

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fakeRes = () => {
  const res = { status: 0, body: '' }
  res.writeHead = status => { res.status = status }
  res.end = body => { res.body = String(body) }
  return res
}
const call = async (route, method, body) => {
  const req = { method }
  if (body !== undefined) {
    const buf = Buffer.from(JSON.stringify(body))
    let done = false
    req[Symbol.asyncIterator] = () => ({
      next: async () => (done ? { done: true } : (done = true, { value: buf, done: false })),
    })
  }
  const res = fakeRes()
  await route.handler(req, res)
  return { status: res.status, data: res.body === '' ? null : JSON.parse(res.body) }
}

/** Boot a fresh host against a fresh fake home; returns { dir, byPath }. */
async function freshHost() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-notepad-smoke-'))
  process.env.DSH_HOME = dir
  const { apply } = await import(`./lib/index.js?e2e=${Date.now()}-${Math.random()}`)
  const registered = []
  apply({
    webServer: { register: route => { registered.push(route); return () => {} } },
    effect(cb) { return cb() },
  })
  return { dir, byPath: Object.fromEntries(registered.map(r => [r.path, r])) }
}

// 5a. empty home: GET seeds notes.json from the package on first use.
{
  const h = await freshHost()
  const get = await call(h.byPath['/api/dsh-notepad/notes'], 'GET')
  assert.equal(get.status, 200)
  assert.ok(get.data.notes.length >= 10, 'seed written on first use')
  assert.equal(JSON.parse(get.data.json).version, 1, 'GET returns the raw json file')
  const files = await readdir(join(h.dir, 'dsh-notepad'))
  assert.ok(files.includes('notes.json'), 'notes.json created')
  const persisted = JSON.parse(await readFile(join(h.dir, 'dsh-notepad', 'notes.json'), 'utf8'))
  assert.deepEqual(persisted, JSON.parse(get.data.json), 'file content matches the response')
  await rm(h.dir, { recursive: true, force: true })
}

// 5b. existing notes.json is used as-is (never overwritten by the seed).
{
  const h = await freshHost()
  await mkdir(join(h.dir, 'dsh-notepad'), { recursive: true })
  const mine = JSON.stringify({ version: 1, notes: [{ id: 'mine', category: '我的', title: 'T', content: 'C' }] })
  await writeFile(join(h.dir, 'dsh-notepad', 'notes.json'), mine, 'utf8')

  const get = await call(h.byPath['/api/dsh-notepad/notes'], 'GET')
  assert.equal(get.status, 200)
  assert.deepEqual(get.data.notes.map(n => [n.category, n.title]), [['我的', 'T']])
  assert.equal(
    await readFile(join(h.dir, 'dsh-notepad', 'notes.json'), 'utf8'),
    mine,
    'existing file untouched',
  )
  await rm(h.dir, { recursive: true, force: true })
}

// 5c. import / PUT / GET / reset / 400 handling on a seeded home.
{
  const h = await freshHost()
  const imp = await call(h.byPath['/api/dsh-notepad/import'], 'POST',
    { text: `{"version":1,"notes":[{"category":"别人","title":"一条","content":"内容"}]}`, filename: 'others.json' })
  assert.equal(imp.status, 200)
  assert.equal(imp.data.format, 'json')
  assert.deepEqual(imp.data.notes.map(n => [n.category, n.title]), [['别人', '一条']])

  const put = await call(h.byPath['/api/dsh-notepad/notes'], 'PUT',
    { notes: [{ id: 'a', category: '新', title: 'T', content: 'C' }] })
  assert.equal(put.status, 200)
  assert.equal(put.data.ok, true)
  const get = await call(h.byPath['/api/dsh-notepad/notes'], 'GET')
  assert.deepEqual(get.data.notes.map(n => [n.category, n.title]), [['新', 'T']])

  const reset = await call(h.byPath['/api/dsh-notepad/reset'], 'POST')
  assert.equal(reset.status, 200)
  assert.ok(reset.data.notes.length >= 10, 'seed restored')
  const files = await readdir(join(h.dir, 'dsh-notepad'))
  assert.ok(files.some(f => f.startsWith('notes.json.backup-')), 'notes.json backed up before reset')

  assert.equal((await call(h.byPath['/api/dsh-notepad/notes'], 'PUT', { nope: 1 })).status, 400)
  assert.equal((await call(h.byPath['/api/dsh-notepad/import'], 'POST', { filename: 'x.md' })).status, 400)
  await rm(h.dir, { recursive: true, force: true })
}

console.log('PASS: json format, importer, client contract, host routes, e2e handlers')
process.exit(0)