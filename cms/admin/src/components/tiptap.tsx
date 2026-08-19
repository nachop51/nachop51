import { Markdown } from '@tiptap/markdown'
import { EditorContent, Extension, useEditor } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import type { ResolvedPos } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { BlankLineParagraph, stripTrailingBlankLines } from './blank-lines'
import { CodeFence, NO_PROSE_CHECKING } from './code-fence'
import EditorMenus from './menus'
import { ShikiHighlight } from './shiki-highlight'
import { TableExtensions } from './table'
import TableTools from './table-tools'

const INDENT_SIZE = 2
const INDENT = ' '.repeat(INDENT_SIZE)

const LIST_ITEMS = new Set(['listItem', 'taskItem'])

function inListItem($pos: ResolvedPos) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (LIST_ITEMS.has($pos.node(depth).type.name)) return true
  }
  return false
}

const TabIndent = Extension.create({
  name: 'tabIndent',
  priority: 10,
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const { selection } = editor.state
        // Deepest possible list item, or a node selection (an image, say):
        // nothing sane to indent, just keep focus.
        if (!(selection instanceof TextSelection) || inListItem(selection.$from)) return true

        return editor.commands.command(({ tr, dispatch }) => {
          // insertText, not insertContent: the editor parses strings as
          // markdown, which would eat the spaces.
          if (dispatch) tr.insertText(INDENT)
          return true
        })
      },
      'Shift-Tab': ({ editor }) => {
        const { state } = editor
        const { selection } = state
        if (!(selection instanceof TextSelection) || !selection.empty) return true
        if (inListItem(selection.$from)) return true

        const { $from } = selection
        const before = state.doc.textBetween($from.start(), $from.pos, '\n', '\n')
        const remove = Math.min(before.match(/ *$/)?.[0].length ?? 0, INDENT_SIZE)
        if (remove === 0) return true

        return editor.commands.deleteRange({
          from: $from.pos - remove,
          to: $from.pos,
        })
      },
      Escape: ({ editor }) => editor.commands.blur(),
    }
  },
})

type Props = {
  initial: string
  onChange: (md: string) => void
}

export default function TipTap({ initial, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Replaced below, so a blank line in the editor is a blank line on
        // the published page.
        paragraph: false,
        codeBlock: {
          enableTabIndentation: true,
          tabSize: INDENT_SIZE,
          HTMLAttributes: NO_PROSE_CHECKING,
        },
        code: { HTMLAttributes: NO_PROSE_CHECKING },
        // Serialises to `++text++`, which nothing in the publish pipeline
        // understands: it would reach the page as literal plus signs.
        underline: false,
        // Editing a link shouldn't navigate away from the editor.
        link: { openOnClick: false },
      }),
      BlankLineParagraph,
      Image,
      TabIndent,
      CodeFence,
      ShikiHighlight,
      // GFM tables. Column resizing stays off: markdown has no column widths,
      // so any width dragged here would be gone on the next save, and the
      // editor would stop matching the page for as long as it was applied.
      ...TableExtensions,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: false },
        indentation: { style: 'space', size: INDENT_SIZE },
      }),
    ],
    content: initial,
    contentType: 'markdown',
    onUpdate: ({ editor }) => {
      onChange(stripTrailingBlankLines(editor.markdown?.serialize(editor.getJSON()) || ''))
    },
    editorProps: {
      // `markdown` is the shared content class -> see shared/markdown.css.
      // It goes on the ProseMirror root so the editable area *is* the article.
      attributes: { class: 'markdown' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.length === 0) return false

        for (const file of files) uploadAndInsert(file)

        return true
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length === 0) return false

        for (const file of files) uploadAndInsert(file)

        return true
      },
    },
  })

  async function uploadAndInsert(file: File) {
    const fd = new FormData()
    fd.append('file', file)

    const r = await fetch('/api/upload', {
      method: 'POST',
      body: fd,
    })
    if (!r.ok) {
      console.error('Upload failed')
      return
    }

    const asset = (await r.json()) as { url: string; content_type: string }

    if (asset.content_type.startsWith('image/')) {
      editor.chain().focus().setImage({ src: asset.url, alt: file.name }).run()
    } else {
      // archivos y videos: link al recurso
      editor.chain().focus().insertContent(`<a href="${asset.url}">${file.name}</a>`).run()
    }
  }

  return (
    // Positioned: the table grips are an overlay measured against this box.
    <div className="relative">
      <EditorContent editor={editor} />
      <TableTools editor={editor} />
      <EditorMenus editor={editor} onUpload={uploadAndInsert} />
    </div>
  )
}
