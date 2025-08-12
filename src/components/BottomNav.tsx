'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

// Icon components
const HouseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.10Z" />
  </svg>
);

const CompassIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,99.06l-32,80a8,8,0,0,1-14.84,0l-32-80a8,8,0,0,1,10.42-10.42l80,32a8,8,0,0,1,0,14.84ZM138.82,138.82,153.19,102.81,117.18,117.18,102.81,153.19Z" />
  </svg>
);

const UsersThreeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z" />
  </svg>
);

const ChatCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z" />
  </svg>
);

const BookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M208,24H72A32,32,0,0,0,40,56V224a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16H56a16,16,0,0,1,16-16H208a8,8,0,0,0,8-8V32A8,8,0,0,0,208,24ZM200,184H72a31.82,31.82,0,0,0-16,4.29V56A16,16,0,0,1,72,40H200Z" />
  </svg>
);

interface BottomNavProps {
  activePage?: string;
}

export default function BottomNav({ activePage }: BottomNavProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: HouseIcon },
    { href: '/explore', label: 'Explore', icon: CompassIcon },
    { href: '/community', label: 'Community', icon: ChatCircleIcon },
    { href: '/resources', label: 'Resources', icon: BookIcon },
    { href: user ? `/profile/${user.id}` : '/login', label: 'Profile', icon: UsersThreeIcon },
  ];

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-emerald-200 z-50">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center space-y-1">
              <div className="w-5 h-5 bg-emerald-200 rounded animate-pulse"></div>
              <div className="w-8 h-2 bg-emerald-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </nav>
    );
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-emerald-200 z-50">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center space-y-1 transition-colors duration-200"
            >
              <IconComponent 
                className={`w-5 h-5 ${
                  active 
                    ? 'text-emerald-600 fill-current' 
                    : 'text-emerald-400 fill-current hover:text-emerald-500'
                }`}
              />
              <span className={`text-xs ${
                active 
                  ? 'text-emerald-600 font-medium' 
                  : 'text-emerald-400 hover:text-emerald-500'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}