'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface UserProfile {
  name: string;
  email: string;
  image?: string;
  age?: number;
  location?: string;
}

interface Match {
  id: string;
  name: string;
  age: number;
  location: string;
  image: string;
}

const DashboardPage = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Set time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay('Morning');
    else if (hour < 18) setTimeOfDay('Afternoon');
    else setTimeOfDay('Evening');

    // Fetch the authenticated user from Supabase
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        // If no pseudonym or full_name, redirect to settings
        if (!profile?.pseudonym && !profile?.full_name) {
          router.push('/settings');
          return;
        }
        setUser({
          name: profile?.pseudonym || profile?.full_name || 'User',
          email: user.email || '',
          image: profile?.avatar_url || user.user_metadata?.avatar_url || '/default-avatar.png',
          age: 28, // Example, replace with real data from your DB
          location: 'San Francisco', // Example, replace with real data from your DB
        });
        setMatches([
          {
            id: '1',
            name: 'Emma',
            age: 28,
            location: 'New York',
            image: 'https://randomuser.me/api/portraits/women/44.jpg',
          },
          {
            id: '2',
            name: 'Liam',
            age: 32,
            location: 'Los Angeles',
            image: 'https://randomuser.me/api/portraits/men/32.jpg',
          },
          {
            id: '3',
            name: 'Chloe',
            age: 30,
            location: 'Chicago',
            image: 'https://randomuser.me/api/portraits/women/63.jpg',
          },
        ]);
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2A4A42]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#eedfc9]/20 border-t-[#eedfc9]"></div>
      </div>
    );
  }

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-[#2A4A42] overflow-x-hidden" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="gap-1 px-6 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-80">
            <div className="flex h-full min-h-[700px] flex-col justify-between bg-[#2A4A42] p-4">
              <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden">
                    <Image src={user.image ? user.image : '/default-avatar.png'} alt={user.name} width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <h1 className="text-[#eedfc9] text-base font-medium leading-normal">{user.name}</h1>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-[#eedfc9]/10 hover:bg-[#eedfc9]/20 transition-colors">
                    <div className="text-[#eedfc9]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path></svg>
                    </div>
                    <p className="text-[#eedfc9] text-sm font-medium leading-normal">Dashboard</p>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="text-[#eedfc9]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path></svg>
                    </div>
                    <p className="text-[#eedfc9] text-sm font-medium leading-normal">Matches</p>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="text-[#eedfc9]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z"></path></svg>
                    </div>
                    <p className="text-[#eedfc9] text-sm font-medium leading-normal">Groups</p>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="text-[#eedfc9]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z"></path></svg>
                    </div>
                    <p className="text-[#eedfc9] text-sm font-medium leading-normal">Dating</p>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="text-[#eedfc9]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"></path></svg>
                    </div>
                    <p className="text-[#eedfc9] text-sm font-medium leading-normal">Settings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Main Content */}
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <h2 className="text-[#eedfc9] tracking-light text-[28px] font-bold leading-tight px-4 text-left pb-3 pt-5">
              Good {timeOfDay}, {user.name}
            </h2>
            <div className="p-4">
              <div className="bg-cover bg-center flex flex-col items-stretch justify-end rounded-xl pt-[132px]" style={{backgroundImage: 'linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%), url(https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=facearea&w=800&q=80)'}}>
                <div className="flex w-full items-end justify-between gap-4 p-4">
                  <div className="flex max-w-[440px] flex-1 flex-col gap-1">
                    <p className="text-[#eedfc9] tracking-light text-2xl font-bold leading-tight max-w-[440px]">How are you doing today?</p>
                    <p className="text-white text-base font-medium leading-normal">Check in with our AI therapist</p>
                  </div>
                </div>
              </div>
            </div>
            <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Your Daily Dose</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-3 p-4">
              <div className="flex flex-1 gap-3 rounded-lg border border-[#5f4b3a] bg-[#2f251d] p-4 items-center">
                <div className="text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z"></path></svg>
                </div>
                <h2 className="text-white text-base font-bold leading-tight">Mindfulness</h2>
              </div>
              <div className="flex flex-1 gap-3 rounded-lg border border-[#5f4b3a] bg-[#2f251d] p-4 items-center">
                <div className="text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"></path></svg>
                </div>
                <h2 className="text-white text-base font-bold leading-tight">Community</h2>
              </div>
              <div className="flex flex-1 gap-3 rounded-lg border border-[#5f4b3a] bg-[#2f251d] p-4 items-center">
                <div className="text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z"></path></svg>
                </div>
                <h2 className="text-white text-base font-bold leading-tight">Support Groups</h2>
              </div>
            </div>
            <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Your Matches</h2>
            <div className="flex overflow-y-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-stretch p-4 gap-8">
                {matches.map((match) => (
                  <div key={match.id} className="flex h-full flex-1 flex-col gap-4 text-center rounded-lg min-w-32 pt-4">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden self-center">
                      <Image src={match.image} alt={match.name} width={96} height={96} className="object-cover w-full h-full" />
                    </div>
                    <div>
                      <p className="text-white text-base font-medium leading-normal">{match.name}</p>
                      <p className="text-[#c1ab9a] text-sm font-normal leading-normal">{match.age}, {match.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
