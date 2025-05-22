import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pastelPink: '#FFD1DC',
        powderBlue: '#B0E0E6',
        mintGreen: '#98FF98', // Using #98FF98 as per prompt, though #98FB98 is often also cited
        lavenderMist: '#E6E6FA',
        peachSorbet: '#FFDAB9',
        softCream: '#FFFDD0', // Very light color for backgrounds
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
