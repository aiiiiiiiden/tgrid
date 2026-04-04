# tgrid

<p align="center">
  <img src="resources/hagrid.svg" alt="Hagrid" width="200" />
</p>

**t**erminal **grid** manager for AI agents — named after Hagrid from Harry Potter, the gentle giant who guides young wizards into a new world, just as tgrid guides your AI agents into their terminal homes.

Run multiple terminals in a grid layout with semi-transparent character image overlays on each panel.

[한국어](README.ko.md)

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![License](https://img.shields.io/badge/License-MIT-green)

## Screenshots

| Light Theme | Dark Theme |
|:-:|:-:|
| ![Light Theme](resources/screenshots/screenshot_01_light_theme.png) | ![Dark Theme](resources/screenshots/screenshot_02_dark_theme.png) |

| Grid Resize | Preset Editor |
|:-:|:-:|
| ![Grid Resize](resources/screenshots/screenshot_03_grid.png) | ![Preset Editor](resources/screenshots/screenshot_04_preset.png) |

## Features

- **Grid Layout** — Up to 4x4 (16) terminals arranged simultaneously
- **Character Presets** — Assign name, image, color, and shell per panel via presets
- **Preset Packs** — Bundled preset packs (e.g., Harry Potter houses) installable from the UI
- **Image Overlay** — Semi-transparent character images rendered over terminals
- **Session Restore** — Saves grid config, preset assignments, and working directories on exit; restores on relaunch
- **Drag & Drop** — Drag panel headers to swap preset assignments between panels
- **Spatial Grid Resize** — Change grid dimensions while running; panels preserve their row/column positions
- **Light/Dark Theme** — Toggle between light and dark themes; propagates to CLI tools via OSC 10/11 color reporting
- **CJK Input** — Full UTF-8 locale support for Korean, Japanese, and Chinese input

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Launch with specific grid size
npm run dev -- 2 3   # 2 rows, 3 columns
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + 1-9` | Focus panel by number |
| `Cmd/Ctrl + Arrow` | Navigate between panels |
| `Cmd/Ctrl + Enter` | Toggle fullscreen for active panel |
| `Shift` (on launch) | Skip session restore, start fresh |

## Configuration

Config is stored at `~/.tgrid/config.json`.

```json
{
  "defaultShell": "/bin/zsh",
  "defaultOpacity": 0.3,
  "activeOpacity": 0.5,
  "theme": "dark",
  "presets": [
    {
      "id": "claude",
      "name": "Claude",
      "image": "~/.tgrid/characters/claude.png",
      "color": "#a855f7",
      "shell": "/bin/zsh"
    }
  ],
  "assignments": {
    "0": "claude"
  }
}
```

| Field | Description |
|---|---|
| `defaultShell` | Default shell path |
| `defaultOpacity` | Character image opacity for inactive panels |
| `activeOpacity` | Character image opacity for the active panel |
| `theme` | Color theme (`dark` or `light`) |
| `presets` | List of character presets (name, image, color, shell) |
| `assignments` | Panel index to preset ID mapping |

## Building

```bash
# Build for current platform (Electron Forge)
npm run dist

# Platform-specific builds
npm run dist:mac     # macOS
npm run dist:win     # Windows
npm run dist:linux   # Linux
```

Alternatively, use the release build script for more control:

```bash
./scripts/build.sh           # Build for current platform
./scripts/build.sh mac       # macOS (dmg + zip)
./scripts/build.sh win       # Windows (nsis + zip)
./scripts/build.sh linux     # Linux (AppImage + deb + tar.gz)
./scripts/build.sh all       # All platforms (requires cross-compilation tools)
```

## Project Structure

```
tgrid/
├── src/
│   ├── main/
│   │   ├── main.ts            # Electron main process (IPC, shortcuts, session)
│   │   ├── pty-manager.ts     # PTY lifecycle management (node-pty)
│   │   ├── config.ts          # Config/session file I/O
│   │   └── image-loader.ts    # Image file loading and picker
│   ├── preload/
│   │   └── preload.ts         # Context-isolated IPC bridge
│   ├── renderer/
│   │   ├── index.tsx           # React entry point
│   │   ├── App.tsx             # App shell (grid resize, swap, IPC events)
│   │   ├── global.d.ts         # Window.tgrid type declaration
│   │   ├── components/
│   │   │   ├── Grid.tsx            # Grid container with stable DOM ordering
│   │   │   ├── Panel.tsx           # Panel with header, terminal, overlay
│   │   │   ├── TerminalView.tsx    # xterm.js terminal wrapper
│   │   │   ├── AgentOverlay.tsx    # Character image overlay
│   │   │   ├── GridPicker.tsx      # Initial grid size selector
│   │   │   ├── GridResizeDropdown.tsx
│   │   │   ├── PresetDropdown.tsx
│   │   │   └── PresetEditor.tsx
│   │   ├── context/
│   │   │   ├── GridContext.tsx          # Composite provider and hooks
│   │   │   ├── GridLayoutContext.tsx    # Grid rows/cols state
│   │   │   ├── GridSelectionContext.tsx # Active/fullscreen panel state
│   │   │   ├── PresetContext.tsx        # Presets, assignments, config state
│   │   │   └── ThemeContext.tsx         # Theme state
│   │   ├── hooks/
│   │   │   ├── useTerminal.ts      # xterm.js + PTY binding hook
│   │   │   ├── useIpc.ts           # IPC event listener hook
│   │   │   ├── useImageLoader.ts   # Lazy image loader with caching
│   │   │   ├── useDragSwap.ts      # Drag-and-drop swap hook
│   │   │   └── useDropdownPosition.ts
│   │   ├── utils/
│   │   │   ├── colors.ts       # Color utilities
│   │   │   └── ptyMap.ts       # PTY ID helpers
│   │   └── styles/
│   │       ├── index.css        # Main styles
│   │       └── themes.css       # Light/dark theme variables
│   ├── shared/
│   │   └── types.ts            # Shared IPC type definitions
│   └── __tests__/              # 24 test files (Vitest + Testing Library)
│       ├── setup.ts
│       ├── test-utils.tsx
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── main/
│       └── utils/
├── resources/
│   ├── icon.svg                # App icon (SVG source)
│   ├── icon.png                # App icon (PNG)
│   ├── icon.icns               # App icon (macOS)
│   ├── icon.ico                # App icon (Windows)
│   └── presets/                # Bundled preset packs
│       └── harry-potter/       # Harry Potter house crests (CC BY-SA 2.0)
├── scripts/
│   ├── dev.mjs                 # Dev server script
│   └── build.sh                # Release build script
├── forge.config.ts             # Electron Forge config
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── vitest.config.mts
└── tsconfig.json
```

## Tech Stack

- **Electron 41** — Desktop application framework
- **React 19** — UI framework
- **TypeScript 5.5** — Type-safe development
- **Vite 5** — Build tooling (via Electron Forge 7)
- **node-pty 1** — Native PTY (pseudo-terminal) bindings
- **xterm.js 6** — Terminal emulator (xterm-256color, OSC 10/11 color reporting)
- **Vitest 2** — Unit testing framework
- **Testing Library** — React component testing (16+ react, 6+ jest-dom)

## Testing

24 test files covering components, contexts, hooks, main process modules, and utilities.

```bash
npm test            # Run tests once
npm run test:watch  # Watch mode
```

## License

MIT

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party asset licenses.
