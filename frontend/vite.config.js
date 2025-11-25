import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 2272,
    proxy: {
      '/api': {
        target: 'http://localhost:2271',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:2271',
        changeOrigin: true,
        ws: true,
      }
    }
  }
});
