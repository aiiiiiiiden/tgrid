import { contextBridge, ipcRenderer } from 'electron';

// Channel whitelists — only declared channels are accessible from the renderer
const HANDLE_CHANNELS = new Set([
  'create-pty',
  'get-presets',
  'save-preset',
  'delete-preset',
  'get-assignments',
  'set-assignment',
  'swap-assignments',
  'restore-assignments',
  'grid-selected',
  'resize-grid',
  'load-image',
  'pick-image',
  'set-theme',
  'install-preset-pack',
]);

const LISTENER_CHANNELS = new Set([
  'pty-write',
  'pty-resize',
]);

const PUSH_CHANNELS = new Set([
  'pty-data',
  'pty-exit',
  'init',
  'restore-session',
  'show-grid-picker',
  'focus-panel',
  'focus-direction',
  'toggle-fullscreen',
]);

contextBridge.exposeInMainWorld('tgrid', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!HANDLE_CHANNELS.has(channel)) {
      throw new Error(`IPC invoke blocked: unknown channel "${channel}"`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  send: (channel: string, ...args: unknown[]) => {
    if (!LISTENER_CHANNELS.has(channel)) {
      throw new Error(`IPC send blocked: unknown channel "${channel}"`);
    }
    ipcRenderer.send(channel, ...args);
  },

  on: (channel: string, handler: (...args: unknown[]) => void) => {
    if (!PUSH_CHANNELS.has(channel)) {
      throw new Error(`IPC on blocked: unknown channel "${channel}"`);
    }
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      handler(...args);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
