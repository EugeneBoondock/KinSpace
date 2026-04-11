'use client';

import { useState, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';

interface MatchProfile {
  id: string;
  name: string;
  age: number;
  matchPercent: number;
  conditions: string[];
  bio: string;
  interests: string[];
  location: string;
}

const mockProfiles: MatchProfile[] = [
  {
    id: '1',
    name: 'Jordan S.',
    age: 28,
    matchPercent: 94,
    conditions: ['Anxiety', 'Chronic Fatigue'],
    bio: 'Navigating life with anxiety and CFS. Love cooking, board games, and long conversations about absolutely nothing. Looking for people who get it.',
    interests: ['Cooking', 'Board Games', 'Mindfulness'],
    location: 'Brooklyn, NY',
  },
  {
    id: '2',
    name: 'Riley M.',
    age: 31,
    matchPercent: 89,
    conditions: ['Depression', 'Fibromyalgia'],
    bio: 'Artist and fibro warrior. I paint my pain and find beauty in the struggle. Seeking connections who understand the invisible battles.',
    interests: ['Art', 'Music', 'Yoga'],
    location: 'Portland, OR',
  },
  {
    id: '3',
    name: 'Taylor K.',
    age: 25,
    matchPercent: 86,
    conditions: ['Anxiety', 'IBS'],
    bio: 'Software developer by day, anxious human by night. Working on being kinder to myself. Would love to connect with fellow warriors.',
    interests: ['Tech', 'Hiking', 'Reading'],
    location: 'Austin, TX',
  },
  {
    id: '4',
    name: 'Morgan P.',
    age: 33,
    matchPercent: 82,
    conditions: ['PTSD', 'Chronic Pain'],
    bio: 'Trauma survivor on a healing journey. I believe in the power of connection and shared experience. One day at a time.',
    interests: ['Gardening', 'Meditation', 'Podcasts'],
    location: 'Denver, CO',
  },
  {
    id: '5',
    name: 'Casey L.',
    age: 27,
    matchPercent: 79,
    conditions: ['Lupus', 'Anxiety'],
    bio: 'Living boldly with lupus. Flare-ups do not define me, but they sure make for interesting stories. Let us be friends who understand.',
    interests: ['Photography', 'Coffee', 'Dogs'],
    location: 'Seattle, WA',
  },
  {
    id: '6',
    name: 'Avery D.',
    age: 30,
    matchPercent: 75,
    conditions: ['Diabetes', 'Depression'],
    bio: 'Type 1 diabetic and mental health advocate. I believe vulnerability is strength. Looking for authentic connections who keep it real.',
    interests: ['Running', 'Writing', 'Volunteering'],
    location: 'Chicago, IL',
  },
  {
    id: '7',
    name: 'Quinn W.',
    age: 26,
    matchPercent: 72,
    conditions: ['Chronic Fatigue', 'Autoimmune'],
    bio: 'Spoonie life chose me. Making the most of good days and being gentle on bad ones. Let us share our journeys.',
    interests: ['Movies', 'Crafts', 'Cat Videos'],
    location: 'Nashville, TN',
  },
];

function MatchBadge({ percent }: { percent: number }) {
  const color =
    percent >= 90
      ? 'text-green-400 border-green-400/40'
      : percent >= 80
        ? 'text-[#D19A58] border-[#D19A58]/40'
        : 'text-[#eedfc8]/60 border-[#eedfc8]/20';
  return (
    <div
      className={`w-16 h-16 rounded-full border-2 ${color} flex items-center justify-center`}
    >
      <div className="text-center">
        <p className={`text-lg font-bold ${color.split(' ')[0]}`}>{percent}%</p>
        <p className="text-[8px] text-[#eedfc8]/40">match</p>
      </div>
    </div>
  );
}

export default function TraumaBonding() {
  const { loading } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<MatchProfile | null>(null);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [passedProfiles, setPassedProfiles] = useState<string[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const currentProfile =
    currentIndex < mockProfiles.length ? mockProfiles[currentIndex] : null;

  const goToNext = useCallback(() => {
    setSwipeDirection(null);
    if (currentIndex < mockProfiles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex]);

  const handleLike = useCallback(() => {
    if (!currentProfile) return;
    setSwipeDirection('right');
    setLikedProfiles((prev) => [...prev, currentProfile.id]);

    // Simulate a match on profiles with 85%+ match
    if (currentProfile.matchPercent >= 85) {
      setTimeout(() => {
        setMatchedProfile(currentProfile);
        setShowMatch(true);
        setTimeout(() => {
          setShowMatch(false);
          setMatchedProfile(null);
          goToNext();
        }, 3000);
      }, 300);
    } else {
      setTimeout(goToNext, 300);
    }
  }, [currentProfile, goToNext]);

  const handlePass = useCallback(() => {
    if (!currentProfile) return;
    setSwipeDirection('left');
    setPassedProfiles((prev) => [...prev, currentProfile.id]);
    setTimeout(goToNext, 300);
  }, [currentProfile, goToNext]);

  const resetProfiles = () => {
    setCurrentIndex(0);
    setLikedProfiles([]);
    setPassedProfiles([]);
    setSwipeDirection(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-48 skeleton" />
          <div className="card space-y-4 py-8">
            <div className="w-20 h-20 skeleton rounded-full mx-auto" />
            <div className="h-6 w-32 skeleton mx-auto" />
            <div className="h-4 w-48 skeleton mx-auto" />
            <div className="h-20 w-full skeleton" />
            <div className="flex justify-center gap-6">
              <div className="w-16 h-16 skeleton rounded-full" />
              <div className="w-16 h-16 skeleton rounded-full" />
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-[#eedfc8]">Connect</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#eedfc8]/50">
              {likedProfiles.length} liked
            </span>
            <button className="w-10 h-10 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
              <i className="ri-settings-3-line text-[#eedfc8] text-lg" />
            </button>
          </div>
        </div>
        <p className="text-sm text-[#eedfc8]/60">
          Find people who share your journey. Matched by conditions, interests, and
          experiences.
        </p>
      </div>

      {/* Match Card Area */}
      <div className="px-4 mt-2">
        {!currentProfile ? (
          // No more profiles
          <div className="card text-center py-12">
            <i className="ri-emotion-happy-line text-5xl text-[#D19A58] mb-4" />
            <h2 className="text-lg font-bold text-[#eedfc8] mb-2">
              You have seen everyone!
            </h2>
            <p className="text-sm text-[#eedfc8]/60 mb-4">
              Check back later for new connections, or review your matches.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={resetProfiles} className="btn-primary text-sm">
                Start Over
              </button>
              <button className="btn-secondary text-sm">View Matches</button>
            </div>
          </div>
        ) : (
          // Profile card
          <div
            className={`card space-y-4 transition-all duration-300 ${
              swipeDirection === 'left'
                ? 'opacity-0 -translate-x-20'
                : swipeDirection === 'right'
                  ? 'opacity-0 translate-x-20'
                  : 'opacity-100 translate-x-0'
            }`}
          >
            {/* Profile Header */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D19A58]/30 to-[#B85C3A]/30 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-[#D19A58]">
                  {currentProfile.name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#eedfc8]">
                    {currentProfile.name}
                  </h2>
                  <span className="text-sm text-[#eedfc8]/50">
                    {currentProfile.age}
                  </span>
                </div>
                <p className="text-xs text-[#eedfc8]/50 flex items-center gap-1 mt-0.5">
                  <i className="ri-map-pin-2-line" />
                  {currentProfile.location}
                </p>
              </div>
              <MatchBadge percent={currentProfile.matchPercent} />
            </div>

            {/* Shared Conditions */}
            <div>
              <p className="text-xs text-[#eedfc8]/40 mb-1.5 font-medium uppercase tracking-wider">
                Shared Conditions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentProfile.conditions.map((condition) => (
                  <span
                    key={condition}
                    className="badge text-xs bg-[#B85C3A]/15 text-[#B85C3A] border border-[#B85C3A]/20"
                  >
                    <i className="ri-heart-pulse-line mr-1" />
                    {condition}
                  </span>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <p className="text-sm text-[#eedfc8]/80 leading-relaxed">
                {currentProfile.bio}
              </p>
            </div>

            {/* Interests */}
            <div>
              <p className="text-xs text-[#eedfc8]/40 mb-1.5 font-medium uppercase tracking-wider">
                Interests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentProfile.interests.map((interest) => (
                  <span key={interest} className="badge text-xs">
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 pt-2">
              <button
                onClick={handlePass}
                className="w-16 h-16 rounded-full bg-[#eedfc8]/10 border border-[#eedfc8]/20 flex items-center justify-center transition-all hover:bg-red-500/20 hover:border-red-400/30 active:scale-90"
              >
                <i className="ri-close-line text-2xl text-[#eedfc8]/60" />
              </button>
              <button
                onClick={handleLike}
                className="w-20 h-20 rounded-full bg-[#B85C3A]/20 border-2 border-[#B85C3A]/40 flex items-center justify-center transition-all hover:bg-[#B85C3A]/30 active:scale-90"
              >
                <i className="ri-heart-fill text-3xl text-[#B85C3A]" />
              </button>
              <button className="w-16 h-16 rounded-full bg-[#eedfc8]/10 border border-[#eedfc8]/20 flex items-center justify-center transition-all hover:bg-[#D19A58]/20 hover:border-[#D19A58]/30 active:scale-90">
                <i className="ri-star-line text-2xl text-[#D19A58]" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex justify-center gap-1.5 pt-1">
              {mockProfiles.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all ${
                    idx === currentIndex
                      ? 'w-6 bg-[#D19A58]'
                      : idx < currentIndex
                        ? 'w-1.5 bg-[#eedfc8]/30'
                        : 'w-1.5 bg-[#eedfc8]/10'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="px-4 mt-4">
        <div className="flex gap-3">
          <div className="card-light flex-1 text-center py-3">
            <p className="text-lg font-bold text-[#D19A58]">{likedProfiles.length}</p>
            <p className="text-[10px] text-[#eedfc8]/50 uppercase tracking-wider">
              Liked
            </p>
          </div>
          <div className="card-light flex-1 text-center py-3">
            <p className="text-lg font-bold text-[#eedfc8]/60">
              {passedProfiles.length}
            </p>
            <p className="text-[10px] text-[#eedfc8]/50 uppercase tracking-wider">
              Passed
            </p>
          </div>
          <div className="card-light flex-1 text-center py-3">
            <p className="text-lg font-bold text-green-400">
              {mockProfiles.length - currentIndex}
            </p>
            <p className="text-[10px] text-[#eedfc8]/50 uppercase tracking-wider">
              Remaining
            </p>
          </div>
        </div>
      </div>

      {/* Match Celebration Overlay */}
      {showMatch && matchedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
          <div className="text-center px-8 animate-slide-up">
            {/* Connection animation */}
            <div className="relative mb-6">
              <div className="flex items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-full bg-[#D19A58]/20 border-2 border-[#D19A58] flex items-center justify-center">
                  <i className="ri-user-line text-[#D19A58] text-2xl" />
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-[#D19A58]" />
                  <i className="ri-heart-fill text-[#B85C3A] text-2xl mx-1 hero-glow rounded-full" />
                  <div className="w-8 h-0.5 bg-[#D19A58]" />
                </div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D19A58]/30 to-[#B85C3A]/30 border-2 border-[#D19A58] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#D19A58]">
                    {matchedProfile.name[0]}
                  </span>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#eedfc8] mb-2">
              It&apos;s a Connection!
            </h2>
            <p className="text-sm text-[#eedfc8]/70 mb-1">
              You and {matchedProfile.name} share {matchedProfile.matchPercent}% in
              common
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
              {matchedProfile.conditions.map((c) => (
                <span
                  key={c}
                  className="badge text-xs bg-[#D19A58]/20 text-[#D19A58]"
                >
                  {c}
                </span>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowMatch(false);
                  setMatchedProfile(null);
                  goToNext();
                }}
                className="btn-secondary text-sm"
              >
                Keep Browsing
              </button>
              <button
                onClick={() => {
                  setShowMatch(false);
                  setMatchedProfile(null);
                  goToNext();
                }}
                className="btn-primary text-sm"
              >
                <i className="ri-chat-1-line mr-1.5" />
                Say Hello
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
