import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/SciFiArpg/',
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.ttf', 'icon-192.png', 'icon-512.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,ttf,png,svg,json}'] },
      manifest: {
        name: 'Zgłoszenie',
        short_name: 'Zgłoszenie',
        description: 'Zgłoszenie nr 48213',
        lang: 'pl',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/SciFiArpg/',
        scope: '/SciFiArpg/',
        theme_color: '#f3ecd8',
        background_color: '#f3ecd8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
});
