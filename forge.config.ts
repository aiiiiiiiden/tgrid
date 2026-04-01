import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import path from 'path';
import fs from 'fs';

function copyNativeModules(buildPath: string) {
  const nativeModules = ['node-pty'];
  const srcNodeModules = path.resolve(__dirname, 'node_modules');
  const destNodeModules = path.join(buildPath, 'node_modules');

  for (const mod of nativeModules) {
    const src = path.join(srcNodeModules, mod);
    const dest = path.join(destNodeModules, mod);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node-pty/**',
    },
    icon: 'resources/icon',
    appBundleId: 'com.tgrid.app',
    extraResource: ['resources/icon.png', 'resources/presets'],
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      copyNativeModules(buildPath);
    },
  },
  makers: [
    new MakerSquirrel({ setupIcon: 'resources/icon.ico' }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({ options: { categories: ['Development'], icon: 'resources/icon.png' } }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
