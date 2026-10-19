import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 6102, strictPort: true, proxy: { '/api': 'http://127.0.0.1:6101' } },
  build: { chunkSizeWarningLimit: 1400 },
});
