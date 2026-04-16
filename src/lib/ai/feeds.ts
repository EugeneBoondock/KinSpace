import Parser from 'rss-parser'
import type { ResearchSource } from './openai'

type Feed = { name: string; url: string; topic?: string }

export const FEEDS: Feed[] = [
  { name: 'NIH News', url: 'https://www.nih.gov/news-events/news-releases/feed', topic: 'Health research' },
  { name: 'WHO News', url: 'https://www.who.int/rss-feeds/news-english.xml', topic: 'Public health' },
  {
    name: 'PubMed - Mental Health',
    url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/1YyRQSBXn4Cav0nllI3UCWTNl3JzzLuXGBVbRJZ2TJvb5oJ22q/?limit=30',
    topic: 'Mental health',
  },
  {
    name: 'PubMed - Chronic Pain',
    url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/1xTMXlrC2CcLWpq6_cyQ0jl8-plqNM22g3DfgJRQ5bwJ-1pJv5/?limit=30',
    topic: 'Chronic pain',
  },
  { name: 'CDC MMWR', url: 'https://www.cdc.gov/mmwr/rss/rss.xml', topic: 'Disease prevention' },
  { name: 'ScienceDaily Mind & Brain', url: 'https://www.sciencedaily.com/rss/mind_brain.xml', topic: 'Mind and brain' },
  { name: 'ScienceDaily Health', url: 'https://www.sciencedaily.com/rss/top/health.xml', topic: 'General health' },
]

type FeedItem = {
  title?: string
  link?: string
  isoDate?: string
  pubDate?: string
  contentSnippet?: string
  content?: string
  summary?: string
}

export type RawFeedItem = ResearchSource & { topicHint?: string }

function hoursSince(date: Date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

export async function fetchFreshItems(sinceHours = 48): Promise<RawFeedItem[]> {
  const parser = new Parser({
    timeout: 15000,
    headers: { 'User-Agent': 'KinSpace Research Bot/1.0' },
  })

  const results: RawFeedItem[] = []

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url)
      const items = (parsed.items ?? []) as FeedItem[]
      for (const item of items) {
        if (!item.title || !item.link) continue
        const pubDate = item.isoDate ?? item.pubDate
        if (pubDate) {
          const date = new Date(pubDate)
          if (!Number.isNaN(date.getTime()) && hoursSince(date) > sinceHours) continue
        }
        const excerpt = (item.contentSnippet ?? item.summary ?? '').slice(0, 800)
        results.push({
          title: item.title,
          excerpt,
          url: item.link,
          pubDate,
          sourceName: feed.name,
          rawContent: item.content,
          topicHint: feed.topic,
        })
      }
    } catch (error) {
      console.warn(`Feed fetch failed for ${feed.name}:`, error)
    }
  }

  return results
}
