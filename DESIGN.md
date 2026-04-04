# DESIGN.md

Design system for tgrid. Source of truth for all visual decisions.

## Aesthetic

**Industrial Utilitarian + Calm.** Terminal-first tool that stays out of the way. No glow effects, no glassmorphism, no gradient text. Inspired by Linear's restraint and Ghostty's personality.

## Typography

Two stacks, strict separation:

- **UI chrome** (toolbar, status bar, dialogs, labels): System sans-serif
  ```
  -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif
  ```
- **Terminal content** (xterm.js): System monospace
  ```
  'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace
  ```

Panel header uses the UI sans-serif stack. Terminal content uses the monospace stack. Never mix them.

## Color System

### Dark Theme (default)

Green-tinted neutrals. Every gray carries a hint of `#4ade80` to feel organic, not sterile.

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#111111` | App background, canvas |
| `--bg-surface` | `#181818` | Elevated surfaces, headers |
| `--bg-panel` | `#141514` | Terminal panel background |
| `--bg-interactive` | `#1e1f1e` | Buttons, inputs |
| `--border` | `#222322` | Subtle separators |
| `--border-light` | `#2f302f` | Input borders, elevated |
| `--accent` | `#4ade80` | Focus, active, interactive |
| `--accent-glow` | `rgba(74, 222, 128, 0.15)` | Ring shadows |
| `--accent-hover` | `rgba(74, 222, 128, 0.1)` | Hover backgrounds |
| `--accent-selection` | `rgba(74, 222, 128, 0.2)` | Text selection |
| `--accent-highlight` | `rgba(74, 222, 128, 0.35)` | Emphasized selection |
| `--text-primary` | `#e5e6e5` | Headings, active labels |
| `--text-secondary` | `#cccdcc` | Body text |
| `--text-muted` | `#707170` | Labels, hints |
| `--text-dim` | `#4e4f4e` | Disabled, decorative |
| `--text-dark` | `#414241` | Very low emphasis |
| `--text-darker` | `#373837` | Ghost text |
| `--text-index` | `#444544` | Panel index numbers |
| `--danger` | `#f87171` | Destructive actions |

### Light Theme

Higher contrast borders, muted green accent.

| Token | Value |
|-------|-------|
| `--bg-base` | `#ebebeb` |
| `--bg-surface` | `#ededed` |
| `--bg-panel` | `#fafafa` |
| `--bg-interactive` | `#d8d8d8` |
| `--border` | `#c8c8c8` |
| `--border-light` | `#b0b0b0` |
| `--accent` | `#15803d` |
| `--danger` | `#dc2626` |

## Spacing

4px base grid (`--spacing: 0.25rem`). Compact everywhere.

- Grid gap: 6px (`gap-1.5`)
- Panel header: 10px horizontal, 3px vertical
- Toolbar height: 38px
- Status bar height: 24px
- Dialog max-width: 400px

## Border Radius

Minimal. Rounded rectangles, not pills.

- `--radius-sm`: 2px (inputs, small elements)
- `--radius-md`: 4px (panels, cards)
- `--radius-lg`: 6px (dialogs)
- `--radius-xl`: 8px (image previews)

## Motion

Minimal-functional. 200ms for color/shadow transitions. No decorative animation.

```
transition-duration: 200ms
transition-timing-function: ease
prefers-reduced-motion: instant (0.01ms)
```

## Active State Pattern

Panels use a layered active indicator:
1. `ring-2` with panel color (no layout shift)
2. Accent-tinted header background (8% mix)
3. Outer glow shadow at 20% opacity, 14px spread

Inactive panels show nothing. "Quiet Until Active."

## Preset Colors

8-color palette for panel identification:

| Name | Value |
|------|-------|
| Red | `#f87171` |
| Orange | `#fb923c` |
| Yellow | `#fbbf24` |
| Green | `#4ade80` |
| Cyan | `#67e8f9` |
| Blue | `#60a5fa` |
| Purple | `#c084fc` |
| Pink | `#f472b6` |

## Terminal Theme (xterm.js)

- Background: `#141514`
- Foreground: `#cccdcc`
- Cursor: `#4ade80`
- Selection: `rgba(74, 222, 128, 0.2)`

## Design Principles

1. **Terminal First** -- Terminal content always wins. UI chrome minimized.
2. **Keyboard Native** -- All core actions work without mouse.
3. **Quiet Until Active** -- Default state invisible, active state clear.
4. **Character as Identity** -- Overlays are a feature, not decoration.
5. **Joyful Precision** -- Restraint with delight in details.
