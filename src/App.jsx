import { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

const STORAGE_KEY = "trading-journal-trades-v1";

const defaultForm = {
  symbol: "", date: new Date().toISOString().slice(0, 10),
  direction: "long", entry: "", stop: "", exit: "",
  result: "", qty: "", profit: "", fee: "",
  strategy: "", risk: "", setupGrade: "",
  notes: "", screenshots: [],
};

function calcPnL(t) {
  if (!t.exit || !t.entry || !t.qty) return null;
  const diff = t.direction === "long" ? t.exit - t.entry : t.entry - t.exit;
  return parseFloat((diff * t.qty).toFixed(2));
}

function fmtCcy(n, currency = "USD") {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2 });
}

// Convert YYYY-MM-DD → DD.MM.YYYY for display
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Build YYYY-MM-DD from a local Date object (avoids UTC-shift issues)
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Compress image via canvas before storing in localStorage
function compressImage(dataUrl, maxWidth = 1800, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function exportCSV(trades) {
  if (!trades.length) return;
  const headers = ["Date","Instrument","Direction","Entry","Stop","Exit","Win/Lose","Position Size","P&L","Profit","Fee","Setup","Risk","Setup Grade","Notes"];
  const rows = trades.map(t => {
    const pnl = calcPnL(t);
    return [t.date, t.symbol, t.direction, t.entry ?? "", t.stop ?? "", t.exit ?? "", t.result || "", t.qty ?? "", pnl ?? "", t.profit ?? "", t.fee ?? "", t.strategy || "", t.risk ?? "", t.setupGrade || "", t.notes || ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importCSV(file, onImport) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split("\n").slice(1).filter(Boolean);
    const imported = lines.map(line => {
      const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
      return {
        id: uuidv4(),
        date: cols[0], symbol: cols[1], direction: cols[2],
        entry: cols[3] ? parseFloat(cols[3]) : null,
        stop: cols[4] ? parseFloat(cols[4]) : null,
        exit: cols[5] ? parseFloat(cols[5]) : null,
        result: cols[6] || "",
        qty: cols[7] ? parseFloat(cols[7]) : null,
        // cols[8] = P&L (computed, skip)
        profit: cols[9] ? parseFloat(cols[9]) : null,
        fee: cols[10] ? parseFloat(cols[10]) : null,
        strategy: cols[11] || "",
        risk: cols[12] ? parseFloat(cols[12]) : null,
        setupGrade: cols[13] || "",
        notes: cols[14] || "", screenshots: [],
      };
    });
    onImport(imported);
  };
  reader.readAsText(file);
}

// ── Design tokens ───────────────────────────────────────────────────────
const T = {
  surface: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  textSec: "#64748b",
  textMuted: "#94a3b8",
  green: "#10b981",
  greenBg: "#d1fae5",
  greenText: "#065f46",
  red: "#ef4444",
  redBg: "#fee2e2",
  redText: "#b91c1c",
  blue: "#3b82f6",
};

const inputStyle = {
  width: "100%", border: `1px solid ${T.border}`, borderRadius: 8,
  padding: "9px 12px", fontSize: 13, background: "#f8fafc",
  color: T.text, boxSizing: "border-box", transition: "border-color 0.15s",
};
const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 500, textTransform: "uppercase",
  letterSpacing: "0.06em", color: T.textMuted, marginBottom: 5,
};
const sectionDivider = { borderTop: `1px solid ${T.border}`, margin: "0 24px" };
const sectionHeading = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 10 };

// ── Stat Card ──────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color || T.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, currency = "USD" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ color: T.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>{fmtCcy(payload[0].value, currency)}</div>
    </div>
  );
}

