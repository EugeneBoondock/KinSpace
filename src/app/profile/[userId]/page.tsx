'use client';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

// Define UserProfile type if not already defined
interface UserProfile {
  id: string;
  username: string;
  pseudonym: string | null;
  isAnonymous: boolean;
  conditions: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  profileImageUrl: string;
  coverImageUrl: string;
  bio: string;
  interests: string[];
  pronouns: string;
  location: string;
  followers: number;
  following: number;
  postsCount: number;
}

const mockUser: UserProfile = {
  id: '123-abc',
  username: 'MitoUser123',
  pseudonym: 'ChronicWarrior',
  isAnonymous: false,
  conditions: ['Lupus', "Raynaud's Phenomenon"],
  status: 'Managing daily symptoms',
  createdAt: '2023-01-15T09:30:00Z',
  updatedAt: '2023-10-26T14:45:00Z',
  profileImageUrl: '/images/profile-placeholder.jpg',
  coverImageUrl: '/images/cover-placeholder.jpg',
  bio: 'Living one day at a time with chronic illness. Finding strength in community.',
  interests: ['Reading', 'Art', 'Gentle Yoga', 'Advocacy'],
  pronouns: 'She/Her',
  location: 'California, USA',
  followers: 1250,
  following: 300,
  postsCount: 150,
};

const mockAnonymousUser: UserProfile = {
  id: '456-def',
  username: 'AnonymousUser',
  pseudonym: null,
  isAnonymous: true,
  conditions: ['Fibromyalgia'],
  status: 'Newly Diagnosed',
  createdAt: '2023-03-20T11:00:00Z',
  updatedAt: '2023-09-01T10:00:00Z',
  profileImageUrl: '/images/profile-placeholder-anon.jpg',
  coverImageUrl: '/images/cover-placeholder-anon.jpg',
  bio: 'Seeking support and information anonymously.',
  interests: [],
  pronouns: 'Prefers not to say',
  location: 'Not specified',
  followers: 0,
  following: 0,
  postsCount: 0
};

// Helper icons (can be replaced with actual icon components if you have them)
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6316 7.36837L16.2842 7.35258C16.0895 6.0789L16.7947 5.46311L15.8684 4.53679L15.2526 5.24206C14.6526 4.94732 14.0053 4.74732 13.3211 4.66311L13.2316 4H11.7684L11.6789 4.66311C11.0053 4.74732 10.3474 4.94732 9.74737 5.24206L9.13158 4.53679L8.20526 5.46311L8.91053 6.0789C8.71579 6.71048 8.64737 7.36837 8.71579 8L8.20526 8.53679L9.13158 9.46311L9.74737 8.75785C10.3474 9.05258 11.0053 9.25258 11.6789 9.33679L11.7684 10H13.2316L13.3211 9.33679C14.0053 9.25258 14.6526 9.05258 15.2526 8.75785L15.8684 9.46311L16.7947 8.53679L16.2842 8C16.3526 7.36837 16.2842 6.71048 16.0895 6.0789L16.6316 7.36837ZM12.5 7.5C12.5 8.05263 12.0526 8.5 11.5 8.5C10.9474 8.5 10.5 8.05263 10.5 7.5C10.5 6.94737 10.9474 6.5 11.5 6.5C12.0526 6.5 12.5 6.94737 12.5 7.5Z" fill="currentColor"/>
    <path d="M17.5 12.5C17.5 12.2239 17.2761 12 17 12H16.5C16.5 11.0526 16.1474 10.1895 15.5789 9.53684L16.0316 9.08421C16.2211 8.89474 16.2211 8.58947 16.0316 8.39474L15.6053 7.96842C15.4105 7.77895 15.1053 7.77895 14.9158 7.96842L14.4632 8.42105C13.8105 7.85263 12.9474 7.5 12 7.5H11C10.7239 7.5 10.5 7.72386 10.5 8V8.5C10.5 9.44737 10.1474 10.3105 9.57895 10.9632L9.12632 10.5105C8.93684 10.3211 8.63158 10.3211 8.43684 10.5105L8.01053 10.9368C7.82105 11.1263 7.82105 11.4316 8.01053 11.6263L8.46316 12.0789C7.85263 12.6895 7.5 13.5526 7.5 14.5H7C6.72386 14.5 6.5 14.7239 6.5 15V16C6.5 16.2761 6.72386 16.5 7 16.5H7.5C7.5 17.4474 7.85263 18.3105 8.46316 18.9211L8.01053 19.3737C7.82105 19.5632 7.82105 19.8684 8.01053 20.0632L8.43684 20.4895C8.63158 20.6789 8.93684 20.6789 9.12632 20.4895L9.57895 20.0368C10.1895 20.6474 11.0526 21 12 21H13C13.2761 21 13.5 20.7761 13.5 20.5V20C13.5 19.0526 13.8526 18.1895 14.4211 17.5368L14.8737 17.9895C15.0632 18.1789 15.3684 18.1789 15.5632 17.9895L15.9895 17.5632C16.1789 17.3737 16.1789 17.0684 15.9895 16.8737L15.5368 16.4211C16.1474 15.8105 16.5 14.9474 16.5 14H17C17.2761 14 17.5 13.7761 17.5 13.5V12.5ZM12.5 16.5C11.9474 16.5 11.5 16.0526 11.5 15.5C11.5 14.9474 11.9474 14.5 12.5 14.5C13.0526 14.5 13.5 14.9474 13.5 15.5C13.5 16.0526 13.0526 16.5 12.5 16.5Z" fill="currentColor"/>
  </svg>
);

const UserPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10ZM10 11.5C6.96243 11.5 4.5 13.9624 4.5 17V18H15.5V17C15.5 13.9624 13.0376 11.5 10 11.5Z" fill="currentColor"/>
    <path d="M17 5.5H15.5V4H14V5.5H12.5V7H14V8.5H15.5V7H17V5.5Z" fill="currentColor"/>
  </svg>
);


export default function Page({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const userToDisplay = userId === 'anonymous-example' ? mockAnonymousUser : mockUser;

  const displayName = userToDisplay.isAnonymous
    ? userToDisplay.pseudonym || 'Anonymous User'
    : userToDisplay.username;

  return (
    <div className="@container/main flex min-h-screen flex-col bg-brand-background pb-24 font-manrope">
      {/* Header Section */}
      <div className="relative h-40 @[600px]/main:h-52">
        {userToDisplay.coverImageUrl && 
          <Image 
            src={userToDisplay.coverImageUrl} 
            alt={`${displayName}'s cover photo`} 
            layout="fill" 
            objectFit="cover" 
            className="h-full w-full"
          />
        }
        <div className="absolute inset-0 bg-black/20"></div> {/* Optional: overlay for better text visibility */}
        <button className="absolute right-3 top-3 rounded-full bg-brand-background bg-opacity-80 p-1.5 text-brand-text-primary backdrop-blur-sm">
          <SettingsIcon />
        </button>
      </div>

      {/* Profile Info Section */}
      <div className="-mt-12 @[600px]/main:-mt-16 px-3">
        <div className="flex items-end gap-3">
          <div className="relative h-24 w-24 @[600px]/main:h-32 @[600px]/main:w-32 rounded-full border-4 border-brand-background bg-brand-accent3 bg-opacity-30">
            {userToDisplay.profileImageUrl && 
              <Image 
                src={userToDisplay.profileImageUrl} 
                alt={`${displayName}'s profile picture`} 
                layout="fill" 
                objectFit="cover" 
                className="rounded-full"
              />
            }
          </div>
          <div className="pb-2 @[600px]/main:pb-3">
            <h1 className="text-xl @[600px]/main:text-2xl font-bold text-brand-text-primary">{displayName}</h1>
            {userToDisplay.username && !userToDisplay.isAnonymous && <p className="text-sm text-brand-text-secondary">@{userToDisplay.username}</p>}
            {userToDisplay.pronouns && <p className="text-xs text-brand-text-secondary">{userToDisplay.pronouns}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-brand-text-on-primary shadow-sm hover:opacity-90">
            Message
          </button>
          <button className="flex-1 rounded-lg bg-brand-accent1 px-3.5 py-2 text-sm font-semibold text-brand-text-on-accent shadow-sm hover:opacity-90">
            Follow
          </button>
          <button className="rounded-lg bg-brand-accent2 p-2 text-brand-text-on-accent shadow-sm hover:opacity-90">
            <UserPlusIcon />
          </button>
        </div>

        {/* Bio Section */}
        {userToDisplay.bio && 
          <p className="mt-3 text-sm text-brand-text-primary">{userToDisplay.bio}</p>
        }

        {/* Stats Section */}
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <span className="font-semibold text-brand-text-primary">{userToDisplay.followers}</span>
            <span className="text-brand-text-secondary"> Followers</span>
          </div>
          <div>
            <span className="font-semibold text-brand-text-primary">{userToDisplay.following}</span>
            <span className="text-brand-text-secondary"> Following</span>
          </div>
          <div>
            <span className="font-semibold text-brand-text-primary">{userToDisplay.postsCount}</span>
            <span className="text-brand-text-secondary"> Posts</span>
          </div>
        </div>
        
        {/* Location & Joined Date */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-text-secondary">
            {userToDisplay.location && <span>{userToDisplay.location}</span>}
            <span>Joined {new Date(userToDisplay.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>

        {/* Conditions */}
        {userToDisplay.conditions && userToDisplay.conditions.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-brand-text-primary mb-1">Conditions</h2>
            <div className="flex flex-wrap gap-1.5">
              {userToDisplay.conditions.map((condition, index) => (
                <span key={index} className="rounded-full bg-brand-accent3 bg-opacity-20 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {userToDisplay.interests && userToDisplay.interests.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-brand-text-primary mb-1">Interests</h2>
            <div className="flex flex-wrap gap-1.5">
              {userToDisplay.interests.map((interest: string, index: number) => (
                <span key={index} className="rounded-full bg-brand-accent2 bg-opacity-20 px-2.5 py-0.5 text-xs font-medium text-brand-accent1">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Placeholder for Tabs/Content (Posts, About, etc.) */}
        <div className="mt-6 border-t border-brand-accent3 border-opacity-50 pt-4">
          <p className="text-center text-sm text-brand-text-secondary">
            User content (posts, detailed about, etc.) will go here.
          </p>
        </div>
      </div>
      
      <BottomNav activePage="Profile" />
    </div>
  );
};


