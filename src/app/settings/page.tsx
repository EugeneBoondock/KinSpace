"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { HomeIcon, UsersIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [comorbidities, setComorbidities] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [notifMatches, setNotifMatches] = useState(false);
  const [notifMessages, setNotifMessages] = useState(false);
  const [notifGroups, setNotifGroups] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const navLinks = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon },
    { name: 'Matches', href: '/matches', icon: UsersIcon },
    { name: 'Messages', href: '/messages', icon: ChatBubbleLeftRightIcon },
    { name: 'Groups', href: '/groups', icon: UserGroupIcon },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  ];

  const defaultAvatar = "/images/avatar.png";

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setAge(data.age ? String(data.age) : "");
        setLocation(data.location || "");
        setBio(data.bio || "");
        setUsername(data.username || "");
        setStatus(data.status || "");
        setIsAnonymous(data.is_anonymous || false);
        setComorbidities((data.comorbidities && data.comorbidities.join(", ")) || "");
        setConditions((data.conditions && data.conditions.join(", ")) || "");
        setMedications((data.medications && data.medications.join(", ")) || "");
        setNotifMatches(data.notif_matches || false);
        setNotifMessages(data.notif_messages || false);
        setNotifGroups(data.notif_groups || false);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }

    const updates = {
      full_name: fullName,
      avatar_url: avatarUrl,
      age: age ? parseInt(age) : null,
      location,
      bio,
      username,
      status,
      is_anonymous: isAnonymous,
      comorbidities: comorbidities.split(",").map((c) => c.trim()).filter(Boolean),
      conditions: conditions.split(",").map((c) => c.trim()).filter(Boolean),
      medications: medications.split(",").map((m) => m.trim()).filter(Boolean),
      notif_matches: notifMatches,
      notif_messages: notifMessages,
      notif_groups: notifGroups,
      updated_at: new Date(),
    };

    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      return;
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setAvatarUrl(publicUrl);

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
    }
  };

  if (loading) return <div className="text-white p-8">Loading...</div>;

  return (
    <div className="min-h-screen w-full flex bg-[#2A4A42] py-10 px-2">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 rounded-tl-3xl bg-[#2A4A42] p-6 gap-8 shadow-xl border-r border-[#eedfc9]/20">
        <div className="flex flex-col items-center gap-2">
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-16 border-2 border-[#eedfc9]" style={{ backgroundImage: `url(${avatarUrl || defaultAvatar})` }}></div>
          <span className="text-[#eedfc9] font-semibold text-lg mt-2">{fullName || 'User'}</span>
          <span className="text-[#eedfc9]/60 text-sm">@{username || 'user'}</span>
        </div>
        <nav className="flex flex-col gap-2 mt-6">
          {navLinks.map(link => (
            <a key={link.name} href={link.href} className={`flex items-center gap-3 px-4 py-2 rounded-lg transition font-medium text-base ${link.name === 'Settings' ? 'bg-[#eedfc9]/10 text-[#eedfc9]' : 'text-[#eedfc9]/80 hover:bg-[#eedfc9]/5 hover:text-[#eedfc9]'}`}> {/* Highlight Settings */}
              <link.icon className="h-5 w-5" />
              {link.name}
            </a>
          ))}
        </nav>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl bg-[#2A4A42] rounded-2xl shadow-2xl border border-[#eedfc9]/20 p-8 md:p-12 flex flex-col gap-8">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-20 border-4 border-[#eedfc9] shadow-lg" style={{ backgroundImage: `url(${avatarUrl || defaultAvatar})` }}></div>
              <label className="absolute bottom-0 right-0 bg-[#eedfc9] rounded-full p-2 cursor-pointer hover:bg-[#eedfc9]/80 transition-colors" title="Upload new profile picture">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#2A4A42" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v-9m4.5 4.5h-9" />
                </svg>
              </label>
            </div>
            <h1 className="text-[#eedfc9] text-2xl font-extrabold leading-tight tracking-tight">{fullName || "User"}</h1>
            <p className="text-[#eedfc9]/60 text-base font-medium leading-normal">@{username || "user"}</p>
          </div>
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-[#eedfc9] text-xl font-bold mb-4 border-b border-[#eedfc9]/20 pb-2">Profile Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Full Name</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={fullName} onChange={e => setFullName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Username</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={username} onChange={e => setUsername(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Profile Picture URL</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Age</span>
                  <input type="number" min="0" className="form-input rounded-lg bg-[#18122B] text-white border border-[#39324a] focus:border-[#1993e5] focus:ring-2 focus:ring-[#1993e5]/30 transition p-3" value={age} onChange={e => setAge(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Location</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={location} onChange={e => setLocation(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Status</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={status} onChange={e => setStatus(e.target.value)} />
                </label>
              </div>
              <label className="flex flex-col gap-1 mt-6">
                <span className="text-[#beac9d] font-medium">Bio</span>
                <textarea className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3 min-h-[80px]" value={bio} onChange={e => setBio(e.target.value)} />
              </label>
            </div>
            <div>
              <h2 className="text-[#eedfc9] text-xl font-bold mb-4 border-b border-[#eedfc9]/20 pb-2">Health & Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Comorbidities (comma-separated)</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={comorbidities} onChange={e => setComorbidities(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Conditions (comma-separated)</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={conditions} onChange={e => setConditions(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#eedfc9]/80 font-medium">Medications (comma-separated)</span>
                  <input className="form-input rounded-lg bg-[#2A4A42] text-[#eedfc9] border border-[#eedfc9]/20 focus:border-[#eedfc9] focus:ring-2 focus:ring-[#eedfc9]/30 transition-colors p-3" value={medications} onChange={e => setMedications(e.target.value)} />
                </label>
                <label className="flex flex-row items-center gap-2 mt-6">
                  <input type="checkbox" id="isAnonymous" checked={isAnonymous} onChange={() => setIsAnonymous(!isAnonymous)} className="h-5 w-5 text-[#eedfc9] border-[#eedfc9]/20 rounded focus:ring-[#eedfc9]/30" />
                  <span className="text-[#eedfc9]/80 text-sm">Stay anonymous (use a pseudonym)</span>
                </label>
              </div>
            </div>
            <div>
              <h2 className="text-[#eedfc9] text-xl font-bold mb-4 border-b border-[#eedfc9]/20 pb-2">Notifications</h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-[#2A4A42] rounded-lg px-4 py-3 border border-[#eedfc9]/20">
                  <div>
                    <p className="text-[#eedfc9] text-base font-semibold">New Matches</p>
                    <p className="text-[#eedfc9]/70 text-sm">Receive notifications for new matches</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 text-[#eedfc9] border-[#eedfc9]/20 rounded focus:ring-[#eedfc9]/30" checked={notifMatches} onChange={() => setNotifMatches(!notifMatches)} />
                </div>
                <div className="flex items-center justify-between bg-[#2A4A42] rounded-lg px-4 py-3 border border-[#eedfc9]/20">
                  <div>
                    <p className="text-[#eedfc9] text-base font-semibold">Messages</p>
                    <p className="text-[#eedfc9]/70 text-sm">Receive notifications for new messages</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 text-[#eedfc9] border-[#eedfc9]/20 rounded focus:ring-[#eedfc9]/30" checked={notifMessages} onChange={() => setNotifMessages(!notifMessages)} />
                </div>
                <div className="flex items-center justify-between bg-[#2A4A42] rounded-lg px-4 py-3 border border-[#eedfc9]/20">
                  <div>
                    <p className="text-[#eedfc9] text-base font-semibold">Group Activities</p>
                    <p className="text-[#eedfc9]/70 text-sm">Receive notifications for group activities</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 text-[#eedfc9] border-[#eedfc9]/20 rounded focus:ring-[#eedfc9]/30" checked={notifGroups} onChange={() => setNotifGroups(!notifGroups)} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-4">
            <button className="bg-[#eedfc9] text-[#2A4A42] px-10 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-[#eedfc9]/90 transition-colors duration-200 disabled:opacity-60" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            {error && <span className="text-red-500 text-sm mt-1">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
} 