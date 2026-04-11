'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';
import { DatabaseService } from '@/lib/database';

type Tab = 'discussions' | 'angels' | 'mentors' | 'adventures';

const mockPosts = [
  {
    id: '1',
    author: 'Sarah M.',
    avatar: null,
    content: 'Just completed my first week of physical therapy after my diagnosis. Small wins matter! Anyone else celebrating milestones today?',
    likes: 24,
    comments: 8,
    timestamp: '2h ago',
    liked: false,
  },
  {
    id: '2',
    author: 'James K.',
    avatar: null,
    content: 'Found a great breathing technique that helps with my anxiety flare-ups. Inhale 4 counts, hold 7, exhale 8. Changed my mornings completely.',
    likes: 57,
    comments: 15,
    timestamp: '4h ago',
    liked: true,
  },
  {
    id: '3',
    author: 'Priya R.',
    avatar: null,
    content: 'Reminder: You are not your diagnosis. You are a whole person who happens to be navigating something difficult. Be gentle with yourself today.',
    likes: 112,
    comments: 23,
    timestamp: '6h ago',
    liked: false,
  },
  {
    id: '4',
    author: 'Alex T.',
    avatar: null,
    content: 'Does anyone have tips for explaining chronic fatigue to coworkers? I have a meeting with my manager tomorrow and could use advice.',
    likes: 19,
    comments: 31,
    timestamp: '8h ago',
    liked: false,
  },
  {
    id: '5',
    author: 'Maya L.',
    avatar: null,
    content: 'My angel supporter helped me navigate a really tough insurance call today. So grateful for this community and the support system here.',
    likes: 45,
    comments: 6,
    timestamp: '12h ago',
    liked: false,
  },
];

const mockAngels = [
  {
    id: '1',
    name: 'Maya Chen',
    specialty: 'Anxiety & Depression',
    rating: 4.9,
    responseTime: '< 5 min',
    currentLoad: 3,
    maxLoad: 5,
    available: true,
    bio: 'Living with anxiety for 8 years. Certified peer support specialist.',
  },
  {
    id: '2',
    name: 'Marcus Thompson',
    specialty: 'Chronic Pain',
    rating: 4.8,
    responseTime: '< 15 min',
    currentLoad: 4,
    maxLoad: 5,
    available: true,
    bio: 'Chronic pain warrior. Here to listen and share coping strategies.',
  },
  {
    id: '3',
    name: 'Elena Vasquez',
    specialty: 'Autoimmune Conditions',
    rating: 4.7,
    responseTime: '< 10 min',
    currentLoad: 2,
    maxLoad: 5,
    available: true,
    bio: 'Lupus advocate. Helping others navigate their autoimmune journey.',
  },
  {
    id: '4',
    name: 'David Park',
    specialty: 'Cancer Support',
    rating: 5.0,
    responseTime: '< 20 min',
    currentLoad: 5,
    maxLoad: 5,
    available: false,
    bio: 'Cancer survivor. Passionate about helping others through treatment.',
  },
];

const mockMentors = [
  {
    id: '1',
    name: 'Dr. Elena Rodriguez',
    expertise: ['Clinical Psychology', 'CBT', 'Trauma'],
    credentials: 'PhD, Licensed Psychologist',
    sessions: 342,
    rating: 4.9,
    price: 75,
  },
  {
    id: '2',
    name: 'James Wilson',
    expertise: ['Recovery Coaching', 'Mindfulness', 'Stress Management'],
    credentials: 'CPRS, Recovery Coach',
    sessions: 218,
    rating: 4.8,
    price: 45,
  },
  {
    id: '3',
    name: 'Dr. Aisha Patel',
    expertise: ['Chronic Illness', 'Pain Management', 'Acceptance Therapy'],
    credentials: 'PsyD, Health Psychologist',
    sessions: 187,
    rating: 4.7,
    price: 80,
  },
  {
    id: '4',
    name: 'Lisa Nakamura',
    expertise: ['Art Therapy', 'Emotional Expression', 'Group Work'],
    credentials: 'ATR-BC, Licensed Art Therapist',
    sessions: 156,
    rating: 4.9,
    price: 55,
  },
];

