'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface SearchResult {
  id: number
  title: string
  source: string
  sourceIcon: string
  keyPoints: string[]
  reliability: 'Verified' | 'Peer-Reviewed' | 'Expert Opinion'
  relatedTopics: string[]
  snippet: string
}

const trendingTopics = [
  { name: 'Mental Health Awareness', icon: 'ri-mental-health-line', count: '2.4k searches' },
  { name: 'Chronic Pain Management', icon: 'ri-heart-pulse-line', count: '1.8k searches' },
  { name: 'Diabetes Prevention', icon: 'ri-drop-line', count: '1.5k searches' },
  { name: 'Sleep Disorders', icon: 'ri-moon-line', count: '1.2k searches' },
  { name: 'Anxiety Coping', icon: 'ri-emotion-line', count: '980 searches' },
  { name: 'Gut Health', icon: 'ri-leaf-line', count: '870 searches' },
]

const placeholderSuggestions = [
  'Search for symptoms, conditions, treatments...',
  'Try "anxiety management techniques"',
  'Try "diabetes diet plan"',
  'Try "chronic pain relief methods"',
]

const mockResults: SearchResult[] = [
  {
    id: 1,
    title: 'Anxiety Disorders: Symptoms, Types, and Treatment Options',
    source: 'National Institute of Mental Health',
    sourceIcon: 'ri-government-line',
    keyPoints: [
      'Anxiety disorders affect 40 million adults in the US',
      'CBT and medication are first-line treatments',
      'Early intervention improves outcomes by 60%',
    ],
    reliability: 'Verified',
    relatedTopics: ['GAD', 'Panic Disorder', 'CBT', 'SSRIs'],
    snippet: 'Anxiety disorders are the most common mental health conditions, characterized by persistent excessive worry that interferes with daily activities.',
  },
  {
    id: 2,
    title: 'Evidence-Based Approaches to Managing Chronic Pain',
    source: 'Mayo Clinic',
    sourceIcon: 'ri-hospital-line',
    keyPoints: [
      'Multimodal pain management is most effective',
      'Physical therapy reduces pain scores by 30-40%',
      'Mindfulness meditation shows clinically significant benefits',
    ],
    reliability: 'Peer-Reviewed',
    relatedTopics: ['Physical Therapy', 'Mindfulness', 'Pain Scale', 'Opioid Alternatives'],
    snippet: 'Chronic pain management requires a comprehensive approach combining physical, psychological, and pharmacological interventions for optimal outcomes.',
  },
  {
    id: 3,
    title: 'Type 2 Diabetes: Prevention and Lifestyle Modifications',
    source: 'American Diabetes Association',
    sourceIcon: 'ri-heart-3-line',
    keyPoints: [
      'Weight loss of 5-7% body weight reduces risk by 58%',
      '150 minutes of weekly exercise recommended',
      'Mediterranean diet shows strongest protective effect',
    ],
    reliability: 'Verified',
    relatedTopics: ['Prediabetes', 'Diet', 'Exercise', 'Blood Sugar'],
    snippet: 'Lifestyle modifications are the cornerstone of Type 2 diabetes prevention, with diet and exercise changes showing significant risk reduction.',
  },
  {
    id: 4,
    title: 'Sleep Hygiene: Improving Sleep Quality Naturally',
    source: 'Harvard Medical School',
    sourceIcon: 'ri-graduation-cap-line',
    keyPoints: [
      'Consistent sleep schedule improves sleep quality by 25%',
      'Blue light exposure before bed delays sleep onset',
      'Room temperature of 65-68F is optimal for sleep',
    ],
    reliability: 'Peer-Reviewed',
    relatedTopics: ['Insomnia', 'Circadian Rhythm', 'Melatonin', 'Sleep Apnea'],
    snippet: 'Good sleep hygiene involves consistent habits and environmental adjustments that promote regular, restorative sleep.',
  },
  {
    id: 5,
    title: 'Understanding Autoimmune Diseases: A Comprehensive Guide',
    source: 'Johns Hopkins Medicine',
    sourceIcon: 'ri-hospital-line',
    keyPoints: [
      'Over 80 autoimmune diseases have been identified',
      'Women are affected 2-3x more often than men',
      'Anti-inflammatory diets may reduce flare frequency',
    ],
    reliability: 'Expert Opinion',
    relatedTopics: ['Lupus', 'Rheumatoid Arthritis', 'Inflammation', 'Immune System'],
    snippet: 'Autoimmune diseases occur when the immune system mistakenly attacks healthy body tissue, leading to chronic inflammation and organ damage.',
  },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Anxiety coping strategies',
    'Diabetes meal planning',
    'Chronic fatigue syndrome',
  ])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return

    setQuery(q)
    setHasSearched(true)

    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== q.toLowerCase())
      return [q, ...filtered].slice(0, 5)
    })

    // Filter mock results based on query (simple keyword matching)
    const lower = q.toLowerCase()
    const matched = mockResults.filter(r =>
      r.title.toLowerCase().includes(lower) ||
      r.keyPoints.some(kp => kp.toLowerCase().includes(lower)) ||
      r.relatedTopics.some(t => t.toLowerCase().includes(lower)) ||
      r.snippet.toLowerCase().includes(lower)
    )
    setResults(matched.length > 0 ? matched : mockResults.slice(0, 3))
  }

  const clearSearch = () => {
    setQuery('')
    setHasSearched(false)
    setResults([])
  }

  const getReliabilityColor = (r: string) => {
    switch (r) {
      case 'Verified': return 'bg-[#6B8A83]/30 text-[#6B8A83]'
      case 'Peer-Reviewed': return 'bg-[#D19A58]/30 text-[#D19A58]'
      case 'Expert Opinion': return 'bg-[#eedfc8]/15 text-[#eedfc8]/70'
      default: return 'bg-[#eedfc8]/10 text-[#eedfc8]'
    }
  }

  const cyclePlaceholder = () => {
    setPlaceholderIndex(prev => (prev + 1) % placeholderSuggestions.length)
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      <div className="px-5 pt-14 pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Health Search</h1>
          <p className="text-[#eedfc8]/60 text-sm">Find trusted health information</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/40"></i>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={cyclePlaceholder}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={placeholderSuggestions[placeholderIndex]}
              className="input-field pl-11 pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <button
                  onClick={clearSearch}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#eedfc8]/10"
                >
                  <i className="ri-close-line text-[#eedfc8]/40 text-sm"></i>
                </button>
              )}
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-[#eedfc8]/10 hover:bg-[#eedfc8]/20">
                <i className="ri-camera-line text-[#eedfc8]/60 text-sm"></i>
              </button>
              <button
                onClick={() => handleSearch()}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#B85C3A] hover:bg-[#B85C3A]/80"
              >
                <i className="ri-arrow-right-line text-[#eedfc8] text-sm"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0">Results for &ldquo;{query}&rdquo;</h2>
              <span className="text-xs text-[#eedfc8]/50">{results.length} found</span>
            </div>

            <div className="space-y-4">
              {results.map(result => (
                <div key={result.id} className="card">
                  {/* Source & Reliability */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
                        <i className={`${result.sourceIcon} text-xs text-[#eedfc8]/60`}></i>
                      </div>
                      <span className="text-[11px] text-[#eedfc8]/50">{result.source}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getReliabilityColor(result.reliability)}`}>
                      <i className="ri-shield-check-line mr-0.5"></i>
                      {result.reliability}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-[#eedfc8] text-sm leading-tight mb-2">{result.title}</h3>

                  {/* Snippet */}
                  <p className="text-xs text-[#eedfc8]/60 mb-3 leading-relaxed">{result.snippet}</p>

                  {/* Key Points */}
                  <div className="bg-[#eedfc8]/5 rounded-lg p-3 mb-3">
                    <p className="text-[10px] font-semibold text-[#eedfc8]/40 uppercase tracking-wider mb-2">Key Points</p>
                    <ul className="space-y-1.5">
                      {result.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#eedfc8]/70">
                          <i className="ri-check-double-line text-[#6B8A83] mt-0.5 shrink-0"></i>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Related Topics */}
                  <div className="flex flex-wrap gap-1.5">
                    {result.relatedTopics.map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleSearch(topic)}
                        className="bg-[#eedfc8]/8 text-[#eedfc8]/60 px-2.5 py-1 rounded-full text-[11px] hover:bg-[#eedfc8]/15 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {!hasSearched && recentSearches.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Recent Searches</h2>
              <button
                onClick={() => setRecentSearches([])}
                className="text-xs text-[#eedfc8]/40 hover:text-[#eedfc8]/60"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {recentSearches.map((search, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(search)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#eedfc8]/5 hover:bg-[#eedfc8]/10 transition-colors text-left"
                >
                  <i className="ri-history-line text-[#eedfc8]/30"></i>
                  <span className="text-sm text-[#eedfc8]/70 flex-1">{search}</span>
                  <i className="ri-arrow-right-up-line text-[#eedfc8]/20"></i>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending Topics */}
        {!hasSearched && (
          <div>
            <h2 className="section-title">Trending Health Topics</h2>
            <div className="grid grid-cols-2 gap-3">
              {trendingTopics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(topic.name)}
                  className="card-light text-left hover:bg-[#eedfc8]/12 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-[#6B8A83]/20 flex items-center justify-center shrink-0">
                      <i className={`${topic.icon} text-[#6B8A83] text-base`}></i>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-[#eedfc8] text-xs leading-tight">{topic.name}</h4>
                      <p className="text-[10px] text-[#eedfc8]/40 mt-0.5">{topic.count}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
