'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import BottomNav from '@/components/BottomNav';

export default function Community() {
  const [activeTab, setActiveTab] = useState('discussions');
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-[#eedfc8] pb-20 page-community">
      {/* Content */}
      <div className="pt-20 px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-emerald-800 mb-2">Community</h1>
          <p className="text-emerald-600">Connect, share, and spread joy together</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-emerald-100 rounded-full p-1 mb-6 text-xs">
          <button
            onClick={() => setActiveTab('discussions')}
            className={`flex-1 py-2 px-2 rounded-full font-medium transition-all ${
              activeTab === 'discussions'
                ? 'bg-amber-50 text-emerald-600 shadow-sm'
                : 'text-emerald-600'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('angels')}
            className={`flex-1 py-2 px-2 rounded-full font-medium transition-all ${
              activeTab === 'angels'
                ? 'bg-amber-50 text-emerald-600 shadow-sm'
                : 'text-emerald-600'
            }`}
          >
            Angels
          </button>
          <button
            onClick={() => setActiveTab('mentors')}
            className={`flex-1 py-2 px-2 rounded-full font-medium transition-all ${
              activeTab === 'mentors'
                ? 'bg-amber-50 text-emerald-600 shadow-sm'
                : 'text-emerald-600'
            }`}
          >
            Mentors
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex-1 py-2 px-2 rounded-full font-medium transition-all ${
              activeTab === 'activities'
                ? 'bg-amber-50 text-emerald-600 shadow-sm'
                : 'text-emerald-600'
            }`}
          >
            Adventures
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'discussions' && (
          <div className="space-y-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-emerald-200 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-chat-3-line text-emerald-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">No discussions yet</h3>
              <p className="text-emerald-600 text-sm mb-4">Be the first to start a conversation in the community!</p>
              <button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-2 rounded-full font-semibold text-sm">
                Start Discussion
              </button>
            </div>
          </div>
        )}

        {activeTab === 'angels' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-emerald-200 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-heart-3-line text-emerald-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">No angels available</h3>
              <p className="text-emerald-600 text-sm mb-4">Check back later or consider becoming an angel yourself!</p>
            </div>
          </div>
        )}

        {activeTab === 'mentors' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-emerald-200 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-user-star-line text-emerald-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">No mentors available</h3>
              <p className="text-emerald-600 text-sm mb-4">Check back later or consider becoming a mentor yourself!</p>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-emerald-200 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-calendar-line text-emerald-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">No activities scheduled</h3>
              <p className="text-emerald-600 text-sm mb-4">Check back later for upcoming community adventures!</p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}