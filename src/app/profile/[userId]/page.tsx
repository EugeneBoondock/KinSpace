"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Image from "next/image";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  age?: number;
  location?: string;
  status?: string;
  is_anonymous: boolean;
  conditions: string[];
  comorbidities: string[];
  medications: string[];
  created_at: string;
  updated_at: string;
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showMedReminder, setShowMedReminder] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userId = params.userId as string;

        // Get current user to check if this is their own profile
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const isOwn = user?.id === userId;
        setIsOwnProfile(isOwn);

        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileError) {
          setError("Profile not found");
          return;
        }

        setProfile(profileData);
      } catch (err) {
        setError("Failed to load profile");
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params.userId]);

  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [userMedications, setUserMedications] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [nextMedReminder, setNextMedReminder] = useState<any>(null);

  // Fetch additional user data
  useEffect(() => {
    const fetchAdditionalData = async () => {
      if (!profile || !isOwnProfile) return;

      try {
        // Fetch user's groups
        const { data: groupsData } = await supabase
          .from("user_group_memberships")
          .select(
            `
            *,
            support_groups (
              id,
              name,
              current_members,
              is_private
            )
          `
          )
          .eq("user_id", profile.id)
          .eq("is_active", true);

        if (groupsData) {
          setUserGroups(groupsData);
        }

        // Fetch user's medication schedules for today
        const today = new Date().toISOString().split("T")[0];
        const { data: medsData } = await supabase
          .from("medication_schedules")
          .select(
            `
            *,
            medication_logs!inner (
              scheduled_time,
              taken_at,
              status
            )
          `
          )
          .eq("user_id", profile.id)
          .eq("is_active", true)
          .gte("medication_logs.scheduled_time", `${today}T00:00:00`)
          .lt("medication_logs.scheduled_time", `${today}T23:59:59`);

        if (medsData) {
          setUserMedications(medsData);
        }

        // Fetch recent activities
        const { data: activitiesData } = await supabase.rpc(
          "get_user_recent_activities",
          {
            p_user_id: profile.id,
            p_limit: 5,
          }
        );

        if (activitiesData) {
          setRecentActivities(activitiesData);
        }

        // Fetch next medication reminder
        const { data: reminderData } = await supabase
          .from("medication_reminders")
          .select(
            `
            *,
            medication_schedules (
              medication_name,
              dosage
            )
          `
          )
          .eq("user_id", profile.id)
          .eq("status", "pending")
          .gte("reminder_time", new Date().toISOString())
          .order("reminder_time", { ascending: true })
          .limit(1)
          .single();

        if (reminderData) {
          setNextMedReminder(reminderData);
        }
      } catch (error) {
        console.error("Error fetching additional data:", error);
      }
    };

    fetchAdditionalData();
  }, [profile, isOwnProfile]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const getDaysSinceJoined = (dateString: string) => {
    const joinDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - joinDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 animate-spin rounded-full border-4 border-[#eedfc8]/30 border-t-[#eedfc8] mx-auto mb-4"></div>
          <p className="text-brand-background">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-red-600 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-brand-background mb-2">
            Profile Not Found
          </h2>
          <p className="text-brand-background opacity-80 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-[#2A4A42] text-[#eedfc8] px-6 py-2 rounded-full font-semibold hover:bg-[#2A4A42]/90 transition-colors border-2 border-[#eedfc8]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-24 page-profile">
      {/* Content */}
      <div className="pt-20 px-6 pb-8">
        {/* Warm Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-background mb-1">
            {isOwnProfile
              ? `Hi there, ${profile.username}! `
              : `${profile.username}'s Profile`}
          </h1>
          <p className="text-brand-background opacity-80">
            {isOwnProfile
              ? "Welcome home to your cozy corner "
              : "Getting to know a community member "}
          </p>
        </div>

        {/* AI Therapist Card - Only show for own profile */}
        {isOwnProfile && (
          <div className="bg-gradient-to-r from-[var(--page-accent)] to-[var(--page-accent-light)] rounded-2xl p-6 text-[#eedfc8] mb-6 shadow-lg">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-[#eedfc8]/20 rounded-full flex items-center justify-center">
                <i className="ri-robot-line text-2xl"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg"> Your AI Buddy</h3>
                <p className="text-[#eedfc8]/80 text-sm">
                  Your friendly wellness companion
                </p>
              </div>
            </div>
            <Link
              href="/therapy"
              className="block bg-[#eedfc8] text-[#2A4A42] px-6 py-3 rounded-full font-semibold text-sm w-full text-center hover:bg-[#eedfc8]/90 transition-colors"
            >
              Open Safe Space
            </Link>
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-[var(--page-bg-tint)] backdrop-blur-lg rounded-2xl p-6 shadow-sm border border-[#eedfc8]/20 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#eedfc8]/20 flex items-center justify-center">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={`${profile.username}'s profile`}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="ri-user-line text-brand-background text-2xl"></i>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h2 className="text-xl font-bold text-brand-background">
                  {profile.is_anonymous
                    ? profile.username
                    : profile.full_name || profile.username}
                </h2>
                {profile.is_anonymous && (
                  <div className="bg-[#eedfc8]/20 text-brand-background px-2 py-1 rounded-full text-xs font-medium">
                    Anonymous
                  </div>
                )}
              </div>
              <p className="text-brand-background opacity-80 text-sm">
                Member since {formatDate(profile.created_at)}
              </p>
              {profile.location && (
                <div className="flex items-center space-x-1 mt-1">
                  <i className="ri-map-pin-line text-brand-background opacity-60 text-sm"></i>
                  <span className="text-brand-background opacity-70 text-sm">
                    {profile.location}
                  </span>
                </div>
              )}
              {profile.age && (
                <div className="flex items-center space-x-1 mt-1">
                  <i className="ri-calendar-line text-brand-background opacity-60 text-sm"></i>
                  <span className="text-brand-background opacity-70 text-sm">
                    {profile.age} years old
                  </span>
                </div>
              )}
            </div>
            {isOwnProfile && (
              <Link
                href="/settings"
                className="bg-[var(--page-accent)] text-[#eedfc8] p-2 rounded-full hover:bg-[var(--page-accent-light)] transition-colors border-2 border-[#eedfc8]"
              >
                <i className="ri-settings-line text-lg"></i>
              </Link>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mb-4 p-3 bg-[#eedfc8]/20 rounded-lg border border-[#eedfc8]/30">
              <p className="text-brand-background text-sm italic">
                "{profile.bio}"
              </p>
            </div>
          )}

          {/* Status */}
          {profile.status && (
            <div className="mb-4">
              <div className="bg-[var(--page-accent)]/20 text-brand-background px-3 py-2 rounded-full text-sm font-medium inline-block">
                <i className="ri-heart-pulse-line mr-1"></i>
                {profile.status}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-[#eedfc8]/30">
            <div className="text-center">
              <div className="text-lg font-bold text-brand-background">
                {getDaysSinceJoined(profile.created_at)}
              </div>
              <div className="text-xs text-brand-background opacity-70">
                Days Here
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-brand-background">
                {profile.conditions.length}
              </div>
              <div className="text-xs text-brand-background opacity-70">
                Conditions
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-brand-background">
                {profile.medications.length}
              </div>
              <div className="text-xs text-brand-background opacity-70">
                Medications
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-brand-background">
                {profile.comorbidities.length}
              </div>
              <div className="text-xs text-brand-background opacity-70">
                Comorbidities
              </div>
            </div>
          </div>
        </div>

        {/* Medication Reminder Alert */}
        {isOwnProfile && nextMedReminder && !showMedReminder && (
          <div className="bg-gradient-to-r from-[#2A4A42] to-red-500 rounded-2xl p-4 text-white mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <i className="ri-alarm-line text-lg"></i>
                </div>
                <div>
                  <h3 className="font-semibold">Med Time!</h3>
                  <p className="text-sm text-[#eedfc8]/80">
                    {nextMedReminder.medication_schedules.medication_name} (
                    {nextMedReminder.medication_schedules.dosage}) due at{" "}
                    {new Date(nextMedReminder.reminder_time).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      }
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMedReminder(true)}
                className="bg-white text-[#2A4A42] px-4 py-2 rounded-full font-semibold text-sm hover:bg-[#eedfc8] transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-[var(--page-accent)]/20 rounded-full p-1 mb-6 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2 px-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === "overview"
                ? "bg-[#eedfc8] text-[#2A4A42] shadow-sm"
                : "text-brand-background"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("health")}
            className={`flex-1 py-2 px-3 rounded-full font-medium transition-all whitespace-nowrap ${
              activeTab === "health"
                ? "bg-[#eedfc8] text-[#2A4A42] shadow-sm"
                : "text-brand-background"
            }`}
          >
            Health Info
          </button>
          {isOwnProfile && (
            <>
              <button
                onClick={() => setActiveTab("groups")}
                className={`flex-1 py-2 px-3 rounded-full font-medium transition-all whitespace-nowrap ${
                  activeTab === "groups"
                    ? "bg-[#eedfc8] text-[#2A4A42] shadow-sm"
                    : "text-brand-background"
                }`}
              >
                Groups
              </button>
              <button
                onClick={() => setActiveTab("meds")}
                className={`flex-1 py-2 px-3 rounded-full font-medium transition-all whitespace-nowrap ${
                  activeTab === "meds"
                    ? "bg-[#eedfc8] text-[#2A4A42] shadow-sm"
                    : "text-brand-background"
                }`}
              >
                Meds
              </button>
            </>
          )}
        </div>

        {/* Health Info Tab */}
        {activeTab === "health" && (
          <div className="space-y-6 mb-8">
            {/* Conditions */}
            <div>
              <h3 className="text-lg font-semibold text-brand-background mb-3">
                {isOwnProfile
                  ? "Your Conditions"
                  : `${profile.username}'s Conditions`}
              </h3>
              {profile.conditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.conditions.map((condition, index) => (
                    <div
                      key={index}
                      className="bg-[var(--page-accent)]/20 text-brand-background px-3 py-2 rounded-full text-sm font-medium"
                    >
                      <i className="ri-heart-pulse-line mr-1"></i>
                      {condition}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#eedfc8]/20 rounded-lg p-4 text-center">
                  <i className="ri-heart-line text-brand-background opacity-60 text-2xl mb-2"></i>
                  <p className="text-brand-background opacity-70 text-sm">
                    No conditions listed
                  </p>
                </div>
              )}
            </div>

            {/* Comorbidities */}
            {profile.comorbidities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-brand-background mb-3">
                  Comorbidities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.comorbidities.map((comorbidity, index) => (
                    <div
                      key={index}
                      className="bg-[var(--page-accent)]/30 text-brand-background px-3 py-2 rounded-full text-sm font-medium"
                    >
                      <i className="ri-add-circle-line mr-1"></i>
                      {comorbidity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medications - Only show for own profile */}
            {isOwnProfile && profile.medications.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-brand-background mb-3">
                  Current Medications
                </h3>
                <div className="space-y-2">
                  {profile.medications.map((medication, index) => (
                    <div
                      key={index}
                      className="bg-[#eedfc8]/20 border border-[#eedfc8]/30 rounded-lg p-3"
                    >
                      <div className="flex items-center space-x-2">
                        <i className="ri-capsule-line text-brand-background"></i>
                        <span className="text-brand-background font-medium">
                          {medication}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Notice for Other Users */}
            {!isOwnProfile && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="ri-shield-line text-amber-600"></i>
                  <h4 className="font-semibold text-amber-800">
                    Privacy Protected
                  </h4>
                </div>
                <p className="text-amber-700 text-sm">
                  Medication information is kept private for each user's safety
                  and privacy.
                </p>
              </div>
            )}

            {/* Support Matching */}
            {!isOwnProfile && profile.conditions.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
                <h4 className="font-bold text-lg mb-2">Connect & Support</h4>
                <p className="text-emerald-100 text-sm mb-4">
                  You both share similar health journeys. Consider connecting
                  for mutual support!
                </p>
                <div className="flex space-x-3">
                  <button className="bg-white text-emerald-600 px-4 py-2 rounded-full font-semibold text-sm hover:bg-emerald-50 transition-colors">
                    Send Message
                  </button>
                  <button className="border border-white/30 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/10 transition-colors">
                    Add Friend
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6 mb-8">
            {/* Journey Stats */}
            <div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-3">
                {isOwnProfile
                  ? "Your Journey"
                  : `${profile.username}'s Journey`}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 text-white">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mb-2">
                    <i className="ri-calendar-line text-lg"></i>
                  </div>
                  <div className="text-lg font-bold">
                    {getDaysSinceJoined(profile.created_at)}
                  </div>
                  <div className="text-sm opacity-90">Days in Community</div>
                </div>

                <div className="bg-gradient-to-r from-teal-500 to-green-500 rounded-2xl p-4 text-white">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mb-2">
                    <i className="ri-heart-pulse-line text-lg"></i>
                  </div>
                  <div className="text-lg font-bold">
                    {profile.conditions.length + profile.comorbidities.length}
                  </div>
                  <div className="text-sm opacity-90">Health Conditions</div>
                </div>
              </div>
            </div>

            {/* Quick Health Summary */}
            <div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-3">
                Health Summary
              </h3>
              <div className="bg-amber-50 rounded-2xl p-4 border border-emerald-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="ri-heart-pulse-line text-emerald-600 text-xl"></i>
                    </div>
                    <div className="text-lg font-bold text-emerald-800">
                      {profile.conditions.length}
                    </div>
                    <div className="text-sm text-emerald-600">
                      Primary Conditions
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="ri-add-circle-line text-teal-600 text-xl"></i>
                    </div>
                    <div className="text-lg font-bold text-emerald-800">
                      {profile.comorbidities.length}
                    </div>
                    <div className="text-sm text-emerald-600">
                      Comorbidities
                    </div>
                  </div>
                  {isOwnProfile && (
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i className="ri-capsule-line text-blue-600 text-xl"></i>
                      </div>
                      <div className="text-lg font-bold text-emerald-800">
                        {profile.medications.length}
                      </div>
                      <div className="text-sm text-emerald-600">
                        Medications
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-3">
                Recent Adventures
              </h3>
              {recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {recentActivities.map((activity, index) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case "joined_group":
                          return "ri-group-line";
                        case "posted_message":
                          return "ri-chat-3-line";
                        case "saved_resource":
                          return "ri-bookmark-line";
                        case "completed_session":
                          return "ri-check-line";
                        case "medication_taken":
                          return "ri-capsule-line";
                        default:
                          return "ri-heart-line";
                      }
                    };

                    const getActivityColor = (type: string) => {
                      switch (type) {
                        case "joined_group":
                          return "bg-green-100 text-green-600";
                        case "posted_message":
                          return "bg-emerald-100 text-emerald-600";
                        case "saved_resource":
                          return "bg-teal-100 text-teal-600";
                        case "completed_session":
                          return "bg-blue-100 text-blue-600";
                        case "medication_taken":
                          return "bg-purple-100 text-purple-600";
                        default:
                          return "bg-gray-100 text-gray-600";
                      }
                    };

                    const timeAgo = (dateString: string) => {
                      const date = new Date(dateString);
                      const now = new Date();
                      const diffInHours = Math.floor(
                        (now.getTime() - date.getTime()) / (1000 * 60 * 60)
                      );

                      if (diffInHours < 1) return "Just now";
                      if (diffInHours < 24) return `${diffInHours} hours ago`;
                      const diffInDays = Math.floor(diffInHours / 24);
                      return `${diffInDays} days ago`;
                    };

                    return (
                      <div
                        key={index}
                        className="bg-amber-50 rounded-xl p-4 shadow-sm border border-emerald-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(
                              activity.activity_type
                            )}`}
                          >
                            <i
                              className={`${getActivityIcon(
                                activity.activity_type
                              )} text-sm`}
                            ></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-emerald-800">
                              {activity.activity_description}
                            </p>
                            <p className="text-xs text-emerald-500">
                              {timeAgo(activity.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <i className="ri-history-line text-gray-400 text-2xl mb-2"></i>
                  <p className="text-gray-500 text-sm">No recent activities</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-3">
                Quick Actions{" "}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Link
                  href="/explore"
                  className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 text-center !rounded-button"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="ri-search-line text-emerald-600 text-lg"></i>
                  </div>
                  <div className="font-semibold text-emerald-800 text-sm">
                    Find Groups{" "}
                  </div>
                </Link>

                <Link
                  href="/games"
                  className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 text-center !rounded-button"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="ri-gamepad-line text-purple-600 text-lg"></i>
                  </div>
                  <div className="font-semibold text-emerald-800 text-sm">
                    Play Games{" "}
                  </div>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Link
                  href="/research"
                  className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 text-center !rounded-button"
                >
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="ri-flask-line text-teal-600 text-lg"></i>
                  </div>
                  <div className="font-semibold text-emerald-800 text-sm">
                    New Research{" "}
                  </div>
                </Link>

                <Link
                  href="/therapy"
                  className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 text-center !rounded-button"
                >
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="ri-heart-pulse-line text-pink-600 text-lg"></i>
                  </div>
                  <div className="font-semibold text-emerald-800 text-sm">
                    AI Support{" "}
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* My Groups Tab - Only for own profile */}
        {activeTab === "groups" && isOwnProfile && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-800">
                My Cozy Groups
              </h3>
              <span className="text-sm text-emerald-500">
                {userGroups.length} groups
              </span>
            </div>

            {userGroups.length > 0 ? (
              userGroups.map((membership, index) => (
                <div
                  key={index}
                  className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-emerald-800">
                      {membership.support_groups.name}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {membership.role !== "member" && (
                        <div className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">
                          {membership.role}
                        </div>
                      )}
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          membership.support_groups.is_private
                            ? "bg-purple-100 text-purple-600"
                            : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        {membership.support_groups.is_private
                          ? "Private"
                          : "Public"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-emerald-500 mb-3 space-x-4">
                    <div className="flex items-center space-x-1">
                      <i className="ri-group-line"></i>
                      <span>
                        {membership.support_groups.current_members} members
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <i className="ri-calendar-line"></i>
                      <span>
                        Joined{" "}
                        {new Date(membership.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Link
                      href={`/groups/${membership.support_groups.id}`}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2 px-4 rounded-full text-sm font-medium text-center hover:from-emerald-600 hover:to-teal-600 transition-colors"
                    >
                      Visit Group
                    </Link>
                    <button className="px-4 py-2 border border-emerald-200 rounded-full text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors">
                      Settings
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <i className="ri-group-line text-gray-400 text-3xl mb-3"></i>
                <h4 className="font-semibold text-gray-600 mb-2">
                  No Groups Yet
                </h4>
                <p className="text-gray-500 text-sm mb-4">
                  Join support groups to connect with others who understand your
                  journey.
                </p>
                <Link
                  href="/explore"
                  className="bg-emerald-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Find Groups
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Medications Tab - Only for own profile */}
        {activeTab === "meds" && isOwnProfile && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-800">
                Today's Medications
              </h3>
              <Link
                href="/settings?tab=medications"
                className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
              >
                Manage Meds
              </Link>
            </div>

            {userMedications.length > 0 ? (
              <div className="space-y-3">
                {userMedications.map((schedule, index) => {
                  const todayLog = schedule.medication_logs[0];
                  const isTaken = todayLog?.status === "taken";
                  const scheduledTime = new Date(
                    todayLog?.scheduled_time
                  ).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });

                  return (
                    <div
                      key={index}
                      className={`rounded-2xl p-4 border-2 ${
                        isTaken
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-amber-50 border-emerald-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-emerald-800">
                            {schedule.medication_name}
                          </h4>
                          <p className="text-sm text-emerald-600">
                            {schedule.dosage} • {scheduledTime}
                          </p>
                          {schedule.notes && (
                            <p className="text-xs text-emerald-500 mt-1">
                              {schedule.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          {isTaken ? (
                            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                              <i className="ri-check-line text-white text-sm"></i>
                            </div>
                          ) : (
                            <button
                              className="w-8 h-8 border-2 border-emerald-300 rounded-full flex items-center justify-center hover:border-emerald-500 transition-colors"
                              onClick={() => {
                                // TODO: Mark medication as taken
                                console.log("Mark as taken:", schedule.id);
                              }}
                            >
                              <i className="ri-check-line text-emerald-400 text-sm"></i>
                            </button>
                          )}
                          <button className="w-8 h-8 flex items-center justify-center hover:bg-emerald-100 rounded-full transition-colors">
                            <i className="ri-alarm-line text-emerald-400 text-lg"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <i className="ri-capsule-line text-gray-400 text-3xl mb-3"></i>
                <h4 className="font-semibold text-gray-600 mb-2">
                  No Medications Scheduled
                </h4>
                <p className="text-gray-500 text-sm mb-4">
                  Add your medications to track your daily routine and get
                  reminders.
                </p>
                <Link
                  href="/settings?tab=medications"
                  className="bg-emerald-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Add Medications
                </Link>
              </div>
            )}

            <div className="bg-emerald-100 rounded-2xl p-4 border border-emerald-200">
              <h4 className="font-semibold text-emerald-800 mb-2">
                Medication Tracking
              </h4>
              <p className="text-sm text-emerald-600">
                Stay consistent with your medication routine. Set up reminders
                and track your progress.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-amber-50 border-t border-emerald-200 px-0 py-0">
        <div className="grid grid-cols-5 h-16">
          <Link
            href="/"
            className="flex flex-col items-center justify-center space-y-1"
          >
            <i className="ri-home-5-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Home</span>
          </Link>
          <Link
            href="/explore"
            className="flex flex-col items-center justify-center space-y-1"
          >
            <i className="ri-compass-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Explore</span>
          </Link>
          <Link
            href="/community"
            className="flex flex-col items-center justify-center space-y-1"
          >
            <i className="ri-chat-3-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Community</span>
          </Link>
          <Link
            href="/resources"
            className="flex flex-col items-center justify-center space-y-1"
          >
            <i className="ri-book-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Resources</span>
          </Link>
          <Link
            href="/profile"
            className="flex flex-col items-center justify-center space-y-1 bg-emerald-100"
          >
            <i className="ri-user-fill text-emerald-600 text-lg"></i>
            <span className="text-xs text-emerald-600 font-medium">
              Profile
            </span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
