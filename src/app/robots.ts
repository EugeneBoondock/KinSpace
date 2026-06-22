import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.kinspace.co.za'

/**
 * Allow indexing of the public, SEO-worthy surface (conditions, research,
 * community, etc.) while keeping authenticated, personal, and API routes out of
 * search engines. Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/dashboard',
          '/settings',
          '/messages',
          '/notifications',
          '/onboarding',
          '/calendar',
          '/timeline',
          '/saved',
          '/people-like-you',
          '/support',
          '/strands',
          '/trauma-bonding',
          '/profile/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
