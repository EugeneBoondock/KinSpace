'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface Resource {
  id: number
  title: string
  category: string
  type: string
  readTime: string
  difficulty: string
  tags: string[]
  excerpt: string
  isPopular: boolean
  icon: string
}

const categories = [
  { id: 'all', name: 'All', icon: 'ri-apps-line' },
  { id: 'articles', name: 'Articles', icon: 'ri-article-line' },
  { id: 'guides', name: 'Guides', icon: 'ri-book-3-line' },
  { id: 'tools', name: 'Tools', icon: 'ri-tools-line' },
  { id: 'videos', name: 'Videos', icon: 'ri-video-line' },
  { id: 'podcasts', name: 'Podcasts', icon: 'ri-mic-line' },
]

const resources: Resource[] = [
  {
    id: 1,
    title: 'Understanding Your Diagnosis: A Complete Guide',
    category: 'guides',
    type: 'Treatment Guide',
    readTime: '15 min read',
    difficulty: 'Beginner',
    tags: ['Chronic Illness', 'Mental Health'],
    excerpt: 'A comprehensive guide to help you understand your diagnosis and take the first steps toward management.',
    isPopular: true,
    icon: 'ri-book-open-line',
  },
  {
    id: 2,
    title: 'Mindfulness Techniques for Anxiety Management',
    category: 'articles',
    type: 'Article',
    readTime: '8 min read',
    difficulty: 'Beginner',
    tags: ['Anxiety', 'Mindfulness'],
    excerpt: 'Learn practical mindfulness exercises you can use anywhere to manage anxiety symptoms effectively.',
    isPopular: true,
    icon: 'ri-mental-health-line',
  },
  {
    id: 3,
    title: 'MySymptoms - Daily Tracking App',
    category: 'tools',
    type: 'Mobile App',
    readTime: 'Free Download',
    difficulty: 'Easy to use',
    tags: ['Tracking', 'Symptoms'],
    excerpt: 'Track symptoms, medications, and mood patterns to share with your healthcare team.',
    isPopular: false,
    icon: 'ri-smartphone-line',
  },
  {
    id: 4,
    title: 'Living Well with Chronic Pain',
    category: 'videos',
    type: 'Video Series',
    readTime: '45 min watch',
    difficulty: 'All Levels',
    tags: ['Chronic Pain', 'Lifestyle'],
    excerpt: '6-part video series on pain management strategies and lifestyle adaptations for daily living.',
    isPopular: true,
    icon: 'ri-play-circle-line',
  },
  {
    id: 5,
    title: 'The Healing Journey Podcast',
    category: 'podcasts',
    type: 'Podcast',
    readTime: 'Weekly episodes',
    difficulty: 'All Levels',
    tags: ['Stories', 'Inspiration'],
    excerpt: 'Weekly conversations with people thriving despite health challenges and chronic conditions.',
    isPopular: false,
    icon: 'ri-headphone-line',
  },
  {
    id: 6,
    title: 'Overcoming Addiction: Recovery Resources',
    category: 'guides',
    type: 'Treatment Guide',
    readTime: '20 min read',
    difficulty: 'Intermediate',
    tags: ['Addiction', 'Recovery'],
    excerpt: 'Comprehensive recovery resources for substance abuse and behavioral addictions with step-by-step plans.',
    isPopular: true,
    icon: 'ri-heart-pulse-line',
  },
  {
    id: 7,
    title: 'Grief and Loss Support Guide',
    category: 'articles',
    type: 'Article',
    readTime: '12 min read',
    difficulty: 'All Levels',
    tags: ['Grief', 'Loss', 'Support'],
    excerpt: 'Understanding the grieving process and finding healthy ways to cope with loss and bereavement.',
    isPopular: false,
    icon: 'ri-hand-heart-line',
  },
  {
    id: 8,
    title: 'Sleep Hygiene Masterclass',
    category: 'videos',
    type: 'Video',
    readTime: '30 min watch',
    difficulty: 'Beginner',
    tags: ['Sleep', 'Wellness'],
    excerpt: 'Expert-led masterclass on improving sleep quality through evidence-based hygiene practices.',
    isPopular: true,
    icon: 'ri-moon-line',
  },
]

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [bookmarked, setBookmarked] = useState<number[]>([])

  const filteredResources = activeCategory === 'all'
    ? resources
    : resources.filter(r => r.category === activeCategory)

  const toggleBookmark = (id: number) => {
    setBookmarked(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-[#6B8A83]/30 text-[#eedfc8]'
      case 'Intermediate': return 'bg-[#D19A58]/30 text-[#D19A58]'
      case 'Advanced': return 'bg-[#B85C3A]/30 text-[#B85C3A]'
      default: return 'bg-[#eedfc8]/10 text-[#eedfc8]'
    }
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      <div className="px-5 pt-14 pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Resources</h1>
          <p className="text-[#eedfc8]/60 text-sm">Expert-curated content for your wellness journey</p>
        </div>

        {/* Featured Resource */}
        <div className="card mb-6 bg-gradient-to-br from-[#B85C3A]/40 to-[#D19A58]/20 border-[#D19A58]/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="badge bg-[#D19A58]/30 text-[#D19A58]">
              <i className="ri-star-fill mr-1 text-[10px]"></i>Featured
            </span>
            <span className="badge bg-[#6B8A83]/30 text-[#eedfc8]">New</span>
          </div>
          <h3 className="text-lg font-bold text-[#eedfc8] mb-2">Complete Wellness Toolkit</h3>
          <p className="text-[#eedfc8]/70 text-sm mb-4 leading-relaxed">
            Everything you need to start your wellness journey -- tracking sheets, goal planners,
            emergency contact forms, and self-care checklists all in one place.
          </p>
          <div className="flex items-center gap-3">
            <button className="btn-primary flex items-center gap-2">
              <i className="ri-download-2-line"></i>
              Download Free
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <i className="ri-eye-line"></i>
              Preview
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'tab-active'
                    : 'tab-inactive'
                }`}
              >
                <i className={`${cat.icon} text-sm`}></i>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">
            {categories.find(c => c.id === activeCategory)?.name || 'All'} Resources
          </h2>
          <span className="text-xs text-[#eedfc8]/50">{filteredResources.length} items</span>
        </div>

        {/* Resource Cards */}
        <div className="space-y-4 mb-8">
          {filteredResources.map(resource => (
            <div key={resource.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {resource.isPopular && (
                    <span className="badge bg-[#D19A58]/20 text-[#D19A58]">
                      <i className="ri-fire-fill mr-1 text-[10px]"></i>Popular
                    </span>
                  )}
                  <span className="badge">{resource.type}</span>
                </div>
                <button
                  onClick={() => toggleBookmark(resource.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#eedfc8]/10 transition-colors"
                >
                  <i className={`${bookmarked.includes(resource.id) ? 'ri-bookmark-fill text-[#D19A58]' : 'ri-bookmark-line text-[#eedfc8]/40'} text-lg`}></i>
                </button>
              </div>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#eedfc8]/10 flex items-center justify-center shrink-0">
                  <i className={`${resource.icon} text-lg text-[#eedfc8]/70`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[#eedfc8] text-sm leading-tight mb-1">{resource.title}</h4>
                  <p className="text-xs text-[#eedfc8]/60 leading-relaxed">{resource.excerpt}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#eedfc8]/50 mb-3">
                <i className="ri-time-line"></i>
                <span>{resource.readTime}</span>
                <span className="text-[#eedfc8]/20">|</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getDifficultyColor(resource.difficulty)}`}>
                  {resource.difficulty}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {resource.tags.map(tag => (
                  <span key={tag} className="bg-[#eedfc8]/8 text-[#eedfc8]/60 px-2.5 py-1 rounded-full text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5">
                  <i className={resource.category === 'tools' ? 'ri-download-2-line' : 'ri-arrow-right-line'}></i>
                  {resource.category === 'tools' ? 'Download' : 'Read Now'}
                </button>
                <button
                  onClick={() => toggleBookmark(resource.id)}
                  className="btn-secondary px-3 py-2.5 text-xs"
                >
                  <i className={bookmarked.includes(resource.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Access */}
        <div className="mb-4">
          <h2 className="section-title">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="card-light text-left">
              <div className="w-10 h-10 rounded-full bg-[#B85C3A]/20 flex items-center justify-center mb-3">
                <i className="ri-heart-pulse-line text-[#B85C3A] text-lg"></i>
              </div>
              <h4 className="font-semibold text-[#eedfc8] text-sm mb-1">Emergency Resources</h4>
              <p className="text-[11px] text-[#eedfc8]/50">Crisis support & contacts</p>
            </button>
            <button className="card-light text-left">
              <div className="w-10 h-10 rounded-full bg-[#6B8A83]/20 flex items-center justify-center mb-3">
                <i className="ri-hospital-line text-[#6B8A83] text-lg"></i>
              </div>
              <h4 className="font-semibold text-[#eedfc8] text-sm mb-1">Healthcare Directory</h4>
              <p className="text-[11px] text-[#eedfc8]/50">Find local providers</p>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
