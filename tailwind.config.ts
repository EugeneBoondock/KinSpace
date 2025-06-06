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
        'brand-background': '#F5F0E6',
        'brand-primary': '#2A4A42',
        'brand-accent1': '#B85C3A',
        'brand-accent2': '#D19A58',
        'brand-accent3': '#6B8A83',
        'brand-text-primary': '#2A4A42', // For primary text on light backgrounds
        'brand-text-secondary': '#555555', // Neutral dark gray for secondary text
        'brand-text-on-primary': '#FFFFFF', // White text for dark primary backgrounds
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};

export default config;