const mockAdventures = [
  {
    id: '1',
    title: 'Mindful Morning Walk',
    description: 'Join us for a gentle guided walk focusing on mindfulness and connection with nature.',
    date: 'Sat, Apr 18',
    time: '8:00 AM',
    participants: 12,
    maxParticipants: 20,
    type: 'in-person' as const,
    location: 'Central Park, NY',
  },
  {
    id: '2',
    title: 'Virtual Art Therapy Session',
    description: 'Express your feelings through art in this supportive group session. No experience needed.',
    date: 'Mon, Apr 20',
    time: '6:00 PM',
    participants: 8,
    maxParticipants: 15,
    type: 'virtual' as const,
  },
  {
    id: '3',
    title: 'Cooking for Wellness',
    description: 'Learn anti-inflammatory recipes that taste amazing. Ingredients list provided in advance.',
    date: 'Wed, Apr 22',
    time: '5:30 PM',
    participants: 18,
    maxParticipants: 25,
    type: 'virtual' as const,
  },
  {
    id: '4',
    title: 'Yoga for Chronic Pain',
    description: 'Adaptive yoga designed specifically for those managing chronic pain conditions.',
    date: 'Fri, Apr 24',
    time: '10:00 AM',
    participants: 6,
    maxParticipants: 12,
    type: 'in-person' as const,
    location: 'Healing Hearts Studio, Brooklyn',
  },
  {
    id: '5',
    title: 'Game Night: Board Games & Bonding',
    description: 'A fun virtual game night to unwind, laugh, and build connections with fellow members.',
    date: 'Sat, Apr 25',
    time: '7:00 PM',
    participants: 14,
    maxParticipants: 30,
    type: 'virtual' as const,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={`${
            star <= Math.floor(rating)
              ? 'ri-star-fill'
              : star - 0.5 <= rating
                ? 'ri-star-half-fill'
                : 'ri-star-line'
          } text-[#D19A58] text-sm`}
        />
      ))}
      <span className="text-xs text-[#eedfc8]/60 ml-1">{rating}</span>
    </div>
  );
}

