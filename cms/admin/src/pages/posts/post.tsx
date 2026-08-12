import { useEffect, useRef, useState } from 'react'
import TipTap from '../../components/tiptap'
import useDebounce from '../../hooks/useDebounce'
import { navigate } from 'wouter/use-browser-location'
import toast from 'react-hot-toast'

type Props = {
  id: string
}

type Post = {
  id: string
  lang: string
  slug: string
  title: string
  description: string
  content: string
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}

export default function PostPage({ id }: Props) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)
  const debouncedPost = useDebounce(post, 500)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/posts/${id}`)
      .then((r) => {
        if (r.status === 404) {
          return navigate('/post/not-found')
        }

        return r.json()
      })
      .then((post) => {
        setTimeout(() => (initialized.current = true), 1000)
        setPost(post)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (error || !debouncedPost || !initialized.current) return

    fetch(`/api/posts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: debouncedPost.id,
        lang: debouncedPost.lang,
        slug: debouncedPost.slug,
        title: debouncedPost.title,
        content: debouncedPost.content,
        description: debouncedPost.description,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to update post')
        toast.success('Saved')
      })
      .catch((err) => setError(err.message))
  }, [debouncedPost, id, error])

  if (loading) return <p>Loading...</p>
  if (!post) return <p>Post not found</p>

  async function handlePublish() {
    const mode = post?.published_at ? 'unpublish' : 'publish'
    try {
      const url = mode === 'unpublish' ? `/api/posts/${id}/unpublish` : `/api/posts/${id}/publish`
      const res = await fetch(url, {
        method: 'POST',
      })
      toast.error(await res.text())
      if (res.status >= 400) {
        return
      }

      setPost((prevPost) => {
        if (!prevPost) return prevPost
        return {
          ...prevPost,
          published_at: mode === 'publish' ? new Date().toISOString() : null,
        }
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <main>
      <div>
        <h1>Post: {post.title}</h1>
        Published at: {post.published_at || 'Not published yet'}
        <div>
          <button onClick={handlePublish}>{post.published_at ? 'Unpublish' : 'Publish'}</button>
        </div>
      </div>

      <div>
        <h4>description</h4>
        <input
          type="text"
          value={post.description}
          onChange={(e) =>
            setPost((p) => {
              if (!p) return null
              return {
                ...p,
                description: e.target.value,
              }
            })
          }
        />
      </div>

      <div className="text-start flex flex-col gap-4 align-start">
        <h2>Editor</h2>
        <TipTap
          initial={post.content || ''}
          onChange={(md) => {
            setPost((prevPost) => {
              if (!prevPost) return null

              return {
                ...prevPost,
                content: md,
              }
            })
          }}
        />
      </div>
    </main>
  )
}
