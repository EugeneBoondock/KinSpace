
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Research() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'All Research', count: 342 },
    { id: 'mental-health', name: 'Mental Health', count: 89 },
    { id: 'chronic-pain', name: 'Chronic Pain', count: 67 },
    { id: 'diabetes', name: 'Diabetes', count: 54 },
    { id: 'autoimmune', name: 'Autoimmune', count: 43 },
    { id: 'addiction', name: 'Addiction', count: 38 },
    { id: 'neurology', name: 'Neurology', count: 51 }
  ];

  const researchPapers = [
    {
      id: 1,
      title: 'New Breakthrough in Depression Treatment Shows 78% Success Rate',
      journal: 'Nature Medicine',
      date: '2024-01-15',
      category: 'mental-health',
      readTime: '8 min read',
      difficulty: 'Beginner',
      keyFindings: [
        'Combined therapy shows significant improvement over traditional methods',
        'Reduced side effects compared to current medications',
        'Effective across diverse patient populations'
      ],
      summary: 'Researchers have developed a novel treatment approach combining cognitive therapy with targeted medication that shows remarkable success in treating major depression.',
      isBreaking: true,
      relevanceScore: 95
    },
    {
      id: 2,
      title: 'Chronic Pain Management: Revolutionary Non-Opioid Approach',
      journal: 'The Lancet',
      date: '2024-01-12',
      category: 'chronic-pain',
      readTime: '12 min read',
      difficulty: 'Intermediate',
      keyFindings: [
        'Natural compounds reduce pain by 65% on average',
        'No addiction potential or severe side effects',
        'Works for multiple types of chronic pain conditions'
      ],
      summary: 'Scientists have identified plant-based compounds that effectively manage chronic pain without the risks associated with opioid medications.',
      isBreaking: false,
      relevanceScore: 88
    },
    {
      id: 3,
      title: 'Type 1 Diabetes: Gene Therapy Shows Promise for Insulin Independence',
      journal: 'Cell Metabolism',
      date: '2024-01-10',
      category: 'diabetes',
      readTime: '15 min read',
      difficulty: 'Advanced',
      keyFindings: [
        'Gene therapy restored insulin production in 12 patients',
        'Effects lasted 6+ months in clinical trials',
        'Could eliminate need for daily insulin injections'
      ],
      summary: 'A groundbreaking gene therapy approach has successfully restored natural insulin production in people with Type 1 diabetes, offering hope for a functional cure.',
      isBreaking: true,
      relevanceScore: 92
    },
    {
      id: 4,
      title: 'Anxiety Disorders: Digital Therapy as Effective as Traditional Treatment',
      journal: 'Psychological Medicine',
      date: '2024-01-08',
      category: 'mental-health',
      readTime: '10 min read',
      difficulty: 'Beginner',
      keyFindings: [
        'App-based therapy showed equal effectiveness to in-person sessions',
        'More accessible and cost-effective treatment option',
        'Higher completion rates among younger patients'
      ],
      summary: 'Large-scale study demonstrates that properly designed digital mental health interventions can be as effective as traditional face-to-face therapy.',
      isBreaking: false,
      relevanceScore: 81
    },
    {
      id: 5,
      title: 'Lupus Treatment: New Drug Reduces Flares by 70%',
      journal: 'Arthritis & Rheumatology',
      date: '2024-01-05',
      category: 'autoimmune',
      readTime: '11 min read',
      difficulty: 'Intermediate',
      keyFindings: [
        'Dramatic reduction in disease flares and symptoms',
        'Improved quality of life scores across all participants',
        'Minimal side effects reported in Phase 3 trials'
      ],
      summary: 'A new targeted therapy for lupus has shown exceptional results in preventing disease flares and improving patient outcomes in large clinical trials.',
      isBreaking: false,
      relevanceScore: 86
    },
    {
      id: 6,
      title: 'Addiction Recovery: Brain Stimulation Technique Shows 85% Success Rate',
      journal: 'Nature Neuroscience',
      date: '2024-01-03',
      category: 'addiction',
      readTime: '9 min read',
      difficulty: 'Beginner',
      keyFindings: [
        'Non-invasive brain stimulation reduces cravings significantly',
        'Higher long-term sobriety rates compared to traditional methods',
        'Can be used alongside existing addiction treatments'
      ],
      summary: 'Researchers have developed a brain stimulation technique that dramatically improves addiction recovery outcomes by targeting specific neural pathways.',
      isBreaking: true,
      relevanceScore: 89
    }
  ];

  const filteredPapers = researchPapers.filter(paper => {
    const matchesCategory = activeCategory === 'all' || paper.category === activeCategory;
    const matchesSearch = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         paper.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 pb-24">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-orange-100 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/" className="w-8 h-8 bg-gradient-to-r from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
              <i className="ri-heart-line text-white text-lg"></i>
            </Link>
            <span className="text-xl font-bold text-amber-800" style={{fontFamily: "Pacifico, serif"}}>Kinspace</span>
          </div>
          <button className="w-8 h-8 flex items-center justify-center">
            <i className="ri-bookmark-line text-xl text-amber-700"></i>
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-20 px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-800 mb-2">Latest Research</h1>
          <p className="text-amber-600">Stay updated with breakthrough discoveries in your health conditions</p>
        </div>

        {/* Breaking News Banner */}
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl p-4 text-white mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">Breaking</div>
            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium">High Relevance</div>
          </div>
          <h3 className="font-bold mb-2">Major Depression Breakthrough</h3>
          <p className="text-red-100 text-sm mb-3">
            New treatment shows 78% success rate with minimal side effects
          </p>
          <button className="bg-white text-red-600 px-4 py-2 rounded-full font-semibold text-sm !rounded-button">
            Read Study
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <i className="ri-search-line text-amber-400"></i>
          </div>
          <input
            type="text"
            placeholder="Search research papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-full border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-amber-800 mb-3">Research Areas</h3>
          <div className="grid grid-cols-2 gap-3">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-3 rounded-xl text-left transition-all !rounded-button ${
                  activeCategory === category.id
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                    : 'bg-white border border-orange-200 text-amber-700 hover:bg-orange-50'
                }`}
              >
                <div className="font-semibold text-sm">{category.name}</div>
                <div className={`text-xs ${activeCategory === category.id ? 'text-orange-100' : 'text-amber-500'}`}>
                  {category.count} studies
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Research Papers List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-amber-800">
              {activeCategory === 'all' ? 'All Research' : categories.find(c => c.id === activeCategory)?.name}
            </h3>
            <span className="text-sm text-amber-500">{filteredPapers.length} papers</span>
          </div>

          {filteredPapers.map((paper) => (
            <div key={paper.id} className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
              <div className="mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  {paper.isBreaking && (
                    <div className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-medium">
                      Breaking
                    </div>
                  )}
                  <div className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-medium">
                    {paper.journal}
                  </div>
                  <div className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-xs font-medium">
                    {paper.relevanceScore}% match
                  </div>
                </div>
                
                <h4 className="font-semibold text-amber-800 mb-2 leading-tight">{paper.title}</h4>
                <p className="text-sm text-amber-600 mb-3">{paper.summary}</p>
                
                <div className="flex items-center justify-between text-xs text-amber-500 mb-4">
                  <div className="flex items-center space-x-3">
                    <span>{paper.date}</span>
                    <span>•</span>
                    <span>{paper.readTime}</span>
                    <span>•</span>
                    <span>{paper.difficulty}</span>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-3 mb-4">
                  <h5 className="font-semibold text-orange-800 text-sm mb-2">Key Findings:</h5>
                  <ul className="space-y-1">
                    {paper.keyFindings.map((finding, index) => (
                      <li key={index} className="text-sm text-amber-700 flex items-start">
                        <i className="ri-check-line text-orange-500 mt-0.5 mr-2 text-xs"></i>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex space-x-3">
                  <button className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-full text-sm font-medium !rounded-button">
                    Read Full Study
                  </button>
                  <button className="px-4 py-2 border border-orange-200 rounded-full text-sm font-medium text-amber-600 !rounded-button">
                    <i className="ri-bookmark-line mr-1"></i>
                    Save
                  </button>
                  <button className="px-4 py-2 border border-orange-200 rounded-full text-sm font-medium text-amber-600 !rounded-button">
                    <i className="ri-share-line"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Research Alerts */}
        <div className="mt-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 text-white">
          <h3 className="font-bold mb-2">Research Alerts</h3>
          <p className="text-emerald-100 text-sm mb-3">
            Get notified when new research is published about your conditions
          </p>
          <button className="bg-white text-emerald-600 px-4 py-2 rounded-full font-semibold text-sm !rounded-button">
            Set Up Alerts
          </button>
        </div>

        {/* Quick Access */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-amber-800 mb-4">Quick Access</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 text-left !rounded-button">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <i className="ri-bookmark-line text-amber-600 text-lg"></i>
              </div>
              <h4 className="font-semibold text-amber-800 mb-1 text-sm">Saved Studies</h4>
              <p className="text-xs text-amber-500">Your research library</p>
            </button>
            
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 text-left !rounded-button">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                <i className="ri-notification-line text-orange-600 text-lg"></i>
              </div>
              <h4 className="font-semibold text-amber-800 mb-1 text-sm">Research Alerts</h4>
              <p className="text-xs text-amber-500">Custom notifications</p>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-orange-200 px-0 py-0">
        <div className="grid grid-cols-5 h-16">
          <Link href="/" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-home-5-line text-amber-400 text-lg"></i>
            <span className="text-xs text-amber-400">Home</span>
          </Link>
          <Link href="/explore" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-compass-line text-amber-400 text-lg"></i>
            <span className="text-xs text-amber-400">Explore</span>
          </Link>
          <Link href="/community" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-chat-3-line text-amber-400 text-lg"></i>
            <span className="text-xs text-amber-400">Community</span>
          </Link>
          <Link href="/resources" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-book-line text-amber-400 text-lg"></i>
            <span className="text-xs text-amber-400">Resources</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-user-line text-amber-400 text-lg"></i>
            <span className="text-xs text-amber-400">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
