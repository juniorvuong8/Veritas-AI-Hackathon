/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared': path.resolve(import.meta.dirname, './supabase/functions/_shared'),
    },
  },
  build: {
    rollupOptions: {
      // The game, plus the evaluation rating page (eval.html, used locally by the developer).
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        eval: path.resolve(import.meta.dirname, 'eval.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts', 'eval/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
