// trips.js: the Trips tab. Current, upcoming and past trips, each with its own budget and expenses.
// Trip expenses stay out of everyday monthly spending (spending.js filters them out).

import { state, ui, rerender } from './state.js';
import * as db from './db.js';
import { initRates, prefillCurrency } from './rates.js';
import {
  TODAY, TRIP_CATS, catColor, esc, rm, fmtDate, fmtTime, fmtRange, daysBetween, monthKey, sum, clamp,
  sortExpensesNewest, tile, pill, setMsg, showError, showStatus,
} from './utils.js';

const $ = (s) => document.querySelector(s);

const tripStatus = (t) => (TODAY < t.start ? 'upcoming' : TODAY > t.end ? 'past' : 'current');
const tripDays = (t) => daysBetween(t.start, t.end) + 1;
const tripExpenses = (t) => state.expenses.filter((e) => e.trip === t.id);
const money = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// Which trip to show when nothing was picked: the current one, else the next one, else the latest.
function pickDefault() {
  const cur = state.trips.filter((t) => tripStatus(t) === 'current').sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  if (cur) return cur.id;
  const up = state.trips.filter((t) => tripStatus(t) === 'upcoming').sort((a, b) => (a.start < b.start ? -1 : 1))[0];
  if (up) return up.id;
  const past = state.trips.slice().sort((a, b) => (a.end < b.end ? 1 : -1))[0];
  return past ? past.id : null;
}
function selected() {
  let t = state.trips.find((x) => x.id === ui.tripId);
  if (!t) {
    ui.tripId = pickDefault();
    t = state.trips.find((x) => x.id === ui.tripId);
  }
  return t || null;
}

// ---- small line for the Spending tab ----
export function tripNoteHtml(key) {
  const parts = [];
  const cur = state.trips.filter((t) => tripStatus(t) === 'current').sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  if (cur) {
    const days = tripDays(cur);
    const dayNo = clamp(daysBetween(cur.start, TODAY) + 1, 1, days);
    const total = sum(tripExpenses(cur), (e) => e.amt);
    parts.push('On a trip: <b>' + esc(cur.name) + '</b>, day ' + dayNo + ' of ' + days + ', ' + rm(total) +
      ' so far. <button class="linkbtn" type="button" data-action="open-trip" data-id="' + cur.id + '">Open trip</button>');
  }
  const m = sum(state.expenses.filter((e) => e.trip && monthKey(e.date) === key), (e) => e.amt);
  if (m > 0) parts.push('Trip spending in this month: ' + rm(m) + '. It is not counted above.');
  return parts.join('<br>');
}

// ---- Trips tab ----
export function renderTrips() {
  const t = selected();
  renderList();
  $('#trip-add-card').hidden = !t;
  $('#trip-exp-card').hidden = !t;
  if (!t) {
    $('#trip-detail').innerHTML = '<h2>No trip yet</h2><p class="empty">Add your first trip below. Everything you spend on it is counted here, separate from your everyday months.</p>';
    return;
  }
  renderDetail(t);
  renderExpenses(t);
}

