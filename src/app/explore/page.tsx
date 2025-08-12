"use client";

import Link from "next/link";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { id: "all", name: "All", count: 850 },
    { id: "mental-health", name: "Mental Health", count: 245 },
    { id: "chronic-illness", name: "Chronic Illness", count: 180 },
    { id: "diabetes", name: "Diabetes", count: 95 },
    { id: "cancer", name: "Cancer Support", count: 75 },
    { id: "anxiety", name: "Anxiety & Depression", count: 120 },
    { id: "autoimmune", name: "Autoimmune", count: 65 },
    { id: "rare-diseases", name: "Rare Diseases", count: 45 },
  ];

  const supportGroups = [
    {
      id: 1,
      name: "Depression Recovery Circle",
      members: 127,
      type: "virtual",
      category: "mental-health",
      nextMeeting: "Today, 7:00 PM",
      description:
        "A safe space to share experiences and coping strategies for depression recovery.",
    },
    {
      id: 2,
      name: "Type 1 Diabetes Warriors",
      members: 89,
      type: "local",
      category: "diabetes",
      nextMeeting: "Tomorrow, 6:30 PM",
      location: "Community Center, Downtown",
      description:
        "Support and practical tips for managing Type 1 diabetes daily.",
    },
    {
      id: 3,
      name: "Chronic Pain Support Network",
      members: 156,
      type: "virtual",
      category: "chronic-illness",
      nextMeeting: "Wed, 8:00 PM",
      description: "Understanding and managing chronic pain with peer support.",
    },
    {
      id: 4,
      name: "Anxiety Mindfulness Group",
      members: 203,
      type: "virtual",
      category: "anxiety",
      nextMeeting: "Thu, 7:30 PM",
      description:
        "Mindfulness techniques and breathing exercises for anxiety management.",
    },
    {
      id: 5,
      name: "Cancer Survivors United",
      members: 78,
      type: "local",
      category: "cancer",
      nextMeeting: "Sat, 2:00 PM",
      location: "Memorial Hospital, Room 204",
      description:
        "Stories of hope and practical support for cancer survivors.",
    },
    {
      id: 6,
      name: "Lupus Community Circle",
      members: 45,
      type: "virtual",
      category: "autoimmune",
      nextMeeting: "Sun, 4:00 PM",
      description: "Living well with lupus - tips, support, and friendship.",
    },
  ];

  const filteredGroups = supportGroups.filter((group) => {
    const matchesCategory =
      activeCategory === "all" || group.category === activeCategory;
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#eedfc8] pb-20 page-explore">
      {/* Content */}
      <div className="pt-20 px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-emerald-800 mb-2">
            Explore Support Groups
          </h1>
          <p className="text-emerald-600">
            Find your community and connect with others who understand
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <i className="ri-search-line text-emerald-400"></i>
          </div>
          <input
            type="text"
            placeholder="Search support groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/90 rounded-full border border-emerald-200 text-sm text-emerald-800 placeholder-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
          />
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-emerald-800 mb-3">
            Categories
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-3 rounded-xl text-left transition-all !rounded-button ${
                  activeCategory === category.id
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                    : "bg-white/90 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-sm"
                }`}
              >
                <div className="font-semibold text-sm">{category.name}</div>
                <div
                  className={`text-xs ${
                    activeCategory === category.id
                      ? "text-emerald-100"
                      : "text-emerald-500"
                  }`}
                >
                  {category.count} groups
                </div>
              </button>
            ))}
          </div>
          <button className="text-emerald-600 text-sm font-medium hover:text-emerald-700">
            View all categories
          </button>
        </div>

        {/* Support Groups List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-emerald-800">
              {activeCategory === "all"
                ? "All Groups"
                : categories.find((c) => c.id === activeCategory)?.name}
            </h3>
            <span className="text-sm text-emerald-500">
              {filteredGroups.length} groups
            </span>
          </div>

          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-emerald-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-emerald-800 mb-1">
                    {group.name}
                  </h4>
                  <p className="text-sm text-emerald-600 mb-2">
                    {group.description}
                  </p>
                </div>
                <div
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    group.type === "virtual"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-teal-100 text-teal-600"
                  }`}
                >
                  {group.type === "virtual" ? "Virtual" : "In-Person"}
                </div>
              </div>

              <div className="flex items-center text-sm text-emerald-500 mb-3 space-x-4">
                <div className="flex items-center space-x-1">
                  <i className="ri-group-line"></i>
                  <span>{group.members} members</span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="ri-calendar-line"></i>
                  <span>{group.nextMeeting}</span>
                </div>
              </div>

              {group.location && (
                <div className="flex items-center text-sm text-emerald-500 mb-3">
                  <i className="ri-map-pin-line mr-1"></i>
                  <span>{group.location}</span>
                </div>
              )}

              <div className="flex space-x-3">
                <button className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2 px-4 rounded-full text-sm font-medium !rounded-button">
                  Join Group
                </button>
                <button className="px-4 py-2 border border-emerald-200 rounded-full text-sm font-medium text-emerald-600 !rounded-button hover:bg-emerald-50">
                  Learn More
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
