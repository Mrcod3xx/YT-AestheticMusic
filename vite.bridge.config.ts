import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/bridge/mainWorldBridge.ts'),
      name: 'AestheticMusicBridge',
      formats: ['iife'],
      fileName: () => 'mainWorldBridge.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