function renderDetail(t) {
  const st = tripStatus(t);
  const days = tripDays(t);
  const ex = tripExpenses(t);
  const total = sum(ex, (e) => e.amt);
  const dayNo = clamp(daysBetween(t.start, TODAY) + 1, 1, days);
  const toStart = daysBetween(TODAY, t.start);

  const stPill = st === 'current' ? pill('ok', '●', 'Now · day ' + dayNo + ' of ' + days)
    : st === 'upcoming' ? pill('neutral', '○', 'Starts in ' + plural(toStart, 'day', 'days'))
    : pill('neutral', '○', 'Finished');

  const by = {};
  ex.forEach((e) => { by[e.cat] = (by[e.cat] || 0) + e.amt; });
  const order = Object.keys(by).sort((a, b) => by[b] - by[a]);

  const perDayDays = st === 'current' ? dayNo : st === 'past' ? days : 0;
  // Per-day figure counts only spending on the trip dates, not flights or hotels booked earlier.
  const onTrip = sum(ex.filter((e) => e.date >= t.start && e.date <= t.end), (e) => e.amt);
  const hasBudget = t.budget != null;
  const left = hasBudget ? t.budget - total : 0;

  let tiles =
    tile('t1', 'Spent', rm(total), plural(ex.length, 'entry', 'entries')) +
    tile('t2', 'Per day', perDayDays ? rm(onTrip / perDayDays) : '—', perDayDays ? 'during the trip, over ' + plural(perDayDays, 'day', 'days') : 'Trip has not started') +
    tile('t3', hasBudget ? (left < 0 ? 'Over budget' : 'Budget left') : 'Budget', hasBudget ? rm(Math.abs(left)) : '—', hasBudget ? 'of ' + rm(t.budget) : 'No budget set') +
    tile('t4', 'Biggest category', order.length ? order[0] : '—', order.length ? rm(by[order[0]]) + ' (' + Math.round((by[order[0]] / total) * 100) + '%)' : 'Nothing logged yet');

  let meter = '';
  if (hasBudget) {
    const pct = clamp((total / t.budget) * 100, 0, 100);
    const remDays = days - dayNo + 1;
    const hint = left < 0 ? pill('over', '■', rm(-left) + ' over budget')
      : st === 'current' && remDays > 0 ? 'About ' + rm(left / remDays) + ' a day for the ' + plural(remDays, 'day', 'days') + ' left, including today.'
      : Math.round(pct) + '% of the budget used.';
    meter = '<div><div class="mtrack" role="img" aria-label="' + Math.round(pct) + ' percent of the trip budget used"><div class="mfill" style="width:' + pct + '%"></div></div>' +
      '<p class="then budgethint">' + hint + '</p></div>';
  }

  const rows = order.map((id) => {
    const pct = (by[id] / total) * 100;
    return '<div class="catrow"><span class="catname"><i class="dot" style="background:' + catColor(id) + '"></i>' + id + '</span>' +
      '<span class="track"><span class="fill" style="width:' + pct + '%;background:' + catColor(id) + '"></span></span>' +
      '<span class="catval">' + rm(by[id]) + '<small>' + Math.round(pct) + '%</small></span></div>';
  }).join('');

  const confirming = ui.tripConfirm === t.id;
  const del = confirming
    ? '<button class="btn danger small" type="button" data-action="del-trip" data-id="' + t.id + '">Confirm: delete trip and ' + plural(ex.length, 'expense', 'expenses') + '</button>' +
      '<button class="btn ghost small" type="button" data-action="cancel-del">Cancel</button>'
    : '<button class="btn ghost small" type="button" data-action="del-trip" data-id="' + t.id + '">Delete trip</button>';

  $('#trip-detail').innerHTML =
    '<div class="tripHead"><div><h2 class="tname">' + esc(t.name) + '</h2><p class="sub">' + fmtRange(t.start, t.end) + ' · ' + plural(days, 'day', 'days') + '</p></div>' + stPill + '</div>' +
    '<div class="tiles">' + tiles + '</div>' + meter +
    (rows ? '<div class="tripcats">' + rows + '</div>' : '') +
    '<div class="tripactions"><button class="btn ghost small" type="button" data-action="edit-trip" data-id="' + t.id + '">Edit trip</button>' + del + '</div>';
}

function renderExpenses(t) {
  $('#te-for').textContent = 'for ' + t.name;
  // Start the date at today (during the trip), or the first/last day otherwise.
  const d = $('#te-date');
  if (d.dataset.trip !== t.id) {
    const st = tripStatus(t);
    d.value = st === 'upcoming' ? t.start : st === 'past' ? t.end : TODAY;
    d.dataset.trip = t.id;
  }
  prefillCurrency(t.id, tripExpenses(t));
  const list = tripExpenses(t).sort(sortExpensesNewest);
  $('#trip-exp-sum').textContent = plural(list.length, 'entry', 'entries') + ' · ' + rm(sum(list, (e) => e.amt));
  $('#trip-exp-body').innerHTML = list.length ? list.map((e) => {
    const tm = fmtTime(e.createdAt);
    return '<tr><td>' + fmtDate(e.date) + (tm ? '<br><small class="tx-time">' + esc(tm) + '</small>' : '') + '</td><td><span class="tag" style="background:' + catColor(e.cat) + '">' + e.cat + '</span></td>' +
      '<td>' + esc(e.note) + (e.fx ? '<br><small class="fx">' + esc(e.fxc || '') + ' ' + money(e.fx) + '</small>' : '') + '</td>' +
      '<td class="n">' + rm(e.amt) + '</td>' +
      '<td class="n"><button class="rm" type="button" data-action="del-exp" data-id="' + e.id + '" aria-label="Remove ' + esc(e.note) + '">Remove</button></td></tr>';
  }).join('') : '<tr><td colspan="5" class="empty">Nothing logged for this trip yet. Add the first expense above.</td></tr>';
}

function renderList() {
  const selId = ui.tripId;
  const groups = [['Current', 'current'], ['Upcoming', 'upcoming'], ['Past', 'past']];
  let html = '';
  groups.forEach((g) => {
    const ts = state.trips.filter((t) => tripStatus(t) === g[1])
      .sort(g[1] === 'upcoming' ? (a, b) => (a.start < b.start ? -1 : 1) : (a, b) => (a.start < b.start ? 1 : -1));
    if (!ts.length) return;
    html += '<h3 class="grp">' + g[0] + '</h3><ul class="triplist">' + ts.map((t) => {
      const total = sum(tripExpenses(t), (e) => e.amt);
      return '<li><button class="tripbtn" type="button" data-action="pick-trip" data-id="' + t.id + '" aria-pressed="' + (t.id === selId) + '">' +
        '<span class="tn"><b>' + esc(t.name) + '</b><small>' + fmtRange(t.start, t.end) + ' · ' + plural(tripDays(t), 'day', 'days') + '</small></span>' +
        '<span class="tt">' + rm(total) + '<small>' + (t.budget != null ? 'of ' + rm(t.budget) : 'no budget') + '</small></span></button></li>';
    }).join('') + '</ul>';
  });
  $('#trip-list').innerHTML = html || '<p class="empty">No trips yet. Add your first one below.</p>';
}

