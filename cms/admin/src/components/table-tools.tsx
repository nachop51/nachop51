import { useCallback, useEffect, useRef, useState } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { TableMap } from '@tiptap/pm/tables'
import type { Editor } from '@tiptap/react'
import { PlusIcon } from './icons'

/** Depth of the strip, and how far the pointer can stray and still count. */
const STRIP = 14
const REACH = 16

type Side = 'bottom' | 'right'

type Spot = {
  left: number
  top: number
  width: number
  height: number
  /** Where the table node itself starts, which insertions don't move. */
  pos: number
  /** A cell in the last row and one in the last column, for the commands. */
  lastRow: number
  lastColumn: number
}

/**
 * Every table in the document, measured from the top left of the overlay.
 *
 * All of them, not just the one holding the cursor: the strip answers to the
 * pointer, so they have to be ready before anything is clicked.
 */
function measure(editor: Editor, base: DOMRect): Spot[] {
  if (!editor.isEditable) return []

  const spots: Spot[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true

    // The node view wraps the table in a div, so reach through it.
    const dom = editor.view.nodeDOM(pos)
    const element = dom instanceof HTMLElement ? (dom.querySelector('table') ?? dom) : null
    if (!(element instanceof HTMLElement)) return false

    const rect = element.getBoundingClientRect()
    const map = TableMap.get(node)
    const start = pos + 1

    spots.push({
      left: rect.left - base.left,
      top: rect.top - base.top,
      width: rect.width,
      height: rect.height,
      pos,
      lastRow: start + map.map[(map.height - 1) * map.width],
      lastColumn: start + map.map[map.width - 1],
    })

    return false
  })

  return spots
}

type Near = { index: number; side: Side } | null

/**
 * The edge the pointer is at, if it is at one.
 *
 * A strip hangs off its edge, so REACH has to clear its depth or moving from
 * the table onto the strip would put the pointer nowhere.
 */
function edgeAt(spots: Spot[], x: number, y: number): Near {
  for (const [index, spot] of spots.entries()) {
    const right = spot.left + spot.width
    const bottom = spot.top + spot.height
    const acrossX = x > spot.left - REACH && x < right + REACH
    const acrossY = y > spot.top - REACH && y < bottom + REACH

    if (acrossX && Math.abs(y - bottom) < REACH) return { index, side: 'bottom' }
    if (acrossY && Math.abs(x - right) < REACH) return { index, side: 'right' }
  }

  return null
}

type Props = {
  editor: Editor
}

/**
 * A short empty cell off the bottom or right edge of the table the pointer is
 * at. Click it and the table grows a row or a column on that side.
 *
 * Nothing shows until the pointer reaches an edge, so the only clicks it takes
 * are the ones aimed at it.
 */
export default function TableTools({ editor }: Props) {
  const overlay = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [near, setNear] = useState<Near>(null)

  const sync = useCallback(() => {
    const base = overlay.current?.getBoundingClientRect()
    const next = base ? measure(editor, base) : []
    // Every keystroke fires a transaction; only a moved edge is a re-render.
    setSpots((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [editor])

  useEffect(() => {
    sync()

    editor.on('transaction', sync)
    window.addEventListener('resize', sync)

    // Wrapping text changes a table's height without touching the document.
    const observer = new ResizeObserver(sync)
    observer.observe(editor.view.dom)

    return () => {
      editor.off('transaction', sync)
      window.removeEventListener('resize', sync)
      observer.disconnect()
    }
  }, [editor, sync])

  const track = useCallback(() => {
    const base = overlay.current?.getBoundingClientRect()
    const at = pointer.current
    if (!base || !at) return

    setNear((current) => {
      const found = edgeAt(spots, at.x - base.left, at.y - base.top)
      // Same edge as last time: keep the object, or every mouse move is a
      // re-render.
      return found?.index === current?.index && found?.side === current?.side ? current : found
    })
  }, [spots])

  useEffect(() => {
    // On the window rather than the editor: the strip sits in the overlay, and
    // moving onto it would otherwise read as leaving the table.
    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY }
      track()
    }

    window.addEventListener('pointermove', onMove)
    // A table that just grew moved its edge out from under the pointer.
    track()

    return () => window.removeEventListener('pointermove', onMove)
  }, [track])

  function add(side: Side, spot: Spot) {
    editor
      .chain()
      .focus()
      // The commands work off the selection, so point it at the far edge
      // first, then leave the cursor in the cell that just appeared.
      .setCellSelection({ anchorCell: side === 'bottom' ? spot.lastRow : spot.lastColumn })
      [side === 'bottom' ? 'addRowAfter' : 'addColumnAfter']()
      .command(({ tr, dispatch }) => {
        const table = tr.doc.nodeAt(spot.pos)
        if (!table || !dispatch) return true

        const map = TableMap.get(table)
        const cell = side === 'bottom' ? map.map[(map.height - 1) * map.width] : map.map[map.width - 1]
        dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(spot.pos + 1 + cell + 1))))

        return true
      })
      .run()
  }

  function strip(side: Side, spot: Spot) {
    // Flush against the table, one pixel over the edge so the two borders
    // land on each other and it reads as the next row rather than a box
    // parked nearby.
    const place =
      side === 'bottom'
        ? { left: spot.left, width: spot.width, top: spot.top + spot.height - 1, height: STRIP }
        : { top: spot.top, height: spot.height, left: spot.left + spot.width - 1, width: STRIP }

    return (
      <button
        type="button"
        title={side === 'bottom' ? 'Add row' : 'Add column'}
        aria-label={side === 'bottom' ? 'Add row' : 'Add column'}
        // The overlay is outside the editor: without this the click blurs
        // ProseMirror before the command runs.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => add(side, spot)}
        className="table-append pointer-events-auto absolute"
        // Which way the table is about to grow.
        style={{ ...place, cursor: side === 'bottom' ? 's-resize' : 'e-resize' }}
      >
        <PlusIcon />
      </button>
    )
  }

  const spot = near ? spots[near.index] : null

  return (
    <div ref={overlay} className="pointer-events-none absolute inset-0">
      {spot && near && strip(near.side, spot)}
    </div>
  )
}
