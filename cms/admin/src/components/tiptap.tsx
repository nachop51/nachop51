import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import Image from '@tiptap/extension-image'
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
      Image,
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
    editorProps: {
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
    <>
      <EditorContent className="border border-red-500 " editor={editor} />
      <FloatingMenu editor={editor}>This is the floating menu</FloatingMenu>
      <BubbleMenu editor={editor}>This is the bubble menu</BubbleMenu>
    </>
  )
}
