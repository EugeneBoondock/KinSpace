'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, toDate } from '@/lib/platform'
import { Avatar, Badge, Card, EmptyState, LinkButton, Skeleton } from '@/components/ui'

type SavedPost = {
  id: string
  content: string
  type: string | null
  media: Array<{ url: string; type: string }>
  tags: string[]
  likes_count: number | null
  comments_count: number | null
  is_anonymous: boolean
  created_at: string | null
  author: {
    full_name: string | null
    username: string | null
    pseudonym: string | null
    avatar_url: string | null
  } | null
}

function authorName(post: SavedPost): string {
  if (post.is_anonymous || !post.author) return 'Someone in the circle'
  return post.author.full_name || post.author.pseudonym || post.author.username || 'A member'
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { push: toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<SavedPost[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const rows = (await DatabaseService.getBookmarks(50)) as SavedPost[]
        setPosts(Array.isArray(rows) ? rows : [])
      } catch (error) {
        console.error('Failed to load saved posts:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [user])

  async function handleUnsave(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId))
    try {
      await DatabaseService.toggleBookmark(postId)
    } catch (error) {
      console.error('Failed to unsave post:', error)
      toast('Could not remove from saved', 'error')
    }
  }

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent3">Your collection</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Saved</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
            Posts you wanted to come back to. Only you can see this.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<i className="ri-bookmark-line text-3xl" aria-hidden="true" />}
              title="Nothing saved yet"
              description="Tap the bookmark on any post to keep it here for later."
              action={<LinkButton href="/community">Browse the community</LinkButton>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const when = toDate(post.created_at)
              const firstImage = post.media.find((item) => item.type === 'image')
              return (
                <Card key={post.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        src={post.is_anonymous ? null : post.author?.avatar_url}
                        name={authorName(post)}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-background">{authorName(post)}</p>
                        {when && <p className="text-[11px] text-brand-background/45">{formatRelativeTime(when)}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnsave(post.id)}
                      aria-label="Remove from saved"
                      className="shrink-0 rounded-full p-2 text-brand-accent3 transition-colors hover:bg-brand-background/8"
                    >
                      <i className="ri-bookmark-fill text-lg" aria-hidden="true" />
                    </button>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-background/85">{post.content}</p>

                  {firstImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstImage.url}
                      alt=""
                      className="mx-auto max-h-[34rem] w-auto max-w-full rounded-xl bg-black/20 object-contain"
                      loading="lazy"
                    />
                  )}

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.tags.slice(0, 5).map((tag) => (
                        <Badge key={tag}>#{tag}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 border-t border-brand-background/8 pt-3 text-xs text-brand-background/45">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-heart-line" aria-hidden="true" />
                      {post.likes_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-chat-1-line" aria-hidden="true" />
                      {post.comments_count ?? 0}
                    </span>
                    <LinkButton href="/community" variant="ghost" size="sm" className="ml-auto">
                      Open in community
                    </LinkButton>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
