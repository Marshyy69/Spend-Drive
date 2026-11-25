// utils.js: formatting, dates, small helpers shared by every module.

export const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

export const NOW = new Date();
export const TODAY = isoOf(NOW);

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Spending categories. The order here is the order in the form.
// The ids must match the check constraint in supabase/schema.sql.
export const CATS = [
  { id: 'Food', c: 'var(--p1)' },
  { id: 'Car', c: 'var(--p5)' },
  { id: 'Bills', c: 'var(--p4)' },
  { id: 'Shopping', c: 'var(--p2)' },
  { id: 'Entertainment', c: 'var(--p6)' },
  { id: 'Other', c: 'var(--p3)' },
];
export const TYPEC = { Service: 'var(--p5)', Repair: 'var(--p1)', Other: 'var(--p3)' };
export const TRIP_CATS = ['Food', 'Transport', 'Stay', 'Activities', 'Shopping', 'Other'];
const TRIP_COLORS = { Transport: 'var(--p5)', Stay: 'var(--p4)', Activities: 'var(--p3)' };
export const catColor = (id) => (CATS.find((c) => c.id === id) || { c: TRIP_COLORS[id] || 'var(--p3)' }).c;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const rm = (n) =>
  'RM ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n) => Math.round(n).toLocaleString('en-US');

export const fmtDate = (iso) => {
  const p = iso.split('-').map(Number);
  return p[2] + ' ' + MON[p[1] - 1] + ' ' + p[0];
};
export const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
export const sortExpensesNewest = (a, b) => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ta = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
  const tb = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
  return tb - ta;
};
export const monthKey = (iso) => iso.slice(0, 7);
export const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function shiftMonth(key, d) {
  const p = key.split('-').map(Number);
  const dt = new Date(p[0], p[1] - 1 + d, 1);
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1);
}
export function daysIn(key) {
  const p = key.split('-').map(Number);
  return new Date(p[0], p[1], 0).getDate();
}
export function monthLabel(key) {
  const p = key.split('-').map(Number);
  return MONTHS[p[1] - 1] + ' ' + p[0];
}
export function daysUntil(iso) {
  const p = iso.split('-').map(Number);
  const t = new Date(p[0], p[1] - 1, p[2]);
  const n = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  return Math.round((t - n) / 86400000);
}

export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
export function fmtRange(a, b) {
  const p = a.split('-').map(Number);
  const q = b.split('-').map(Number);
  if (a === b) return fmtDate(a);
  if (p[0] === q[0] && p[1] === q[1]) return p[2] + '–' + q[2] + ' ' + MON[p[1] - 1] + ' ' + p[0];
  if (p[0] === q[0]) return p[2] + ' ' + MON[p[1] - 1] + ' – ' + q[2] + ' ' + MON[q[1] - 1] + ' ' + p[0];
  return fmtDate(a) + ' – ' + fmtDate(b);
}

// Chart helpers
export function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return n * p;
}
export function topRound(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
    'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
}

// Small HTML builders
export const tile = (cls, label, value, sub) =>
  '<div class="tile ' + cls + '"><p class="tl">' + label + '</p><p class="tv">' + value + '</p><p class="ts">' + sub + '</p></div>';
export const pill = (cls, glyph, text) =>
  '<span class="pill ' + cls + '"><span aria-hidden="true">' + glyph + '</span> ' + text + '</span>';

// Messages
export function setMsg(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}
export function showStatus(text) {
  const el = document.getElementById('status');
  el.textContent = text || '';
  el.hidden = !text;
}
export function showError(err) {
  console.error(err);
  const m = err && err.message ? err.message : String(err);
  showStatus('Something went wrong: ' + m);
}

// Download a CSV file (opens fine in Excel and Google Sheets)
export function downloadCsv(filename, header, rows) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = '﻿' + [header].concat(rows).map((r) => r.map(q).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
