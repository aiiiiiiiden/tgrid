import { defineConfig, mergeConfig, type ConfigEnv } from 'vite';
import {
  getBuildConfig,
  getBuildDefine,
  pluginHotRestart,
} from '@electron-forge/plugin-vite/dist/config/vite.base.config';

export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'build'>;

  return mergeConfig(getBuildConfig(forgeEnv), {
    define: getBuildDefine(forgeEnv),
    plugins: [pluginHotRestart('reload')],
    resolve: {
      alias: {
        '@shared': '/src/shared',
      },
    },
  });
});
