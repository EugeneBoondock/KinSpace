'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Define an interface for the props
interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive?: boolean; // Optional: to explicitly set active state if needed
}

const NavIcon = ({ component: Icon, isActive }: { component: React.ElementType; isActive: boolean }) => (
  <div className={`flex h-8 items-center justify-center ${isActive ? 'text-brand-text-on-primary' : 'text-brand-accent3'}`}>
    <Icon width="24px" height="24px" fill="currentColor" />
  </div>
);

const NavLabel = ({ label, isActive }: { label: string; isActive: boolean }) => (
  <p className={`text-xs font-medium leading-normal tracking-[0.015em] ${isActive ? 'text-brand-text-on-primary' : 'text-brand-accent3'}`}>
    {label}
  </p>
);

// Placeholder icons - replace with actual SVG components or imports
const HouseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.1Z" />
  </svg>
);

const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M164.47,195.63a8,8,0,0,1-6.7,12.37H10.23a8,8,0,0,1-6.7-12.37,95.83,95.83,0,0,1,47.22-37.71,60,60,0,1,1,66.5,0A95.83,95.83,0,0,1,164.47,195.63Zm87.91-.15a95.87,95.87,0,0,0-47.13-37.56A60,60,0,0,0,144.7,54.59a4,4,0,0,0-1.33,6A75.83,75.83,0,0,1,147,150.53a4,4,0,0,0,1.07,5.53,112.32,112.32,0,0,1,29.85,30.83,23.92,23.92,0,0,1,3.65,16.47,4,4,0,0,0,3.95,4.64h60.3a8,8,0,0,0,7.73-5.93A8.22,8.22,0,0,0,252.38,195.48Z" />
  </svg>
);

const UsersThreeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
     <path d="M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" />
  </svg>
);

const HeartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z" />
  </svg>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z" />
  </svg>
);

const ChatCircleDotsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z" />
  </svg>
);

const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" {...props}>
    <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" />
  </svg>
);

interface BottomNavProps {
  activePage: 'Home' | 'Connect' | 'Trauma-Bonding' | 'Profile' | 'Groups' | 'Matches' | 'Messages' | 'Notifications';
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage }) => {
  const pathname = usePathname();

  const navItems = {
    profile: [
      { href: "/dashboard", icon: HouseIcon, label: "Home" }, // Assuming home is dashboard
      { href: "/trauma-bonding", icon: UsersIcon, label: "Connect" },
      { href: "/trauma-bonding", icon: HeartIcon, label: "Trauma-Bonding" }, // Points to trauma-bonding as per current understanding
      { href: "/profile/me", icon: UserIcon, label: "Profile" } // Assuming '/profile/me' or similar for current user
    ],
    traumaBonding: [
      { href: "/dashboard", icon: HouseIcon, label: "Home" },
      { href: "/trauma-bonding", icon: UsersIcon, label: "Matches" }, // Active link
      { href: "/messages", icon: ChatCircleDotsIcon, label: "Messages" },
      { href: "/profile/me", icon: UserIcon, label: "Profile" }
    ],
    groups: [
      { href: "/dashboard", icon: HouseIcon, label: "Home" },
      { href: "/groups", icon: UsersThreeIcon, label: "Groups" }, // Active link
      { href: "/messages", icon: ChatCircleDotsIcon, label: "Messages" },
      { href: "/notifications", icon: BellIcon, label: "Notifications" }, // Assuming a notifications page
    ],
    // nearby-support does not have a bottom nav in the snippet
  };

  let currentNavItems: NavLinkProps[] = [];
  if (activePage === 'Profile') currentNavItems = navItems.profile;
  else if (activePage === 'Trauma-Bonding' || activePage === 'Matches') currentNavItems = navItems.traumaBonding;
  else if (activePage === 'Groups') currentNavItems = navItems.groups;
  // Add other page types if they have specific navs

  // Fallback to a default or empty nav if no specific one is found
  if (!currentNavItems.length && (pathname.startsWith('/profile/') || pathname === '/profile')) {
    currentNavItems = navItems.profile;
  }
  if (!currentNavItems.length && (pathname.startsWith('/trauma-bonding/') || pathname === '/trauma-bonding')) {
    currentNavItems = navItems.traumaBonding;
  }
   if (!currentNavItems.length && (pathname.startsWith('/groups/') || pathname === '/groups')) {
    currentNavItems = navItems.groups;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-solid border-t-brand-accent3 bg-brand-primary sm:hidden">
      {currentNavItems.map((item) => {
        const isActive = item.href === pathname || activePage === item.label || (item.label === 'Matches' && activePage === 'Trauma-Bonding');
        return (
          <Link href={item.href} key={item.label} className={`flex flex-1 flex-col items-center justify-center gap-1 ${isActive ? 'text-brand-text-on-primary' : 'text-brand-accent3'}`}>
            <NavIcon component={item.icon} isActive={isActive} />
            <NavLabel label={item.label} isActive={isActive} />
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