export default function Community() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('discussions');
  const [posts, setPosts] = useState<{ id: string; author: string; avatar: string | null; content: string; likes: number; comments: number; timestamp: string; liked: boolean }[]>(mockPosts);
  const [composing, setComposing] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [joinedAdventures, setJoinedAdventures] = useState<string[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'discussions', label: 'Discussions', icon: 'ri-discuss-line' },
    { id: 'angels', label: 'Angels', icon: 'ri-heart-pulse-line' },
    { id: 'mentors', label: 'Mentors', icon: 'ri-user-star-line' },
    { id: 'adventures', label: 'Adventures', icon: 'ri-compass-3-line' },
  ];

  useEffect(() => {
    async function loadPosts() {
      try {
        const firestorePosts = await DatabaseService.getCommunityPosts(20);
        if (firestorePosts.length > 0) {
          setPosts(firestorePosts.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            author: (p.profile as Record<string, unknown>)?.full_name as string || (p.profile as Record<string, unknown>)?.username as string || 'Anonymous',
            avatar: (p.profile as Record<string, unknown>)?.avatar_url as string || null,
            content: p.content as string,
            likes: (p.likes_count as number) || 0,
            comments: (p.comments_count as number) || 0,
            timestamp: p.created_at ? new Date((p.created_at as { seconds: number }).seconds * 1000).toLocaleDateString() : 'Recently',
            liked: false,
          })));
        }
      } catch (err) {
        console.error('Failed to load posts from Firestore:', err);
      } finally {
        setPostsLoaded(true);
      }
    }
    if (user) loadPosts();
  }, [user]);

  const handleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    try {
      if (postsLoaded) await DatabaseService.likePost(postId);
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !user) return;
    const newPost = {
      id: Date.now().toString(),
      author: user.displayName || 'You',
      avatar: null,
      content: newPostContent.trim(),
      likes: 0,
      comments: 0,
      timestamp: 'Just now',
      liked: false,
    };
    setPosts([newPost, ...posts]);
    setNewPostContent('');
    setComposing(false);
    try {
      const result = await DatabaseService.createPost(user.userId, newPostContent.trim(), 'discussion');
      setPosts((prev) => prev.map((p) => p.id === newPost.id ? { ...p, id: result.id } : p));
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  const handleJoinAdventure = (adventureId: string) => {
    setJoinedAdventures((prev) =>
      prev.includes(adventureId)
        ? prev.filter((id) => id !== adventureId)
        : [...prev, adventureId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-48 skeleton" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 skeleton rounded-full" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 skeleton rounded-full" />
                <div className="h-4 w-24 skeleton" />
              </div>
              <div className="h-4 w-full skeleton" />
              <div className="h-4 w-3/4 skeleton" />
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
          <h1 className="text-2xl font-bold text-[#eedfc8]">Community</h1>
          <button className="w-10 h-10 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
            <i className="ri-notification-3-line text-[#eedfc8] text-lg" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#eedfc8]/5 rounded-xl p-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'tab-active' : 'tab-inactive'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discussions Tab */}
      {activeTab === 'discussions' && (
        <div className="px-4 space-y-3">
          {/* Create Post Button */}
          {!composing ? (
            <button
              onClick={() => setComposing(true)}
              className="w-full card flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-user-line text-[#D19A58]" />
              </div>
              <span className="text-[#eedfc8]/50 text-sm">
                Share something with the community...
              </span>
              <i className="ri-edit-line text-[#eedfc8]/40 ml-auto" />
            </button>
          ) : (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#eedfc8]">Create Post</h3>
                <button
                  onClick={() => {
                    setComposing(false);
                    setNewPostContent('');
                  }}
                >
                  <i className="ri-close-line text-[#eedfc8]/60 text-xl" />
                </button>
              </div>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                className="input-field resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
                    <i className="ri-image-line text-[#eedfc8]/60 text-sm" />
                  </button>
                  <button className="w-8 h-8 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
                    <i className="ri-emotion-line text-[#eedfc8]/60 text-sm" />
                  </button>
                </div>
                <button
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim()}
                  className="btn-primary text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Post
                </button>
              </div>
            </div>
          )}

          {/* Posts */}
          {posts.map((post) => (
            <div key={post.id} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D19A58] font-semibold text-sm">
                    {post.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#eedfc8]">{post.author}</p>
                  <p className="text-xs text-[#eedfc8]/50">{post.timestamp}</p>
                </div>
                <button className="text-[#eedfc8]/40">
                  <i className="ri-more-2-fill" />
                </button>
              </div>
              <p className="text-sm text-[#eedfc8]/80 leading-relaxed">{post.content}</p>
              <div className="flex items-center gap-4 pt-1 border-t border-[#eedfc8]/10">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    post.liked ? 'text-[#B85C3A]' : 'text-[#eedfc8]/50'
                  }`}
                >
                  <i className={post.liked ? 'ri-heart-fill' : 'ri-heart-line'} />
                  {post.likes}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-[#eedfc8]/50">
                  <i className="ri-chat-1-line" />
                  {post.comments}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-[#eedfc8]/50 ml-auto">
                  <i className="ri-share-forward-line" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Angels Tab */}
      {activeTab === 'angels' && (
        <div className="px-4 space-y-3">
          <div className="card-light flex items-center gap-3 text-sm">
            <i className="ri-information-line text-[#D19A58] text-lg flex-shrink-0" />
            <p className="text-[#eedfc8]/70">
              Angels are peer supporters who have walked a similar path. They volunteer
              their time to help you navigate your journey.
            </p>
          </div>

          {mockAngels.map((angel) => (
            <div key={angel.id} className="card space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#D19A58] font-bold text-sm">
                    {angel.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#eedfc8]">{angel.name}</h3>
                    {angel.available && (
                      <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                    )}
                  </div>
                  <p className="text-xs text-[#D19A58] font-medium">{angel.specialty}</p>
                  <StarRating rating={angel.rating} />
                </div>
              </div>
              <p className="text-sm text-[#eedfc8]/60">{angel.bio}</p>
              <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                <span className="flex items-center gap-1">
                  <i className="ri-time-line" />
                  {angel.responseTime}
                </span>
                <span className="flex items-center gap-1">
                  <i className="ri-group-line" />
                  {angel.currentLoad}/{angel.maxLoad} souls
                </span>
              </div>
              <button
                disabled={!angel.available}
                className={`w-full text-sm py-2.5 rounded-full font-semibold transition-all ${
                  angel.available
                    ? 'btn-primary'
                    : 'bg-[#eedfc8]/10 text-[#eedfc8]/30 cursor-not-allowed'
                }`}
              >
                {angel.available ? 'Choose Angel' : 'Currently Full'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mentors Tab */}
      {activeTab === 'mentors' && (
        <div className="px-4 space-y-3">
          <div className="card-light flex items-center gap-3 text-sm">
            <i className="ri-information-line text-[#D19A58] text-lg flex-shrink-0" />
            <p className="text-[#eedfc8]/70">
              Mentors are licensed professionals and certified coaches offering guided
              sessions.
            </p>
          </div>

          {mockMentors.map((mentor) => (
            <div key={mentor.id} className="card space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-[#B85C3A]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#B85C3A] font-bold text-sm">
                    {mentor.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#eedfc8]">{mentor.name}</h3>
                  <p className="text-xs text-[#eedfc8]/50">{mentor.credentials}</p>
                  <StarRating rating={mentor.rating} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-[#D19A58]">${mentor.price}</p>
                  <p className="text-[10px] text-[#eedfc8]/40">per session</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mentor.expertise.map((tag) => (
                  <span key={tag} className="badge text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-[#eedfc8]/50">
                <span className="flex items-center gap-1">
                  <i className="ri-calendar-check-line" />
                  {mentor.sessions} sessions
                </span>
              </div>
              <button className="w-full btn-accent text-sm py-2.5">Book Session</button>
            </div>
          ))}
        </div>
      )}

      {/* Adventures Tab */}
      {activeTab === 'adventures' && (
        <div className="px-4 space-y-3">
          <div className="card-light flex items-center gap-3 text-sm">
            <i className="ri-compass-3-line text-[#D19A58] text-lg flex-shrink-0" />
            <p className="text-[#eedfc8]/70">
              Adventures are group activities designed to help you connect, heal, and have
              fun together.
            </p>
          </div>

          {mockAdventures.map((adventure) => {
            const joined = joinedAdventures.includes(adventure.id);
            return (
              <div key={adventure.id} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#eedfc8]">{adventure.title}</h3>
                    <p className="text-sm text-[#eedfc8]/60 mt-1">
                      {adventure.description}
                    </p>
                  </div>
                  <span
                    className={`badge text-[10px] ml-2 flex-shrink-0 ${
                      adventure.type === 'virtual'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}
                  >
                    <i
                      className={`${
                        adventure.type === 'virtual' ? 'ri-vidicon-line' : 'ri-map-pin-line'
                      } mr-1`}
                    />
                    {adventure.type === 'virtual' ? 'Virtual' : 'In-Person'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#eedfc8]/50">
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line" />
                    {adventure.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line" />
                    {adventure.time}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-group-line" />
                    {adventure.participants}/{adventure.maxParticipants}
                  </span>
                  {adventure.location && (
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-2-line" />
                      {adventure.location}
                    </span>
                  )}
                </div>
                {/* Capacity bar */}
                <div className="w-full h-1.5 bg-[#eedfc8]/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D19A58] rounded-full transition-all"
                    style={{
                      width: `${(adventure.participants / adventure.maxParticipants) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => handleJoinAdventure(adventure.id)}
                  className={`w-full text-sm py-2.5 rounded-full font-semibold transition-all ${
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
                    'Join Adventure'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
