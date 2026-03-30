# Trading Journal

> A free, offline-first trading journal for Windows. No subscriptions, no cloud, no account required.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20React-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Installation

1. Download the latest **`Trading Journal Setup.exe`** from the [Releases](../../releases) page
2. Run the installer — no admin rights required
3. Launch **Trading Journal** from the Start Menu or Desktop shortcut

> Your data is stored in `%APPDATA%\trading-journal\` and is **never deleted** when you uninstall or update the app.

---

## Features

**Trade Logging**
- Log long and short trades with symbol, date, quantity, entry/exit price, strategy, risk, and notes
- Open positions supported — leave exit blank until the trade is closed
- Attach up to 3 chart screenshots per trade with automatic image compression

**Performance Tracking**
- Automatic P&L calculation for both long and short trades
- Dashboard stat cards: total P&L, win rate, average win/loss, and open position count
- Calendar view (month/week) showing net P&L per day at a glance

**Analytics**
- Cumulative P&L line chart over time
- P&L breakdown by strategy (bar chart)
- Requires at least 2 closed trades to display

**Data Management**
- Export your full journal to CSV — compatible with Excel and Google Sheets
- Import trades from a previously exported CSV (appends, does not overwrite)
- Switch display currency between USD ($) and EUR (€), persisted across sessions

**Privacy & Portability**
- Fully offline — no internet connection required, ever
- No account, no subscription, no telemetry
- All data stored locally; survives uninstalls and updates

---

## Screenshots

> _Add screenshots here_

---

## Usage

### Adding a trade

1. Click **Add trade** in the top-right corner
2. Fill in Symbol, Date (`dd.mm.yyyy`), Direction, Quantity and Entry Price (required)
3. Leave **Exit Price** blank to log an open position
4. Optionally attach up to 3 chart screenshots
5. Click **Save trade**

### Calendar view

Switch to the **Calendar** tab to see your trading activity by day. Each cell shows the net P&L for that day. Use the **Month / Week** toggle and the arrows to navigate.

### Exporting & importing data

- **Export CSV** — saves all trades to a `.csv` file you can open in Excel or Google Sheets
- **Import CSV** — appends trades from a previously exported file (does not overwrite existing data)

---

## Data & Privacy

All data is stored locally on your machine at:

```
%APPDATA%\trading-journal\
```

Nothing is ever sent to any server. Uninstalling the app leaves your data intact at the path above. To fully remove all data, delete that folder manually after uninstalling.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v16+
- npm

```bash
# Install dependencies
npm install

# Development (hot reload in Electron)
npm run electron:dev

# Preview production build in Electron
npm run electron:preview

# Build Windows installer → dist/Trading Journal Setup.exe
npm run electron:build
```

---

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React 18](https://react.dev/) — UI
- [Recharts](https://recharts.org/) — charts
- localStorage — persistence (no backend)

---

## License

MIT