// ── Trade Detail Modal (read-only) ─────────────────────────────────────
function TradeDetailModal({ trade, onClose, onEdit, currency = "USD" }) {
  const [lightbox, setLightbox] = useState(null);
  const pnl = calcPnL(trade);
  const screenshots = trade.screenshots || [];

  const dash = <span style={{ color: T.textMuted }}>—</span>;

  const resultLabel = { win: "Win", loss: "Loss", breakeven: "Breakeven" }[trade.result] || null;
  const resultColor = { win: T.green, loss: T.red, breakeven: T.textMuted }[trade.result] || T.textMuted;

  const fields = [
    { label: "Date",          value: trade.date ? fmtDate(trade.date) : dash },
    { label: "Entry",         value: trade.entry ? (+trade.entry).toFixed(2) : dash },
    { label: "Stop",          value: trade.stop  ? (+trade.stop).toFixed(2)  : dash },
    { label: "Exit",          value: trade.exit  ? (+trade.exit).toFixed(2)  : <span style={{ color: T.textMuted }}>Open</span> },
    { label: "Win / Lose",    value: resultLabel  ? <span style={{ color: resultColor, fontWeight: 600 }}>{resultLabel}</span> : dash },
    { label: "Position Size", value: trade.qty   ? (+trade.qty).toLocaleString() : dash },
    { label: "Profit",        value: trade.profit != null ? fmtCcy(+trade.profit, currency) : dash },
    { label: "Fee",           value: trade.fee   ? fmtCcy(+trade.fee, currency)  : dash },
    { label: "Setup",         value: trade.strategy || dash },
    { label: "Risk",          value: trade.risk  ? fmtCcy(+trade.risk, currency) : dash },
    { label: "Setup Grade",   value: trade.setupGrade || dash },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" }}
      >
        <div style={{ background: T.surface, borderRadius: 16, width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${T.border}` }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>{trade.symbol}</span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: trade.direction === "long" ? T.greenBg : T.redBg,
                color: trade.direction === "long" ? T.greenText : T.redText,
              }}>
                {trade.direction === "long" ? "↑" : "↓"} {trade.direction}
              </span>
              {pnl !== null && (
                <span style={{ fontSize: 16, fontWeight: 600, color: pnl >= 0 ? T.green : T.red, fontVariantNumeric: "tabular-nums" }}>
                  {fmtCcy(pnl, currency)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button onClick={onEdit} className="btn-secondary"
                style={{ cursor: "pointer", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-6 6H3V8l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                Edit
              </button>
              <button onClick={onClose} className="icon-btn" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Details grid */}
          <div style={sectionDivider} />
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 20px" }}>
            {fields.map(({ label, value }) => (
              <div key={label}>
                <div style={sectionHeading}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Notes */}
          {trade.notes && (
            <>
              <div style={sectionDivider} />
              <div style={{ padding: "20px 24px" }}>
                <div style={sectionHeading}>Notes</div>
                <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{trade.notes}</div>
              </div>
            </>
          )}

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <>
              <div style={sectionDivider} />
              <div style={{ padding: "20px 24px" }}>
                <div style={sectionHeading}>Screenshots <span style={{ color: T.textMuted, fontWeight: 400 }}>({screenshots.length})</span></div>
                <div style={{ display: "flex", gap: 10 }}>
                  {screenshots.map((src, i) => (
                    <div key={i} onClick={() => setLightbox(i)}
                      style={{ flex: 1, aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", cursor: "zoom-in", border: `1px solid ${T.border}`, background: "#f1f5f9" }}>
                      <img src={src} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                  {/* placeholder slots */}
                  {Array.from({ length: 3 - screenshots.length }).map((_, i) => (
                    <div key={`ph-${i}`} style={{ flex: 1, aspectRatio: "16/9", borderRadius: 8, border: `1px dashed ${T.border}`, background: "#f8fafc" }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Footer padding */}
          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {/* Prev */}
          {lightbox > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => l - 1); }}
              style={{ position: "absolute", left: 20, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ‹
            </button>
          )}
          <img src={screenshots[lightbox]} alt="" onClick={e => e.stopPropagation()}
            style={{ maxWidth: "88vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", userSelect: "none" }} />
          {/* Next */}
          {lightbox < screenshots.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => l + 1); }}
              style={{ position: "absolute", right: 20, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ›
            </button>
          )}
          {/* Close */}
          <button onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
          {/* Dot indicators */}
          {screenshots.length > 1 && (
            <div style={{ position: "absolute", bottom: 20, display: "flex", gap: 6 }}>
              {screenshots.map((_, i) => (
                <div key={i} onClick={e => { e.stopPropagation(); setLightbox(i); }}
                  style={{ width: 6, height: 6, borderRadius: "50%", cursor: "pointer", background: i === lightbox ? "#fff" : "rgba(255,255,255,0.35)", transition: "background 0.15s" }} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Trade Form Modal ───────────────────────────────────────────────────
function TradeModal({ trade, onSave, onClose }) {
  const [form, setForm] = useState(trade ? { screenshots: [], ...trade } : defaultForm);
  const [formError, setFormError] = useState("");
  const set = (k, v) => { setFormError(""); setForm(f => ({ ...f, [k]: v })); };

  // dd.mm.yyyy display state; form.date stays as YYYY-MM-DD internally
  const isoToDisplay = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };
  const [dateText, setDateText] = useState(() => isoToDisplay(form.date));
  function handleDateInput(val) {
    setDateText(val);
    const match = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) set("date", `${match[3]}-${match[2]}-${match[1]}`);
  }

  function handleSave() {
    if (!form.symbol) {
      setFormError("Please fill in the Instrument field.");
      return;
    }
    onSave({
      ...form,
      id: form.id || uuidv4(),
      symbol: form.symbol.toUpperCase(),
      entry: form.entry ? parseFloat(form.entry) : null,
      stop: form.stop ? parseFloat(form.stop) : null,
      exit: form.exit ? parseFloat(form.exit) : null,
      qty: form.qty ? parseFloat(form.qty) : null,
      profit: form.profit ? parseFloat(form.profit) : null,
      fee: form.fee ? parseFloat(form.fee) : null,
      risk: form.risk ? parseFloat(form.risk) : null,
      result: form.result || "",
      setupGrade: form.setupGrade || "",
    });
  }

  async function handleScreenshotAdd(e) {
    const files = Array.from(e.target.files);
    const existing = form.screenshots || [];
    const remaining = 3 - existing.length;
    if (!remaining) return;
    const compressed = await Promise.all(
      files.slice(0, remaining).map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = async ev => resolve(await compressImage(ev.target.result));
        reader.readAsDataURL(file);
      }))
    );
    set("screenshots", [...existing, ...compressed]);
    e.target.value = "";
  }

  const shots = form.screenshots || [];

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" }}
    >
      <div style={{ background: T.surface, borderRadius: 16, width: 560, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${T.border}` }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: T.text }}>{form.id ? "Edit trade" : "New trade"}</h2>
          <button onClick={onClose} className="icon-btn" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Trade fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 14px" }}>
            <div>
              <label style={labelStyle}>Instrument *</label>
              <input type="text" value={form.symbol} placeholder="AAPL"
                onChange={e => set("symbol", e.target.value)}
                style={{ ...inputStyle, textTransform: "uppercase", fontWeight: 600 }} />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="text" value={dateText} placeholder="dd.mm.yyyy"
                onChange={e => handleDateInput(e.target.value)}
                maxLength={10} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Direction</label>
              <select value={form.direction} onChange={e => set("direction", e.target.value)} style={inputStyle}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Entry</label>
              <input type="number" value={form.entry || ""} placeholder="0.00"
                onChange={e => set("entry", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Stop</label>
              <input type="number" value={form.stop || ""} placeholder="0.00"
                onChange={e => set("stop", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Exit</label>
              <input type="number" value={form.exit || ""} placeholder="— open position"
                onChange={e => set("exit", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Win / Lose</label>
              <select value={form.result || ""} onChange={e => set("result", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Position Size</label>
              <input type="number" value={form.qty || ""} placeholder="100"
                onChange={e => set("qty", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Profit</label>
              <input type="number" value={form.profit || ""} placeholder="0.00"
                onChange={e => set("profit", e.target.value)} style={inputStyle} step="any" />
            </div>
            <div>
              <label style={labelStyle}>Fee</label>
              <input type="number" value={form.fee || ""} placeholder="0.00"
                onChange={e => set("fee", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div>
              <label style={labelStyle}>Setup</label>
              <input type="text" value={form.strategy || ""} placeholder="e.g. Breakout"
                onChange={e => set("strategy", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Risk</label>
              <input type="number" value={form.risk || ""} placeholder="0.00"
                onChange={e => set("risk", e.target.value)} style={inputStyle} min="0" step="any" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Setup Grade</label>
              <select value={form.setupGrade || ""} onChange={e => set("setupGrade", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="A+">A+</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="F">F</option>
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="What did you observe? What could you improve?"
                style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.5 }} />
            </div>
          </div>

          {/* Screenshots */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>
              Screenshots
              <span style={{ color: T.textMuted, fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                {shots.length}/3
              </span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {shots.map((src, i) => (
                <div key={i} style={{ position: "relative", flex: 1, aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: "#f1f5f9" }}>
                  <img src={src} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <button
                    type="button"
                    onClick={() => set("screenshots", shots.filter((_, idx) => idx !== i))}
                    style={{ position: "absolute", top: 5, right: 5, background: "rgba(15,23,42,0.65)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ))}
              {shots.length < 3 && (
                <label style={{ flex: 1, aspectRatio: "16/9", borderRadius: 8, border: `1.5px dashed ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textMuted, fontSize: 11, gap: 5, background: "#f8fafc", transition: "border-color 0.15s" }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  Add image
                  <input type="file" accept="image/*" multiple onChange={handleScreenshotAdd} style={{ display: "none" }} />
                </label>
              )}
              {/* Placeholder slots to keep layout stable */}
              {Array.from({ length: Math.max(0, 2 - shots.length) }).map((_, i) => (
                <div key={`ph-${i}`} style={{ flex: 1, aspectRatio: "16/9" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 24px" }}>
          {formError && (
            <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: T.redBg, color: T.redText, fontSize: 12, fontWeight: 500 }}>
              {formError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} className="btn-secondary"
              style={{ cursor: "pointer", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary"
              style={{ cursor: "pointer", border: "none", background: T.text, color: "#fff", padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              Save trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────
function CalendarView({ trades, currency }) {
  const todayStr = toDateStr(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [mode, setMode] = useState("month");

  // Aggregate P&L and trade count per day
  const dailyData = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!t.date) return;
      if (!map[t.date]) map[t.date] = { pnl: 0, count: 0, open: 0 };
      const pnl = calcPnL(t);
      if (pnl !== null) map[t.date].pnl += pnl;
      map[t.date].count++;
      if (!t.exit) map[t.date].open++;
    });
    Object.values(map).forEach(d => { d.pnl = parseFloat(d.pnl.toFixed(2)); });
    return map;
  }, [trades]);

  function prevPeriod() {
    const d = new Date(viewDate);
    if (mode === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setViewDate(d);
  }
  function nextPeriod() {
    const d = new Date(viewDate);
    if (mode === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setViewDate(d);
  }

  // Build ordered day array for current view
  let days = [];
  if (mode === "month") {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Mon=0
    const cursor = new Date(y, m, 1 - startDow);
    do {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    } while (cursor <= last || days.length % 7 !== 0);
  } else {
    const d = new Date(viewDate);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  }

  const headerLabel = mode === "month"
    ? viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })
    : `${days[0].toLocaleString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleString("en-US", { month: "short", day: "numeric" })}, ${days[6].getFullYear()}`;

  const navBtnStyle = {
    cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`,
    borderRadius: 6, width: 28, height: 28, fontSize: 18, display: "flex",
    alignItems: "center", justifyContent: "center", color: T.textSec, lineHeight: 1,
  };
  const pillStyle = (active) => ({
    cursor: "pointer", border: "none", borderRadius: 6, padding: "4px 12px",
    fontSize: 12, fontWeight: 500, transition: "all 0.15s",
    background: active ? T.surface : "transparent",
    color: active ? T.text : T.textMuted,
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
  });

  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const numWeeks = days.length / 7;

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={prevPeriod} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text, minWidth: 170, textAlign: "center" }}>{headerLabel}</span>
          <button onClick={nextPeriod} style={navBtnStyle}>›</button>
        </div>
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
          {[["month", "Month"], ["week", "Week"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={pillStyle(mode === k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${T.border}`, background: "#f8fafc" }}>
        {DOW.map(d => (
          <div key={d} style={{ padding: "7px 0", textAlign: "center", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: T.textMuted }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      {Array.from({ length: numWeeks }, (_, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: wi < numWeeks - 1 ? `1px solid ${T.border}` : "none" }}>
          {days.slice(wi * 7, wi * 7 + 7).map((day, di) => {
            const dateStr = toDateStr(day);
            const data = dailyData[dateStr];
            const inPeriod = mode === "month" ? day.getMonth() === viewDate.getMonth() : true;
            const isToday = dateStr === todayStr;
            const cellBg = data
              ? data.pnl > 0 ? "#f0fdf4" : data.pnl < 0 ? "#fef2f2" : T.surface
              : T.surface;
            return (
              <div key={di} style={{
                minHeight: mode === "week" ? 110 : 76,
                padding: "8px 10px",
                borderRight: di < 6 ? `1px solid ${T.border}` : "none",
                background: cellBg,
                opacity: inPeriod ? 1 : 0.3,
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    width: 22, height: 22, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: isToday ? T.blue : "transparent",
                    color: isToday ? "#fff" : T.text,
                  }}>
                    {day.getDate()}
                  </span>
                  {data && data.count > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 500, color: T.textMuted, background: "#f1f5f9", borderRadius: 8, padding: "1px 5px" }}>
                      {data.count}t
                    </span>
                  )}
                </div>
                {data && (
                  <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: data.pnl >= 0 ? T.greenText : T.redText }}>
                    {fmtCcy(data.pnl, currency)}
                  </div>
                )}
                {mode === "week" && data && data.open > 0 && (
                  <div style={{ fontSize: 10, color: T.textMuted }}>{data.open} open</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────
function Analytics({ trades, currency = "USD" }) {
  const closed = trades.filter(t => t.exit && t.entry && t.qty);
  if (closed.length < 2) return (
    <div style={{ textAlign: "center", padding: "64px 24px", color: T.textMuted, fontSize: 14 }}>
      Add at least 2 closed trades to see analytics.
    </div>
  );

  const sorted = [...closed].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  const curve = sorted.map(t => {
    cum = parseFloat((cum + calcPnL(t)).toFixed(2));
    return { date: t.date.slice(5), cum };
  });

  const byStrategy = {};
  closed.forEach(t => {
    const s = t.strategy || "Untagged";
    if (!byStrategy[s]) byStrategy[s] = { pnl: 0, count: 0, wins: 0 };
    const p = calcPnL(t);
    byStrategy[s].pnl += p; byStrategy[s].count++;
    if (p > 0) byStrategy[s].wins++;
  });
  const stratData = Object.entries(byStrategy)
    .map(([name, d]) => ({ name, pnl: parseFloat(d.pnl.toFixed(2)), winRate: Math.round(d.wins / d.count * 100) }))
    .sort((a, b) => b.pnl - a.pnl);

  const chartCard = (title, children) => (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "24px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textMuted, marginBottom: 20 }}>{title}</div>
      {children}
    </div>
  );

  const tickStyle = { fontSize: 11, fill: T.textMuted };
  const sym = currency === "EUR" ? "€" : "$";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {chartCard("Cumulative P&L",
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => sym + v} width={56} />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Line type="monotone" dataKey="cum" stroke={T.blue} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
      {chartCard("P&L by strategy",
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stratData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={v => sym + v} />
            <YAxis dataKey="name" type="category" tick={tickStyle} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
              {stratData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? T.green : T.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────
export default function App() {
  const [trades, setTrades] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [currency, setCurrency] = useState(() => localStorage.getItem("tj-currency") || "USD");
  const [modal, setModal] = useState(null);        // null | "add" | trade (edit)
  const [detailTrade, setDetailTrade] = useState(null); // null | trade (view)
  const [tab, setTab] = useState("log");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState(-1);
  const [filterDir, setFilterDir] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); }, [trades]);
  useEffect(() => { localStorage.setItem("tj-currency", currency); }, [currency]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  function saveTrade(t) {
    setTrades(prev => t.id && prev.find(x => x.id === t.id)
      ? prev.map(x => x.id === t.id ? t : x)
      : [...prev, t]);
    setModal(null);
  }

  function deleteTrade(id) {
    if (window.confirm("Delete this trade?")) setTrades(prev => prev.filter(t => t.id !== id));
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(-1); }
  }

  function handleExport() { exportCSV(trades); showToast(`Exported ${trades.length} trades`); }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    importCSV(file, imported => {
      setTrades(prev => [...prev, ...imported]);
      showToast(`Imported ${imported.length} trades`);
    });
    e.target.value = "";
  }

  const filtered = useMemo(() => {
    return trades
      .filter(t => {
        if (filterDir !== "all" && t.direction !== filterDir) return false;
        if (search) {
          const q = search.toLowerCase();
          return (t.symbol || "").toLowerCase().includes(q) || (t.strategy || "").toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        let av = sortCol === "pnl" ? calcPnL(a) : a[sortCol];
        let bv = sortCol === "pnl" ? calcPnL(b) : b[sortCol];
        if (av === null || av === undefined) av = sortDir < 0 ? -Infinity : Infinity;
        if (bv === null || bv === undefined) bv = sortDir < 0 ? -Infinity : Infinity;
        return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * sortDir;
      });
  }, [trades, filterDir, search, sortCol, sortDir]);

  const stats = useMemo(() => {
    const closed = filtered.filter(t => t.exit && t.entry && t.qty);
    const pnls = closed.map(t => calcPnL(t));
    const total = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    return {
      total, count: trades.length, closed: closed.length,
      winRate: closed.length ? wins.length / closed.length * 100 : null,
      avgWin: wins.length ? wins.reduce((s, p) => s + p, 0) / wins.length : null,
      avgLoss: losses.length ? losses.reduce((s, p) => s + p, 0) / losses.length : null,
      profitFactor: losses.length && wins.length ? Math.abs(wins.reduce((s, p) => s + p, 0) / losses.reduce((s, p) => s + p, 0)) : null,
    };
  }, [filtered, trades]);

  function ThSort({ col, label }) {
    const active = sortCol === col;
    return (
      <th onClick={() => handleSort(col)}
        style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? T.text : T.textMuted, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", borderBottom: `1px solid ${T.border}`, background: "#f8fafc" }}>
        {label}
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.4, fontSize: 9 }}>
          {active ? (sortDir > 0 ? "▲" : "▼") : "⇅"}
        </span>
      </th>
    );
  }

  const secondaryBtn = {
    cursor: "pointer", border: `1px solid ${T.border}`, background: T.surface,
    color: T.textSec, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ── Top Nav ── */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 10L5 6L8 9L13 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>Trading Journal</span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Currency picker */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, gap: 2 }}>
              {[["USD", "$ USD"], ["EUR", "€ EUR"]].map(([c, label]) => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  cursor: "pointer", border: "none", borderRadius: 6, padding: "4px 10px",
                  fontSize: 12, fontWeight: 500, transition: "all 0.15s",
                  background: currency === c ? T.surface : "transparent",
                  color: currency === c ? T.text : T.textMuted,
                  boxShadow: currency === c ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}>
                  {label}
                </button>
              ))}
            </div>
            <label className="btn-secondary" style={{ ...secondaryBtn, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 6.5 6.5)" /><path d="M1 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Import CSV
              <input type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
            </label>
            <button onClick={handleExport} className="btn-secondary" style={{ ...secondaryBtn, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M1 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Export CSV
            </button>
            <button onClick={() => setModal("add")} className="btn-primary"
              style={{ cursor: "pointer", border: "none", background: T.text, color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span> Add trade
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total P&L" value={fmtCcy(stats.total, currency)} color={stats.total > 0 ? T.green : stats.total < 0 ? T.red : T.text} />
          <StatCard label="Win Rate" value={stats.winRate !== null ? stats.winRate.toFixed(1) + "%" : "—"} color={stats.winRate !== null && stats.winRate >= 50 ? T.green : T.text} />
          <StatCard label="Avg Win" value={stats.avgWin !== null ? fmtCcy(stats.avgWin, currency) : "—"} color={T.green} />
          <StatCard label="Avg Loss" value={stats.avgLoss !== null ? fmtCcy(stats.avgLoss, currency) : "—"} color={T.red} />
          <StatCard label="Profit Factor" value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—"} color={stats.profitFactor > 1 ? T.green : T.text} />
          <StatCard label="Total Trades" value={stats.count} />
        </div>

        {/* Controls + Tabs bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
            {[["log", "Trade Log"], ["calendar", "Calendar"], ["analytics", "Analytics"]].map(([key, label]) => (
              <button key={key} className="tab-pill" onClick={() => setTab(key)}
                style={{ cursor: "pointer", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 500, transition: "all 0.15s", background: tab === key ? T.surface : "transparent", color: tab === key ? T.text : T.textMuted, boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="5.5" cy="5.5" r="4" stroke={T.textMuted} strokeWidth="1.4" />
                <path d="M10 10l-2-2" stroke={T.textMuted} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: 180, paddingLeft: 30 }} />
            </div>
            <select value={filterDir} onChange={e => setFilterDir(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="all">All directions</option>
              <option value="long">Long only</option>
              <option value="short">Short only</option>
            </select>
          </div>
        </div>

        {/* Tab content */}
        {tab === "log" ? (
          filtered.length === 0 ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "64px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.text, marginBottom: 6 }}>No trades yet</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Hit <strong>Add trade</strong> to start tracking your performance.</div>
            </div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <ThSort col="date" label="Date" />
                      <ThSort col="symbol" label="Instrument" />
                      <ThSort col="direction" label="Side" />
                      <ThSort col="entry" label="Entry" />
                      <ThSort col="exit" label="Exit" />
                      <ThSort col="result" label="W/L" />
                      <ThSort col="qty" label="Size" />
                      <ThSort col="pnl" label="P&L" />
                      <ThSort col="strategy" label="Setup" />
                      <th style={{ borderBottom: `1px solid ${T.border}`, background: "#f8fafc", width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => {
                      const pnl = calcPnL(t);
                      const hasShots = (t.screenshots || []).length > 0;
                      return (
                        <tr key={t.id} className="tr-hover"
                          onClick={() => setDetailTrade(t)}
                          style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <td style={td}>{fmtDate(t.date)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {t.symbol}
                              {hasShots && (
                                <span title={`${t.screenshots.length} screenshot${t.screenshots.length > 1 ? "s" : ""}`}
                                  style={{ fontSize: 10, color: T.textMuted }}>
                                  🖼
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={td}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: t.direction === "long" ? T.greenBg : T.redBg, color: t.direction === "long" ? T.greenText : T.redText }}>
                              {t.direction === "long" ? "↑" : "↓"} {t.direction}
                            </span>
                          </td>
                          <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{t.entry ? (+t.entry).toFixed(2) : "—"}</td>
                          <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                            {t.exit ? (+t.exit).toFixed(2) : <span style={{ color: T.textMuted, fontSize: 11 }}>open</span>}
                          </td>
                          <td style={td}>
                            {t.result && (
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                                background: t.result === "win" ? T.greenBg : t.result === "loss" ? T.redBg : "#f1f5f9",
                                color: t.result === "win" ? T.greenText : t.result === "loss" ? T.redText : T.textSec }}>
                                {t.result === "win" ? "W" : t.result === "loss" ? "L" : "BE"}
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{t.qty ? (+t.qty).toLocaleString() : "—"}</td>
                          <td style={{ ...td, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: pnl === null ? T.textMuted : pnl >= 0 ? T.green : T.red }}>
                            {pnl !== null ? fmtCcy(pnl, currency) : "—"}
                          </td>
                          <td style={td}>
                            {t.strategy && (
                              <span style={{ display: "inline-block", background: "#f1f5f9", border: `1px solid ${T.border}`, borderRadius: 20, padding: "2px 8px", fontSize: 11, color: T.textSec }}>
                                {t.strategy}
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "right", paddingRight: 12 }}>
                            <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                              <button onClick={e => { e.stopPropagation(); setModal(t); }} className="icon-btn" title="Edit">
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2-6 6H3V8l6-6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteTrade(t.id); }} className="icon-btn" title="Delete">
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5h3v1M4 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, background: "#f8fafc" }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
                  {filtered.length !== trades.length ? ` (filtered from ${trades.length})` : ""}
                  {" · "}click any row to view details
                </span>
              </div>
            </div>
          )
        ) : tab === "calendar" ? (
          <CalendarView trades={trades} currency={currency} />
        ) : (
          <Analytics trades={trades} currency={currency} />
        )}
      </main>

      {/* Detail modal */}
      {detailTrade && (
        <TradeDetailModal
          trade={detailTrade}
          onClose={() => setDetailTrade(null)}
          onEdit={() => { setModal(detailTrade); setDetailTrade(null); }}
          currency={currency}
        />
      )}

      {/* Edit / Add modal */}
      {modal && (
        <TradeModal
          trade={modal === "add" ? null : modal}
          onSave={saveTrade}
          onClose={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.text, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const td = { padding: "11px 14px", verticalAlign: "middle", color: "#0f172a" };
