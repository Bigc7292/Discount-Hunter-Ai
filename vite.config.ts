import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3004,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Kept for backward compat — app now uses VITE_NVIDIA_API_KEY
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Split large chunks for faster page loads
      rollupOptions: {
        output: {
          manualChunks: {
            // React runtime
            'vendor-react': ['react', 'react-dom'],
            // Animation library
            'vendor-framer': ['framer-motion'],
            // Firebase (large — load separately)
            'vendor-firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
            ],
            // Lucide icons
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      // Raise warning threshold slightly — Firebase alone is ~250KB
      chunkSizeWarningLimit: 600,
    },
  };
});
