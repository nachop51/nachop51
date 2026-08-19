import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CODE_THEME } from '../../../../shared/code-theme'
import {
  bootHighlighter,
  getHighlighter,
  onHighlighterChange,
  resolveLanguage,
  type CodeLanguage,
} from '../lib/shiki'

const shikiKey = new PluginKey<DecorationSet>('shikiHighlight')

/** The shape of hast we care about, so this file needs no extra dependency. */
type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  value?: string
  children?: HastNode[]
}

/** A styled run, as an offset range into the code block's text. */
type StyledRun = { from: number; to: number; style: string }

/**
 * Highlighting is redone on every keystroke, so cache by content: only the
 * block being typed into is re-tokenised, the rest are handed back untouched.
 */
const runCache = new Map<string, StyledRun[]>()
const RUN_CACHE_LIMIT = 64

function childElement(node: HastNode | undefined, tagName: string): HastNode | undefined {
  return node?.children?.find((child) => child.type === 'element' && child.tagName === tagName)
}

/**
 * Walk the token spans inside <code>, tracking the text offset. The <pre> and
 * <code> wrappers are skipped deliberately — <pre> carries the theme's own
 * background and colour, which shared/markdown.css overrides.
 */
function styledRuns(code: HastNode | undefined): StyledRun[] {
  const runs: StyledRun[] = []
  let offset = 0

  const visit = (node: HastNode, inherited: string) => {
    if (node.type === 'text') {
      const length = node.value?.length ?? 0
      if (inherited && length > 0) {
        runs.push({ from: offset, to: offset + length, style: inherited })
      }
      offset += length
      return
    }

    const own = typeof node.properties?.style === 'string' ? node.properties.style : ''
    for (const child of node.children ?? []) visit(child, own || inherited)
  }

  for (const child of code?.children ?? []) visit(child, '')

  return runs
}

function highlight(code: string, language: CodeLanguage): StyledRun[] | null {
  const highlighter = getHighlighter()
  if (!highlighter) return null

  const cacheKey = `${language}:${code}`
  const cached = runCache.get(cacheKey)
  if (cached) return cached

  let runs: StyledRun[]
  try {
    const root = highlighter.codeToHast(code, {
      lang: language,
      theme: CODE_THEME,
    }) as unknown as HastNode
    runs = styledRuns(childElement(childElement(root, 'pre'), 'code'))
  } catch {
    return null
  }

  if (runCache.size >= RUN_CACHE_LIMIT) {
    runCache.delete(runCache.keys().next().value as string)
  }
  runCache.set(cacheKey, runs)

  return runs
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  if (!getHighlighter()) return DecorationSet.empty

  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true

    const language = resolveLanguage(node.attrs.language as string | null)
    // Shiki emits no colour at all for plaintext, and neither does the site:
    // the block just inherits the <pre> colour. Nothing to decorate.
    if (language === 'plaintext') return false

    const runs = highlight(node.textContent, language)
    if (!runs) return false

    // Text starts one position inside the node, and every character — newlines
    // included — is one position.
    const contentStart = pos + 1
    const contentEnd = contentStart + node.content.size

    for (const run of runs) {
      const from = contentStart + run.from
      const to = contentStart + run.to
      if (to > contentEnd) break
      decorations.push(Decoration.inline(from, to, { style: run.style }))
    }

    return false
  })

  return DecorationSet.create(doc, decorations)
}

export const ShikiHighlight = Extension.create({
  name: 'shikiHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: shikiKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc),
          apply(tr, value, _oldState, newState) {
            if (tr.docChanged || tr.getMeta(shikiKey)) {
              return buildDecorations(newState.doc)
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return shikiKey.getState(state)
          },
        },
        view(view) {
          // Redraw when the highlighter boots, and again whenever a grammar
          // one of the fences asked for finishes loading.
          const stopListening = onHighlighterChange(() => {
            if (view.isDestroyed) return
            view.dispatch(view.state.tr.setMeta(shikiKey, true))
          })

          void bootHighlighter()

          return { destroy: stopListening }
        },
      }),
    ]
  },
})
