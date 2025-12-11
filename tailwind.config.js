/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'hunter-bg': '#050510',
                'hunter-cyan': '#00d2ff',
                'hunter-green': '#0aff00',
                'hunter-purple': '#a855f7',
                'hunter-text': '#e5e7eb',
                'hunter-muted': '#9ca3af',
                'hunter-border': '#1f2937',
                'hunter-surface': '#111827',
            },
            animation: {
                'marquee': 'marquee 30s linear infinite',
                'spin-slow': 'spin 3s linear infinite',
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-50%)' }
                }
            }
        },
    },
    plugins: [],
}
