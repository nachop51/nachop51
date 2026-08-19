import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { navigate } from 'wouter/use-browser-location'

type Post = {
  id: string
  lang: string
  slug: string
  title: string
  published_at: string | null
}

function formatPublishedDate(date: string | null) {
  if (!date) return 'Last saved as a draft'

  return `Published ${new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))}`
}

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const {
    data: posts,
    isLoading,
    isSuccess,
    error,
  } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts')
      if (!res.ok) throw new Error('Unable to load posts. Please try again.')
      return res.json()
    },
  })

  const handleNewPost = async () => {
    setIsCreating(true)
    setCreateError(null)
    const uuid = crypto.randomUUID()

    try {
      const res = await fetch(`/api/posts/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: 'en',
          slug: 'brand-new',
          title: 'New post',
          content: 'hello',
          published_at: null,
        }),
      })
      if (!res.ok) throw new Error('Unable to create a post. Please try again.')
      navigate(`/posts/${uuid}`)
    } catch (creationError) {
      setCreateError(
        creationError instanceof Error ? creationError.message : 'Unable to create a post.'
      )
      setIsCreating(false)
    }
  }

  const publishedCount = posts?.filter((post) => post.published_at).length ?? 0
  const draftCount = (posts?.length ?? 0) - publishedCount

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-semibold tracking-wide text-sky-700 uppercase">
            Overview
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Your writing, in one place.
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Create, refine, and publish the stories that appear on your site.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewPost}
          disabled={isCreating}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          <span className="text-lg leading-none">+</span>
          {isCreating ? 'Creating post…' : 'New post'}
        </button>
      </section>

      {createError && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {createError}
        </p>
      )}

      {isLoading && (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-500">
          Loading your posts…
        </p>
      )}
      {!isLoading && (!isSuccess || error) && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5 text-red-700"
        >
          {error?.message ?? 'Unable to load posts.'}
        </p>
      )}

      {isSuccess && posts && (
        <>
          <section
            aria-label="Post summary"
            className="mb-8 grid grid-cols-3 gap-3 sm:max-w-md sm:gap-4"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-xs font-medium text-slate-500">All posts</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">{posts.length}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-xs font-medium text-slate-500">Published</dt>
              <dd className="mt-1 text-2xl font-bold text-emerald-700">{publishedCount}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-xs font-medium text-slate-500">Drafts</dt>
              <dd className="mt-1 text-2xl font-bold text-amber-600">{draftCount}</dd>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-950">Posts</h2>
              <span className="text-sm text-slate-500">{posts.length} total</span>
            </div>
            {posts.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-lg font-semibold text-slate-900">Start your first post</p>
                <p className="mt-2 text-sm text-slate-500">
                  It will stay a draft until you are ready to publish.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      to={`/posts/${post.id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50 sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900 group-hover:text-sky-700">
                          {post.title || 'Untitled post'}
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-500">
                          /{post.lang}/{post.slug}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-right">
                        <span className="hidden text-xs text-slate-500 sm:block">
                          {formatPublishedDate(post.published_at)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${post.published_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                        >
                          {post.published_at ? 'Published' : 'Draft'}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-lg text-slate-400 transition-transform group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
