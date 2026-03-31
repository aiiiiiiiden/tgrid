# CLAUDE.md

## Project Overview

tgrid is an Electron-based terminal grid manager for AI agents. It arranges multiple terminals in a grid layout and supports character image overlays on each panel.

## Architecture

Single-window Electron app composed of a main process and a renderer process.

### Main Process (`src/main.js`)
- PTY lifecycle management (spawn, write, resize, kill via node-pty)
- Config file read/write (`~/.tgrid/config.json`)
- Session save/restore (`~/.tgrid/session.json`)
- Character image loading (file → data URL conversion)
- Native dialogs (image picker)
- Global shortcut registration (`Cmd/Ctrl+1-9`, `Cmd/Ctrl+Arrow`, `Cmd/Ctrl+Enter`)

### Renderer Process (`src/renderer.js`)
- Grid UI creation and management
- xterm.js terminal instance management
- Preset system (dropdown menus, modal editor)
- Character image overlay rendering
- Drag & drop to swap preset assignments between panels
- Grid picker (on first launch) and runtime resize

### IPC Communication
Main ↔ renderer communication uses the `ipcMain.handle`/`ipcRenderer.invoke` pattern:
- `create-pty`, `pty-write`, `pty-resize`, `pty-kill` — PTY control
- `get-presets`, `save-preset`, `delete-preset` — Preset CRUD
- `get-assignments`, `set-assignment`, `swap-assignments` — Panel-preset mapping
- `grid-selected`, `resize-grid` — Grid size changes
- `load-image`, `pick-image` — Image management
- `restore-assignments` — Session restore

## Key Conventions

- **nodeIntegration: true, contextIsolation: false** — Renderer uses `require()` directly
- **Preset IDs** — Auto-generated name-based slugs (`generatePresetId`)
- **Image paths** — Stored under `~/.tgrid/characters/`, tilde (`~`) paths supported
- **PTY IDs** — Format `pty-{index}` (e.g., `pty-0`, `pty-1`)
- **Session restore** — Previous session auto-restores on launch; hold `Shift` to skip

## Build & Run

```bash
npm install          # Install deps + rebuild native modules
npm start            # Dev run
npm run dist:mac     # macOS release build
npm run dist:win     # Windows release build
npm run dist:linux   # Linux release build
```

## File Layout

```
src/main.js       — Electron main process (455 lines)
src/renderer.js   — Renderer process UI logic (1070 lines)
src/index.html    — HTML layout + CSS styles
src/preload.js    — Preload (minimal, 3 lines)
scripts/build.sh  — Release build script
build/icon.png    — App icon
```

## Style Notes

- Plain JavaScript (no TypeScript)
- Vanilla DOM manipulation, no frameworks
- CSS is inlined in `<style>` tag within `index.html`
- Color theme: dark background (`#0a0a0f`), cyan accent (`#00d4ff`)
- All UI components (dropdowns, modals, grid picker) are dynamically created in JS
