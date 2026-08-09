import { useEffect, useState } from 'react'
import { Link } from 'wouter'

type Post = {
  id: string
  lang: string
  slug: string
  title: string
  published_at: string | null
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/posts')
      .then((r) => r.json())
      .then(setPosts)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p>Error: {error}</p>

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <Link to={`/posts/${p.id}`}>
              <strong>{p.title || '(sin título)'}</strong>
              {' — '}
              {p.lang}/{p.slug}
              {' — '}
              {p.published_at ? 'publicado' : 'borrador'}
            </Link>
          </li>
        ))}
      </ul>

      {/*<div className="card">
      <TipTap initial="# Hello!" onChange={setMd} />
    </div>*/}
    </div>
  )
}
