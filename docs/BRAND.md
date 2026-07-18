# Porticle product and brand direction

## Product position

**Porticle is the quickest trustworthy answer to “what owns this local port?”**

The product is a native-feeling instrument, not a developer dashboard. It should be useful five seconds after launch and remain quiet for the rest of the day.

Principles:

1. **Tray first.** The app is never more than one click away and does not occupy the Dock or taskbar.
2. **Identity before action.** Process details and race checks are not advanced options; they are the safety model.
3. **Local by construction.** No network backend, account, analytics, or process history.
4. **Ordinary privileges.** Visibility can degrade gracefully; authority never expands silently.
5. **Dense, not cramped.** Every persistent pixel helps find, understand, copy, open, watch, or stop an endpoint.

## Name

**Porticle** combines “port” with “portal” and “particle”: a small aperture into the machine’s local network state.

The name was selected on July 17, 2026 after checking exact-name npm availability and obvious GitHub/web conflicts. The exact npm package was unclaimed and search results did not show a competing local-port developer application. This is a practical collision check, not legal trademark clearance.

Pronunciation: **POR-ti-kəl**.

Tagline: **Local ports, without the terminal archaeology.**

## Mark

The mark is one continuous `P` shaped like a physical socket or cable path, with a single round contact. At tray size the construction reduces to a heavy vertical stem, one loop, and one dot. It does not depend on lettering, thin strokes, shadows, or color.

App icon:

- graphite rounded square;
- signal-orange socket path;
- warm-white contact;
- corner radius large enough to feel like a tool tile, not a corporate badge.

Tray icon:

- monochrome template asset on macOS so the OS controls contrast;
- white monochrome asset on Windows;
- 20px and 2× variants;
- no enclosing square, text, or tiny secondary detail.

Source and generated assets live in `resources/`. Run `npm run icons` after changing either SVG.
Renderer favicons are generated from the same canonical app mark into `src/renderer/public/`.

## Color system

| Token    | Dark      | Light     | Role                                |
| -------- | --------- | --------- | ----------------------------------- |
| Signal   | `#FF5A36` | `#FF5A36` | selection, web services, brand line |
| Canvas   | `#15171B` | `#EFEDE7` | outer/background context            |
| Surface  | `#1B1E23` | `#F8F7F3` | main popover                        |
| Raised   | `#22262C` | `#FFFEFA` | fields, dialog, controls            |
| Ink      | `#F3F1EB` | `#191B20` | primary text                        |
| Muted    | `#94979F` | `#686B73` | secondary metadata                  |
| Success  | `#49C991` | `#168460` | active/free state                   |
| Danger   | `#F06A6A` | `#CF3F43` | stop and failure                    |
| Database | `#69A2FF` | `#2F6FDA` | service signal                      |
| Warning  | `#E9B552` | `#A66B05` | permission/protected state          |

Users may replace Signal with one of four curated colors or any six-digit color. Derived backgrounds and borders use CSS `color-mix`, keeping contrast relationships intact.

## Typography

- **IBM Plex Sans** at 400/500/600 for interface language.
- **IBM Plex Mono** at 400/500/600 for ports, commands, PIDs, protocols, and micro-labels.
- Only Latin subsets are bundled.

Plex feels engineered without turning the interface into a terminal imitation. Port numbers use a slightly tightened mono setting so five digits remain scannable in the compact column.

## Layout and motion

- Canonical popover: 420 × 640 CSS pixels.
- One-pixel structural borders; no glass layers.
- Status bars, not cards, identify service categories.
- Rows expand in place so context is never lost.
- Stop is always present at row level; secondary copy/watch actions live in details.
- Motion is limited to the refresh spinner and 100–120ms state transitions.
- `prefers-reduced-motion` reduces all nonessential motion to effectively zero.

## Voice

Short, factual, and calm.

Use:

- “Port 5173 changed owners before it could be stopped.”
- “Windows denied permission to stop System.”
- “Watching port 3000.”

Avoid:

- jokes around destructive actions;
- “magic,” “AI-powered,” or anthropomorphic language;
- unexplained OS jargon;
- blame when a race or permission boundary is expected.

## Assets

| File                                       | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| `resources/icon.svg`                       | canonical app mark                |
| `resources/icon.icns`                      | macOS package icon                |
| `resources/icon.ico`                       | Windows package icon              |
| `resources/icon.png`                       | documentation/general fallback    |
| `resources/trayTemplate*.png`              | macOS template tray assets        |
| `resources/tray-windows*.png`              | Windows tray assets               |
| `src/renderer/public/favicon*`             | renderer/browser favicon variants |
| `src/renderer/public/apple-touch-icon.png` | high-resolution browser shortcut  |
| `docs/assets/porticle-*.png`               | reproducible product screenshots  |
