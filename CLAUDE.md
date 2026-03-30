# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run electron:dev      # Start Electron + CRA dev server together (hot reload)
npm run electron:preview  # Build then open in Electron without packaging
npm run electron:build    # Build → dist/Trading Journal Setup.exe (Windows installer)
npm start                 # CRA dev server only (browser)
npm run build             # CRA production build only → /build
```

No test or lint scripts are configured.

## Electron setup

The app is packaged with Electron + electron-builder. The main process lives at `public/electron.js` — CRA copies `public/` into `build/` verbatim, which is how electron-builder's `react-cra` preset finds it at `build/electron.js` inside the asar.

Three load modes in `electron.js`:
- `app.isPackaged` → load `index.html` from inside the asar
- `--prod` flag → load from `../build/index.html` (preview mode, not packaged)
- default → load `http://localhost:3000` (dev server)

User data (localStorage) is persisted at `%APPDATA%\trading-journal\` and is intentionally preserved on uninstall (`deleteAppDataOnUninstall: false`).

## Architecture

This is a **single-file React app** — all application logic lives in `src/App.jsx`. There is no routing, no external state management, and no CSS files. Styling is entirely inline.

**Component hierarchy (all in App.jsx):**
- `App` — root component; owns all state, renders tab layout
- `TradeModal` — add/edit form rendered as an overlay modal
- `StatCard` — small reusable stat display
- `Analytics` — tab content with two Recharts charts (cumulative P&L line, P&L-by-strategy bar)

**State:** React `useState` hooks only. `trades` array is the single source of truth, persisted to `localStorage` via `useEffect` on every change.

**Trade data model:**
```js
{ id, symbol, date, direction: "long"|"short", qty, entry, exit, strategy, risk, notes }
```
`exit` is `null` for open trades. P&L is `(exit - entry) * qty` for long, reversed for short.

**Persistence:** `localStorage` only — no backend, no accounts. `exportCSV` / `importCSV` handle CSV round-trips with RFC 4180 quoting.

**Dependencies:**
- `recharts` — the two analytics charts
- `uuid` — `uuidv4()` for trade IDs
- `react-scripts` (CRA) — build tooling; no Vite, no TypeScript, no ESLint config
