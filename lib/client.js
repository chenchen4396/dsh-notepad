/**
 * dsh-prompt-assistant — browser half (runs inside the dsh web GUI).
 *
 * Settings section "提示词": a prompt library with good use & management UX.
 *
 * Use: search (`/` focuses, Esc clears), click content to copy (toast
 * feedback), copy button, expand/collapse long prompts, Ctrl+Enter to save.
 * Manage: 「＋ 新建提示词」opens a modal dialog (Esc / backdrop / 取消 to
 * close), edit-in-card, two-step delete, reorder within a category (↑/↓,
 * persists to prompts.md), rename categories in place, filter chips.
 * The header shows a compact storage-status dot (green = saved to file,
 * yellow = local cache) with the full path in its tooltip.
 *
 * Data lives in the user data file (~/.dsh/dsh-prompt-assistant/prompts.md)
 * via host routes:
 *   GET /api/dsh-prompt-assistant/prompts → { ok, prompts, md }
 *   PUT /api/dsh-prompt-assistant/prompts  body { prompts } → { ok }
 * localStorage is a cache / offline fallback (badge shows the source).
 *
 * Visuals follow the dsh design tokens (--dsw-alias-*), so the UI adapts to
 * the active skin automatically; a tiny injected <style> adds hover/focus
 * polish (hand-written bundles can't express :hover inline).
 *
 * Bundle format: `window.__ModuleLoader__.load({id, factory})` with kernel
 * `require(...)`; cordis contract `apply` + `inject`. Failure policy:
 * problems are logged, never thrown.
 */
