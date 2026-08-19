import type { ReactNode } from 'react'

/**
 * Hand-rolled so the toolbars don't pull in an icon package for a dozen
 * glyphs. Paths follow the Lucide set (ISC), 24x24 on a 2px stroke.
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const BoldIcon = () => (
  <Icon>
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  </Icon>
)

export const ItalicIcon = () => (
  <Icon>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </Icon>
)

export const StrikeIcon = () => (
  <Icon>
    <path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16" />
  </Icon>
)

export const CodeIcon = () => (
  <Icon>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </Icon>
)

export const LinkIcon = () => (
  <Icon>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
)

export const H2Icon = () => (
  <Icon>
    <path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
  </Icon>
)

export const H3Icon = () => (
  <Icon>
    <path d="M4 12h8M4 18V6M12 18V6" />
    <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
    <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
  </Icon>
)

export const BulletListIcon = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
)

export const OrderedListIcon = () => (
  <Icon>
    <path d="M10 6h11M10 12h11M10 18h11" />
    <path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </Icon>
)

export const QuoteIcon = () => (
  <Icon>
    <path d="M17 6H3M21 12H8M21 18H8M3 12v6" />
  </Icon>
)

export const CodeBlockIcon = () => (
  <Icon>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="m10 9-2 3 2 3M14 9l2 3-2 3" />
  </Icon>
)

export const TableIcon = () => (
  <Icon>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18M3 15h18M12 3v18" />
  </Icon>
)

export const RuleIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
)

export const ImageIcon = () => (
  <Icon>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon>
    <path d="M5 12h14M12 5v14" />
  </Icon>
)
