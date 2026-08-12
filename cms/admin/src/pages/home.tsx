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

export default function HomePage() {
  const {
    data: posts,
    isLoading,
    isSuccess,
    error,
  } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts')
      if (!res.ok) throw new Error('Error fetching posts')
      return res.json()
    },
  })

  if (isLoading) return <div>Loading...</div>
  if (!isSuccess || error) return <div>Error: {error!.message}</div>

  const handleNewPost = async () => {
    const uuid = crypto.randomUUID()
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
    if (!res.ok) throw new Error('Error creating post')
    navigate(`/posts/${uuid}`)
  }

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
      <button onClick={handleNewPost}>New post</button>
    </div>
  )
}
