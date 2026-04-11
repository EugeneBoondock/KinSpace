'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { DatabaseService } from '@/lib/database';

type Tab = 'for-you' | 'following' | 'your-groups';

const mockRecommended = [
  {
    id: '1',
    name: 'Anxiety Warriors United',
    description: 'A safe space for people living with anxiety disorders to share strategies and support.',
    members: 1243,
    matchPercent: 95,
    matchReasons: ['Anxiety', 'CBT', 'Mindfulness'],
    nextMeeting: 'Today, 7:00 PM',
    type: 'virtual' as const,
    isNew: true,
  },
  {
    id: '2',
    name: 'Chronic Fatigue Circle',
    description: 'For those managing CFS/ME. Pacing strategies, rest advocacy, and emotional support.',
    members: 567,
    matchPercent: 88,
    matchReasons: ['Chronic Fatigue', 'Self-Care'],
    nextMeeting: 'Tomorrow, 5:30 PM',
    type: 'virtual' as const,
    isNew: false,
  },
  {
    id: '3',
    name: 'Mindful Depression Recovery',
    description: 'Combining mindfulness with peer support for those working through depression.',
    members: 1567,
    matchPercent: 82,
    matchReasons: ['Depression', 'Mindfulness'],
    nextMeeting: 'Sat, 10:00 AM',
    type: 'virtual' as const,
    isNew: false,
  },
  {
    id: '4',
    name: 'Young Adults with Chronic Illness',
    description: 'Navigating careers, relationships, and life goals while managing a chronic condition.',
    members: 945,
    matchPercent: 79,
    matchReasons: ['Chronic Illness', 'Young Adults'],
    nextMeeting: 'Mon, 8:00 PM',
    type: 'in-person' as const,
    isNew: true,
  },
  {
    id: '5',
    name: 'Holistic Healing Collective',
    description: 'Exploring complementary therapies alongside traditional treatment. Open-minded and evidence-informed.',
    members: 378,
    matchPercent: 74,
    matchReasons: ['Holistic', 'Wellness'],
    nextMeeting: 'Wed, 6:00 PM',
    type: 'virtual' as const,
    isNew: false,
  },
];

const mockFollowing = [
  {
    id: '10',
    name: 'PTSD & Trauma Support',
    description: 'A gentle, moderated space for trauma survivors.',
    members: 1890,
    lastPost: '2h ago',
    unread: 5,
    type: 'virtual' as const,
  },
  {
    id: '11',
    name: 'Cancer Survivors Network',
    description: 'Connecting cancer survivors and those in treatment.',
    members: 654,
    lastPost: '6h ago',
    unread: 2,
    type: 'virtual' as const,
  },
  {
    id: '12',
    name: 'Lupus & Autoimmune Alliance',
    description: 'Supporting each other through autoimmune flare-ups and remissions.',
    members: 432,
    lastPost: '1d ago',
    unread: 0,
    type: 'in-person' as const,
  },
];

const mockYourGroups = [
  {
    id: '20',
    name: 'My Anxiety Support Pod',
    description: 'Your personal support group for anxiety management and daily check-ins.',
    members: 12,
    role: 'Admin',
    lastActivity: '30 min ago',
    type: 'virtual' as const,
    unread: 3,
  },
  {
    id: '21',
    name: 'Fibro Friends',
    description: 'A small close-knit group for fibromyalgia warriors to share daily experiences.',
    members: 8,
    role: 'Member',
    lastActivity: '2h ago',
    type: 'virtual' as const,
    unread: 0,
  },
  {
    id: '22',
    name: 'Meditation & Chronic Pain',
    description: 'Weekly meditation sessions focused on pain management techniques.',
    members: 24,
    role: 'Member',
    lastActivity: '1d ago',
    type: 'virtual' as const,
    unread: 1,
  },
];

