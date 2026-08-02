import { useEffect, useState } from 'react'
import './App.css'
import TipTap from './components/tiptap'

type Post = {
  id: string
  lang: string
  slug: string
  title: string
  published_at: string | null
}

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState<string | null>(null)
  const [_md, setMd] = useState<string>('# Hello!')

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
            <strong>{p.title || '(sin título)'}</strong>
            {' — '}
            {p.lang}/{p.slug}
            {' — '}
            {p.published_at ? 'publicado' : 'borrador'}
          </li>
        ))}
      </ul>

      <div className="card">
        <TipTap initial="# Hello!" onChange={setMd} />
      </div>
    </div>
  )
}

export default App
