'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface ResearchPaper {
  id: number
  title: string
  journal: string
  date: string
  category: string
  keyFindings: string[]
  difficulty: string
  relevance: number
  tags: string[]
  isBreaking: boolean
  isFeatured: boolean
}

const categories = [
  { id: 'all', name: 'All', icon: 'ri-flask-line' },
  { id: 'mental-health', name: 'Mental Health', icon: 'ri-mental-health-line' },
  { id: 'chronic-pain', name: 'Chronic Pain', icon: 'ri-heart-pulse-line' },
  { id: 'diabetes', name: 'Diabetes', icon: 'ri-drop-line' },
  { id: 'autoimmune', name: 'Autoimmune', icon: 'ri-shield-cross-line' },
  { id: 'addiction', name: 'Addiction', icon: 'ri-capsule-line' },
  { id: 'neurology', name: 'Neurology', icon: 'ri-brain-line' },
]

const papers: ResearchPaper[] = [
  {
    id: 1,
    title: 'Novel CBT Approaches Show 40% Improvement in Treatment-Resistant Depression',
    journal: 'Journal of Clinical Psychology',
    date: 'Mar 2026',
    category: 'mental-health',
    keyFindings: [
      'Combined CBT with mindfulness showed 40% symptom reduction',
      'Effects sustained at 12-month follow-up',
      'Particularly effective for ages 25-45',
    ],
    difficulty: 'Intermediate',
    relevance: 94,
    tags: ['Depression', 'CBT', 'Mindfulness'],
    isBreaking: true,
    isFeatured: true,
  },
  {
    id: 2,
    title: 'Breakthrough in Non-Opioid Pain Management Using Neural Stimulation',
    journal: 'Pain Research & Management',
    date: 'Feb 2026',
    category: 'chronic-pain',
    keyFindings: [
      'Transcranial magnetic stimulation reduced chronic pain by 55%',
      'No significant side effects observed in 6-month trial',
      'Applicable to fibromyalgia and neuropathic pain',
    ],
    difficulty: 'Advanced',
    relevance: 91,
    tags: ['Pain Management', 'Neural Stimulation', 'Non-Opioid'],
    isBreaking: false,
    isFeatured: true,
  },
  {
    id: 3,
    title: 'Continuous Glucose Monitoring Reduces A1C Levels in Type 2 Diabetes',
    journal: 'Diabetes Care',
    date: 'Jan 2026',
    category: 'diabetes',
    keyFindings: [
      'CGM users saw 1.2% average A1C reduction',
      'Real-time feedback improved dietary choices',
      'Cost-effective when combined with telehealth',
    ],
    difficulty: 'Beginner',
    relevance: 88,
    tags: ['Type 2 Diabetes', 'CGM', 'A1C'],
    isBreaking: false,
    isFeatured: false,
  },
  {
    id: 4,
    title: 'Gut Microbiome Modulation Shows Promise for Autoimmune Conditions',
    journal: 'Nature Immunology',
    date: 'Mar 2026',
    category: 'autoimmune',
    keyFindings: [
      'Specific probiotic strains reduced inflammation markers by 35%',
      'Improved quality of life scores in rheumatoid arthritis patients',
      'Potential for personalized microbiome therapies',
    ],
    difficulty: 'Advanced',
    relevance: 86,
    tags: ['Microbiome', 'Autoimmune', 'Inflammation'],
    isBreaking: true,
    isFeatured: false,
  },
  {
    id: 5,
    title: 'Psilocybin-Assisted Therapy for Alcohol Use Disorder: Phase 3 Results',
    journal: 'The Lancet Psychiatry',
    date: 'Dec 2025',
    category: 'addiction',
    keyFindings: [
      '48% of participants achieved sustained abstinence',
      'Two sessions sufficient for lasting behavioral change',
      'FDA fast-track designation pending',
    ],
    difficulty: 'Intermediate',
    relevance: 92,
    tags: ['Addiction', 'Psilocybin', 'Alcohol Use'],
    isBreaking: false,
    isFeatured: false,
  },
  {
    id: 6,
    title: 'Early Detection of Alzheimer\'s Through Retinal Biomarkers',
    journal: 'Neurology',
    date: 'Feb 2026',
    category: 'neurology',
    keyFindings: [
      'Retinal scans detected amyloid deposits 10 years before symptoms',
      'Non-invasive screening achievable in routine eye exams',
      '92% sensitivity and 85% specificity',
    ],
    difficulty: 'Intermediate',
    relevance: 95,
    tags: ['Alzheimer\'s', 'Early Detection', 'Biomarkers'],
    isBreaking: false,
    isFeatured: false,
  },
  {
    id: 7,
    title: 'Social Prescribing Reduces Anxiety Symptoms in Young Adults',
    journal: 'British Medical Journal',
    date: 'Jan 2026',
    category: 'mental-health',
    keyFindings: [
      'Community engagement programs reduced anxiety scores by 30%',
      'Group activities more effective than individual interventions',
      'Benefits persisted after program completion',
    ],
    difficulty: 'Beginner',
    relevance: 78,
    tags: ['Anxiety', 'Social Prescribing', 'Young Adults'],
    isBreaking: false,
    isFeatured: false,
  },
  {
    id: 8,
    title: 'Wearable Devices Predict Pain Flare-Ups 48 Hours in Advance',
    journal: 'Digital Health',
    date: 'Mar 2026',
    category: 'chronic-pain',
    keyFindings: [
      'Machine learning model predicted flare-ups with 82% accuracy',
      'Heart rate variability and sleep patterns key predictors',
      'Enabled proactive pain management strategies',
    ],
    difficulty: 'Beginner',
    relevance: 84,
    tags: ['Wearables', 'Prediction', 'Pain Flare'],
    isBreaking: true,
    isFeatured: false,
  },
]

