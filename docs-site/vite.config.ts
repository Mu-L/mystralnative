import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  base: '/mystralnative/',
  plugins: [
    mdx({
      remarkPlugins: [remarkGfm],
    }),
    react(),
  ],
  build: {
    outDir: 'dist',
  },
});
