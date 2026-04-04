#!/usr/bin/env node
/**
 * Dev script: starts Vite renderer dev server, builds main+preload with watch,
 * then launches Electron. Bypasses Forge's stdio: 'inherit' issue in non-TTY shells.
 */
import { spawn } from 'node:child_process';
import { createServer, build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  // 1. Start Vite dev server for renderer
  const viteServer = await createServer({
    root,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@shared': path.join(root, 'src/shared'),
        '@': path.join(root, 'src/renderer'),
      },
    },
    clearScreen: false,
  });
  await viteServer.listen();
  const address = viteServer.httpServer?.address();
  const port = typeof address === 'object' ? address?.port : 5173;
  const devServerUrl = `http://localhost:${port}`;
  console.log(`Vite dev server running at ${devServerUrl}`);

  // 2. Build main + preload with watch mode
  const commonDefine = {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(devServerUrl),
    MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
  };

  const external = [
    'electron',
    'electron/common',
    'node-pty',
    ...['path', 'fs', 'os', 'child_process', 'events', 'util', 'net', 'stream', 'crypto', 'http', 'https', 'url', 'assert', 'tty', 'zlib', 'buffer', 'string_decoder', 'querystring', 'module']
      .flatMap(m => [m, `node:${m}`]),
  ];

  const buildMain = await build({
    root,
    configFile: false,
    define: commonDefine,
    resolve: {
      alias: { '@shared': path.join(root, 'src/shared') },
    },
    build: {
      outDir: '.vite/build',
      emptyOutDir: false,
      lib: { entry: 'src/main/main.ts', formats: ['cjs'], fileName: () => 'main.js' },
      rollupOptions: { external },
      watch: {},
      minify: false,
    },
    logLevel: 'warn',
  });

  const buildPreload = await build({
    root,
    configFile: false,
    define: commonDefine,
    resolve: {
      alias: { '@shared': path.join(root, 'src/shared') },
    },
    build: {
      outDir: '.vite/build',
      emptyOutDir: false,
      lib: { entry: 'src/preload/preload.ts', formats: ['cjs'], fileName: () => 'preload.js' },
      rollupOptions: { external },
      watch: {},
      minify: false,
    },
    logLevel: 'warn',
  });

  // Wait a tick for initial builds
  await new Promise(r => setTimeout(r, 500));

  // 3. Launch Electron
  const electronPath = path.join(root, 'node_modules/.bin/electron');
  const extraArgs = process.argv.slice(2);
  const electron = spawn(electronPath, ['.', ...extraArgs], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env },
  });

  console.log(`Electron launched (PID: ${electron.pid})`);

  electron.on('exit', (code) => {
    console.log(`Electron exited with code ${code}`);
    viteServer.close();
    if (buildMain && 'close' in buildMain) buildMain.close();
    if (buildPreload && 'close' in buildPreload) buildPreload.close();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    electron.kill();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
