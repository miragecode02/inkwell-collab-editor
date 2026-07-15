import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@collab/crdt': path.resolve(__dirname, '../packages/crdt/src/rga.ts'),
    },
  },
  server: { port: 5173 },
});
