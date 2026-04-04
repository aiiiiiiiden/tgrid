import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pluginExposeRenderer } from '@electron-forge/plugin-vite/dist/config/vite.base.config';

export default defineConfig((env) => {
  const { forgeConfigSelf } = env as typeof env & {
    forgeConfigSelf: { name?: string };
  };

  const name = forgeConfigSelf?.name ?? '';

  return {
    plugins: [pluginExposeRenderer(name), react(), tailwindcss()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@': path.resolve(__dirname, 'src/renderer'),
      },
    },
    clearScreen: false,
  };
});
