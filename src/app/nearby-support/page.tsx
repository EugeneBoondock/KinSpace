'use client'

import { useState } from 'react'
import BottomNav from '@/components/BottomNav'

interface SupportGroup {
  id: number
  name: string
  distance: string
  distanceValue: number
  nextMeeting: string
  nextMeetingDate: Date
  memberCount: number
  category: string
  format: 'virtual' | 'in-person' | 'hybrid'
  description: string
  location: string
}

const mockGroups: SupportGroup[] = [
  {
    id: 1,
    name: 'Depression Recovery Circle',
    distance: '0.5 mi',
    distanceValue: 0.5,
    nextMeeting: 'Today, 7:00 PM',
    nextMeetingDate: new Date(Date.now() + 3600000),
    memberCount: 127,
    category: 'Mental Health',
    format: 'in-person',
    description: 'A safe space to share experiences and coping strategies for depression recovery.',
    location: 'Community Center, 123 Main St',
  },
  {
    id: 2,
    name: 'Chronic Pain Warriors',
    distance: '1.2 mi',
    distanceValue: 1.2,
    nextMeeting: 'Tomorrow, 6:30 PM',
    nextMeetingDate: new Date(Date.now() + 86400000),
    memberCount: 89,
    category: 'Chronic Pain',
    format: 'hybrid',
    description: 'Support and practical tips for managing chronic pain in daily life.',
    location: 'Health Hub, 456 Oak Ave',
  },
  {
    id: 3,
    name: 'Mindful Anxiety Support',
    distance: '0.8 mi',
    distanceValue: 0.8,
    nextMeeting: 'Wed, 8:00 PM',
    nextMeetingDate: new Date(Date.now() + 172800000),
    memberCount: 203,
    category: 'Anxiety',
    format: 'virtual',
    description: 'Learn mindfulness techniques and share anxiety management strategies with peers.',
    location: 'Online via Zoom',
  },
  {
    id: 4,
    name: 'Diabetes Management Group',
    distance: '2.1 mi',
    distanceValue: 2.1,
    nextMeeting: 'Thu, 5:30 PM',
    nextMeetingDate: new Date(Date.now() + 259200000),
    memberCount: 156,
    category: 'Diabetes',
    format: 'in-person',
    description: 'Share tips on blood sugar management, nutrition, and living well with diabetes.',
    location: 'Medical Arts Building, 789 Health Blvd',
  },
  {
    id: 5,
    name: 'Grief & Loss Support',
    distance: '1.5 mi',
    distanceValue: 1.5,
    nextMeeting: 'Fri, 7:00 PM',
    nextMeetingDate: new Date(Date.now() + 345600000),
    memberCount: 64,
    category: 'Grief',
    format: 'in-person',
    description: 'A compassionate group for those navigating grief, loss, and bereavement.',
    location: 'Serenity Room, 321 Peace Lane',
  },
  {
    id: 6,
    name: 'Addiction Recovery Network',
    distance: '0.3 mi',
    distanceValue: 0.3,
    nextMeeting: 'Daily, 8:00 AM',
    nextMeetingDate: new Date(Date.now() + 43200000),
    memberCount: 312,
    category: 'Addiction',
    format: 'hybrid',
    description: 'Daily support meetings for those on the path to recovery from substance use.',
    location: 'Recovery Center, 555 Hope St',
  },
  {
    id: 7,
    name: 'Caregiver Support Circle',
    distance: '3.0 mi',
    distanceValue: 3.0,
    nextMeeting: 'Sat, 10:00 AM',
    nextMeetingDate: new Date(Date.now() + 432000000),
    memberCount: 78,
    category: 'Caregiving',
    format: 'virtual',
    description: 'Connect with fellow caregivers for emotional support, tips, and respite resources.',
    location: 'Online via Google Meet',
  },
]

type SortOption = 'distance' | 'date' | 'popularity'

