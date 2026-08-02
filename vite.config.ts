import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'public',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logomarca_FF_Manutencoes_-_1254x1254.png'],
      manifest: {
        name: 'FF Manutencoes',
        short_name: 'FF Manut.',
        description: 'FF Manutencoes - Sistema de ordens de servico para ar condicionado e maquina de lavar',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/Logomarca_FF_Manutencoes_-_1254x1254.png', sizes: '192x192', type: 'image/png' },
          { src: '/Logomarca_FF_Manutencoes_-_1254x1254.png', sizes: '512x512', type: 'image/png' },
          { src: '/Logomarca_FF_Manutencoes_-_1254x1254.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['idb'],
  },
});
