/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                dark: {
                    950: '#0a0e1a',
                    900: '#0f1629',
                    800: '#151d35',
                    700: '#1e293b',
                    600: '#2a3650',
                },
                accent: {
                    DEFAULT: '#a855f7',
                    light: '#c084fc',
                    dark: '#7c3aed',
                    indigo: '#6366f1',
                },
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease forwards',
                'slide-up': 'slideUp 0.5s ease forwards',
                'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.1)' },
                    '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.25)' },
                },
            },
        },
    },
    plugins: [],
};