window.__ModuleLoader__.load({
  id: 'dsh-prompt-assistant',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const { createElement, useEffect, useRef, useState, useSyncExternalStore } = require('react')
    const { createRoot } = require('react-dom/client')

    /** Services this client plugin needs (fiber inject waiting). */
    const inject = ['slots']

    // ── design tokens (dsh skin variables with light fallbacks) ────────────

    const T = {
      page: 'var(--dsw-alias-bg-base, #f8fafc)',
      card: 'var(--dsw-alias-bg-layer-1, #ffffff)',
      card2: 'var(--dsw-alias-bg-layer-2, #ffffff)',
      hover: 'var(--dsw-alias-interactive-bg-hover, #f1f5f9)',
      text: 'var(--dsw-alias-label-primary, #0f172a)',
      muted: 'var(--dsw-alias-label-secondary, #475569)',
      faint: 'var(--dsw-alias-label-tertiary, #94a3b8)',
      dim: 'var(--dsw-alias-label-dimmed, #cbd5e1)',
      border: 'var(--dsw-alias-border-l2, #e2e8f0)',
      borderSoft: 'var(--dsw-alias-border-l1, #eef2f7)',
      brand: 'var(--dsw-alias-brand-primary, #2563eb)',
      btnFill: 'var(--dsw-alias-button-primary-fill, #2563eb)',
      btnHover: 'var(--dsw-alias-button-primary-hover, #1d4ed8)',
      ok: 'var(--dsw-alias-state-success-primary, #16a34a)',
      okBg: 'var(--dsw-alias-state-success-secondary, #ecfdf5)',
      danger: 'var(--dsw-alias-state-error-primary, #dc2626)',
      dangerBg: 'var(--dsw-alias-state-error-secondary, #fef2f2)',
      font: 'var(--dsw-font-family, system-ui, -apple-system, sans-serif)',
      radius: 10,
    }

    const fieldBase = {
      boxSizing: 'border-box', width: '100%', padding: '8px 10px',
      border: `1px solid ${T.border}`, borderRadius: '8px', fontSize: '13px',
      fontFamily: T.font, color: T.text, background: T.card, outline: 'none',
    }
    const btnBase = {
      border: 'none', borderRadius: '8px', padding: '6px 12px',
      fontSize: '12.5px', cursor: 'pointer', fontFamily: T.font,
    }

    // ── injected stylesheet (hover/focus/toast polish) ─────────────────────

    let cssInjected = false
    function injectCss() {
      if (cssInjected) return
      cssInjected = true
      const style = document.createElement('style')
      style.textContent = `
.dsh-pa-card{transition:border-color .15s ease, box-shadow .15s ease, background .15s ease}
.dsh-pa-card:hover{border-color:var(--dsw-alias-border-l3,#cbd5e1)!important;box-shadow:var(--dsw-shadow-lv3,0 4px 16px rgba(15,23,42,.08))}
.dsh-pa-btn{transition:background .12s ease, color .12s ease, opacity .12s ease}
.dsh-pa-btn.primary:hover{background:var(--dsw-alias-button-primary-hover,#1d4ed8)}
.dsh-pa-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9)}
.dsh-pa-btn.danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger,#fef2f2)}
.dsh-pa-field:focus-visible, .dsh-pa-field:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#2563eb)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#2563eb) 20%,transparent)}
.dsh-pa-chip{transition:all .12s ease}
.dsh-pa-chip:hover{border-color:var(--dsw-alias-border-l3,#cbd5e1)}
.dsh-pa-qitem{transition:background .12s ease}
.dsh-pa-qitem:hover{background:var(--dsw-alias-interactive-bg-hover,#f1f5f9)}
.dsh-pa-copy:hover{color:var(--dsw-alias-label-primary,#0f172a)}
.dsh-pa-toast{position:fixed;right:20px;z-index:2147483001;background:var(--dsw-alias-bg-layer-2,#ffffff);color:var(--dsw-alias-label-primary,#0f172a);border:1px solid var(--dsw-alias-border-l2,#e2e8f0);border-radius:10px;box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(15,23,42,.16));padding:10px 14px;font:12.5px/1.5 var(--dsw-font-family,system-ui,sans-serif);opacity:0;transform:translateY(-4px);transition:opacity .18s ease, transform .18s ease;pointer-events:none;max-width:320px}
.dsh-pa-note{font-size:11px;font-family:var(--dsw-font-family,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary,#94a3b8)}
`
      document.head.appendChild(style)
    }

    // ── toast ──────────────────────────────────────────────────────────────

    const liveToasts = []

    function showToast(text) {
      const el = document.createElement('div')
      el.className = 'dsh-pa-toast'
      el.textContent = text
      const slot = liveToasts.length
      liveToasts.push(el)
      el.style.top = `${16 + slot * 48}px`
      document.body.appendChild(el)
      requestAnimationFrame(() => {
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      })
      setTimeout(() => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(-4px)'
        setTimeout(() => {
          el.remove()
          const i = liveToasts.indexOf(el)
          if (i !== -1) liveToasts.splice(i, 1)
        }, 200)
      }, 2000)
    }

    // ── store: file-backed list + localStorage cache + source badge ────────

    const STORE_KEY = 'dsh.prompt-assistant.v1'
    const API = '/api/dsh-prompt-assistant/prompts'
    const RESET_URL = '/api/dsh-prompt-assistant/reset'

    let prompts = loadLocalCache()
    let source = 'loading' // 'loading' | 'file' | 'local'
    const listeners = new Set()

    function loadLocalCache() {
      try {
        const raw = localStorage.getItem(STORE_KEY)
        const arr = raw === null ? [] : JSON.parse(raw)
        return Array.isArray(arr) ? arr : []
      } catch (error) {
        console.error('[dsh-prompt-assistant] local cache load failed', error)
        return []
      }
    }

    function persistLocalCache() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(prompts))
      } catch (error) {
        console.error('[dsh-prompt-assistant] local cache save failed', error)
      }
    }

    function emit() {
      chipsSnapshot = computeChips()
      for (const fn of listeners) fn()
    }

    function subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }

    function getSnapshot() {
      return prompts
    }

    function getSourceSnapshot() {
      return source
    }

    function setStore(list, nextSource) {
      prompts = list
      source = nextSource
      persistLocalCache()
      emit()
    }

    async function fetchFromFile() {
      const res = await fetch(API, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'bad response')
      return data.prompts
    }

    async function saveToFile(list) {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompts: list }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }

    /** Boot-time load: file first, migrate an orphaned cache, else local. */
    async function initStore() {
      try {
        const fileList = await fetchFromFile()
        const cached = loadLocalCache()
        if (fileList.length === 0 && cached.length > 0) {
          await saveToFile(cached) // migrate the old localStorage list
        }
        setStore(fileList, 'file')
      } catch (error) {
        console.error('[dsh-prompt-assistant] file load failed, falling back to local cache', error)
        setStore(loadLocalCache(), 'local')
      }
    }

    /**
     * Apply a store mutation. Returns the persistence promise (null in
     * local-cache mode) so UI can show saving/saved states.
     */
    function mutate(nextList) {
      setStore(nextList, source)
      if (source !== 'file') return null
      return saveToFile(nextList).catch(error =>
        console.error('[dsh-prompt-assistant] file save failed', error))
    }

    function upsertPrompt(prompt) {
      const exists = prompts.some(p => p.id === prompt.id)
      return mutate(exists ? prompts.map(p => (p.id === prompt.id ? prompt : p)) : [...prompts, prompt])
    }

    function removePrompt(id) {
      return mutate(prompts.filter(p => p.id !== id))
    }

    /** Move one prompt one step within its category (persisted order). */
    function movePrompt(id, dir) {
      const i = prompts.findIndex(p => p.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prompts.length) return null
      if (prompts[j].category.trim() !== prompts[i].category.trim()) return null
      const list = [...prompts]
      ;[list[i], list[j]] = [list[j], list[i]]
      return mutate(list)
    }

    /** Rename a category across every prompt that uses it (and any empty
     * category entry of the same name). */
    function renameCategory(oldName, newName) {
      const to = newName.trim()
      const from = oldName.trim()
      if (to === '' || to === from) return null
      const trimmed = extraCats.includes(from)
      if (trimmed) {
        extraCats = extraCats.map(c => (c === from ? to : c))
        persistExtraCats()
      }
      return mutate(prompts.map(p =>
        p.category.trim() === from ? { ...p, category: to } : p))
    }

    // ── empty categories (persist in localStorage; the md file cannot
    //    represent a category that has no prompts) ──────────────────────────

    const CATS_KEY = 'dsh.prompt-assistant.categories.v1'

    let extraCats = loadExtraCats()

    /** Derived chip list (real categories + empty ones), stable snapshot. */
    let chipsSnapshot = computeChips()

    function computeChips() {
      const real = categoriesOf(prompts)
      const chips = real.map(c => ({
        name: c,
        count: prompts.filter(p => p.category.trim() === c).length,
      }))
      for (const c of extraCats) if (!chips.some(x => x.name === c)) chips.push({ name: c, count: 0 })
      return chips
    }

    function getChipsSnapshot() {
      return chipsSnapshot
    }

    function loadExtraCats() {
      try {
        const raw = localStorage.getItem(CATS_KEY)
        const arr = raw === null ? [] : JSON.parse(raw)
        return Array.isArray(arr) ? arr.filter(c => typeof c === 'string' && c.trim() !== '') : []
      } catch (error) {
        console.error('[dsh-prompt-assistant] categories load failed', error)
        return []
      }
    }

    function persistExtraCats() {
      try {
        localStorage.setItem(CATS_KEY, JSON.stringify(extraCats))
      } catch (error) {
        console.error('[dsh-prompt-assistant] categories save failed', error)
      }
    }

    /** Add an empty category: rejected when blank or already known. */
    function addCategory(name) {
      const n = name.trim()
      if (n === '') return false
      const known = [...extraCats, ...categoriesOf(prompts)]
      if (known.includes(n)) return false
      extraCats = [...extraCats, n]
      persistExtraCats()
      emit()
      return true
    }

    /**
     * Delete a category entirely: prompts under it are removed too (real
     * categories cannot exist without prompts in the md format). Empty
     * categories just lose their entry. Returns the persistence promise.
     */
    function deleteCategory(name) {
      const hasPrompts = prompts.some(p => p.category.trim() === name)
      extraCats = extraCats.filter(c => c !== name)
      persistExtraCats()
      if (!hasPrompts) {
        emit()
        return null
      }
      return mutate(prompts.filter(p => p.category.trim() !== name))
    }

    function categoriesOf(list) {
      const seen = []
      for (const p of list) {
        const c = p.category.trim()
        if (c !== '' && !seen.includes(c)) seen.push(c)
      }
      return seen
    }

    // ── one-click copy ──────────────────────────────────────────────────────

    function copyText(text) {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
      }
      return new Promise((resolve, reject) => {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          resolve()
        } catch (error) {
          reject(error)
        } finally {
          ta.remove()
        }
      })
    }

    // ── shared bits ─────────────────────────────────────────────────────────

    const chomp = q => q.replace(/\s+/g, ' ').trim()
    const isTypingTarget = t =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement ||
      (typeof HTMLSelectElement !== 'undefined' && t instanceof HTMLSelectElement) ||
      (t && t.isContentEditable === true)

    function timeLabel(ts) {
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }

    // ── components ──────────────────────────────────────────────────────────

    /** Storage status: small colored dot + short text (full detail on hover). */
    const BADGETEXT = {
      loading: { dot: 'var(--dsw-alias-label-tertiary,#94a3b8)', text: '载入中', title: '正在读取数据…' },
      file: { dot: 'var(--dsw-alias-state-success-primary,#16a34a)', text: '已保存', title: '数据已同步到 ~/.dsh/dsh-prompt-assistant/prompts.md' },
      local: { dot: 'var(--dsw-alias-state-warn-primary,#d97706)', text: '本地缓存', title: '文件不可用，数据暂存在浏览器 localStorage' },
    }

    /** One prompt card: badge + title + actions + copyable content. */
    function PromptCard({ prompt, index, count, onCommit }) {
      const [copied, setCopied] = useState(false)
      const [armed, setArmed] = useState(false)
      const [editing, setEditing] = useState(false)
      const [expanded, setExpanded] = useState(false)
      const [category, setCategory] = useState(prompt.category)
      const [title, setTitle] = useState(prompt.title)
      const [content, setContent] = useState(prompt.content)

      const longEnough = chomp(prompt.content).length > 60 && prompt.content.split('\n').length > 3

      const copy = () => {
        copyText(prompt.content)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
            showToast('已复制「' + (prompt.title === '（无标题）' ? prompt.category : prompt.title) + '」')
          })
          .catch(error => console.error('[dsh-prompt-assistant] copy failed', error))
      }

      const deleteClick = () => {
        if (!armed) {
          setArmed(true)
          setTimeout(() => setArmed(false), 2500)
          return
        }
        onCommit(removePrompt(prompt.id), () => showToast('已删除'))
      }

      const saveEdit = () => {
        const trimmed = content.trim()
        if (trimmed === '') {
          showToast('内容不能为空')
          return
        }
        const next = {
          ...prompt,
          category: category.trim(),
          title: title.trim() || '（无标题）',
          content: trimmed,
          updatedAt: Date.now(),
        }
        onCommit(upsertPrompt(next), () => {
          showToast('已保存')
          setEditing(false)
        })
      }

      // ── edit mode: the card becomes the form ──
      if (editing) {
        return createElement(
          'div',
          {
            className: 'dsh-pa-card',
            style: {
              background: T.card, border: `1.5px solid ${T.brand}`, borderRadius: `${T.radius}px`,
              padding: '12px 14px', marginBottom: '10px',
            },
          },
          createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
            createElement('input', {
              className: 'dsh-pa-field', list: 'dsh-pa-categories',
              placeholder: '分类',
              value: category, onChange: e => setCategory(e.target.value),
              style: { ...fieldBase, flex: '0 1 40%' },
            }),
            createElement('input', {
              className: 'dsh-pa-field', placeholder: '标题',
              value: title, onChange: e => setTitle(e.target.value),
              style: { ...fieldBase, flex: '1 1 auto' },
            }),
          ),
          createElement('textarea', {
            className: 'dsh-pa-field',
            placeholder: '提示词内容',
            value: content, onChange: e => setContent(e.target.value),
            onKeyDown: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveEdit() },
            rows: 5,
            style: { ...fieldBase, resize: 'vertical', marginBottom: '10px' },
          }),
          createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            createElement('button', {
              className: 'dsh-pa-btn primary',
              onClick: saveEdit,
              style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '7px 16px' },
            }, '保存修改'),
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: () => setEditing(false),
              style: { ...btnBase, background: 'var(--dsw-alias-bg-layer-2,#f1f5f9)', color: T.text },
            }, '取消'),
            createElement('span', { className: 'dsh-pa-note', style: { marginLeft: 'auto' } }, 'Ctrl+Enter 保存'),
          ),
        )
      }

      // ── view mode ──
      return createElement(
        'div',
        {
          className: 'dsh-pa-card',
          style: {
            background: T.card, border: `1px solid ${T.border}`, borderRadius: `${T.radius}px`,
            padding: '12px 14px', marginBottom: '10px',
            boxShadow: '0 1px 2px rgba(15,23,42,.04)',
          },
        },
        createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
          createElement(
            'span',
            {
              style: {
                fontSize: '11px', color: 'var(--dsw-alias-brand-primary,#1d4ed8)',
                background: 'var(--dsw-alias-interactive-bg-hover,#eff6ff)',
                borderRadius: '999px', padding: '2px 8px', flex: '0 0 auto',
              },
            },
            prompt.category,
          ),
          createElement(
            'span',
            {
              className: 'dsh-pa-copy',
              title: '点击复制内容',
              onClick: copy,
              style: {
                fontWeight: 600, fontSize: '13.5px', color: T.text, flex: '1 1 auto',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: 'copy', transition: 'color .12s',
              },
            },
            prompt.title,
          ),
          createElement('button', {
            className: 'dsh-pa-btn ghost',
            disabled: index === 0,
            onClick: () => onCommit(movePrompt(prompt.id, -1)),
            title: '上移（保存到文件）',
            style: { ...btnBase, background: 'transparent', color: index === 0 ? T.dim : T.muted, padding: '4px 6px', opacity: index === 0 ? 0.4 : 1, cursor: index === 0 ? 'default' : 'pointer' },
          }, '↑'),
          createElement('button', {
            className: 'dsh-pa-btn ghost',
            disabled: index === count - 1,
            onClick: () => onCommit(movePrompt(prompt.id, 1)),
            title: '下移（保存到文件）',
            style: { ...btnBase, background: 'transparent', color: index === count - 1 ? T.dim : T.muted, padding: '4px 6px', opacity: index === count - 1 ? 0.4 : 1, cursor: index === count - 1 ? 'default' : 'pointer' },
          }, '↓'),
          createElement('button', {
            className: 'dsh-pa-btn primary',
            onClick: copy,
            style: { ...btnBase, background: copied ? T.ok : T.btnFill, color: '#fff', padding: '5px 12px' },
          }, copied ? '✓ 已复制' : '复制'),
          createElement('button', {
            className: 'dsh-pa-btn ghost',
            onClick: () => setEditing(true),
            style: { ...btnBase, background: 'var(--dsw-alias-bg-layer-2,#f1f5f9)', color: T.text, padding: '5px 12px' },
          }, '编辑'),
          createElement('button', {
            className: 'dsh-pa-btn danger',
            onClick: deleteClick,
            style: {
              ...btnBase,
              background: armed ? T.danger : 'transparent',
              color: armed ? '#fff' : 'var(--dsw-alias-state-error-primary,#dc2626)',
              padding: '5px 12px',
            },
          }, armed ? '确认删除？' : '删除'),
        ),
        createElement(
          'pre',
          {
            className: 'dsh-pa-copy',
            title: '点击复制全部内容',
            onClick: copy,
            style: {
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: '12.5px', color: 'var(--dsw-alias-label-secondary,#334155)', lineHeight: 1.6,
              maxHeight: expanded ? 'none' : '72px', overflow: expanded ? 'visible' : 'hidden',
              cursor: 'copy', fontFamily: T.font, transition: 'color .12s',
            },
          },
          prompt.content,
        ),
        longEnough &&
          createElement(
            'button',
            {
              className: 'dsh-pa-btn ghost',
              onClick: () => setExpanded(!expanded),
              style: { ...btnBase, background: 'transparent', color: T.faint, padding: '2px 4px', marginTop: '4px', fontSize: '11.5px' },
            },
            expanded ? '收起 ▲' : '展开全文 ▼',
          ),
      )
    }

    // ── modals (own React roots on document.body) ──────────────────────────

    let modalEl = null
    let modalRoot = null

    /** Open one modal at a time; render the given element factory. */
    function openModal(render) {
      if (modalEl !== null) return
      modalEl = document.createElement('div')
      document.body.appendChild(modalEl)
      modalRoot = createRoot(modalEl)
      const close = () => {
        modalRoot.unmount()
        modalEl.remove()
        modalEl = null
        modalRoot = null
      }
      modalRoot.render(render(close))
    }

    /** Open the "new prompt" dialog (optionally with a preset category). */
    function openPromptModal(categories, initialCategory) {
      openModal(close =>
        createElement(AddPromptModal, { categories, initialCategory: initialCategory ?? '', onClose: close }))
    }

    /** Open the full category management dialog. */
    function openCategoryManageModal() {
      openModal(close => createElement(CategoryManageModal, { onClose: close }))
    }

    /** Modal dialog: category / title / content fields, save or cancel. */
    function AddPromptModal({ categories, initialCategory, onClose }) {
      const [cat, setCat] = useState(initialCategory)
      const [title, setTitle] = useState('')
      const [body, setBody] = useState('')
      const [error, setError] = useState('')

      useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])

      const submit = () => {
        const trimmed = body.trim()
        if (trimmed === '') {
          setError('内容不能为空')
          return
        }
        const promise = upsertPrompt({
          id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          category: cat.trim(),
          title: title.trim() || '（无标题）',
          content: trimmed,
          updatedAt: Date.now(),
        })
        if (promise !== null) {
          promise.then(() => showToast('已添加并保存')).catch(() => {})
        } else {
          showToast('已添加（本地缓存）')
        }
        onClose()
      }

      return createElement(
        'div',
        {
          onClick: e => { if (e.target === e.currentTarget) onClose() },
          style: {
            position: 'fixed', inset: 0, zIndex: 2147483002,
            background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', fontFamily: T.font,
          },
        },
        createElement(
          'div',
          {
            className: 'dsh-pa-card',
            style: {
              width: 'min(520px, 100%)', background: T.card2,
              border: `1px solid ${T.border}`, borderRadius: '12px',
              boxShadow: 'var(--dsw-shadow-lv3,0 16px 48px rgba(15,23,42,.28))',
              padding: '20px', color: T.text,
            },
          },
          createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } },
            createElement('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 650 } }, '新建提示词'),
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: onClose,
              title: '关闭（Esc）',
              style: { ...btnBase, background: 'transparent', color: T.faint, padding: '2px 8px', fontSize: '16px', lineHeight: 1 },
            }, '×'),
          ),
          createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
            createElement('input', {
              className: 'dsh-pa-field', list: 'dsh-pa-categories',
              placeholder: '分类（可选）',
              value: cat, onChange: e => setCat(e.target.value),
              style: { ...fieldBase, flex: '0 1 40%' },
            }),
            createElement('input', {
              className: 'dsh-pa-field', placeholder: '标题（可选）',
              value: title, onChange: e => setTitle(e.target.value),
              onKeyDown: e => { if (e.key === 'Enter') submit() },
              style: { ...fieldBase, flex: '1 1 auto' },
            }),
          ),
          createElement('textarea', {
            className: 'dsh-pa-field',
            placeholder: '提示词内容（粘贴你的 prompt）',
            value: body, onChange: e => setBody(e.target.value),
            onKeyDown: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit() },
            rows: 6, autoFocus: true,
            style: { ...fieldBase, resize: 'vertical', marginBottom: '12px', maxHeight: '40vh' },
          }),
          createElement(
            'div',
            { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            error !== '' && createElement('span', { style: { color: T.danger, fontSize: '12px' } }, error),
            createElement('span', { className: 'dsh-pa-note', style: { marginLeft: 'auto' } }, 'Ctrl+Enter 保存 · Esc 关闭'),
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: onClose,
              style: { ...btnBase, background: 'var(--dsw-alias-bg-layer-2,#f1f5f9)', color: T.text, padding: '7px 16px' },
            }, '取消'),
            createElement('button', {
              className: 'dsh-pa-btn primary',
              onClick: submit,
              style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '7px 20px' },
            }, '保存'),
          ),
        ),
      )
    }

    /** Modal dialog: confirm restoring the built-in default prompts. */
    function ResetConfirmModal({ count, onClose, onConfirm }) {
      useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])

      const confirm = () => {
        onConfirm()
        onClose()
      }

      return createElement(
        'div',
        {
          onClick: e => { if (e.target === e.currentTarget) onClose() },
          style: {
            position: 'fixed', inset: 0, zIndex: 2147483002,
            background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', fontFamily: T.font,
          },
        },
        createElement(
          'div',
          {
            className: 'dsh-pa-card',
            style: {
              width: 'min(440px, 100%)', background: T.card2,
              border: `1px solid ${T.border}`, borderRadius: '12px',
              boxShadow: 'var(--dsw-shadow-lv3,0 16px 48px rgba(15,23,42,.28))',
              padding: '20px', color: T.text,
            },
          },
          createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } },
            createElement('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 650 } }, '恢复默认值'),
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: onClose,
              title: '关闭（Esc）',
              style: { ...btnBase, background: 'transparent', color: T.faint, padding: '2px 8px', fontSize: '16px', lineHeight: 1 },
            }, '×'),
          ),
          createElement('p', { style: { margin: '0 0 12px', fontSize: '13px', lineHeight: 1.7, color: T.text } },
            '将把提示词库还原为插件内置的默认内容，当前的 ', count, ' 条提示词会被覆盖。'),
          createElement('p', { className: 'dsh-pa-note', style: { margin: '0 0 16px', fontSize: '12px', lineHeight: 1.7 } },
            '恢复前会自动把当前数据备份为 prompts.backup-*.md（位于用户目录），可放心操作。'),
          createElement(
            'div',
            { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: onClose,
              style: { ...btnBase, background: 'var(--dsw-alias-bg-layer-2,#f1f5f9)', color: T.text, padding: '7px 16px' },
            }, '取消'),
            createElement('button', {
              className: 'dsh-pa-btn danger',
              onClick: confirm,
              autoFocus: true,
              style: { ...btnBase, background: T.danger, color: '#fff', padding: '7px 20px' },
            }, '确认恢复'),
          ),
        ),
      )
    }

    /** One category row inside the manage modal: rename inline / delete (two-step). */
    function CategoryRow({ name, count, armed, onDelete, onRename }) {
      const [editing, setEditing] = useState(false)
      const [draft, setDraft] = useState(name)

      const startEdit = () => { setDraft(name); setEditing(true) }
      const commitRename = () => {
        setEditing(false)
        if (draft.trim() !== '' && draft.trim() !== name) onRename(name, draft.trim())
      }

      if (editing) {
        return createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 4px' } },
          createElement('input', {
            className: 'dsh-pa-field',
            autoFocus: true,
            value: draft,
            onChange: e => setDraft(e.target.value),
            onBlur: commitRename,
            onKeyDown: e => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') setEditing(false)
            },
            style: { ...fieldBase, flex: '1 1 auto' },
          }),
          createElement('button', {
            className: 'dsh-pa-btn primary',
            onClick: commitRename,
            style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '5px 12px' },
          }, '确定'),
        )
      }

      return createElement(
        'div',
        {
          style: {
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', border: `1px solid ${T.borderSoft}`, borderRadius: '8px',
            marginBottom: '6px', background: 'var(--dsw-alias-bg-layer-1,#ffffff)',
          },
        },
        createElement('span', { style: { fontWeight: 600, fontSize: '13px', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
        createElement('span', {
          title: '点击重命名',
          style: { fontSize: '11px', color: T.faint, cursor: 'pointer', flex: '0 0 auto' },
          onClick: startEdit,
        }, `${count} 条 · ✎`),
        createElement('button', {
          className: 'dsh-pa-btn danger',
          onClick: () => onDelete(name, count),
          style: {
            ...btnBase, flex: '0 0 auto',
            background: armed ? T.danger : 'transparent',
            color: armed ? '#fff' : 'var(--dsw-alias-state-error-primary,#dc2626)',
            padding: '5px 10px',
          },
        }, armed ? `确认删除${count > 0 ? `（含 ${count} 条提示词）` : ''}？` : '删除'),
      )
    }

    /** Category management modal: add / rename / delete current categories. */
    function CategoryManageModal({ onClose }) {
      const chips = useSyncExternalStore(subscribe, getChipsSnapshot)
      const [name, setName] = useState('')
      const [error, setError] = useState('')
      const [armed, setArmed] = useState(null)

      useEffect(() => {
        const onKey = e => {
          if (e.key === 'Escape') {
            if (armed !== null) setArmed(null)
            else onClose()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [armed])

      const add = () => {
        const added = addCategory(name)
        if (!added) {
          setError(name.trim() === '' ? '分类名不能为空' : `分类「${name.trim()}」已存在`)
          return
        }
        setName('')
        setError('')
        showToast(`分类「${name.trim()}」已添加`)
      }

      const del = (c, count) => {
        if (armed !== c) {
          setArmed(c)
          setTimeout(() => setArmed(x => (x === c ? null : x)), 2500)
          return
        }
        setArmed(null)
        const promise = deleteCategory(c)
        if (promise !== null) {
          promise.then(() => showToast(`已删除分类「${c}」及 ${count} 条提示词`)).catch(() => {})
        } else {
          showToast(`空分类「${c}」已删除`)
        }
      }

      const rename = (oldName, newName) => {
        const promise = renameCategory(oldName, newName)
        if (promise !== null) {
          promise.then(() => showToast(`分类「${oldName}」已重命名为「${newName}」`)).catch(() => {})
        } else {
          showToast('分类已重命名')
        }
      }

      return createElement(
        'div',
        {
          onClick: e => { if (e.target === e.currentTarget) onClose() },
          style: {
            position: 'fixed', inset: 0, zIndex: 2147483002,
            background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', fontFamily: T.font,
          },
        },
        createElement(
          'div',
          {
            className: 'dsh-pa-card',
            style: {
              width: 'min(460px, 100%)', maxHeight: '70vh', overflow: 'auto',
              background: T.card2,
              border: `1px solid ${T.border}`, borderRadius: '12px',
              boxShadow: 'var(--dsw-shadow-lv3,0 16px 48px rgba(15,23,42,.28))',
              padding: '20px', color: T.text,
            },
          },
          createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' } },
            createElement('h3', { style: { margin: 0, fontSize: '15px', fontWeight: 650 } }, '分类管理'),
            createElement('button', {
              className: 'dsh-pa-btn ghost',
              onClick: onClose,
              title: '关闭（Esc）',
              style: { ...btnBase, background: 'transparent', color: T.faint, padding: '2px 8px', fontSize: '16px', lineHeight: 1 },
            }, '×'),
          ),
          // add row
          createElement(
            'div',
            { style: { display: 'flex', gap: '8px', marginBottom: '14px' } },
            createElement('input', {
              className: 'dsh-pa-field',
              placeholder: '新分类名称（如：产品需求）',
              value: name,
              onChange: e => { setName(e.target.value); setError('') },
              onKeyDown: e => { if (e.key === 'Enter') add() },
              style: { ...fieldBase, flex: '1 1 auto' },
            }),
            createElement('button', {
              className: 'dsh-pa-btn primary',
              onClick: add,
              style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '7px 16px' },
            }, '添加'),
          ),
          error !== '' && createElement('p', { style: { color: T.danger, fontSize: '12px', margin: '-8px 0 12px' } }, error),
          // list
          chips.length === 0
            ? createElement('p', { style: { color: T.faint, fontSize: '13px', margin: '8px 0' } },
                '还没有分类，先在上面添加一个吧。')
            : createElement(
                'div',
                null,
                ...chips.map(({ name: c, count }) =>
                  createElement(CategoryRow, {
                    key: c,
                    name: c,
                    count,
                    armed: armed === c,
                    onDelete: del,
                    onRename: rename,
                  }),
                ),
              ),
          createElement('p', { className: 'dsh-pa-note', style: { margin: '14px 0 0' } },
            '删除非空分类会连同其中的提示词一并删除 · 点击「N 条 · ✎」可重命名'),
        ),
      )
    }
    /**
     * Quick-access popover on the conversation input toolbar
     * (conversation.input.left — the slot dsh-sticky-note uses): open the
     * prompt library right under the input box, search, and put a prompt
     * into the composer draft with one click. The settings-page manager
     * stays the management surface.
     */
    function PromptQuickAccess({ inputActions, useInput }) {
      const list = useSyncExternalStore(subscribe, getSnapshot)
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [cat, setCat] = useState('全部')
      const boxRef = useRef(null)
      const inputDraft = useInput ? useInput(s => (s && s.draft) || '') : ''

      // Esc closes; clicking anywhere outside closes too.
      useEffect(() => {
        if (!open) return
        const onKey = e => { if (e.key === 'Escape') setOpen(false) }
        const onDown = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
        window.addEventListener('keydown', onKey)
        window.addEventListener('mousedown', onDown)
        return () => {
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('mousedown', onDown)
        }
      }, [open])

      // Append the prompt to the composer draft, keeping what's already there.
      const usePrompt = p => {
        if (!inputActions) { showToast('无法写入输入框'); return }
        const cur = (inputDraft || '').trim()
        inputActions.setDraft(cur ? cur + '\n\n' + p.content.trim() : p.content.trim())
        setOpen(false)
        showToast(`已放入输入框：「${p.title}」`)
      }

      const copyPrompt = (p, e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(p.content)
          .then(() => showToast(`已复制「${p.title}」`))
          .catch(() => showToast('复制失败'))
      }

      // Category pills, derived from the list in document order.
      const catCounts = new Map()
      for (const p of list) {
        const c = p.category.trim() === '' ? '未分类' : p.category.trim()
        catCounts.set(c, (catCounts.get(c) || 0) + 1)
      }
      const catNames = ['全部', ...catCounts.keys()]

      const q = query.trim().toLowerCase()
      const filtered = list.filter(p => {
        const c = p.category.trim() === '' ? '未分类' : p.category.trim()
        if (cat !== '全部' && c !== cat) return false
        if (q === '') return true
        return chomp(p.title).toLowerCase().includes(q) || chomp(p.content).toLowerCase().includes(q)
      })

      return createElement(
        'div',
        { style: { position: 'relative' } },
        createElement('button', {
          className: 'dsh-pa-btn ghost',
          onClick: () => setOpen(v => !v),
          title: '提示词库：搜索、按分类筛选并放入输入框（Esc 关闭）',
          'aria-label': '打开提示词库',
          style: {
            ...btnBase, background: open ? T.hover : 'transparent',
            color: T.muted, padding: '5px 9px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          },
        },
          createElement('span', { style: { fontSize: '14px', lineHeight: 1 } }, '📋'),
        ),
        open && createElement(
          'div',
          {
            ref: boxRef,
            className: 'dsh-pa-card',
            style: {
              position: 'absolute', left: 0, bottom: 'calc(100% + 8px)',
              width: 'min(430px, 86vw)', maxHeight: 'min(60vh, 520px)',
              display: 'flex', flexDirection: 'column',
              background: T.card2, border: `1px solid ${T.border}`, borderRadius: '12px',
              boxShadow: 'var(--dsw-shadow-lv3,0 16px 48px rgba(15,23,42,.28))',
              zIndex: 2147483000, overflow: 'hidden', fontFamily: T.font,
            },
          },
          createElement(
            'div',
            { style: { padding: '10px 12px 8px', borderBottom: `1px solid ${T.borderSoft}` } },
            createElement('input', {
              className: 'dsh-pa-field', autoFocus: true,
              placeholder: `🔍 搜索提示词…（共 ${list.length} 条）`,
              value: query, onChange: e => setQuery(e.target.value),
              style: { ...fieldBase, background: T.page },
            }),
            // category filter pills: click to view one category
            createElement(
              'div',
              { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' } },
              ...catNames.map(c => createElement('button', {
                key: c,
                className: 'dsh-pa-chip',
                onClick: () => setCat(c),
                title: c === '全部' ? '显示所有分类' : `只看「${c}」`,
                style: {
                  ...btnBase, fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                  background: cat === c ? T.btnFill : T.page,
                  color: cat === c ? '#fff' : T.muted,
                  border: `1px solid ${cat === c ? T.btnFill : T.border}`,
                  cursor: 'pointer',
                },
              }, `${c} ${catCounts.get(c) ?? list.length}`)),
            ),
          ),
          filtered.length === 0
            ? createElement(
                'div',
                { style: { padding: '28px 16px', textAlign: 'center', color: T.faint, fontSize: '12.5px' } },
                list.length === 0 ? '还没有提示词，去 设置 → 提示词 新建一条' : '没有匹配的提示词',
              )
            : createElement(
                'div',
                { style: { overflowY: 'auto', padding: '4px' } },
                ...filtered.map(p => createElement(
                  'div',
                  {
                    key: p.id,
                    className: 'dsh-pa-qitem',
                    onClick: () => usePrompt(p),
                    title: '点击放入输入框',
                    style: {
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                    },
                  },
                  createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
                    createElement('div', { style: { fontSize: '12.5px', fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.title),
                    createElement('div', { style: { fontSize: '11px', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, chomp(p.content)),
                  ),
                  p.category.trim() !== '' && createElement('span', { style: { flex: 'none', fontSize: '10.5px', color: T.faint, background: T.hover, borderRadius: '999px', padding: '2px 8px' } }, p.category.trim()),
                  createElement('button', {
                    className: 'dsh-pa-btn ghost',
                    onClick: e => copyPrompt(p, e),
                    title: '复制到剪贴板',
                    style: { ...btnBase, flex: 'none', background: 'transparent', color: T.faint, padding: '3px 7px', fontSize: '12px' },
                  }, '⧉'),
                )),
              ),
          createElement(
            'div',
            { style: { padding: '6px 12px', borderTop: `1px solid ${T.borderSoft}`, display: 'flex', justifyContent: 'space-between' } },
            createElement('span', { className: 'dsh-pa-note' }, '点击条目放入输入框，⧉ 复制'),
            createElement('span', { className: 'dsh-pa-note', style: { cursor: 'pointer' }, onClick: () => setOpen(false) }, 'Esc 关闭'),
          ),
        ),
      )
    }

    function PromptSection() {
      const list = useSyncExternalStore(subscribe, getSnapshot)
      const status = useSyncExternalStore(subscribe, getSourceSnapshot)
      const chips = useSyncExternalStore(subscribe, getChipsSnapshot)
      const [search, setSearch] = useState('')
      const [filter, setFilter] = useState('全部')
      const [saving, setSaving] = useState(false)
      const [savedAt, setSavedAt] = useState(null)
      // refs for keyboard shortcuts
      const searchRef = useRef(null)

      const unionCats = chips.map(x => x.name)
      const totalChars = list.reduce((n, p) => n + p.content.length, 0)
      const query = chomp(search).toLowerCase()
      const filtered = query === ''
        ? list
        : list.filter(p => chomp(p.title).toLowerCase().includes(query) || chomp(p.content).toLowerCase().includes(query))

      /**
       * Run one mutation through the store, drive saving/saved indicators,
       * and fire the success toast/closure after persistence.
       */
      const commit = (promise, onDone) => {
        if (promise === null) { if (onDone) onDone(); return }
        setSaving(true)
        promise.then(() => {
          setSaving(false)
          setSavedAt(Date.now())
          if (onDone) onDone()
        }).catch(() => setSaving(false))
      }

      // Restore defaults: an explicit confirm modal, then ask the host to
      // restore the user data file from the package seed (the host backs up
      // the current file before overwriting).
      const doReset = () => {
        fetch(RESET_URL, { method: 'POST' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json()
          })
          .then(data => {
            if (!data.ok) throw new Error(data.error || 'bad response')
            setStore(data.prompts, 'file')
            setSavedAt(Date.now())
            showToast('已恢复默认内容（原数据已备份）')
          })
          .catch(error => {
            console.error('[dsh-prompt-assistant] reset failed', error)
            showToast('恢复失败：文件接口不可用')
          })
      }
      const openResetConfirm = () => {
        openModal(close =>
          createElement(ResetConfirmModal, {
            count: list.length,
            onClose: close,
            onConfirm: doReset,
          }))
      }

      // Keyboard: `/` focuses search (when not typing elsewhere), Esc clears.
      useEffect(() => {
        const onKey = e => {
          if (e.key === '/' && !isTypingTarget(e.target)) {
            e.preventDefault()
            searchRef.current?.focus()
          } else if (e.key === 'Escape' && !isTypingTarget(e.target)) {
            if (search !== '') setSearch('')
            searchRef.current?.blur()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [search])

      // Group (after search) by category, keeping document order.
      const groups = new Map()
      for (const p of filtered) {
        const key = p.category.trim() === '' ? '未分类' : p.category.trim()
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(p)
      }
      const groupKeys = [...groups.keys()]
      const shownKeys = filter === '全部' ? groupKeys : groupKeys.filter(k => k === filter)

      const badge = BADGETEXT[status] ?? BADGETEXT.loading

      return createElement(
        'div',
        { style: { padding: '24px', maxWidth: '680px', fontFamily: T.font, color: T.text } },

        // ── header ──
        createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' } },
          createElement('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 650 } }, '提示词助手'),
          createElement(
            'span',
            {
              title: badge.title,
              style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: T.muted, whiteSpace: 'nowrap', cursor: 'help' },
            },
            createElement('span', {
              style: {
                width: '8px', height: '8px', borderRadius: '50%', background: badge.dot,
                boxShadow: status === 'file' ? '0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary,#16a34a) 14%, transparent)' : 'none',
              },
            }),
            badge.text,
          ),
        ),
        createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '12px', color: T.muted } },
          createElement('span', null,
            `共 ${list.length} 条 · ${chips.length} 个分类 · ${totalChars.toLocaleString()} 字` +
            (query !== '' ? ` ｜ 匹配 ${filtered.length} 条` : '')),
          createElement('span', { style: { color: T.faint, fontSize: '11px' } },
            saving ? '⏳ 正在保存到 prompts.md…' : savedAt !== null ? `已保存 ${timeLabel(savedAt)}` : ''),
        ),

        // ── search ──
        createElement('input', {
          ref: searchRef,
          className: 'dsh-pa-field',
          placeholder: '🔍 搜索标题或内容…（按 / 聚焦 · Esc 清空）',
          value: search,
          onChange: e => setSearch(e.target.value),
          style: { ...fieldBase, marginBottom: '12px', background: T.page },
        }),

        // ── toolbar: new prompt / category manage ──
        createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' } },
          createElement('button', {
            className: 'dsh-pa-btn primary',
            onClick: () => openPromptModal(unionCats),
            style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '7px 14px' },
          }, '＋ 新建提示词'),
          createElement('button', {
            className: 'dsh-pa-btn ghost',
            onClick: () => openCategoryManageModal(),
            title: '新增 / 重命名 / 删除分类',
            style: { ...btnBase, background: 'transparent', color: T.muted },
          }, '✎ 分类管理'),
          createElement('button', {
            className: 'dsh-pa-btn danger',
            onClick: openResetConfirm,
            title: '一键还原为插件内置的默认提示词。恢复前会先把当前数据备份为 prompts.backup-*.md。',
            style: {
              ...btnBase, marginLeft: 'auto',
              background: 'transparent',
              color: 'var(--dsw-alias-state-error-primary,#dc2626)',
              border: '1px solid var(--dsw-alias-state-error-primary,#dc2626)',
              padding: '7px 14px',
            },
          }, '恢复默认值'),
        ),

        // category suggestions shared by the modal and the in-card edit form
        createElement('datalist', { id: 'dsh-pa-categories' },
          ...unionCats.map(c => createElement('option', { key: c, value: c }))),

        // ── category chips (filter pills; dashed = empty category) ──
        createElement(
          'div',
          { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' } },
          createElement(Chip, {
            active: filter === '全部',
            label: '全部',
            count: list.length,
            onClick: () => setFilter('全部'),
          }),
          ...chips.map(({ name: c, count }) => {
            const empty = count === 0
            return createElement(Chip, {
              key: c,
              active: filter === c,
              label: c,
              count,
              empty,
              onClick: () => {
                if (empty) {
                  // Clicking an empty category starts a prompt for it.
                  openPromptModal(unionCats, c)
                } else {
                  setFilter(c)
                }
              },
            })
          }),
          createElement('span', { className: 'dsh-pa-note', style: { marginLeft: 'auto' } },
            '数据存于用户目录 ~/.dsh/dsh-prompt-assistant/prompts.md'),
        ),

        // ── grouped list ──
        list.length === 0
          ? createElement(
              'div',
              {
                style: {
                  border: `1.5px dashed ${T.border}`, borderRadius: `${T.radius}px`,
                  padding: '40px 16px', textAlign: 'center', color: T.faint,
                  fontFamily: T.font, fontSize: '13px',
                },
              },
              createElement('p', { style: { margin: '0 0 12px' } }, '还没有提示词，先新建一条吧 ✍️'),
              createElement('button', {
                className: 'dsh-pa-btn primary',
                onClick: () => openPromptModal(unionCats),
                style: { ...btnBase, background: T.btnFill, color: '#fff', padding: '8px 18px' },
              }, '＋ 新建提示词'),
            )
          : shownKeys.length === 0
            ? (filter !== '全部' && !chips.some(x => x.name === filter))
              ? createElement(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '8px', color: T.faint, fontSize: '13px', margin: '8px 0' } },
                  createElement('span', null, `分类「${filter}」已被删除或为空。`),
                  createElement('button', {
                    className: 'dsh-pa-btn ghost',
                    onClick: () => setFilter('全部'),
                    style: { ...btnBase, background: 'transparent', color: T.muted, padding: '4px 10px' },
                  }, '显示全部'),
                )
              : createElement('p', { style: { color: T.faint, fontSize: '13px', margin: '8px 0' } },
                  '没有匹配「' + search + '」的提示词。')
            : shownKeys.map(key => {
                const items = groups.get(key)
                return createElement(
                  'div',
                  { key, style: { marginBottom: '12px' } },
                  createElement(
                    'h3',
                    { style: { margin: '0 0 8px', fontSize: '12.5px', color: T.muted, fontWeight: 600 } },
                    `▍${key} · ${items.length}`,
                  ),
                  ...items.map((p, index) =>
                    createElement(PromptCard, {
                      key: p.id,
                      prompt: p,
                      index,
                      count: items.length,
                      onCommit: commit,
                    }),
                  ),
                )
              }),

        // (restore-defaults button now lives in the top toolbar)
      )
    }

    /** One category chip (filter pill; `empty` renders dashed + 0). */
    function Chip({ active, label, count, empty, onClick }) {
      return createElement('button', {
        className: 'dsh-pa-chip',
        onClick,
        title: empty ? '空分类：点击直接为该分类新建提示词' : undefined,
        style: {
          ...btnBase, fontSize: '12px',
          background: active ? T.btnFill : 'var(--dsw-alias-bg-layer-1,#ffffff)',
          color: active ? '#fff' : empty ? T.faint : T.muted,
          border: `1px ${empty ? 'dashed' : 'solid'} ${active ? T.btnFill : empty ? T.border : T.border}`,
          padding: '5px 12px',
        },
      }, `${label} ${count}`)
    }

    // ── plugin apply ───────────────────────────────────────────────────────

    let claimed = false

    function apply(ctx) {
      if (claimed) return
      claimed = true
      ctx.effect(() => { claimed = false }, 'prompt-assistant: apply claim')

      try {
        injectCss()

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register({
            name: 'settings.section',
            id: 'prompt-assistant',
            order: 210,
            label: '提示词',
          }, PromptSection),
        )

        // Chat composer quick access: button on the input toolbar (same slot
        // as dsh-sticky-note) opening the prompt library under the input box;
        // one click appends a prompt to the draft.
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register({
            name: 'conversation.input.left',
            id: 'prompt-assistant',
            order: 30,
          }, (zoneProps) => createElement(PromptQuickAccess, {
            inputActions: (zoneProps && zoneProps.inputActions) || null,
            useInput: (zoneProps && zoneProps.useInput) || null,
          })),
        )

        initStore()

        // Cross-tab sync: another tab changed data — refetch the file.
        const onStorage = e => {
          if (e.key === CATS_KEY) {
            extraCats = loadExtraCats()
            emit()
            return
          }
          fetchFromFile()
            .then(list => setStore(list, 'file'))
            .catch(() => {})
        }
        window.addEventListener('storage', onStorage)
        ctx.effect(() => window.removeEventListener('storage', onStorage), 'prompt-assistant: storage sync')
      } catch (error) {
        console.error('[dsh-prompt-assistant] apply failed', error)
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})