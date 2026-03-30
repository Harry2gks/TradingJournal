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

| | |
|---|---|
| Trade log | Log long/short trades with symbol, entry/exit, quantity, strategy, risk & notes |
| Auto P&L | Profit & loss calculated automatically for every closed trade |
| Calendar | Monthly and weekly calendar view showing daily net P&L at a glance |
| Analytics | Cumulative P&L curve and P&L breakdown by strategy |
| Screenshots | Attach up to 3 chart screenshots per trade |
| Currency | Switch between USD ($) and EUR (€) — persisted across sessions |
| CSV import/export | Round-trip your data to Excel or Google Sheets |
| Fully offline | No internet connection needed, ever |

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
