// spending.js: the Spending tab. Draws the tiles, category bars, six-month chart and transaction list,
// and handles the add-expense form.

import { state, ui, rerender } from './state.js';
import * as db from './db.js';
import {
  NOW, TODAY, MON, CATS, catColor, esc, rm, num, fmtDate, fmtTime, sortExpensesNewest, monthKey, sum, clamp, shiftMonth, daysIn,
  monthLabel, niceMax, topRound, tile, setMsg, showError, downloadCsv,
} from './utils.js';
import { confirmDelete } from './confirm.js';
import { tripNoteHtml } from './trips.js';

const $ = (s) => document.querySelector(s);
const everyday = () => state.expenses.filter((e) => !e.trip);

export function renderSpending() {
  const key = ui.month;
  const cur = monthKey(TODAY);
  $('#month-label').textContent = monthLabel(key);
  $('#month-next').disabled = key >= cur;

  const inM = everyday().filter((e) => monthKey(e.date) === key);
  const total = sum(inM, (e) => e.amt);

  // Compare with last month. For the current month, only compare up to the same day.
  const prevKey = shiftMonth(key, -1);
  const cutoff = key === cur ? NOW.getDate() : 99;
  const prevTotal = sum(
  everyday().filter((e) => monthKey(e.date) === prevKey && Number(e.date.slice(8)) <= cutoff),
    (e) => e.amt
  );
  const by = {};
  CATS.forEach((c) => { by[c.id] = 0; });
  inM.forEach((e) => { by[e.cat] = (by[e.cat] || 0) + e.amt; });
  const order = CATS.map((c) => c.id).sort((a, b) => by[b] - by[a]);
  const top = order[0];

  const diff = total - prevTotal;
  const prevName = MON[Number(prevKey.slice(5)) - 1];
  const prevSub = key === cur ? prevName + ' 1–' + NOW.getDate() + ': ' + rm(prevTotal) : prevName + ': ' + rm(prevTotal);
  const deltaV = prevTotal === 0 && total === 0 ? '—' : diff > 0 ? '▲ ' + rm(diff) : diff < 0 ? '▼ ' + rm(-diff) : 'No change';
  const deltaS = diff > 0 ? 'more than last month. ' + prevSub : diff < 0 ? 'less than last month. ' + prevSub : prevSub;
  const elapsed = key === cur ? NOW.getDate() : daysIn(key);

  $('#sp-tiles').innerHTML =
    tile('t1', 'Spent in ' + MON[Number(key.slice(5)) - 1], rm(total), inM.length + (inM.length === 1 ? ' entry' : ' entries')) +
    tile('t2', 'Vs last month', deltaV, esc(deltaS)) +
    tile('t3', 'Biggest category', total > 0 ? top : '—', total > 0 ? rm(by[top]) + ' (' + Math.round((by[top] / total) * 100) + '%)' : 'Nothing logged yet') +
    tile('t4', 'Daily average', rm(total / Math.max(1, elapsed)), key === cur ? 'per day so far' : 'per day');

  const note = tripNoteHtml(key);
  $('#sp-trip-note').innerHTML = note;
  $('#sp-trip-note').hidden = !note;

  $('#sp-cats').innerHTML = order.map((id) => {
    const v = by[id];
    const pct = total > 0 ? (v / total) * 100 : 0;
    const tip = id + ' · ' + rm(v) + ' · ' + Math.round(pct) + '% of the month';
    return '<li><button class="catbtn" type="button" data-action="cat" data-cat="' + id + '" data-tip="' + esc(tip) + '" aria-pressed="' + (ui.cat === id) + '">' +
      '<span class="catname"><i class="dot" style="background:' + catColor(id) + '"></i>' + id + '</span>' +
      '<span class="track"><span class="fill" style="width:' + pct + '%;background:' + catColor(id) + '"></span></span>' +
      '<span class="catval">' + rm(v) + '<small>' + Math.round(pct) + '%</small></span></button></li>';
  }).join('');

  const keys = [];
  for (let i = 5; i >= 0; i--) keys.push(shiftMonth(key, -i));
    const totals = keys.map((k) => sum(everyday().filter((e) => monthKey(e.date) === k), (e) => e.amt));
  $('#sp-trend').innerHTML = trendSvg(keys, totals);

  $('#tx-chips').innerHTML = ['All'].concat(CATS.map((c) => c.id)).map((c) => {
    const dot = c === 'All' ? '' : '<i class="dot" style="background:' + catColor(c) + '"></i>';
    return '<button class="chip" type="button" data-action="chip" data-cat="' + c + '" aria-pressed="' + (ui.cat === c) + '">' + dot + c + '</button>';
  }).join('');

  const q = ui.q.trim().toLowerCase();
  const list = filteredExpenses();
  $('#tx-sum').textContent = list.length + (list.length === 1 ? ' entry' : ' entries') + ' · ' + rm(sum(list, (e) => e.amt));
  $('#tx-body').innerHTML = list.length ? list.map((e) => {
    const t = fmtTime(e.createdAt);
    return '<tr><td>' + fmtDate(e.date) + (t ? '<br><small class="tx-time">' + esc(t) + '</small>' : '') + '</td><td><span class="tag" style="background:' + catColor(e.cat) + '">' + e.cat + '</span></td><td>' + esc(e.note) + '</td><td class="n">' + rm(e.amt) + '</td>' +
      '<td class="n"><button class="edit-btn" type="button" data-action="edit-exp" data-id="' + e.id + '" aria-label="Edit ' + esc(e.note) + '">Edit</button>' +
      '<button class="rm" type="button" data-action="del-exp" data-id="' + e.id + '" aria-label="Remove ' + esc(e.note) + '">Remove</button></td></tr>';
  }).join('') : '<tr><td colspan="5" class="empty">Nothing here for ' + monthLabel(key) + (ui.cat !== 'All' || q ? ' with these filters' : '') + '. Add an expense above.</td></tr>';
}

