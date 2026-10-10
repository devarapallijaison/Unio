import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the API is proxied so the session cookie is first-party.
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
});
