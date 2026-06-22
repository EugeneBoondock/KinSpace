import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.kinspace.co.za'

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/login', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/signup', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/explore', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/community', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/ask', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/resources', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/research', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/insights', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/conditions', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/treatments', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/share-experience', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/groups', priority: 0.6, changeFrequency: 'weekly' as const },
    { path: '/therapy', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/therapist', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/map', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/nearby-support', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/trauma-bonding', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/strands', priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/games', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/search', priority: 0.4, changeFrequency: 'weekly' as const },
    { path: '/symptom-checker', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/pricing', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/crisis', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/community-guidelines', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  return publicRoutes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
