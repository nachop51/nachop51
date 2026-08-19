import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView, NodeView } from '@tiptap/pm/view'
import { languageDisplayName, loadLanguageList, type LanguageInfo } from '../lib/shiki'

/**
 * The fence, drawn.
 *
 * A stock TipTap code block is an anonymous grey box: nothing says it is a
 * fence, and the info string — the one thing that decides how it renders — is
 * invisible and unreachable without editing the markdown by hand. This node
 * view draws the ``` lines the file actually carries and turns the info string
 * into a field you type in, completing over the languages Shiki can load, the
 * way Obsidian does. Also like Obsidian, the lines only show on the block the
 * cursor is in: everywhere else a block is just its code, exactly as the site
 * renders it.
 *
 * None of that chrome is document content. It lives outside `contentDOM`, so
 * it never reaches the markdown, the clipboard or the site; the only thing
 * that leaves here is the `language` attribute.
 */

const CODE_BLOCK = 'codeBlock'

const TICKS = '```'

/** Shown when a block has no language, and the field's width when empty. */
const LANGUAGE_PLACEHOLDER = 'lang'

/** CodeBlock's `languageClassPrefix` option, which we leave at its default. */
const LANGUAGE_CLASS_PREFIX = 'language-'

// Prose checkers have nothing useful to say about `os.WriteFile` or `const fd`,
// and the squiggles make code unreadable. Both attributes are inherited by the
// subtree, so putting them on <pre>/<code> exempts exactly the code.
// `data-gramm` is Grammarly's opt-out; `spellcheck` covers the browser's own.
export const NO_PROSE_CHECKING = {
  spellcheck: 'false',
  'data-gramm': 'false',
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

/** Lower is a better match; Infinity is no match at all. */
function rank(language: LanguageInfo, query: string): number {
  const name = language.name.toLowerCase()

  if (language.id === query) return 0
  if (language.aliases.includes(query)) return 1
  if (language.id.startsWith(query)) return 2
  if (language.aliases.some((alias) => alias.startsWith(query))) return 3
  if (name.startsWith(query)) return 4
  if (language.id.includes(query) || name.includes(query)) return 5

  return Infinity
}

function searchLanguages(languages: LanguageInfo[], query: string): LanguageInfo[] {
  return languages
    .map((language) => ({ language, score: rank(language, query) }))
    .filter((match) => match.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.language.id.localeCompare(b.language.id))
    .map((match) => match.language)
}

/** The code block holding the cursor, if the cursor is in one. */
function focusedCodeBlock(state: EditorState): number | null {
  const { selection } = state

  if (selection instanceof NodeSelection) {
    return selection.node.type.name === CODE_BLOCK ? selection.from : null
  }

  const { $from } = selection

  return $from.parent.type.name === CODE_BLOCK ? $from.before() : null
}

class CodeFenceView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private node: ProseMirrorNode
  private view: EditorView
  private getPos: () => number | undefined

  private code: HTMLElement
  private open: HTMLElement
  private close: HTMLElement
  private field: HTMLInputElement
  private label: HTMLElement
  private list: HTMLElement

  private languages: LanguageInfo[] = []
  private matches: LanguageInfo[] = []
  /** Index into `matches`, or -1 for "nothing picked yet". */
  private active = -1

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.field = element('input', 'code-fence-lang')
    this.field.type = 'text'
    this.field.placeholder = LANGUAGE_PLACEHOLDER
    this.field.spellcheck = false
    this.field.autocomplete = 'off'
    this.field.setAttribute('aria-label', 'Code language')

    this.list = element('div', 'code-fence-suggest')
    this.list.hidden = true

    // The field and its menu share a positioning context, so the menu hangs
    // off the language wherever the language happens to be.
    const field = element('span', 'code-fence-field')
    field.append(this.field, this.list)

    this.label = element('span', 'code-fence-name')

    this.open = element('div', 'code-fence-line')
    this.open.contentEditable = 'false'
    this.open.append(element('span', 'code-fence-ticks', TICKS), field, this.label)

    this.close = element('div', 'code-fence-line')
    this.close.contentEditable = 'false'
    this.close.append(element('span', 'code-fence-ticks', TICKS))

    this.code = element('code')
    const pre = element('pre')
    pre.append(this.code)
    for (const [name, value] of Object.entries(NO_PROSE_CHECKING)) pre.setAttribute(name, value)
    this.contentDOM = this.code

    this.dom = element('div', 'code-fence')
    this.dom.append(this.open, pre, this.close)

    // Clicking a fence line puts you on it, the way clicking a line of text
    // does — the ticks themselves are the affordance for the language.
    this.open.addEventListener('mousedown', (event) => {
      // Before the focus swap, not after: this mousedown blurs the editor, and
      // if the line went away with the focus there would be nothing left to
      // click on.
      this.dom.classList.add('is-editing')

      if (event.target === this.field || this.list.contains(event.target as Node)) return
      event.preventDefault()
      this.focusLanguage()
    })
    this.close.addEventListener('mousedown', (event) => {
      event.preventDefault()
      this.focusCode('end')
    })

    // The editor loses focus to the field, so the block has to say for itself
    // that it is still being worked on.
    this.field.addEventListener('focus', () => {
      this.dom.classList.add('is-editing')
      this.suggest()
    })
    this.field.addEventListener('blur', () => {
      this.dom.classList.remove('is-editing')
      this.hideSuggestions()
      // Show what was stored rather than what was typed: `Go` is stored as
      // `go`, and the fence line is meant to read like the file.
      this.syncLanguage()
    })
    this.field.addEventListener('input', () => {
      this.sizeField()
      this.setLanguage(this.field.value)
      this.suggest()
    })
    this.field.addEventListener('keydown', (event) => this.onFieldKeyDown(event))

    this.syncLanguage()

    void loadLanguageList().then((languages) => {
      this.languages = languages
      this.renderLabel()
      if (document.activeElement === this.field) this.suggest()
    })
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false

    this.node = node
    this.syncLanguage()

    return true
  }

  /** Chrome is ours: the editor should not read a click or a keystroke here. */
  stopEvent(event: Event) {
    const target = event.target as Node | null
    if (!target) return false

    return this.open.contains(target) || this.close.contains(target)
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }) {
    if (mutation.type === 'selection') return false
    if (mutation.target === this.contentDOM && mutation.type === 'attributes') return true

    return !this.contentDOM.contains(mutation.target)
  }

  private syncLanguage() {
    const language = (this.node.attrs.language as string | null) ?? ''

    this.code.className = language ? LANGUAGE_CLASS_PREFIX + language : ''
    // Leave the field alone while it is being typed into: the attribute is
    // normalised and the caret is somewhere in the middle of the word.
    if (document.activeElement !== this.field) this.field.value = language

    this.sizeField()
    this.renderLabel()
  }

  private renderLabel() {
    this.label.textContent = languageDisplayName(this.node.attrs.language as string | null) ?? ''
  }

  private sizeField() {
    // `ch` is one character wide in a monospace face, so the field takes
    // exactly the room its text needs and the fence reads as a line of text
    // rather than a widget. The pixel keeps the caret off the right edge.
    const width = this.field.value.length || LANGUAGE_PLACEHOLDER.length
    this.field.style.width = `calc(${width}ch + 1px)`
  }

  private setLanguage(value: string) {
    const pos = this.getPos()
    if (pos === undefined) return

    const language = value.trim().toLowerCase() || null
    if (language === this.node.attrs.language) return

    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, language })
    )
  }

  private focusLanguage() {
    this.field.focus()
    this.field.setSelectionRange(this.field.value.length, this.field.value.length)
  }

  private focusCode(at: 'start' | 'end') {
    const pos = this.getPos()
    if (pos === undefined) return

    const { state } = this.view
    const inside = at === 'start' ? pos + 1 : pos + 1 + this.node.content.size

    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, inside)))
    this.view.focus()
  }

  private suggest() {
    const query = this.field.value.trim().toLowerCase()

    // Everything, unfiltered, when nothing is typed: the menu is the language
    // list, and typing is how you get through it quickly.
    this.matches = query ? searchLanguages(this.languages, query) : this.languages
    // With something typed the best match is pre-picked, so Enter accepts it.
    // With nothing typed the list is only a menu — Enter drops into the code.
    this.active = query && this.matches.length > 0 ? 0 : -1
    this.list.hidden = this.matches.length === 0

    this.renderSuggestions()
  }

  /** Keep the arrow-key selection inside the scrolled menu. */
  private revealActive(item: HTMLElement) {
    const top = item.offsetTop
    const bottom = top + item.offsetHeight

    if (top < this.list.scrollTop) this.list.scrollTop = top
    else if (bottom > this.list.scrollTop + this.list.clientHeight) {
      this.list.scrollTop = bottom - this.list.clientHeight
    }
  }

  private hideSuggestions() {
    this.list.hidden = true
    this.matches = []
    this.active = -1
  }

  private renderSuggestions() {
    let activeItem: HTMLElement | null = null

    this.list.replaceChildren(
      ...this.matches.map((language, index) => {
        const item = element('div', 'code-fence-suggestion')
        if (index === this.active) {
          item.classList.add('is-active')
          activeItem = item
        }

        item.append(
          element('span', 'code-fence-suggestion-id', language.id),
          element('span', 'code-fence-suggestion-name', language.name)
        )
        item.addEventListener('mousedown', (event) => {
          // Keep the focus — and so the caret — in the field.
          event.preventDefault()
          this.accept(language)
        })

        return item
      })
    )

    if (activeItem) this.revealActive(activeItem)
    else this.list.scrollTop = 0
  }

  private accept(language: LanguageInfo) {
    this.field.value = language.id
    this.sizeField()
    this.setLanguage(language.id)
    this.hideSuggestions()
  }

  private onFieldKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (this.list.hidden) this.suggest()
        if (this.matches.length === 0) return

        const step = event.key === 'ArrowDown' ? 1 : -1
        this.active = (this.active + step + this.matches.length) % this.matches.length
        this.renderSuggestions()
        return
      }

      // Tab takes the completion and leaves you on the fence line; Enter takes
      // it and drops you into the code, which is where you were heading.
      case 'Tab':
      case 'Enter': {
        event.preventDefault()
        const match = this.matches[this.active]
        if (match) this.accept(match)
        if (event.key === 'Enter') this.focusCode('start')
        return
      }

      case 'Escape': {
        event.preventDefault()
        if (!this.list.hidden) {
          this.hideSuggestions()
          return
        }
        this.focusCode('start')
        return
      }
    }
  }
}

export const CodeFence = Extension.create({
  name: 'codeFence',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('codeFence'),
        props: {
          nodeViews: {
            [CODE_BLOCK]: (node, view, getPos) => new CodeFenceView(node, view, getPos),
          },

          // A node decoration lands on the node view's own element, so the
          // fence lines are a CSS rule away from showing and hiding as the
          // cursor moves. See markdown.css.
          decorations(state) {
            const pos = focusedCodeBlock(state)
            if (pos === null) return null

            const node = state.doc.nodeAt(pos)
            if (!node) return null

            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { class: 'is-focused' }),
            ])
          },
        },
      }),
    ]
  },
})
