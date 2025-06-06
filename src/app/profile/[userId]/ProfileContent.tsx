'use client';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

// Define UserProfile type if not already defined
interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar: string;
  interests: string[];
  conditions: string[];
  connections: number;
  posts: number;
  likes: number;
}

const mockUser: UserProfile = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'Software engineer passionate about AI and web development',
  avatar: '/path/to/avatar.jpg',
  interests: ['AI', 'Web Development', 'Machine Learning'],
  conditions: ['ADHD', 'Anxiety'],
  connections: 500,
  posts: 42,
  likes: 1337,
};

const mockAnonymousUser: UserProfile = {
  id: 'anonymous',
  name: 'Anonymous User',
  email: 'anonymous@example.com',
  bio: 'This profile is private',
  avatar: '/path/to/default-avatar.jpg',
  interests: ['Privacy', 'Anonymity'],
  conditions: ['Prefer not to say'],
  connections: 0,
  posts: 0,
  likes: 0
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-white p-4 rounded-lg shadow-md">
    <p className="text-gray-600 text-sm">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

interface ProfileContentProps {
  userId: string;
}

export default function ProfileContent({ userId }: ProfileContentProps) {
  const userToDisplay = userId === 'anonymous-example' ? mockAnonymousUser : mockUser;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-4">
            <Image
              src={userToDisplay.avatar}
              alt={`${userToDisplay.name}'s avatar`}
              width={100}
              height={100}
              className="rounded-full"
            />
            <div>
              <h1 className="text-2xl font-bold">{userToDisplay.name}</h1>
              <p className="text-gray-600">{userToDisplay.email}</p>
            </div>
          </div>
          <p className="mt-4 text-gray-700">{userToDisplay.bio}</p>

          {/* Conditions */}
          {userToDisplay.conditions && userToDisplay.conditions.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-brand-text-primary mb-1">Conditions</h2>
              <div className="flex flex-wrap gap-1.5">
                {userToDisplay.conditions.map((condition: string, index: number) => (
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
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Connections" value={userToDisplay.connections} />
          <StatCard label="Posts" value={userToDisplay.posts} />
          <StatCard label="Likes" value={userToDisplay.likes} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-20">
          <h2 className="text-xl font-bold mb-4">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {userToDisplay.interests.map((interest) => (
              <span
                key={interest}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav activePage="Profile" />
      </div>
    </div>
  );
}
