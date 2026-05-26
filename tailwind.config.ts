import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        bg: {
          base: '#08090b',
          panel: '#0e1014',
          card: '#13161c',
          hover: '#1a1e26',
        },
        edge: '#222730',
        ink: {
          primary: '#e6e8ec',
          secondary: '#9ba1ad',
          muted: '#5a6170',
        },
        accent: {
          green: '#5cf08c',
          amber: '#f0b15c',
          red: '#ff5c7a',
          blue: '#5cc8f0',
          violet: '#b88cf0',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'flow': 'flow 2s linear infinite',
      },
      keyframes: {
        flow: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 0%' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