function filteredExpenses() {
  const q = ui.q.trim().toLowerCase();
  return everyday()
    .filter((e) => monthKey(e.date) === ui.month)
    .filter((e) => (ui.cat === 'All' || e.cat === ui.cat) && (!q || (e.note + ' ' + e.cat).toLowerCase().indexOf(q) > -1))
    .sort(sortExpensesNewest);
}

function trendSvg(keys, totals) {
  const W = 360, H = 210, pl = 46, pr = 8, pt = 26, pb = 26;
  const pw = W - pl - pr, ph = H - pt - pb;
  const mx = niceMax(Math.max.apply(null, totals));
  const slot = pw / keys.length;
  const bw = Math.min(30, slot * 0.58);
  let s = '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Monthly spending for the last six months">';
  [0, 0.5, 1].forEach((t) => {
    const y = pt + ph - t * ph;
    s += '<line class="gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/><text class="ax" x="' + (pl - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + num(mx * t) + '</text>';
  });
  keys.forEach((k, i) => {
    const last = i === keys.length - 1;
    const h = (totals[i] / mx) * ph;
    const x = pl + slot * i + (slot - bw) / 2;
    const y = pt + ph - h;
    const cx = pl + slot * i + slot / 2;
    const m = Number(k.slice(5)) - 1;
    if (totals[i] > 0) s += '<path class="bar' + (last ? ' sel' : '') + '" d="' + topRound(x, y, bw, Math.max(h, 2), 5) + '"/>';
    if (last) s += '<text class="val" x="' + clamp(cx, 34, W - 34) + '" y="' + (Math.max(y, pt - 4) - 6) + '" text-anchor="middle">RM ' + num(totals[i]) + '</text>';
    s += '<text class="mo' + (last ? ' sel' : '') + '" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + MON[m] + '</text>';
    s += '<rect class="hit" x="' + (pl + slot * i) + '" y="' + (pt - 14) + '" width="' + slot + '" height="' + (H - pt + 14) + '" tabindex="0" role="button" aria-label="' + monthLabel(k) + ', ' + rm(totals[i]) + '" data-action="pick-month" data-month="' + k + '" data-tip="' + esc(monthLabel(k) + ' · ' + rm(totals[i])) + '"/>';
  });
  return s + '</svg>';
}

// Clicks on elements with data-action="..." land here (app.js routes them).
export const spendingActions = {
  'month-prev': () => { ui.month = shiftMonth(ui.month, -1); },
  'month-next': () => { if (ui.month < monthKey(TODAY)) ui.month = shiftMonth(ui.month, 1); },
  'pick-month': (b) => { ui.month = b.dataset.month; },
  'cat': (b) => { ui.cat = ui.cat === b.dataset.cat ? 'All' : b.dataset.cat; },
  'chip': (b) => { ui.cat = b.dataset.cat; },
  'del-exp': async (b) => {
    const e = state.expenses.find((x) => x.id === b.dataset.id);
    const label = e ? e.note + ' — ' + rm(e.amt) : 'this expense';
    const ok = await confirmDelete('Delete this expense?', 'Are you sure you want to delete "' + label + '"? This cannot be undone.');
    if (!ok) return;
    await db.deleteExpense(b.dataset.id);
    state.expenses = state.expenses.filter((x) => x.id !== b.dataset.id);
  },
  'edit-exp': (b) => {
    const e = state.expenses.find((x) => x.id === b.dataset.id);
    if (!e) return;
    const $ = (s) => document.querySelector(s);
    $('#edit-exp-id').value = e.id;
    $('#edit-exp-date').value = e.date;
    $('#edit-exp-amt').value = e.amt;
    $('#edit-exp-cat').value = e.cat;
    $('#edit-exp-note').value = e.note;
    setMsg('#edit-exp-msg', '');
    $('#edit-exp-modal').hidden = false;
  },
  'edit-exp-cancel': () => {
    document.querySelector('#edit-exp-modal').hidden = true;
  },
  'export-exp': () => {
    const rows = state.expenses.slice().sort(sortExpensesNewest)
      .map((e) => [e.date, fmtTime(e.createdAt), e.cat, e.note, e.amt.toFixed(2)]);
    downloadCsv('expenses-' + TODAY + '.csv', ['Date', 'Time', 'Category', 'Note', 'Amount (RM)'], rows);
  },
};

export function initSpendingForms() {
  $('#exp-cat').innerHTML = CATS.map((c) => '<option>' + c.id + '</option>').join('');
  $('#edit-exp-cat').innerHTML = CATS.map((c) => '<option>' + c.id + '</option>').join('');
  $('#exp-date').value = TODAY;
  $('#tx-q').addEventListener('input', (e) => { ui.q = e.target.value; rerender(); });

  $('#exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = $('#exp-date').value || TODAY;
    const amt = parseFloat($('#exp-amt').value);
    if (!(amt > 0)) { setMsg('#exp-msg', 'Enter an amount above 0.'); return; }
    const cat = $('#exp-cat').value;
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      const row = await db.addExpense({ date, cat, note: $('#exp-note').value.trim() || cat, amt: Math.round(amt * 100) / 100 });
      state.expenses.push(row);
      ui.month = monthKey(date);
      ui.cat = 'All';
      $('#exp-amt').value = '';
      $('#exp-note').value = '';
      setMsg('#exp-msg', 'Added to ' + monthLabel(ui.month) + '.');
      rerender();
    } catch (err) {
      setMsg('#exp-msg', '');
      showError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  $('#edit-exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#edit-exp-id').value;
    const date = $('#edit-exp-date').value;
    const amt = parseFloat($('#edit-exp-amt').value);
    if (!(amt > 0)) { setMsg('#edit-exp-msg', 'Enter an amount above 0.'); return; }
    const cat = $('#edit-exp-cat').value;
    const note = $('#edit-exp-note').value.trim() || cat;
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      const updated = await db.updateExpense({ id, date, cat, note, amt: Math.round(amt * 100) / 100 });
      const idx = state.expenses.findIndex((x) => x.id === id);
      if (idx !== -1) state.expenses[idx] = updated;
      $('#edit-exp-modal').hidden = true;
      rerender();
    } catch (err) {
      setMsg('#edit-exp-msg', '');
      showError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
