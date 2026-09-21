import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'firebase-core': ['firebase/app', 'firebase/auth'],
            'firebase-firestore': ['firebase/firestore'],
            'react-vendor': ['react', 'react-dom'],
            'lucide': ['lucide-react'],
          },
        },
      },
      minify: 'esbuild',
      target: 'es2020',
      chunkSizeWarningLimit: 300,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
