import type { Editor, JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { Node } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { CellSelection, isInTable, selectedRect, TableMap } from '@tiptap/pm/tables'

/**
 * The blank-line marker as it arrives back from the parser. Cells written
 * before blank-lines.ts stopped emitting it in tables carry it as literal
 * text — `&nbsp;` on the first load, `&amp;nbsp;` in the file after any save
 * since, which the entity decoder turns back into this. Either way it lands
 * here as one text node, so one pass on load clears both.
 */
const BLANK_CELL = /^(?:&nbsp;|\u00A0)$/

function emptyBlankCells(table: JSONContent): JSONContent {
  for (const row of table.content ?? []) {
    for (const cell of row.content ?? []) {
      const [block, ...rest] = cell.content ?? []
      if (rest.length > 0 || block?.type !== 'paragraph') continue

      const [text, ...more] = block.content ?? []
      if (more.length === 0 && text?.type === 'text' && BLANK_CELL.test(text.text ?? '')) {
        block.content = []
      }
    }
  }
  return table
}

/**
 * Put the cursor on the paragraph after the table, adding one if the table is
 * the last thing in the document.
 *
 * Every other way out is a dead end: Tab walks to the next cell and then adds
 * a row, Enter opens another paragraph inside the cell, and the arrow keys
 * only leave from the edge rows. This is the same key that leaves a code
 * block, so one shortcut steps out of both.
 */
function exitTable(editor: Editor): boolean {
  const { $from } = editor.state.selection

  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name !== 'table') continue

    const after = $from.after(depth)
    return editor.commands.command(({ tr, dispatch }) => {
      if (!dispatch) return true

      const next = tr.doc.nodeAt(after)
      if (next?.type.name !== 'paragraph' || next.content.size > 0) {
        tr.insert(after, editor.schema.nodes.paragraph.create())
      }
      tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1))).scrollIntoView()
      return true
    })
  }

  return false
}

/**
 * The table the cursor has just walked off the top of, if it has.
 *
 * Only the block right after the table counts. Anything deeper — a paragraph
 * inside a list that follows a table — falls through to what the browser does
 * on its own, which is right for those.
 */
function tableAbove(editor: Editor): { table: Node; start: number } | null {
  const { selection, doc } = editor.state
  if (!(selection instanceof TextSelection) || !selection.empty) return null

  const { $from } = selection
  if ($from.depth === 0) return null

  const before = $from.before($from.depth)
  const table = doc.resolve(before).nodeBefore

  return table?.type.name === 'table' ? { table, start: before - table.nodeSize + 1 } : null
}

/**
 * Walk backwards into the table above instead of over it.
 *
 * Chromium moves the caret across the whole node view TipTap draws for a
 * table, so the arrow lands on the paragraph *before* it and the table is
 * unreachable from below. This picks the cell by hand: the last one for a step
 * left, and for a step up the one sitting under the caret, the way moving up
 * between two paragraphs keeps its column.
 */
function enterTableFromBelow(editor: Editor, axis: 'horizontal' | 'vertical'): boolean {
  const { view } = editor
  const found = tableAbove(editor)
  if (!found) return false

  // Leaving the block at all: a step left has to start at its first character,
  // a step up only has to start on its first line.
  const leaving =
    axis === 'horizontal'
      ? editor.state.selection.$from.parentOffset === 0
      : view.endOfTextblock('up')
  if (!leaving) return false

  const { table, start } = found
  const map = TableMap.get(table)
  const lastRow = map.cellsInRect({
    left: 0,
    top: map.height - 1,
    right: map.width,
    bottom: map.height,
  })

  const cell =
    axis === 'horizontal' ? lastRow[lastRow.length - 1] : underCaret(editor, start, lastRow)
  const end = start + cell + (table.nodeAt(cell)?.nodeSize ?? 2) - 1

  return editor.commands.command(({ tr, dispatch }) => {
    if (dispatch) {
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1)).scrollIntoView())
    }
    return true
  })
}

/** The cell in `cells` the caret is over, falling back to the last one. */
function underCaret(editor: Editor, start: number, cells: number[]): number {
  const { view } = editor
  const caret = view.coordsAtPos(editor.state.selection.from).left

  for (const cell of cells) {
    const dom = view.nodeDOM(start + cell)
    if (!(dom instanceof HTMLElement)) continue

    const { left, right } = dom.getBoundingClientRect()
    if (caret >= left && caret <= right) return cell
  }

  return cells[cells.length - 1]
}

/**
 * Delete the row the selection is in. GFM has nowhere to put a table without
 * a header, so dropping the header row promotes the row that slides up into
 * its place.
 */
function removeRow(editor: Editor): boolean {
  if (!isInTable(editor.state)) return false

  const { top } = selectedRect(editor.state)
  const chain = editor.chain().focus().deleteRow()

  return (top === 0 ? chain.toggleHeaderRow() : chain).run()
}

/**
 * Backspace on a whole row or column takes it out of the table.
 *
 * The stock handler empties the cells instead, which is the right answer for
 * a few cells dragged by hand but not for a band picked from its grip: there
 * the whole point of the selection is the row or the column.
 */
function deleteBand(editor: Editor): boolean {
  const { selection } = editor.state
  if (!(selection instanceof CellSelection)) return false

  const column = selection.isColSelection()
  const row = selection.isRowSelection()
  // Both at once is the whole table, and the stock handler drops it outright.
  if (column && row) return false
  if (column) return editor.commands.deleteColumn()

  return row ? removeRow(editor) : false
}

/** The stock parser. Typed to what it actually returns: the one table node. */
const parseTable = Table.config.parseMarkdown as (
  token: MarkdownToken,
  helpers: MarkdownParseHelpers
) => JSONContent

const MarkdownTable = Table.extend({
  parseMarkdown: (token, helpers) => emptyBlankCells(parseTable(token, helpers)),

  addKeyboardShortcuts() {
    const stock = this.parent?.() ?? {}

    return {
      ...stock,
      // Returns false outside a table, so the code block keeps this key too.
      'Mod-Enter': ({ editor }) => exitTable(editor),
      ArrowLeft: ({ editor }) => enterTableFromBelow(editor, 'horizontal'),
      ArrowUp: ({ editor }) => enterTableFromBelow(editor, 'vertical'),
      Backspace: (props) => deleteBand(props.editor) || (stock.Backspace?.(props) ?? false),
      Delete: (props) => deleteBand(props.editor) || (stock.Delete?.(props) ?? false),
    }
  },
})

/** GFM tables: the stock nodes, plus a markdown-safe parse and a way out. */
export const TableExtensions = [MarkdownTable, TableRow, TableHeader, TableCell]
