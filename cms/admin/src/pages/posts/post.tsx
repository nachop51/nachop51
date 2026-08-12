import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const postQueryKey = ['post', id]
  const {
    data: post,
    isLoading: loading,
    error,
  } = useQuery<Post>({
    queryKey: postQueryKey,
    queryFn: async () => {
      const response = await fetch(`/api/posts/${id}`)

      if (response.status === 404) {
        navigate('/post/not-found')
        throw new Error('Post not found')
      }

      if (!response.ok) throw new Error('Failed to fetch post')
      return response.json()
    },
  })
  const savedPost = useRef<Post | null>(null)
  const debouncedPost = useDebounce(post, 500)

  const updatePost = (updater: (post: Post) => Post) => {
    queryClient.setQueryData<Post>(postQueryKey, (currentPost) =>
      currentPost ? updater(currentPost) : currentPost
    )
  }

  const { mutate: savePost } = useMutation({
    mutationFn: async (post: Post) => {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: post.id,
          lang: post.lang,
          slug: post.slug,
          title: post.title,
          content: post.content,
          description: post.description,
        }),
      })

      if (!response.ok) throw new Error('Failed to update post')
    },
    onSuccess: (_, post) => {
      savedPost.current = post
      toast.success('Saved')
    },
    onError: (saveError) => toast.error(saveError.message),
  })

  useEffect(() => {
    if (post && savedPost.current?.id !== post.id) {
      savedPost.current = post
    }
  }, [post])

  useEffect(() => {
    if (error || !debouncedPost || !savedPost.current) return

    const hasChanges =
      debouncedPost.lang !== savedPost.current.lang ||
      debouncedPost.slug !== savedPost.current.slug ||
      debouncedPost.title !== savedPost.current.title ||
      debouncedPost.content !== savedPost.current.content ||
      debouncedPost.description !== savedPost.current.description

    if (hasChanges) savePost(debouncedPost)
  }, [debouncedPost, error, savePost])

  const { mutate: publishPost } = useMutation({
    mutationFn: async (mode: 'publish' | 'unpublish') => {
      const url = mode === 'unpublish' ? `/api/posts/${id}/unpublish` : `/api/posts/${id}/publish`
      const response = await fetch(url, { method: 'POST' })
      const message = await response.text()

      if (!response.ok) throw new Error(message || 'Failed to update post status')
      return { mode, message }
    },
    onSuccess: ({ mode, message }) => {
      toast.error(message)
      updatePost((currentPost) => ({
        ...currentPost,
        published_at: mode === 'publish' ? new Date().toISOString() : null,
      }))
    },
    onError: (publishError) => toast.error(publishError.message),
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>
  if (!post) return <p>Post not found</p>

  function handlePublish() {
    if (!post) return
    publishPost(post.published_at ? 'unpublish' : 'publish')
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
            updatePost((currentPost) => ({
              ...currentPost,
              description: e.target.value,
            }))
          }
        />
      </div>

      <div className="text-start flex flex-col gap-4 align-start">
        <h2>Editor</h2>
        <TipTap
          initial={post.content || ''}
          onChange={(md) => {
            updatePost((currentPost) => ({
              ...currentPost,
              content: md,
            }))
          }}
        />
      </div>
    </main>
  )
}
