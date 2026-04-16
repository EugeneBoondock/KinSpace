'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { formatRelativeTime } from '@/lib/platform'
import { renderMarkdown } from '@/lib/markdown'

type ResearchItem = Record<string, unknown> & { id: string }

export default function ResearchArticlePage() {
  const params = useParams<{ id: string }>()
  const articleId = params?.id as string | undefined

  const [article, setArticle] = useState<ResearchItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!articleId) return
    async function load() {
      try {
        const { doc, getDoc } = await import('firebase/firestore')
        const { db } = await import('@/lib/firebase')
        const snap = await getDoc(doc(db, 'resources', articleId as string))
        if (!snap.exists()) {
          setNotFound(true)
          return
        }
        setArticle({ id: snap.id, ...snap.data() })
      } catch (error) {
        console.error('Failed to load article:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [articleId])

  if (loading) {
    return (
      <PageFrame>
        <div className="space-y-4">
          <div className="h-10 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-3xl" />
          <div className="h-96 skeleton rounded-3xl" />
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (notFound || !article) {
    return (
      <PageFrame>
        <div className="card-light text-center">
          <i className="ri-file-list-3-line text-4xl text-[#eedfc8]/30" />
          <p className="mt-3 text-sm text-[#eedfc8]/60">Article not found.</p>
          <Link href="/research" className="btn-primary mt-4 inline-block !py-2.5 !px-4 text-sm">
            Back to research feed
          </Link>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const bodyMarkdown = (article.body_markdown as string | undefined) || (article.excerpt as string | undefined) || ''
  const body = renderMarkdown(bodyMarkdown)

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/research" className="text-sm text-[#D19A58]">
            ← Back to research
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">
              {(article.topic as string | undefined) ||
                (article.category as string | undefined) ||
                'Research'}
            </span>
            {Boolean(article.ai_generated) && (
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">✨ AI summary</span>
            )}
            {(article.source as string | undefined) && (
              <span className="text-xs text-[#eedfc8]/45">{article.source as string}</span>
            )}
            <span className="ml-auto text-xs text-[#eedfc8]/45">
              {formatRelativeTime(article.published_at || article.created_at)}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[#eedfc8]">{article.title as string}</h1>
          {(article.plain_language_summary as string | undefined) && (
            <p className="mt-3 text-base leading-relaxed text-[#eedfc8]/75">
              {article.plain_language_summary as string}
            </p>
          )}
        </section>

        <section className="page-grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="card">
            <div dangerouslySetInnerHTML={{ __html: body }} />
          </article>

          <aside className="space-y-4">
            {Array.isArray(article.key_findings) && (article.key_findings as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Key findings</h2>
                <ul className="space-y-2 text-sm text-[#eedfc8]/70">
                  {(article.key_findings as string[]).map((finding) => (
                    <li key={finding} className="flex items-start gap-2">
                      <i className="ri-check-line mt-0.5 text-[#6B8A83]" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(article.caveats) && (article.caveats as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Caveats</h2>
                <ul className="space-y-2 text-sm text-[#eedfc8]/65">
                  {(article.caveats as string[]).map((caveat) => (
                    <li key={caveat} className="flex items-start gap-2">
                      <i className="ri-information-line mt-0.5 text-[#D19A58]" />
                      <span>{caveat}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(article.url as string | undefined) && (
              <section className="card">
                <h2 className="section-title">Original source</h2>
                <a
                  href={article.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full !py-2.5 text-center text-sm"
                >
                  Read on {(article.source as string | undefined) || 'source'} ↗
                </a>
              </section>
            )}

            {Array.isArray(article.tags) && (article.tags as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {(article.tags as string[]).map((tag) => (
                    <span key={tag} className="badge bg-[#eedfc8]/10 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
