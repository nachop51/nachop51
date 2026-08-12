import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'

type Props = {
  initial: string
  onChange: (md: string) => void
}

export default function TipTap({ initial, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: false },
        indentation: { style: 'space', size: 2 },
      }),
    ],
    content: initial,
    contentType: 'markdown',
    onUpdate: ({ editor }) => {
      onChange(editor.markdown?.serialize(editor.getJSON()) || '')
    },
  })

  return (
    <>
      <EditorContent className="border border-red-500 " editor={editor} />
      <FloatingMenu editor={editor}>This is the floating menu</FloatingMenu>
      <BubbleMenu editor={editor}>This is the bubble menu</BubbleMenu>
    </>
  )
}