export default function ResearchPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [saved, setSaved] = useState<number[]>([])

  const filteredPapers = activeCategory === 'all'
    ? papers
    : papers.filter(p => p.category === activeCategory)

  const featuredPaper = papers.find(p => p.isFeatured && p.isBreaking) || papers.find(p => p.isFeatured)

  const toggleSave = (id: number) => {
    setSaved(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case 'Beginner': return 'bg-[#6B8A83]/30 text-[#eedfc8]'
      case 'Intermediate': return 'bg-[#D19A58]/30 text-[#D19A58]'
      case 'Advanced': return 'bg-[#B85C3A]/30 text-[#B85C3A]'
      default: return 'bg-[#eedfc8]/10 text-[#eedfc8]'
    }
  }

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return 'bg-[#6B8A83]'
    if (score >= 80) return 'bg-[#D19A58]'
    return 'bg-[#eedfc8]/30'
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      <div className="px-5 pt-14 pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Research</h1>
          <p className="text-[#eedfc8]/60 text-sm">Latest medical research and findings</p>
        </div>

        {/* Featured Research */}
        {featuredPaper && (
          <div className="card mb-6 bg-gradient-to-br from-[#6B8A83]/30 to-[#2A4A42] border-[#6B8A83]/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge bg-[#D19A58]/30 text-[#D19A58]">
                <i className="ri-star-fill mr-1 text-[10px]"></i>Featured
              </span>
              {featuredPaper.isBreaking && (
                <span className="badge bg-[#B85C3A]/30 text-[#B85C3A]">
                  <i className="ri-flashlight-fill mr-1 text-[10px]"></i>Breaking
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-[#eedfc8] mb-2 leading-tight">{featuredPaper.title}</h3>
            <p className="text-xs text-[#eedfc8]/50 mb-3">
              {featuredPaper.journal} &middot; {featuredPaper.date}
            </p>
            <ul className="space-y-1.5 mb-4">
              {featuredPaper.keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#eedfc8]/70">
                  <i className="ri-check-line text-[#6B8A83] mt-0.5 shrink-0"></i>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
            <button className="btn-primary flex items-center gap-2 text-xs">
              <i className="ri-file-text-line"></i>
              Read Full Paper
            </button>
          </div>
        )}

        {/* Category Filters */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id ? 'tab-active' : 'tab-inactive'
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
          <h2 className="section-title mb-0">{filteredPapers.length} Papers</h2>
          <span className="text-xs text-[#eedfc8]/50">Sorted by relevance</span>
        </div>

        {/* Research Cards */}
        <div className="space-y-4">
          {filteredPapers.map(paper => (
            <div key={paper.id} className="card">
              {/* Badges Row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {paper.isBreaking && (
                  <span className="badge bg-[#B85C3A]/30 text-[#B85C3A]">
                    <i className="ri-flashlight-fill mr-1 text-[10px]"></i>Breaking
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getDifficultyColor(paper.difficulty)}`}>
                  {paper.difficulty}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-[#eedfc8] text-sm leading-tight mb-2">{paper.title}</h3>

              {/* Journal & Date */}
              <p className="text-xs text-[#eedfc8]/50 mb-3">
                <i className="ri-book-2-line mr-1"></i>
                {paper.journal} &middot; {paper.date}
              </p>

              {/* Key Findings */}
              <div className="bg-[#eedfc8]/5 rounded-lg p-3 mb-3">
                <p className="text-[10px] font-semibold text-[#eedfc8]/40 uppercase tracking-wider mb-2">Key Findings</p>
                <ul className="space-y-1.5">
                  {paper.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#eedfc8]/70">
                      <i className="ri-arrow-right-s-line text-[#6B8A83] mt-0.5 shrink-0"></i>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Relevance Score */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#eedfc8]/40 uppercase tracking-wider font-medium">Relevance Score</span>
                  <span className="text-xs font-semibold text-[#eedfc8]">{paper.relevance}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#eedfc8]/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getRelevanceColor(paper.relevance)}`}
                    style={{ width: `${paper.relevance}%` }}
                  ></div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {paper.tags.map(tag => (
                  <span key={tag} className="bg-[#eedfc8]/8 text-[#eedfc8]/60 px-2.5 py-1 rounded-full text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5">
                  <i className="ri-file-text-line"></i>
                  Read Paper
                </button>
                <button
                  onClick={() => toggleSave(paper.id)}
                  className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all border ${
                    saved.includes(paper.id)
                      ? 'bg-[#D19A58]/20 border-[#D19A58]/40 text-[#D19A58]'
                      : 'btn-secondary'
                  }`}
                >
                  <i className={saved.includes(paper.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'}></i>
                  <span className="ml-1.5">Save</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
