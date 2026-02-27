import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Inter', 'Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
  			heading: ['GmarketSans', 'Inter', 'Pretendard Variable', 'Pretendard', 'sans-serif'],
  		},
  		colors: {
  			/* ── 5색 커스텀 팔레트 ── */
  			teal: {
  				50: '#f0f7f4',
  				100: '#d4e8e0',
  				200: '#a9d1c1',
  				300: '#7dbaa2',
  				400: '#5fa08a',
  				500: '#5B8E7D',
  				600: '#487568',
  				700: '#365c50',
  				800: '#244338',
  			},
  			carrot: {
  				50: '#fef5eb',
  				100: '#fde6cc',
  				200: '#fbcd99',
  				300: '#f7b066',
  				400: '#F3933F',
  				500: '#e07a20',
  				600: '#c06418',
  				700: '#8f4b12',
  				800: '#5f320c',
  			},
  			olive: {
  				50: '#f4f8ef',
  				100: '#e3efd6',
  				200: '#c7dfad',
  				300: '#a8cf82',
  				400: '#8CB369',
  				500: '#739a50',
  				600: '#5c7b40',
  				700: '#455d30',
  				800: '#2e3e20',
  			},
  			gold: {
  				50: '#fefcf3',
  				100: '#fcf5d4',
  				200: '#F4E285',
  				300: '#edd45c',
  				400: '#e0c030',
  				500: '#c9a520',
  				600: '#a68818',
  				700: '#7d6612',
  				800: '#54440c',
  			},
  			brick: {
  				50: '#fdf2f2',
  				100: '#fad9da',
  				200: '#f3b1b4',
  				300: '#e0868a',
  				400: '#d06064',
  				500: '#BC4B51',
  				600: '#a03e43',
  				700: '#7d3033',
  				800: '#5a2224',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
