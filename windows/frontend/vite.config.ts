import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        settings: fileURLToPath(new URL('./settings.html', import.meta.url)),
      },
    },
  },
});
