# CLAUDE.md

## Project Overview

tgrid is an Electron-based terminal grid manager for AI agents. It arranges multiple terminals in a grid layout and supports character image overlays on each panel.

## Architecture

Single-window Electron app: main process (PTY/config), preload (IPC bridge), renderer (React UI), shared types.

### Main Process (`src/main/`)
- `main.ts` — Window creation, IPC handlers, global shortcuts (`Cmd/Ctrl+1-9`, `Cmd/Ctrl+Arrow`, `Cmd/Ctrl+Enter`), preset pack installer
- `pty-manager.ts` — node-pty lifecycle, shell resolution, cwd detection (lsof on macOS, /proc on Linux)
- `config.ts` — Config/session persistence (`~/.tgrid/config.json`, `~/.tgrid/session.json`)
- `image-loader.ts` — Image path expansion (~), MIME detection, base64 encoding, file picker dialog

### Preload Bridge (`src/preload/preload.ts`)
- Context-isolated IPC bridge with hard-coded channel whitelists
- Three channel types: HANDLE (invoke), LISTENER (send), PUSH (main→renderer events)
- Throws on unknown channel access — no wildcard/dynamic channels

### Renderer (`src/renderer/`)
- `App.tsx` — App shell orchestrating grid picker / session restore / running states
- `index.tsx` — React entry point with StrictMode
- **Components** (`components/`): Grid, Panel, TerminalView, AgentOverlay, GridPicker, GridResizeDropdown, PresetDropdown, PresetEditor
- **Contexts** (`context/`): GridLayoutContext (dimensions), GridSelectionContext (active/fullscreen), PresetContext (presets/assignments/image cache), ThemeContext (dark/light), GridContext (composite provider)
- **Hooks** (`hooks/`): useTerminal, useIpc, useDragSwap, useDropdownPosition, useImageLoader
- **Utils** (`utils/`): colors, ptyMap
- **Styles** (`styles/`): index.css, themes.css

### Shared (`src/shared/types.ts`)
- Full IPC type definitions: Preset, TGridConfig, SessionData, IpcHandleChannels, IpcListenerChannels, IpcPushEvents

### IPC Channels
**Handle** (request/reply): `create-pty`, `get-presets`, `save-preset`, `delete-preset`, `get-assignments`, `set-assignment`, `swap-assignments`, `restore-assignments`, `grid-selected`, `resize-grid`, `load-image`, `pick-image`, `set-theme`, `install-preset-pack`

**Listener** (fire-and-forget): `pty-write`, `pty-resize`

**Push** (main→renderer): `pty-data`, `pty-exit`, `init`, `restore-session`, `show-grid-picker`, `focus-panel`, `focus-direction`, `toggle-fullscreen`

## Key Conventions

- **contextIsolation: true, nodeIntegration: false** — Strict security via preload bridge (`window.tgrid`)
- **Preset IDs** — Auto-generated name-based slugs (`generatePresetId`)
- **Image paths** — Stored under `~/.tgrid/characters/`, tilde (`~`) paths supported
- **PTY IDs** — Format `pty-{index}` (e.g., `pty-0`, `pty-1`)
- **Session restore** — Previous session auto-restores on launch; hold `Shift` to skip
- **Path aliases** — `@shared` → `src/shared` (configured in all Vite configs)

## Build & Run

```bash
npm install          # Install deps + rebuild native modules
npm run dev          # Dev run (Vite dev server + Electron)
npm test             # Run tests (Vitest)
npm run test:watch   # Watch mode
npm run dist         # Build for current platform
npm run dist:mac     # macOS release build (.zip)
npm run dist:win     # Windows release build (Squirrel)
npm run dist:linux   # Linux release build (.deb)
```

## File Layout

```
src/
├── main/            — Electron main process (main.ts, pty-manager.ts, config.ts, image-loader.ts)
├── preload/         — Context-isolated IPC bridge (preload.ts)
├── renderer/        — React UI (App.tsx, components/, context/, hooks/, utils/, styles/)
├── shared/          — Shared IPC type definitions (types.ts)
└── __tests__/       — 24 test files (components, contexts, hooks, main, utils)
resources/
├── icon.*           — App icons (svg, png, icns, ico)
├── hagrid.svg       — Hagrid character vector graphic
└── presets/         — Bundled preset packs (harry-potter/)
scripts/
├── dev.mjs          — Dev server orchestration
└── build.sh         — Release build script
```

## Style Notes

- TypeScript + React 19
- CSS variables for theming (dark/light) in `themes.css`
- Design system documented in `DESIGN.md` -- all visual decisions reference this file
- Green-tinted neutrals with `#4ade80` accent
- UI chrome uses system sans-serif; terminal uses system monospace (see DESIGN.md Typography)
- Components are React functional components with context-based state management

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