// ---- editing a trip ----
function startEdit(id) {
  const t = state.trips.find((x) => x.id === id);
  if (!t) return;
  ui.tripEditId = id;
  $('#trip-name').value = t.name;
  $('#trip-start').value = t.start;
  $('#trip-end').value = t.end;
  $('#trip-budget').value = t.budget == null ? '' : t.budget;
  $('#trip-form-title').textContent = 'Edit trip';
  $('#trip-save').textContent = 'Save trip';
  $('#trip-cancel').hidden = false;
  setMsg('#trip-msg', '');
  $('#trip-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function endEdit() {
  ui.tripEditId = null;
  $('#trip-name').value = '';
  $('#trip-start').value = TODAY;
  $('#trip-end').value = TODAY;
  $('#trip-budget').value = '';
  $('#trip-form-title').textContent = 'Plan a trip';
  $('#trip-save').textContent = 'Add trip';
  $('#trip-cancel').hidden = true;
}

// If trips.sql has not been run yet, say so in plain words.
function tripError(err) {
  const m = (err && err.message) || '';
  if (/trips|trip_id|foreign_|schema cache|does not exist|check constraint/i.test(m)) {
    showStatus('Trips are not set up in the database yet. Run supabase/trips.sql in Supabase (SQL Editor), then try again.');
  } else {
    showError(err);
  }
}

export const tripActions = {
  'pick-trip': (b) => { ui.tripId = b.dataset.id; ui.tripConfirm = null; },
  'open-trip': (b) => {
    ui.tripId = b.dataset.id;
    ui.view = 'trips';
    try { location.hash = 'trips'; } catch (x) { /* ignore */ }
  },
  'edit-trip': (b) => { startEdit(b.dataset.id); },
  'cancel-edit': () => { endEdit(); setMsg('#trip-msg', ''); },
  'cancel-del': () => { ui.tripConfirm = null; },
  'del-trip': async (b) => {
    const id = b.dataset.id;
    if (ui.tripConfirm !== id) { ui.tripConfirm = id; return; } // first click asks to confirm
    await db.deleteTrip(id);
    state.trips = state.trips.filter((x) => x.id !== id);
    state.expenses = state.expenses.filter((x) => x.trip !== id);
    ui.tripConfirm = null;
    ui.tripId = null;
    if (ui.tripEditId === id) endEdit();
  },
};

export function initTripForms() {
  initRates();
  $('#te-cat').innerHTML = TRIP_CATS.map((c) => '<option>' + c + '</option>').join('');
  endEdit();

  // Add an expense to the selected trip
  $('#te-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = selected();
    if (!t) return;
    const amt = parseFloat($('#te-amt').value);
    if (!(amt > 0)) { setMsg('#te-msg', 'Enter the amount in RM, above 0.'); return; }
    let fx = parseFloat($('#te-fx-amt').value);
    const fxc = $('#te-fx-cur').value.trim().toUpperCase();
    if (!(fx > 0)) fx = null;
    if (fx && !fxc) { setMsg('#te-msg', 'Pick the currency for the local amount.'); return; }
    const cat = $('#te-cat').value;
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      const row = await db.addExpense({
        date: $('#te-date').value || TODAY, cat, note: $('#te-note').value.trim() || cat,
        amt: Math.round(amt * 100) / 100, trip: t.id, fx, fxc: fx ? fxc : null,
      });
      state.expenses.push(row);
      ['#te-amt', '#te-note', '#te-fx-amt', '#te-fx-cur'].forEach((s) => { $(s).value = ''; });
      setMsg('#te-msg', 'Added.');
      rerender();
    } catch (err) {
      setMsg('#te-msg', '');
      tripError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // Add or edit a trip
  $('#trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#trip-name').value.trim();
    const start = $('#trip-start').value;
    const end = $('#trip-end').value;
    const raw = $('#trip-budget').value.trim();
    const budget = raw === '' ? null : parseFloat(raw);
    if (!name) { setMsg('#trip-msg', 'Give the trip a name, for example "Japan 2027".'); return; }
    if (!start || !end) { setMsg('#trip-msg', 'Pick the start and end dates.'); return; }
    if (end < start) { setMsg('#trip-msg', 'The end date is before the start date.'); return; }
    if (raw !== '' && !(budget > 0)) { setMsg('#trip-msg', 'The budget must be above 0, or leave it empty.'); return; }
    const rec = { name, start, end, budget: budget > 0 ? Math.round(budget * 100) / 100 : null };
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      let saved;
      if (ui.tripEditId) {
        saved = await db.updateTrip(ui.tripEditId, rec);
        state.trips = state.trips.map((x) => (x.id === saved.id ? saved : x));
      } else {
        saved = await db.addTrip(rec);
        state.trips.push(saved);
      }
      ui.tripId = saved.id;
      ui.tripConfirm = null;
      const wasEdit = !!ui.tripEditId;
      endEdit();
      setMsg('#trip-msg', wasEdit ? 'Trip saved.' : 'Trip added.');
      rerender();
    } catch (err) {
      setMsg('#trip-msg', '');
      tripError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
