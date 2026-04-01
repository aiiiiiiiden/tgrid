import { defineConfig, mergeConfig, type ConfigEnv } from 'vite';
import {
  getBuildConfig,
  getBuildDefine,
  external,
  pluginHotRestart,
} from '@electron-forge/plugin-vite/dist/config/vite.base.config';

export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'build'>;

  return mergeConfig(getBuildConfig(forgeEnv), {
    define: getBuildDefine(forgeEnv),
    plugins: [pluginHotRestart('restart')],
    resolve: {
      alias: {
        '@shared': '/src/shared',
      },
    },
    build: {
      rollupOptions: {
        external: [...external, 'node-pty'],
      },
    },
  });
});
