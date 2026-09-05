# Manual Testing & Launch Guide

This guide explains how to launch and test the **Trading Journal** desktop app locally on the **`dialog-window-changes`** branch.

---

## Should you use the Antigravity IDE terminal?

**Yes, absolutely.** You can open the integrated terminal in the Antigravity IDE (`Ctrl + \`` or menu: `Terminal` > `New Terminal`) to run any of the commands below.

---

## 1. Verify You Are on the Correct Branch

In your terminal, make sure you are in the project folder and on the right branch:

```powershell
git status
```

You should see:
```text
On branch dialog-window-changes
```

---

## 2. Launch Options

Depending on how you want to test, pick one of the options below:

### Option A: Development Mode (Recommended for testing UI)
Runs the React development server together with Electron. Any changes made to code will hot-reload automatically.

```powershell
npm run electron:dev
```

> **What happens:**
> 1. React dev server spins up on `http://localhost:3000`.
> 2. `wait-on` waits for the server to be ready.
> 3. The Electron desktop window opens automatically.

---

### Option B: Production Preview Mode (Faster load, tests compiled build)
Builds the static production bundle first, then launches Electron pointing to `build/index.html`. This mirrors the real packaged experience without creating an installer.

```powershell
npm run electron:preview
```

---

### Option C: Browser Only (Quick UI sanity check)
If you only want to quickly check the React interface in your web browser without Electron:

```powershell
npm start
```
Then open `http://localhost:3000` in your browser.

---

## 3. What to Test on `dialog-window-changes`

1. **Required Fields Check:**
   - Click **+ Add trade**.
   - Leave all fields blank and click **Save trade**.
   - Verify the error message prompts for the **Instrument** field only.
   - Enter only an Instrument (e.g. `TSLA`) and click **Save trade**. It should save successfully.

2. **Field Sequence Verification:**
   - Verify the form inputs match this exact order:
     1. **Instrument**
     2. **Date**
     3. **Direction**
     4. **Entry**
     5. **Stop**
     6. **Exit**
     7. **Win / Lose** (`Win`, `Loss`, `Breakeven`)
     8. **Position Size**
     9. **Profit**
     10. **Fee**
     11. **Setup**
     12. **Risk**
     13. **Setup Grade** (`A+`, `A`, `B`, `C`, `D`, `F`)
     14. **Notes**

3. **Trade Detail View:**
   - Click on the saved row in the Trade Log table.
   - Confirm all populated fields (including Stop, W/L badge, Setup Grade, Fees) display cleanly in the detail modal.

4. **CSV Export / Import:**
   - Click **Export CSV** and open the generated file to ensure new columns (`Instrument`, `Stop`, `Win/Lose`, `Position Size`, etc.) are present.
