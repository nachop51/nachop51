import { Link } from 'wouter'

export default function AdminNav() {
  const goBack = () => window.history.back()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <nav
        aria-label="Admin navigation"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link
          to="/"
          className="group flex items-center gap-3 rounded-lg text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105">
            N
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight">Nachop CMS</span>
            <span className="block text-xs leading-tight text-slate-500">Content workspace</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            All posts
          </Link>
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
        </div>
      </nav>
    </header>
  )
}
