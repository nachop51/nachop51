/**
 * The Shiki theme, shared by the Astro build and the CMS editor.
 *
 * Imported by:
 *   - site/astro.config.ts            (markdown.shikiConfig.theme)
 *   - cms/admin/src/lib/shiki.ts      (the editor's highlighter)
 *
 * Both apps must tokenise with the same theme, the same Shiki version and the
 * same engine, or the same code renders in different colours in each. Shiki is
 * pinned to 4.4.3 in cms/admin/package.json to match the copy Astro resolves —
 * re-check that when bumping Astro.
 *
 * The theme's own background is ignored: shared/markdown.css paints the code
 * surface with --md-code-bg so the block reads as part of the page.
 */
export const CODE_THEME = "min-light";
