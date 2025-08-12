
'use client';

import Link from 'next/link';
import { useState } from 'react';
import BottomNav from '@/components/BottomNav';

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Resources', icon: 'ri-book-line' },
    { id: 'articles', name: 'Articles', icon: 'ri-article-line' },
    { id: 'guides', name: 'Treatment Guides', icon: 'ri-guide-line' },
    { id: 'tools', name: 'Tools & Apps', icon: 'ri-tools-line' },
    { id: 'videos', name: 'Videos', icon: 'ri-video-line' },
    { id: 'podcasts', name: 'Podcasts', icon: 'ri-mic-line' },
  ];

  const resources = [
    {
      id: 1,
      title: 'Understanding Your Diagnosis: A Complete Guide',
      category: 'guides',
      type: 'Treatment Guide',
      readTime: '15 min read',
      difficulty: 'Beginner',
      tags: ['Chronic Illness', 'Mental Health'],
      excerpt: 'A comprehensive guide to help you understand your diagnosis and take the first steps toward management.',
      image: 'guide1',
      isPopular: true
    },
    {
      id: 2,
      title: 'Mindfulness Techniques for Anxiety Management',
      category: 'articles',
      type: 'Article',
      readTime: '8 min read',
      difficulty: 'Beginner',
      tags: ['Anxiety', 'Mindfulness'],
      excerpt: 'Learn practical mindfulness exercises you can use anywhere to manage anxiety symptoms.',
      image: 'article1',
      isPopular: true
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
      image: 'app1',
      isPopular: false
    },
    {
      id: 4,
      title: 'Living Well with Chronic Pain',
      category: 'videos',
      type: 'Video Series',
      readTime: '45 min watch',
      difficulty: 'All levels',
      tags: ['Chronic Pain', 'Lifestyle'],
      excerpt: '6-part video series on pain management strategies and lifestyle adaptations.',
      image: 'video1',
      isPopular: true
    },
    {
      id: 5,
      title: 'The Healing Journey Podcast',
      category: 'podcasts',
      type: 'Podcast',
      readTime: 'Weekly episodes',
      difficulty: 'All levels',
      tags: ['Stories', 'Inspiration'],
      excerpt: 'Weekly conversations with people thriving despite health challenges.',
      image: 'podcast1',
      isPopular: false
    },
    {
      id: 6,
      title: 'Overcoming Addiction: Recovery Resources',
      category: 'guides',
      type: 'Treatment Guide',
      readTime: '20 min read',
      difficulty: 'Intermediate',
      tags: ['Addiction', 'Recovery'],
      excerpt: 'Comprehensive recovery resources for substance abuse and behavioral addictions.',
      image: 'guide2',
      isPopular: true
    },
    {
      id: 7,
      title: 'Grief and Loss Support Guide',
      category: 'articles',
      type: 'Article',
      readTime: '12 min read',
      difficulty: 'All levels',
      tags: ['Grief', 'Loss', 'Support'],
      excerpt: 'Understanding the grieving process and finding healthy ways to cope with loss.',
      image: 'article2',
      isPopular: false
    },
  ];

  const filteredResources = activeCategory === 'all' 
    ? resources 
    : resources.filter(resource => resource.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 pb-24 page-resources">
      {/* Content */}
      <div className="pt-20 px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-800 mb-2">Resources</h1>
          <p className="text-amber-600">Expert-curated content for illness, mental health, addiction, grief & more</p>
        </div>

        {/* Featured Resource */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">Featured</div>
            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">New</div>
          </div>
          <h3 className="text-lg font-bold mb-2">Complete Wellness Toolkit</h3>
          <p className="text-orange-100 text-sm mb-4">
            Everything you need to start your wellness journey, including tracking sheets, goal planners, and emergency contact forms.
          </p>
          <button className="bg-white text-orange-600 px-6 py-2 rounded-full font-semibold text-sm !rounded-button">
            Download Free
          </button>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-amber-800 mb-3">Categories</h3>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-3 rounded-xl text-center transition-all !rounded-button ${
                  activeCategory === category.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                    : 'bg-white border border-orange-200 text-amber-700 hover:bg-orange-50'
                }`}
              >
                <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center ${
                  activeCategory === category.id ? 'text-white' : 'text-amber-600'
                }`}>
                  <i className={`${category.icon} text-lg`}></i>
                </div>
                <div className="text-xs font-medium">{category.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Resources List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-amber-800">
              {categories.find(c => c.id === activeCategory)?.name}
            </h3>
            <span className="text-sm text-amber-500">{filteredResources.length} resources</span>
          </div>

          {filteredResources.map((resource) => (
            <div key={resource.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <div className="mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  {resource.isPopular && (
                    <div className="bg-amber-100 text-amber-600 px-2 py-1 rounded-full text-xs font-medium">
                      Popular
                    </div>
                  )}
                  <div className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-medium">
                    {resource.type}
                  </div>
                </div>
                
                <h4 className="font-semibold text-amber-800 mb-2 leading-tight">{resource.title}</h4>
                <p className="text-sm text-amber-600 mb-3">{resource.excerpt}</p>
                
                <div className="flex items-center justify-between text-xs text-amber-500 mb-3">
                  <div className="flex items-center space-x-3">
                    <span>{resource.readTime}</span>
                    <span>•</span>
                    <span>{resource.difficulty}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {resource.tags.map((tag) => (
                    <span key={tag} className="bg-orange-100 text-amber-600 px-2 py-1 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex space-x-3">
                  <button className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-full text-sm font-medium !rounded-button">
                    {resource.category === 'tools' ? 'Download' : 'Read Now'}
                  </button>
                  <button className="px-4 py-2 border border-orange-200 rounded-full text-sm font-medium text-amber-600 !rounded-button">
                    <i className="ri-bookmark-line"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-amber-800 mb-4">Quick Access</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 text-left !rounded-button">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <i className="ri-heart-pulse-line text-red-600 text-lg"></i>
              </div>
              <h4 className="font-semibold text-amber-800 mb-1 text-sm">Emergency Resources</h4>
              <p className="text-xs text-amber-500">Crisis support & contacts</p>
            </button>
            
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 text-left !rounded-button">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                <i className="ri-hospital-line text-emerald-600 text-lg"></i>
              </div>
              <h4 className="font-semibold text-amber-800 mb-1 text-sm">Healthcare Directory</h4>
              <p className="text-xs text-amber-500">Find local providers</p>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
