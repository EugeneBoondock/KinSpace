'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef } from 'react';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const sampleSearches = [
    { query: 'flu symptoms and recovery', icon: 'ri-thermometer-line', category: 'Symptoms' },
    { query: 'anxiety management techniques', icon: 'ri-heart-pulse-line', category: 'Mental Health' },
    { query: 'diabetes meal planning', icon: 'ri-restaurant-line', category: 'Chronic Illness' },
    { query: 'addiction recovery support', icon: 'ri-hearts-line', category: 'Addiction' },
    { query: 'grief counseling resources', icon: 'ri-emotion-line', category: 'Grief & Loss' },
    { query: 'chronic pain relief options', icon: 'ri-health-book-line', category: 'Pain Management' },
  ];

  const mockResults = [
    {
      id: 1,
      title: 'Understanding Flu Symptoms and Recovery Timeline',
      source: 'Mayo Clinic Medical Reference',
      reliability: 'Medical Authority',
      summary: 'Flu symptoms typically include fever, chills, muscle aches, cough, congestion, and fatigue. Most people recover within 7-10 days with proper rest and hydration.',
      keyPoints: [
        'Fever usually peaks within 24-48 hours',
        'Rest and hydration are crucial for recovery',
        'Antiviral medications are most effective when started early',
        'Seek medical attention if symptoms worsen after day 3'
      ],
      relatedTopics: ['Cold vs Flu', 'When to See a Doctor', 'Prevention Methods']
    },
    {
      id: 2,
      title: 'Home Remedies and Care for Flu Recovery',
      source: 'WebMD Health Guide',
      reliability: 'Medical Review',
      summary: 'Effective home remedies include staying hydrated, getting adequate rest, using a humidifier, and consuming warm broths and herbal teas.',
      keyPoints: [
        'Drink plenty of fluids to prevent dehydration',
        'Use honey and warm water for sore throat relief',
        'Saltwater gargles can reduce throat inflammation',
        'Steam inhalation helps with congestion'
      ],
      relatedTopics: ['Natural Remedies', 'Nutrition During Illness', 'Sleep and Recovery']
    }
  ];

  const handleSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchQuery(query);

    // Simulate API call
    setTimeout(() => {
      setSearchResults(mockResults);
      setIsSearching(false);
      setHasSearched(true);
    }, 1500);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        // Simulate image analysis
        handleSearch('skin condition analysis from uploaded image');
      };
      reader.readAsDataURL(file);
    }
  };

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
          <Link href="/resources" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-close-line text-xl text-amber-700"></i>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-20 px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-800 mb-2">Health Search</h1>
          <p className="text-amber-600">Get medically-sourced answers to your health questions</p>
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 mb-6">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Ask about symptoms, conditions, treatments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              className="w-full pl-4 pr-12 py-3 border border-orange-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={() => handleSearch(searchQuery)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center"
            >
              <i className="ri-search-line text-white text-sm"></i>
            </button>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <div className="text-sm text-amber-500">Or search with:</div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-100 rounded-full text-sm font-medium text-amber-700 hover:bg-orange-200 transition-colors !rounded-button"
            >
              <i className="ri-camera-line"></i>
              <span>Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {imagePreview && (
            <div className="mt-4 p-3 bg-orange-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <Image src={imagePreview} alt="Uploaded" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Image uploaded</p>
                  <p className="text-xs text-amber-600">Analyzing for health-related information...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-orange-100 text-center mb-6">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-amber-600">Searching medical databases...</p>
          </div>
        )}

        {/* Search Results */}
        {hasSearched && !isSearching && searchResults.length > 0 && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-amber-800">Search Results</h3>
              <span className="text-sm text-amber-500">{searchResults.length} results</span>
            </div>

            {searchResults.map((result) => (
              <div key={result.id} className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-xs font-medium">
                    {result.reliability}
                  </div>
                  <div className="text-xs text-amber-500">{result.source}</div>
                </div>

                <h4 className="font-semibold text-amber-800 mb-2">{result.title}</h4>
                <p className="text-sm text-amber-600 mb-4">{result.summary}</p>

                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-amber-800 mb-2">Key Points:</h5>
                  <ul className="space-y-1">
                    {result.keyPoints.map((point, index) => (
                      <li key={index} className="text-sm text-amber-600 flex items-start space-x-2">
                        <span className="text-orange-500 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-amber-800 mb-2">Related Topics:</h5>
                  <div className="flex flex-wrap gap-2">
                    {result.relatedTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleSearch(topic)}
                        className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-medium hover:bg-orange-100 transition-colors !rounded-button"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-4 rounded-full text-sm font-medium !rounded-button">
                    Read Full Article
                  </button>
                  <button className="px-4 py-2 border border-orange-200 rounded-full text-sm font-medium text-amber-600 !rounded-button">
                    <i className="ri-bookmark-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sample Searches */}
        {!hasSearched && (
          <div>
            <h3 className="text-lg font-semibold text-amber-800 mb-4">Popular Searches</h3>
            <div className="grid grid-cols-1 gap-3">
              {sampleSearches.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(sample.query)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 text-left hover:bg-orange-50 transition-colors !rounded-button"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <i className={`${sample.icon} text-orange-600 text-lg`}></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 text-sm">{sample.query}</p>
                      <p className="text-xs text-amber-500">{sample.category}</p>
                    </div>
                    <i className="ri-arrow-right-line text-amber-400"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mt-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line text-yellow-600 text-sm"></i>
            </div>
            <div>
              <h4 className="font-semibold text-yellow-800 text-sm mb-1">Medical Disclaimer</h4>
              <p className="text-xs text-yellow-700">
                This information is for educational purposes only and should not replace professional medical advice. 
                Always consult with healthcare providers for proper diagnosis and treatment.
              </p>
            </div>
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
