import Paragraph from '@tiptap/extension-paragraph'

/** A line holding just this is content to markdown, not whitespace. */
const BLANK_LINE_MARKDOWN = '&nbsp;'

/**
 * Node types whose children are cells, where the marker must not appear.
 *
 * A cell is one markdown line, and the table parser reads that line as inline
 * text: a marker in there comes back as the literal string `&nbsp;`, which is
 * then escaped to `&amp;nbsp;` on the next save. An empty cell is valid GFM on
 * its own, so there is nothing to stand in for.
 *
 * `table` is in the set because the table renderer walks its own rows and
 * cells and renders each cell's children directly, so the parent a cell's
 * paragraph reports is the table rather than the cell it sits in.
 */
const CELLS = new Set(['table', 'tableCell', 'tableHeader'])

/**
 * Blank lines that survive publishing.
 *
 * Markdown collapses consecutive blank lines, so an empty paragraph normally
 * vanishes from the rendered page while still showing in the editor — you add
 * space, save, and the site ignores it. A line holding a single non-breaking
 * space does survive, and TipTap already parses `&nbsp;` back into an empty
 * paragraph, so the round trip is stable.
 *
 * What TipTap doesn't do is write it out for every empty paragraph: the stock
 * renderer only emits it when the *previous* node was also an empty paragraph,
 * which leaves the first blank line of every run invisible on the site. This
 * emits it for all of them, so one Enter in the editor is one blank line on
 * the page.
 */
export const BlankLineParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, ctx) {
    const content = Array.isArray(node?.content) ? node.content : []
    if (content.length === 0) {
      return CELLS.has(ctx?.parentType ?? '') ? '' : BLANK_LINE_MARKDOWN
    }
    return helpers.renderChildren(content)
  },
})

/**
 * Drop the empty paragraph TipTap parks at the end of the document. It's the
 * click target for carrying on past a code block or a table, not something the
 * author typed, so it has no business in the file.
 */
export function stripTrailingBlankLines(markdown: string): string {
  return markdown.replace(/(?:\s*&nbsp;)+\s*$/, '').trimEnd()
}