export default function Groups() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('for-you');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<'virtual' | 'in-person'>('virtual');
  const [creating, setCreating] = useState(false);
  const [firestoreGroups, setFirestoreGroups] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    async function loadGroups() {
      try {
        const groups = await DatabaseService.getGroups();
        setFirestoreGroups(groups as Record<string, unknown>[]);
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    }
    if (user) loadGroups();
  }, [user]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    setCreating(true);
    try {
      await DatabaseService.createGroup(user.userId, {
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        category: newGroupType,
      });
      const groups = await DatabaseService.getGroups();
      setFirestoreGroups(groups as Record<string, unknown>[]);
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await DatabaseService.joinGroup(groupId, user.userId);
    } catch (err) {
      console.error('Failed to join group:', err);
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'for-you', label: 'For You', icon: 'ri-sparkling-line' },
    { id: 'following', label: 'Following', icon: 'ri-bookmark-line' },
    { id: 'your-groups', label: 'Your Groups', icon: 'ri-team-line' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-36 skeleton" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-28 skeleton rounded-full" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="h-5 w-3/4 skeleton" />
              <div className="h-4 w-full skeleton" />
              <div className="h-9 w-full skeleton rounded-full" />
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
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#eedfc8]">Groups</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 btn-primary text-xs py-2 px-3"
          >
            <i className="ri-add-line" />
            Create
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#eedfc8]/5 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'tab-active' : 'tab-inactive'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* For You Tab */}
      {activeTab === 'for-you' && (
        <div className="px-4 space-y-3">
          <p className="text-xs text-[#eedfc8]/50">
            Recommended based on your conditions and interests
          </p>

          {mockRecommended.map((group) => (
            <div key={group.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[#eedfc8]">{group.name}</h3>
                    {group.isNew && (
                      <span className="badge text-[10px] bg-[#B85C3A]/20 text-[#B85C3A]">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#eedfc8]/60 mt-1">{group.description}</p>
                </div>
                {/* Match percentage */}
                <div className="flex-shrink-0 w-14 h-14 rounded-full border-2 border-[#D19A58] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#D19A58]">
                      {group.matchPercent}%
                    </p>
                    <p className="text-[8px] text-[#eedfc8]/40">match</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {group.matchReasons.map((reason) => (
                  <span key={reason} className="badge text-[10px]">
                    <i className="ri-link mr-1" />
                    {reason}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                <span className="flex items-center gap-1">
                  <i className="ri-group-line" />
                  {group.members.toLocaleString()} members
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-line" />
                  {group.nextMeeting}
                </span>
                <span
                  className={`badge text-[10px] ${
                    group.type === 'virtual'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-green-500/20 text-green-300'
                  }`}
                >
                  {group.type === 'virtual' ? 'Virtual' : 'In-Person'}
                </span>
              </div>

              <button className="w-full btn-primary text-sm py-2.5">Join Group</button>
            </div>
          ))}
        </div>
      )}

      {/* Following Tab */}
      {activeTab === 'following' && (
        <div className="px-4 space-y-3">
          {mockFollowing.length === 0 ? (
            <div className="card text-center py-8">
              <i className="ri-bookmark-line text-4xl text-[#eedfc8]/20 mb-3" />
              <p className="text-[#eedfc8]/60 text-sm">
                You are not following any groups yet.
              </p>
              <button
                onClick={() => setActiveTab('for-you')}
                className="btn-primary text-xs mt-3"
              >
                Discover Groups
              </button>
            </div>
          ) : (
            mockFollowing.map((group) => (
              <div key={group.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#eedfc8]">{group.name}</h3>
                      {group.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#B85C3A] text-white text-[10px] flex items-center justify-center font-bold">
                          {group.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#eedfc8]/60 mt-0.5">
                      {group.description}
                    </p>
                  </div>
                  <span
                    className={`badge text-[10px] flex-shrink-0 ${
                      group.type === 'virtual'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}
                  >
                    {group.type === 'virtual' ? 'Virtual' : 'In-Person'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                  <span className="flex items-center gap-1">
                    <i className="ri-group-line" />
                    {group.members.toLocaleString()} members
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line" />
                    Last post {group.lastPost}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 btn-primary text-sm py-2">View</button>
                  <button className="btn-secondary text-sm py-2 px-4">
                    <i className="ri-notification-off-line" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Your Groups Tab */}
      {activeTab === 'your-groups' && (
        <div className="px-4 space-y-3">
          {mockYourGroups.length === 0 ? (
            <div className="card text-center py-8">
              <i className="ri-team-line text-4xl text-[#eedfc8]/20 mb-3" />
              <p className="text-[#eedfc8]/60 text-sm">
                You have not joined or created any groups yet.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary text-xs mt-3"
              >
                Create Your First Group
              </button>
            </div>
          ) : (
            mockYourGroups.map((group) => (
              <div key={group.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#eedfc8]">{group.name}</h3>
                      {group.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#B85C3A] text-white text-[10px] flex items-center justify-center font-bold">
                          {group.unread}
                        </span>
                      )}
                      <span className="badge text-[10px] bg-[#D19A58]/20 text-[#D19A58]">
                        {group.role}
                      </span>
                    </div>
                    <p className="text-sm text-[#eedfc8]/60 mt-0.5">
                      {group.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                  <span className="flex items-center gap-1">
                    <i className="ri-group-line" />
                    {group.members} members
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line" />
                    Active {group.lastActivity}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 btn-primary text-sm py-2">Open</button>
                  <button className="btn-secondary text-sm py-2 px-4">
                    <i className="ri-settings-3-line" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-lg bg-brand-primary border-t border-[#eedfc8]/10 rounded-t-2xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#eedfc8]">Create a Group</h2>
              <button onClick={() => setShowCreateModal(false)}>
                <i className="ri-close-line text-[#eedfc8]/60 text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#eedfc8]/60 mb-1.5 block">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Give your group a name"
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs text-[#eedfc8]/60 mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What is this group about?"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#eedfc8]/60 mb-1.5 block">Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewGroupType('virtual')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      newGroupType === 'virtual'
                        ? 'bg-[#eedfc8] text-[#2A4A42]'
                        : 'bg-[#eedfc8]/10 text-[#eedfc8]/60'
                    }`}
                  >
                    <i className="ri-vidicon-line mr-1.5" />
                    Virtual
                  </button>
                  <button
                    onClick={() => setNewGroupType('in-person')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      newGroupType === 'in-person'
                        ? 'bg-[#eedfc8] text-[#2A4A42]'
                        : 'bg-[#eedfc8]/10 text-[#eedfc8]/60'
                    }`}
                  >
                    <i className="ri-map-pin-line mr-1.5" />
                    In-Person
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || creating}
                className="w-full btn-primary py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <><i className="ri-loader-4-line animate-spin mr-2" />Creating...</>
                ) : (
                  'Create Group'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
