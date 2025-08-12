'use client';

import { useState } from 'react';

export default function GroupActivities() {
  const [activeCategory, setActiveCategory] = useState('all');

  const activities = [
    {
      id: 1,
      title: 'Visit Sunny Days Orphanage 🏠',
      description: 'Spend a fun afternoon with the kids - games, stories, and lots of smiles!',
      category: 'orphanages',
      date: 'This Saturday, 2:00 PM',
      location: 'Downtown Community Center',
      participants: 8,
      maxParticipants: 12,
      organizer: 'Sarah M.',
      image: 'orphanage1',
      isPopular: true,
      activities: ['Story time', 'Art & crafts', 'Outdoor games']
    },
    {
      id: 2,
      title: 'Comfort Visit at Grace Hospice 🌺',
      description: 'Bring warmth and companionship to residents who need a friendly face',
      category: 'hospices',
      date: 'Next Sunday, 3:00 PM',
      location: 'Grace Hospice Center',
      participants: 6,
      maxParticipants: 8,
      organizer: 'Mike R.',
      image: 'hospice1',
      isPopular: false,
      activities: ['Gentle conversations', 'Reading together', 'Light music']
    },
    {
      id: 3,
      title: 'Hope Kitchen Meal Prep 🍲',
      description: 'Cook together and serve warm meals to our community friends in need',
      category: 'charity',
      date: 'Thursday, 6:00 PM',
      location: 'Hope Community Kitchen',
      participants: 12,
      maxParticipants: 15,
      organizer: 'Jenny L.',
      image: 'kitchen1',
      isPopular: true,
      activities: ['Meal preparation', 'Serving food', 'Cleanup together']
    },
    {
      id: 4,
      title: 'Senior Center Game Day 🎲',
      description: 'Board games, card games, and lots of laughter with our senior friends',
      category: 'seniors',
      date: 'Friday, 1:00 PM',
      location: 'Riverside Senior Center',
      participants: 5,
      maxParticipants: 10,
      organizer: 'Alex K.',
      image: 'seniors1',
      isPopular: false,
      activities: ['Board games', 'Card games', 'Social time']
    },
    {
      id: 5,
      title: 'Animal Shelter Love Day 🐕',
      description: 'Play with rescue dogs and cats while helping with shelter activities',
      category: 'animals',
      date: 'Next Saturday, 10:00 AM',
      location: 'Paws & Hearts Animal Shelter',
      participants: 15,
      maxParticipants: 20,
      organizer: 'Emma T.',
      image: 'animals1',
      isPopular: true,
      activities: ['Dog walking', 'Cat socialization', 'Shelter cleaning']
    }
  ];

  const categories = [
    { id: 'all', name: 'All Adventures', icon: 'ri-heart-line', count: activities.length },
    { id: 'orphanages', name: 'Orphanages', icon: 'ri-child-line', count: activities.filter(a => a.category === 'orphanages').length },
    { id: 'hospices', name: 'Hospices', icon: 'ri-heart-pulse-line', count: activities.filter(a => a.category === 'hospices').length },
    { id: 'charity', name: 'Charity Homes', icon: 'ri-home-heart-line', count: activities.filter(a => a.category === 'charity').length },
    { id: 'seniors', name: 'Senior Centers', icon: 'ri-user-heart-line', count: activities.filter(a => a.category === 'seniors').length },
    { id: 'animals', name: 'Animal Shelters', icon: 'ri-bear-smile-line', count: activities.filter(a => a.category === 'animals').length },
  ];

  const filteredActivities = activeCategory === 'all' 
    ? activities 
    : activities.filter(activity => activity.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-emerald-800 mb-2">🌟 Group Adventures</h2>
        <p className="text-emerald-600 text-sm">
          Join friends to spread joy and make a difference together!
        </p>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-3 gap-3">
        {categories.slice(0, 6).map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`p-3 rounded-xl text-center transition-all !rounded-button ${
              activeCategory === category.id
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-cream shadow-lg'
                : 'bg-amber-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <div className={`w-6 h-6 mx-auto mb-2 flex items-center justify-center ${
              activeCategory === category.id ? 'text-cream' : 'text-emerald-600'
            }`}>
              <i className={`${category.icon} text-lg`}></i>
            </div>
            <div className="text-xs font-medium">{category.name}</div>
            <div className={`text-xs ${activeCategory === category.id ? 'text-emerald-100' : 'text-emerald-500'}`}>
              {category.count} activities
            </div>
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-emerald-800">
            {categories.find(c => c.id === activeCategory)?.name}
          </h3>
          <span className="text-sm text-emerald-500">{filteredActivities.length} activities</span>
        </div>

        {filteredActivities.map((activity) => (
          <div key={activity.id} className="bg-amber-50 rounded-2xl p-5 shadow-sm border border-emerald-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {activity.isPopular && (
                    <div className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-xs font-medium">
                      Popular! ✨
                    </div>
                  )}
                  <div className="bg-teal-100 text-teal-600 px-2 py-1 rounded-full text-xs font-medium">
                    {categories.find(c => c.id === activity.category)?.name}
                  </div>
                </div>
                <h4 className="font-bold text-emerald-800 mb-2">{activity.title}</h4>
                <p className="text-sm text-emerald-600 mb-3">{activity.description}</p>
              </div>
            </div>

            <div className="mb-4">
              <h5 className="text-sm font-semibold text-emerald-800 mb-2">What we&apos;ll do:</h5>
              <div className="flex flex-wrap gap-2">
                {activity.activities.map((act, index) => (
                  <span key={index} className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-xs">
                    {act}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-emerald-500 mb-4">
              <div className="flex items-center space-x-1">
                <i className="ri-calendar-line"></i>
                <span>{activity.date}</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="ri-map-pin-line"></i>
                <span>{activity.location}</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="ri-group-line"></i>
                <span>{activity.participants}/{activity.maxParticipants} joined</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="ri-user-star-line"></i>
                <span>By {activity.organizer}</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="bg-emerald-100 rounded-full h-2 mb-2">
                <div 
                  className="bg-emerald-500 rounded-full h-2 transition-all" 
                  style={{width: `${(activity.participants / activity.maxParticipants) * 100}%`}}
                ></div>
              </div>
              <p className="text-xs text-emerald-600">
                {activity.maxParticipants - activity.participants} spots left
              </p>
            </div>

            <div className="flex space-x-3">
              <button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-cream py-3 px-4 rounded-full text-sm font-bold !rounded-button">
                Count Me In! 🙌
              </button>
              <button className="px-4 py-3 border border-emerald-200 rounded-full text-sm font-medium text-emerald-600 !rounded-button">
                <i className="ri-share-line"></i>
              </button>
              <button className="px-4 py-3 border border-emerald-200 rounded-full text-sm font-medium text-emerald-600 !rounded-button">
                <i className="ri-bookmark-line"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Activity Button */}
      <div className="text-center pt-4">
        <button className="bg-gradient-to-r from-teal-500 to-emerald-500 text-cream px-6 py-3 rounded-full font-bold shadow-lg !rounded-button">
          🌟 Organize New Adventure
        </button>
      </div>
    </div>
  );
}