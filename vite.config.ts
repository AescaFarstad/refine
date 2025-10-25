import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Keep symlinked paths as-is instead of resolving to real paths
    preserveSymlinks: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    fs: {
      // Allow serving files from one level up and the external repo path
      allow: [
        '..',
        '/mnt/WoB/WOB/web_rep/mhq',
      ],
    },
  },
  preview: { port: 5175, strictPort: true }
});
