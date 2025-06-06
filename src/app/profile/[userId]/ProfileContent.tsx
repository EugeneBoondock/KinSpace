'use client';


// Define UserProfile type if not already defined
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  conditions: string[];
  interests: string[];
  connections: number;
  posts: number;
  likes: number;
  location: string;
  status: string;
}

const mockUser: UserProfile = {
  id: 'user123',
  name: 'Sarah Johnson',
  email: 'sarah@example.com',
  avatar: '/images/avatar.jpg',
  bio: 'Living with chronic conditions and sharing my journey.',
  interests: ['Wellness', 'Support Groups', 'Meditation'],
  conditions: ['Fibromyalgia', 'Chronic Fatigue'],
  connections: 500,
  posts: 42,
  likes: 1337,
  location: '28, New York',
  status: 'Currently in remission'
};

const mockAnonymousUser: UserProfile = {
  id: 'anonymous',
  name: 'Anonymous User',
  email: 'anonymous@example.com',
  avatar: '/images/anonymous-avatar.jpg',
  bio: 'I prefer to remain anonymous.',
  interests: [],
  conditions: ['Prefer not to say'],
  connections: 0,
  posts: 0,
  likes: 0,
  location: 'Location hidden',
  status: 'Status hidden'
};


interface ProfileContentProps {
  userId: string;
}

export default function ProfileContent({ userId }: ProfileContentProps) {
  const userToDisplay = userId === 'anonymous-example' ? mockAnonymousUser : mockUser;

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-[#2A4A42] justify-between group/design-root overflow-x-hidden" style={{fontFamily: 'Manrope, "Noto Sans", sans-serif'}}>
      <div>
        <div className="flex items-center bg-[#2A4A42] p-4 pb-2 justify-between">
          <div className="text-[#eedfc9] flex size-12 shrink-0 items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
            </svg>
          </div>
          <h2 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">Profile</h2>
        </div>
        <div className="flex p-4 @container">
          <div className="flex w-full flex-col gap-4 items-center">
            <div className="flex gap-4 flex-col items-center">
              <div className="flex items-center space-x-4">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 border-2 border-[#eedfc9]/20"
                  style={{backgroundImage: `url(${userToDisplay.avatar})`}}
                />
                <div className="flex flex-col items-center justify-center">
                  <p className="text-[#eedfc9] text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">{userToDisplay.name}</p>
                  <p className="text-[#eedfc9]/70 text-base font-normal leading-normal text-center">{userToDisplay.location}</p>
                </div>
              </div>
              <p className="mt-4 text-[#eedfc9]/90">{userToDisplay.bio}</p>

              {/* Conditions */}
              {userToDisplay.conditions && userToDisplay.conditions.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold text-[#eedfc9] mb-1">Conditions</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {userToDisplay.conditions.map((condition: string, index: number) => (
                      <span key={index} className="rounded-full bg-[#eedfc9]/10 px-2.5 py-0.5 text-xs font-medium text-[#eedfc9] hover:bg-[#eedfc9]/20 transition-colors">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interests */}
              {userToDisplay.interests && userToDisplay.interests.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-sm font-semibold text-[#eedfc9] mb-1">Interests</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {userToDisplay.interests.map((interest: string, index: number) => (
                      <span key={index} className="rounded-full bg-[#eedfc9]/10 px-2.5 py-0.5 text-xs font-medium text-[#eedfc9] hover:bg-[#eedfc9]/20 transition-colors">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <a
              href="/settings"
              className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#eedfc9]/10 text-[#eedfc9] text-sm font-bold leading-normal tracking-[0.015em] w-full max-w-[480px] @[480px]:w-auto hover:bg-[#eedfc9]/20 transition-colors"
            >
              <span className="truncate">Edit Profile</span>
            </a>
          </div>
        </div>
        <h3 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">About</h3>
        <p className="text-[#eedfc9] text-base font-normal leading-normal pb-3 pt-1 px-4">{userToDisplay.bio}</p>
        <h3 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Conditions</h3>
        <div className="flex gap-3 p-3 flex-wrap pr-4">
          {userToDisplay.conditions.map((condition, index) => (
            <div key={index} className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-[#eedfc9]/10 pl-4 pr-4">
              <p className="text-[#eedfc9] text-sm font-medium leading-normal">{condition}</p>
            </div>
          ))}
        </div>
        <h3 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Status</h3>
        <p className="text-[#eedfc9] text-base font-normal leading-normal pb-3 pt-1 px-4">{userToDisplay.status}</p>
        <h3 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Anonymity</h3>
        <div className="flex items-center gap-4 bg-[#2A4A42] px-4 min-h-[72px] py-2 justify-between">
          <div className="flex flex-col justify-center">
            <p className="text-[#eedfc9] text-base font-medium leading-normal line-clamp-1">Anonymous Mode</p>
            <p className="text-[#eedfc9]/70 text-sm font-normal leading-normal line-clamp-2">Keep your profile hidden from the main feed</p>
          </div>
          <div className="shrink-0">
            <label className="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full border-none bg-[#eedfc9]/10 p-0.5 has-[:checked]:justify-end has-[:checked]:bg-[#eedfc9]">
              <div className="h-full w-[27px] rounded-full bg-[#eedfc9]" style={{boxShadow: 'rgba(0, 0, 0, 0.15) 0px 3px 8px, rgba(0, 0, 0, 0.06) 0px 3px 1px'}} />
              <input type="checkbox" className="invisible absolute" />
            </label>
          </div>
        </div>
        <h3 className="text-[#eedfc9] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Integrations</h3>
        <div className="flex items-center gap-4 bg-[#2A4A42] px-4 min-h-[72px] py-2 justify-between">
          <div className="flex flex-col justify-center">
            <p className="text-[#eedfc9] text-base font-medium leading-normal line-clamp-1">Symptom Tracker</p>
            <p className="text-[#eedfc9]/70 text-sm font-normal leading-normal line-clamp-2">Track your symptoms and share with your connections</p>
          </div>
          <div className="shrink-0">
            <div className="text-[#eedfc9] flex size-7 items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="flex gap-2 border-t border-[#eedfc9]/20 bg-[#2A4A42] px-4 pb-3 pt-2">
          {['Home', 'Connect', 'Trauma-Bonding', 'Profile'].map((item, i) => (
            <a key={i} className={`just flex flex-1 flex-col items-center justify-end gap-1 ${item === 'Profile' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'}`} href="#">
              <div className={`${item === 'Profile' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} flex h-8 items-center justify-center`}>
                {/* Icon would go here */}
              </div>
              <p className={`${item === 'Profile' ? 'text-[#eedfc9]' : 'text-[#eedfc9]/70'} text-xs font-medium leading-normal tracking-[0.015em]`}>{item}</p>
            </a>
          ))}
        </div>
        <div className="h-5 bg-[#2A4A42]"></div>
      </div>
    </div>
  );
}
