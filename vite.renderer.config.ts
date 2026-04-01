import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pluginExposeRenderer } from '@electron-forge/plugin-vite/dist/config/vite.base.config';

export default defineConfig((env) => {
  const { forgeConfigSelf } = env as typeof env & {
    forgeConfigSelf: { name?: string };
  };

  const name = forgeConfigSelf?.name ?? '';

  return {
    plugins: [pluginExposeRenderer(name), react()],
    resolve: {
      alias: {
        '@shared': '/src/shared',
      },
    },
    clearScreen: false,
  };
});
