# tgrid

Terminal grid manager for AI agents. Run multiple terminals in a grid layout with semi-transparent character image overlays on each panel.

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Grid Layout** — Up to 4x4 (16) terminals arranged simultaneously
- **Character Presets** — Assign name, image, and shell per panel via presets
- **Image Overlay** — Semi-transparent character images rendered over terminals
- **Session Restore** — Saves grid config, preset assignments, and working directories on exit; restores on relaunch
- **Drag & Drop** — Drag panel headers to swap preset assignments between panels
- **Runtime Resize** — Change grid dimensions while running

## Quick Start

```bash
# Install dependencies
npm install

# Launch (shows grid picker UI)
npm start

# Launch with specific grid size
npx electron . 2 3   # 2 rows, 3 columns
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + 1-9` | Focus panel by number |
| `Cmd/Ctrl + ←↑↓→` | Navigate between panels |
| `Cmd/Ctrl + Enter` | Toggle fullscreen for active panel |
| `Shift` (on launch) | Skip session restore, start fresh |

## Configuration

Config is stored at `~/.tgrid/config.json`.

```json
{
  "defaultShell": "/bin/zsh",
  "defaultOpacity": 0.12,
  "activeOpacity": 0.18,
  "presets": [
    {
      "id": "claude",
      "name": "Claude",
      "image": "~/.tgrid/characters/claude.png",
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
| `presets` | List of character presets (name, image, shell) |
| `assignments` | Panel index → preset ID mapping |

## Building

Generate release builds for distribution.

```bash
# Build for current platform
npm run dist

# Platform-specific builds
npm run dist:mac     # macOS (dmg + zip, x64/arm64)
npm run dist:win     # Windows (nsis + zip, x64)
npm run dist:linux   # Linux (AppImage + deb + tar.gz, x64)

# Build for all platforms
npm run dist:all

# Or use the build script
./scripts/build.sh mac|win|linux|all|current
```

Build output goes to the `release/` directory.

### App Icon

Place a 512x512+ PNG at `build/icon.png` to use as the app icon. A placeholder icon is included by default.

## Project Structure

```
tgrid/
├── src/
│   ├── main.js          # Electron main process (PTY, IPC, session management)
│   ├── renderer.js      # Renderer (UI, terminals, grid management)
│   ├── preload.js       # Preload script (minimal)
│   └── index.html       # UI layout and styles
├── scripts/
│   └── build.sh         # Release build script
├── build/
│   └── icon.png         # App icon
└── package.json
```

## Tech Stack

- **Electron 41** — Desktop application framework
- **node-pty** — Native PTY (pseudo-terminal) bindings
- **xterm.js 6** — Terminal emulator (xterm-256color)
- **electron-builder** — Cross-platform build and packaging

## License

MIT
