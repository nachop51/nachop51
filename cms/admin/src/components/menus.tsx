import { useRef, type ReactNode } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import type { BubbleMenuProps, FloatingMenuProps } from '@tiptap/react/menus'
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
  H2Icon,
  H3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  QuoteIcon,
  RuleIcon,
  StrikeIcon,
  TableIcon,
} from './icons'

/**
 * Floating UI config, hoisted out of the component. The React wrappers keep
 * `options` and `shouldShow` in a ref and dispatch a transaction whenever the
 * identity changes, so inline literals would reconfigure the plugin on every
 * render.
 */
const BUBBLE_OPTIONS: BubbleMenuProps['options'] = { placement: 'top', offset: 8 }
const INSERT_OPTIONS: FloatingMenuProps['options'] = { placement: 'top-start', offset: 8 }

/**
 * The default only hides on an empty or non-text selection. Code blocks reject
 * marks, so the toolbar there would be dead buttons.
 */
const showBubble: NonNullable<BubbleMenuProps['shouldShow']> = ({
  editor,
  element,
  state,
  view,
}) => {
  if (!editor.isEditable || editor.isActive('codeBlock')) return false
  if (!view.hasFocus() && !element.contains(document.activeElement)) return false

  const { selection } = state
  if (!(selection instanceof TextSelection) || selection.empty) return false

  return state.doc.textBetween(selection.from, selection.to).trim() !== ''
}

/**
 * Any empty line the author is sitting on, heading and list item included: the
 * toolbar has to survive its own commands, or clicking H2 would hide the only
 * way back to a paragraph. Table cells are the exception, since tabbing through
 * an empty table would flash it on every cell.
 */
const showInsert: NonNullable<FloatingMenuProps['shouldShow']> = ({ editor, state, view }) => {
  if (!editor.isEditable || !view.hasFocus()) return false

  const { $anchor, empty } = state.selection
  if (!empty) return false

  const line = $anchor.parent
  if (!line.isTextblock || line.type.spec.code || line.content.size > 0) return false

  for (let depth = $anchor.depth; depth > 0; depth--) {
    if ($anchor.node(depth).type.spec.tableRole) return false
  }

  return true
}

// Opaque on purpose: it sits on top of the line above, so anything
// translucent shows the text through it.
const MENU_CLASS =
  'flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white p-1 ' +
  'shadow-lg shadow-neutral-900/10 animate-[menu-in_120ms_ease-out]'

type ButtonProps = {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}

function Button({ title, active, onClick, children }: ButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // The menu lives outside the editor DOM: without this the click blurs
      // ProseMirror and the selection the command needs is gone.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg transition-colors ${
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-neutral-200" />
}

type Props = {
  editor: Editor
  onUpload: (file: File) => void
}

export default function EditorMenus({ editor, onUpload }: Props) {
  const filePicker = useRef<HTMLInputElement>(null)

  // `useEditor` no longer re-renders on every transaction, so active states
  // have to be subscribed to explicitly. Doing it here and not in TipTap keeps
  // the re-render off EditorContent.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      link: editor.isActive('link'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
    }),
  })

  function editLink() {
    const previous = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Link URL', previous ?? '')
    if (href === null) return

    const chain = editor.chain().focus().extendMarkRange('link')
    if (href === '') chain.unsetLink().run()
    else chain.setLink({ href }).run()
  }

  const marks = (
    <>
      <Button
        title="Bold"
        active={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon />
      </Button>
      <Button
        title="Italic"
        active={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon />
      </Button>
      <Button
        title="Strikethrough"
        active={active.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikeIcon />
      </Button>
      <Button
        title="Inline code"
        active={active.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </Button>
    </>
  )

  return (
    <>
      <BubbleMenu
        editor={editor}
        shouldShow={showBubble}
        options={BUBBLE_OPTIONS}
        updateDelay={100}
        className={MENU_CLASS}
      >
        {marks}
        <Divider />
        <Button title="Link" active={active.link} onClick={editLink}>
          <LinkIcon />
        </Button>
      </BubbleMenu>

      <FloatingMenu
        editor={editor}
        shouldShow={showInsert}
        options={INSERT_OPTIONS}
        className={MENU_CLASS}
      >
        <Button
          title="Heading 2"
          active={active.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <H2Icon />
        </Button>
        <Button
          title="Heading 3"
          active={active.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <H3Icon />
        </Button>
        <Divider />
        {marks}
        <Divider />
        <Button
          title="Bullet list"
          active={active.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletListIcon />
        </Button>
        <Button
          title="Numbered list"
          active={active.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListIcon />
        </Button>
        <Button
          title="Quote"
          active={active.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </Button>
        <Button title="Code block" onClick={() => editor.chain().focus().setCodeBlock().run()}>
          <CodeBlockIcon />
        </Button>
        <Divider />
        <Button
          title="Table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon />
        </Button>
        <Button
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <RuleIcon />
        </Button>
        <Button title="Image" onClick={() => filePicker.current?.click()}>
          <ImageIcon />
        </Button>
        <input
          ref={filePicker}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            // Reset, or picking the same file twice fires no change event.
            event.target.value = ''
          }}
        />
      </FloatingMenu>
    </>
  )
}
