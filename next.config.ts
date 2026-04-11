import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'randomuser.me' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'readdy.ai' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400' },
      ],
    },
  ],
};

export default nextConfig;
