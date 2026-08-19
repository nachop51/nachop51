/**
 * A single Shiki highlighter for the editor, configured to match the one Astro
 * runs at build time: same theme, same Oniguruma WASM engine, same lazy
 * per-language loading, same full language bundle. See shared/code-theme.ts.
 *
 * Shiki and its grammars are imported dynamically so none of it sits in the
 * initial bundle — the editor paints first, then code blocks colour in. Every
 * type import here is erased at compile time.
 *
 * Everything is best-effort. If Shiki fails to start, or a fence names a
 * language that doesn't exist, code blocks stay unhighlighted — which is what
 * the site does too, since Astro falls back to plaintext.
 */
import type { BundledLanguage, Highlighter, SpecialLanguage } from 'shiki'
import { CODE_THEME } from '../../../../shared/code-theme'

/** A language name Shiki will accept: either bundled, or one of its specials. */
export type CodeLanguage = BundledLanguage | SpecialLanguage

let highlighter: Highlighter | null = null
let booting: Promise<void> | null = null
let isSpecialLang: ((lang: string) => boolean) | null = null

/** Languages we have already tried to load, successfully or not. */
const requested = new Set<string>()
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Fires when the highlighter starts, and when a new grammar finishes loading. */
export function onHighlighterChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getHighlighter() {
  return highlighter
}

export function bootHighlighter() {
  booting ??= startHighlighter()
  return booting
}

async function startHighlighter() {
  try {
    const [shiki, oniguruma] = await Promise.all([
      import('shiki'),
      import('shiki/engine/oniguruma'),
    ])

    isSpecialLang = shiki.isSpecialLang

    highlighter = await shiki.createHighlighter({
      langs: ['plaintext'],
      themes: [CODE_THEME],
      // The WASM engine is the one Astro uses. The JavaScript engine tokenises
      // some grammars differently, which would show up as colour drift.
      engine: oniguruma.createOnigurumaEngine(import('shiki/wasm')),
    })

    notify()
  } catch (error) {
    console.error('[shiki] highlighter failed to start', error)
  }
}

/**
 * Resolve a fence language to one that can be tokenised right now. Unknown or
 * not-yet-loaded languages come back as 'plaintext' and trigger a background
 * load; the editor re-decorates when it lands.
 */
export function resolveLanguage(language?: string | null): CodeLanguage {
  if (!highlighter) return 'plaintext'

  const name = (language || 'plaintext').trim().toLowerCase()
  if (!name) return 'plaintext'
  if (isSpecialLang?.(name) || highlighter.getLoadedLanguages().includes(name)) {
    // Checked against the loaded set above, so the cast is sound.
    return name as CodeLanguage
  }

  void loadLanguage(name)
  return 'plaintext'
}

async function loadLanguage(language: string) {
  if (requested.has(language)) return
  requested.add(language)

  try {
    await highlighter?.loadLanguage(language as BundledLanguage)
    notify()
  } catch {
    // Not a real language. Astro logs and falls back to plaintext; we do the
    // same quietly, because the author is probably still typing the fence.
  }
}

/** A language the fence line can offer, in Shiki's own bundle metadata. */
export type LanguageInfo = { id: string; name: string; aliases: string[] }

/**
 * Shiki's specials. They tokenise without a grammar and so are absent from the
 * bundle listing, but `plaintext` is a fence language like any other — it is
 * how you say "leave this one alone".
 */
const SPECIAL_LANGUAGES: LanguageInfo[] = [
  { id: 'plaintext', name: 'Plain text', aliases: ['text', 'txt'] },
  { id: 'ansi', name: 'ANSI', aliases: [] },
]

let languages: LanguageInfo[] = []
let listing: Promise<LanguageInfo[]> | null = null
/** Every id and alias the bundle answers to, mapped to its display name. */
const displayNames = new Map<string, string>()

/**
 * Every language the highlighter can load, for the fence line's completion.
 * It comes from the module the highlighter itself comes from, so the list
 * offers exactly what can be tokenised — and nothing extra is downloaded:
 * this is the index, the grammars behind these names stay lazy.
 */
export function loadLanguageList(): Promise<LanguageInfo[]> {
  listing ??= import('shiki')
    .then((shiki) => {
      languages = [
        ...SPECIAL_LANGUAGES,
        ...shiki.bundledLanguagesInfo.map(({ id, name, aliases }) => ({
          id,
          name,
          aliases: aliases ?? [],
        })),
      ]

      for (const language of languages) {
        displayNames.set(language.id, language.name)
        for (const alias of language.aliases) displayNames.set(alias, language.name)
      }

      return languages
    })
    .catch(() => languages)

  return listing
}

/**
 * The display name behind a fence's info string — `ts` is TypeScript. Unknown
 * names have none, which is also the tell that the block won't highlight.
 */
export function languageDisplayName(language?: string | null): string | null {
  const name = language?.trim().toLowerCase()
  if (!name) return null

  return displayNames.get(name) ?? null
}
