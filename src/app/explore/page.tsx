'use client';

import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';

const categories = [
  { id: 'all', name: 'All', count: 850 },
  { id: 'mental-health', name: 'Mental Health', count: 245 },
  { id: 'chronic-illness', name: 'Chronic Illness', count: 180 },
  { id: 'diabetes', name: 'Diabetes', count: 95 },
  { id: 'cancer', name: 'Cancer', count: 75 },
  { id: 'anxiety', name: 'Anxiety', count: 120 },
  { id: 'autoimmune', name: 'Autoimmune', count: 65 },
  { id: 'rare-diseases', name: 'Rare Diseases', count: 45 },
];

const mockGroups = [
  {
    id: '1',
    name: 'Anxiety Warriors United',
    description:
      'A safe space for people living with anxiety disorders. Share coping strategies, celebrate wins, and support each other.',
    members: 1243,
    nextMeeting: 'Today, 7:00 PM',
    type: 'virtual' as const,
    category: 'anxiety',
    tags: ['Anxiety', 'Support', 'CBT'],
  },
  {
    id: '2',
    name: 'Type 2 Diabetes Support Circle',
    description:
      'Managing diabetes together. We discuss nutrition, medication, lifestyle changes and emotional wellbeing.',
    members: 876,
    nextMeeting: 'Tomorrow, 6:30 PM',
    type: 'virtual' as const,
    category: 'diabetes',
    tags: ['Diabetes', 'Nutrition', 'Lifestyle'],
  },
  {
    id: '3',
    name: 'Chronic Pain & Fibromyalgia',
    description:
      'For those navigating life with chronic pain conditions. We understand when others may not.',
    members: 2105,
    nextMeeting: 'Wed, 5:00 PM',
    type: 'in-person' as const,
    location: 'Community Center, Brooklyn',
    category: 'chronic-illness',
    tags: ['Chronic Pain', 'Fibromyalgia'],
  },
  {
    id: '4',
    name: 'Cancer Survivors Network',
    description:
      'Connecting cancer survivors and those in treatment. Find hope, share experiences, and build lasting bonds.',
    members: 654,
    nextMeeting: 'Thu, 4:00 PM',
    type: 'virtual' as const,
    category: 'cancer',
    tags: ['Cancer', 'Survivorship'],
  },
  {
    id: '5',
    name: 'Lupus & Autoimmune Alliance',
    description:
      'Supporting each other through autoimmune flare-ups and remissions. Tips, research updates, and friendship.',
    members: 432,
    nextMeeting: 'Fri, 6:00 PM',
    type: 'in-person' as const,
    location: 'Healing Space, Manhattan',
    category: 'autoimmune',
    tags: ['Lupus', 'Autoimmune', 'Research'],
  },
  {
    id: '6',
    name: 'Mindful Depression Recovery',
    description:
      'Combining mindfulness practices with peer support for those working through depression. All stages welcome.',
    members: 1567,
    nextMeeting: 'Sat, 10:00 AM',
    type: 'virtual' as const,
    category: 'mental-health',
    tags: ['Depression', 'Mindfulness', 'Recovery'],
  },
  {
    id: '7',
    name: 'Rare Disease Warriors',
    description:
      'When your diagnosis is rare, feeling alone is common. Connect with others who truly understand the journey.',
    members: 289,
    nextMeeting: 'Sun, 3:00 PM',
    type: 'virtual' as const,
    category: 'rare-diseases',
    tags: ['Rare Diseases', 'Advocacy'],
  },
  {
    id: '8',
    name: 'Young Adults with Chronic Illness',
    description:
      'Navigating careers, relationships, and life goals while managing a chronic condition. Ages 18-35.',
    members: 945,
    nextMeeting: 'Mon, 8:00 PM',
    type: 'virtual' as const,
    category: 'chronic-illness',
    tags: ['Young Adults', 'Chronic Illness', 'Career'],
  },
  {
    id: '9',
    name: 'PTSD & Trauma Support',
    description:
      'A gentle, moderated space for trauma survivors. Emphasis on safety, grounding, and gradual healing.',
    members: 1890,
    nextMeeting: 'Tue, 7:30 PM',
    type: 'virtual' as const,
    category: 'mental-health',
    tags: ['PTSD', 'Trauma', 'Healing'],
  },
];

export default function Explore() {
  const { loading } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinedGroups, setJoinedGroups] = useState<string[]>([]);

  const filteredGroups = mockGroups.filter((group) => {
    const matchesCategory =
      activeCategory === 'all' || group.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleJoinGroup = (groupId: string) => {
    setJoinedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-48 skeleton" />
          <div className="h-12 w-full skeleton rounded-xl" />
          <div className="flex gap-2 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 w-24 skeleton rounded-full flex-shrink-0" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="h-5 w-3/4 skeleton" />
              <div className="h-4 w-full skeleton" />
              <div className="h-4 w-1/2 skeleton" />
              <div className="flex gap-2">
                <div className="h-9 w-28 skeleton rounded-full" />
                <div className="h-9 w-28 skeleton rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#eedfc8]">Explore</h1>
          <button className="w-10 h-10 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
            <i className="ri-filter-3-line text-[#eedfc8] text-lg" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search support groups..."
            className="input-field pl-10 pr-4"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
            >
              <i className="ri-close-circle-fill text-[#eedfc8]/40" />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-[#eedfc8] text-[#2A4A42] font-semibold'
                  : 'bg-[#eedfc8]/10 text-[#eedfc8]/70'
              }`}
            >
              {cat.name}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeCategory === cat.id
                    ? 'bg-[#2A4A42]/15 text-[#2A4A42]'
                    : 'bg-[#eedfc8]/10 text-[#eedfc8]/50'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2">
        <p className="text-xs text-[#eedfc8]/50">
          {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Group Cards */}
      <div className="px-4 space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="card text-center py-8">
            <i className="ri-search-line text-4xl text-[#eedfc8]/20 mb-3" />
            <p className="text-[#eedfc8]/60 text-sm">
              No groups found matching your search.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
              className="btn-secondary text-xs mt-3"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const joined = joinedGroups.includes(group.id);
            return (
              <div key={group.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#eedfc8] leading-tight">
                      {group.name}
                    </h3>
                  </div>
                  <span
                    className={`badge text-[10px] flex-shrink-0 ${
                      group.type === 'virtual'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}
                  >
                    <i
                      className={`${
                        group.type === 'virtual'
                          ? 'ri-vidicon-line'
                          : 'ri-map-pin-line'
                      } mr-1`}
                    />
                    {group.type === 'virtual' ? 'Virtual' : 'In-Person'}
                  </span>
                </div>

                <p className="text-sm text-[#eedfc8]/60 leading-relaxed">
                  {group.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map((tag) => (
                    <span key={tag} className="badge text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#eedfc8]/50">
                  <span className="flex items-center gap-1">
                    <i className="ri-group-line" />
                    {group.members.toLocaleString()} members
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line" />
                    {group.nextMeeting}
                  </span>
                  {'location' in group && group.location && (
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-2-line" />
                      {group.location}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleJoinGroup(group.id)}
                    className={`flex-1 text-sm py-2.5 rounded-full font-semibold transition-all ${
                      joined
                        ? 'bg-[#D19A58]/20 text-[#D19A58] border border-[#D19A58]/30'
                        : 'btn-primary'
                    }`}
                  >
                    {joined ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <i className="ri-check-line" /> Joined
                      </span>
                    ) : (
                      'Join Group'
                    )}
                  </button>
                  <button className="btn-secondary text-sm py-2.5 px-4">
                    Learn More
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
