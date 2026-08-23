// Smoke tests for dsh-prompt-assistant:
//  1. prompts-md.js: parse / serialize round-trips and edge cases.
//  2. client bundle: module contract + settings.section registration.
//  3. host half: routes registered with the webServer service.

import assert from 'node:assert/strict'
import { parsePrompts, serializePrompts, defaultDocument } from './lib/prompts-md.js'
import { parsePrompts as hostParse, serializePrompts as hostSerialize } from './lib/index.js'

// ── 1. markdown round-trip ─────────────────────────────────────────────────

// 1a. serialize → parse round-trip.
const sample = [
  { id: 'x1', category: '示例', title: '代码审查助手', content: '第一行\n\n空行分隔\n第三行' },
  { id: 'x2', category: '示例', title: '（无标题）', content: '简短内容' },
  { id: 'x3', category: '', title: '未分类条目', content: '无分类' },
]
const back = parsePrompts(serializePrompts(sample))
assert.equal(back.length, 3, 'round-trip count')
assert.deepEqual(back.map(p => p.category), ['示例', '示例', '未分类'])
assert.deepEqual(back.map(p => p.title), ['代码审查助手', '（无标题）', '未分类条目'])
assert.deepEqual(back.map(p => p.content), ['第一行\n\n空行分隔\n第三行', '简短内容', '无分类'])
assert.ok(new Set(back.map(p => p.id)).size === 3, 'ids stable & unique')

// 1b. parse → serialize → parse is stable (idempotent).
const md1 = serializePrompts(back)
assert.equal(serializePrompts(parsePrompts(md1)), md1, 'serialize(parse(md)) === md for canonical md')

// 1c. hand-written document parsing (title-less heading, comments, blanks).
const handmade = [
  '# 提示词库', '',
  '<!-- 注释行 -->', '',
  '## 开发', '',
  '### ', '',
  '无标题内容', '',
  '### 带标题', '',
  '内容A', '内容B', '',
  '', '## 开机', '', '### 启动', '', 'echo hello',
].join('\n')
const parsed = parsePrompts(handmade)
assert.equal(parsed.length, 3)
assert.deepEqual(parsed.map(p => [p.category, p.title]), [
  ['开发', '（无标题）'],
  ['开发', '带标题'],
  ['开机', '启动'],
])
assert.equal(parsed[1].content, '内容A\n内容B')
assert.equal(parsed[2].content, 'echo hello')

// 1d. default document parses to an empty list.
assert.deepEqual(parsePrompts(defaultDocument()), [])

// 1e. host re-exports the same implementations.
assert.equal(hostParse, parsePrompts)
assert.equal(hostSerialize, serializePrompts)

// 1f. ordering persists: first-seen category order + item order within a
// category survive the round trip (backing the reorder feature).
const mixed = parsePrompts(serializePrompts([
  { category: 'A', title: '一', content: 'a' },
  { category: 'B', title: '一', content: 'b' },
  { category: 'A', title: '二', content: 'c' },
]))
assert.deepEqual(mixed.map(p => [p.category, p.title]), [['A', '一'], ['A', '二'], ['B', '一']])

// ── 2. client bundle contract ──────────────────────────────────────────────

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
          // Per-consumer snapshots in PromptSection call order:
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
              // Snapshot consumption order in this bundle: PromptSection
              // takes list → source → chips; PromptQuickAccess then takes
              // the list again (4th call).
              if (storeCalls === 1) return seedList // prompts
              if (storeCalls === 2) return 'file' // source
              if (storeCalls === 3) return [{ name: '空分类A', count: 0 }, { name: '测试', count: 1 }] // chips snapshot
              return seedList // PromptQuickAccess list
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
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, prompts: [] }) })

await import('./lib/client.js')

const mod = captured.module
assert.equal(captured.loadedId, 'dsh-prompt-assistant')
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
assert.equal(captured.entry.id, 'prompt-assistant')
assert.equal(captured.entry.label, '提示词')
// Render the section once: catches TDZ/ordering crashes (e.g. the blank-page
// regression where `countOf` was used before its const initializer).
const tree = captured.component()
assert.ok(tree !== null && typeof tree === 'object', 'section renders a tree')
assert.equal(tree.type, 'div', 'section root is a div')
assert.equal(typeof captured.component, 'function')

// Composer quick access: the same bundle registers the conversation.input.left
// seat and renders with the zone props (inputActions / useInput).
registrations['conversation.input.left']()
assert.equal(captured.entry.name, 'conversation.input.left')
assert.equal(captured.entry.id, 'prompt-assistant')
const seat = captured.component({ inputActions: { setDraft() {}, submit() {} }, useInput: () => '' })
assert.ok(seat !== null && typeof seat === 'object', 'composer seat renders a tree')
assert.equal(typeof seat.type, 'function', 'composer seat is the quick-access component')
const seatRoot = seat.type(seat.props)
assert.equal(seatRoot.type, 'div', 'composer seat root is a div')

// ── 3. host half route registration ────────────────────────────────────────

const routes = []
const hostCtx = {
  webServer: { register: route => { routes.push(route); return () => {} } },
  effect(cb) { return cb() },
}
const host = await import('./lib/index.js')
host.apply(hostCtx)
assert.equal(routes.length, 2)
assert.deepEqual(routes.map(r => r.path).sort(), [
  '/api/dsh-prompt-assistant/prompts',
  '/api/dsh-prompt-assistant/reset',
])
assert.ok(routes.every(r => r.kind === 'exact' && typeof r.handler === 'function'))

console.log('PASS: md round-trip×5, client contract (settings.section / 提示词), host route registration')
process.exit(0)