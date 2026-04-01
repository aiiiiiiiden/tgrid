// ─── Data Types ───────────────────────────────────────────────

export interface Preset {
  id: string;
  name: string;
  shell?: string;
  cwd?: string;
  image?: string;
  color?: string | null;
}

export interface TGridConfig {
  presets: Preset[];
  /** Keys are numeric string indices: "0", "1", "2", etc. Values are preset IDs. */
  assignments: Record<string, string>;
  lastGrid?: { rows: number; cols: number };
  defaultShell?: string;
  defaultOpacity?: number; // default 0.3
  activeOpacity?: number; // default 0.5
  theme?: 'dark' | 'light';
}

export interface SessionPanel {
  index: number;
  presetId: string | null;
  cwd: string;
}

export interface SessionData {
  grid: { rows: number; cols: number };
  panels: SessionPanel[];
  savedAt: string; // ISO 8601
}

// ─── IPC Channels ─────────────────────────────────────────────

/** Request/reply: ipcMain.handle <-> ipcRenderer.invoke */
export interface IpcHandleChannels {
  'create-pty': {
    args: { id: string; shellOverride?: string; cwd?: string };
    result: { id: string; shell: string };
  };
  'get-presets': {
    args: void;
    result: Preset[];
  };
  'save-preset': {
    args: Preset;
    result: Preset[];
  };
  'delete-preset': {
    args: string;
    result: { presets: Preset[]; assignments: Record<string, string> };
  };
  'get-assignments': {
    args: void;
    result: Record<string, string>;
  };
  'set-assignment': {
    args: { panelIndex: number; presetId: string | null };
    result: Record<string, string>;
  };
  'swap-assignments': {
    args: {
      indexA: number;
      presetIdA: string | null;
      indexB: number;
      presetIdB: string | null;
    };
    result: Record<string, string>;
  };
  'restore-assignments': {
    args: { assignments: Record<string, string>; grid: { rows: number; cols: number } };
    result: Record<string, string>;
  };
  'grid-selected': {
    args: { rows: number; cols: number };
    result: { rows: number; cols: number };
  };
  'resize-grid': {
    args: {
      rows: number;
      cols: number;
      killPtyIds: string[];
      assignments: Record<string, string>;
    };
    result: void;
  };
  'load-image': {
    args: string;
    result: string | null;
  };
  'pick-image': {
    args: void;
    result: string | null;
  };
  'set-theme': {
    args: 'dark' | 'light';
    result: 'dark' | 'light';
  };
  'install-preset-pack': {
    args: string; // pack name
    result: Preset[];
  };
}

/** Fire-and-forget: ipcMain.on <- ipcRenderer.send */
export interface IpcListenerChannels {
  'pty-write': { id: string; data: string };
  'pty-resize': { id: string; cols: number; rows: number };
}

/** Push events: webContents.send -> renderer via preload on() */
export interface IpcPushEvents {
  'pty-data': { id: string; data: string };
  'pty-exit': { id: string; exitCode: number };
  'init': {
    rows: number;
    cols: number;
    config: TGridConfig;
    sessionPanels?: SessionPanel[] | null;
  };
  'restore-session': { session: SessionData; config: TGridConfig };
  'show-grid-picker': {
    lastGrid: { rows: number; cols: number };
    config: TGridConfig;
  };
  'focus-panel': number;
  'focus-direction': 'up' | 'down' | 'left' | 'right';
  'toggle-fullscreen': undefined;
}

// ─── Helper Types for Typed Preload Bridge ────────────────────

export type HandleChannel = keyof IpcHandleChannels;
export type ListenerChannel = keyof IpcListenerChannels;
export type PushChannel = keyof IpcPushEvents;

export interface TGridApi {
  invoke<K extends HandleChannel>(
    channel: K,
    ...args: IpcHandleChannels[K]['args'] extends void ? [] : [IpcHandleChannels[K]['args']]
  ): Promise<IpcHandleChannels[K]['result']>;

  send<K extends ListenerChannel>(
    channel: K,
    payload: IpcListenerChannels[K],
  ): void;

  on<K extends PushChannel>(
    channel: K,
    handler: (payload: IpcPushEvents[K]) => void,
  ): () => void; // returns unsubscribe function
}