export default function NearbySupportPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('distance')

  const filteredGroups = mockGroups
    .filter(g =>
      !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return a.distanceValue - b.distanceValue
        case 'date':
          return a.nextMeetingDate.getTime() - b.nextMeetingDate.getTime()
        case 'popularity':
          return b.memberCount - a.memberCount
        default:
          return 0
      }
    })

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'virtual':
        return { color: 'bg-[#6B8A83]/30 text-[#6B8A83]', icon: 'ri-video-chat-line', label: 'Virtual' }
      case 'in-person':
        return { color: 'bg-[#D19A58]/30 text-[#D19A58]', icon: 'ri-map-pin-2-line', label: 'In-Person' }
      case 'hybrid':
        return { color: 'bg-[#B85C3A]/30 text-[#B85C3A]', icon: 'ri-git-merge-line', label: 'Hybrid' }
      default:
        return { color: 'bg-[#eedfc8]/10 text-[#eedfc8]', icon: 'ri-question-line', label: format }
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Mental Health': 'bg-[#6B8A83]/20 text-[#6B8A83]',
      'Chronic Pain': 'bg-[#B85C3A]/20 text-[#B85C3A]',
      'Anxiety': 'bg-[#D19A58]/20 text-[#D19A58]',
      'Diabetes': 'bg-[#6B8A83]/20 text-[#6B8A83]',
      'Grief': 'bg-[#eedfc8]/15 text-[#eedfc8]/70',
      'Addiction': 'bg-[#B85C3A]/20 text-[#B85C3A]',
      'Caregiving': 'bg-[#D19A58]/20 text-[#D19A58]',
    }
    return colors[category] || 'bg-[#eedfc8]/10 text-[#eedfc8]'
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      <div className="px-5 pt-14 pb-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Nearby Support</h1>
          <p className="text-[#eedfc8]/60 text-sm">Find support groups in your area</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/40"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search groups by name, category..."
            className="input-field pl-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#eedfc8]/10"
            >
              <i className="ri-close-line text-[#eedfc8]/40 text-sm"></i>
            </button>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex gap-2 mb-5">
          {([
            { key: 'distance' as SortOption, icon: 'ri-map-pin-line', label: 'Distance' },
            { key: 'date' as SortOption, icon: 'ri-calendar-line', label: 'Date' },
            { key: 'popularity' as SortOption, icon: 'ri-fire-line', label: 'Popular' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                sortBy === opt.key ? 'tab-active' : 'tab-inactive'
              }`}
            >
              <i className={`${opt.icon} text-sm`}></i>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">Support Groups</h2>
          <span className="text-xs text-[#eedfc8]/50">{filteredGroups.length} groups</span>
        </div>

        {/* Group Cards */}
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const formatBadge = getFormatBadge(group.format)
            return (
              <div key={group.id} className="card">
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`badge ${getCategoryColor(group.category)}`}>
                    {group.category}
                  </span>
                  <span className={`badge ${formatBadge.color}`}>
                    <i className={`${formatBadge.icon} mr-1 text-[10px]`}></i>
                    {formatBadge.label}
                  </span>
                </div>

                {/* Name */}
                <h3 className="font-semibold text-[#eedfc8] text-sm mb-2">{group.name}</h3>

                {/* Description */}
                <p className="text-xs text-[#eedfc8]/60 leading-relaxed mb-3">{group.description}</p>

                {/* Details */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-map-pin-2-line text-[#eedfc8]/40 shrink-0"></i>
                    <span className="flex-1">{group.location}</span>
                    <span className="text-[#D19A58] font-medium">{group.distance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-calendar-event-line text-[#eedfc8]/40 shrink-0"></i>
                    <span>Next: {group.nextMeeting}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-team-line text-[#eedfc8]/40 shrink-0"></i>
                    <span>{group.memberCount} members</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5">
                    <i className="ri-eye-line"></i>
                    View Details
                  </button>
                  <button className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5">
                    <i className="ri-add-line"></i>
                    Join Group
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredGroups.length === 0 && (
          <div className="text-center py-12">
            <i className="ri-search-line text-4xl text-[#eedfc8]/20 mb-3 block"></i>
            <p className="text-[#eedfc8]/50 text-sm mb-1">No groups found</p>
            <p className="text-[#eedfc8]/30 text-xs">Try a different search term</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
