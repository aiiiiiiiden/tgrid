# tgrid

AI Agent Terminal Grid Manager with character image overlays.

Run multiple Claude Code sessions in a grid layout, each with a semi-transparent character profile image. Turn your terminal sessions into a team of AI agents with visual identities.

## Features

- **NxM Grid Layout** — `tgrid 2 3` opens a 2x3 grid of terminals
- **Character Overlays** — Semi-transparent profile images on each terminal panel
- **Keyboard Navigation** — `Cmd+1-9` to focus panels, `Cmd+Arrow` to navigate
- **Fullscreen Toggle** — `Cmd+Enter` to maximize a single panel
- **Per-panel Shell Config** — Different shell/command per terminal (e.g., `claude` for Claude Code)
- **Active Panel Glow** — Cyan glow border on the focused panel

## Quick Start

```bash
# Install dependencies
npm install

# Run with a 2x2 grid
npm start -- 2 2

# Or a 2x3 grid
npx electron . 2 3
```

## Character Configuration

Edit `~/.tgrid/config.json`:

```json
{
  "defaultShell": "/bin/zsh",
  "defaultOpacity": 0.12,
  "activeOpacity": 0.18,
  "characters": [
    {
      "name": "Rei",
      "image": "~/.tgrid/characters/rei.png",
      "shell": "claude"
    },
    {
      "name": "Asuka",
      "image": "~/.tgrid/characters/asuka.png"
    }
  ]
}
```

- Place character images (PNG/WebP/JPEG) in `~/.tgrid/characters/`
- Transparent background PNGs work best
- Characters are assigned to panels in array order
- `shell` field is optional — defaults to `defaultShell`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1`~`Cmd+9` | Focus panel by number |
| `Cmd+Arrow` | Navigate between panels (wraps) |
| `Cmd+Enter` | Toggle fullscreen for active panel |

## Tech Stack

- **Electron** — Desktop app shell
- **xterm.js** — Terminal emulation
- **node-pty** — PTY process management

## License

MIT
