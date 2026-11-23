// car.js: the Car tab. Service meter, cost tiles, renewals, service log and settings.

import { state, ui, rerender } from './state.js';
import * as db from './db.js';
import {
  NOW, TODAY, MON, TYPEC, esc, rm, num, fmtDate, monthKey, sum, clamp, daysUntil,
  tile, pill, setMsg, showError, downloadCsv,
} from './utils.js';
import { confirmDelete } from './confirm.js';

const $ = (s) => document.querySelector(s);

// Next service = the highest odometer of any "Service" record + the service interval.
function carStats() {
  const services = state.logs.filter((l) => l.type === 'Service').sort((a, b) => b.odo - a.odo);
  const last = services.length ? services[0].odo : state.car.start;
  const next = last + state.car.interval;
  const remaining = next - state.car.odo;
  const pct = clamp((state.car.odo - last) / state.car.interval, 0, 1) * 100;
  const soonAt = Math.min(1500, state.car.interval * 0.15);
  const st = remaining < 0 ? 'over' : remaining <= soonAt ? 'soon' : 'ok';
  return { last, next, remaining, pct, st, hasService: services.length > 0, services: services.length };
}

export function renderCar() {
  const c = carStats();
  const car = state.car;

  $('#sv-next').textContent = num(c.next) + ' km';
  $('#sv-pill').innerHTML =
    c.st === 'over' ? pill('over', '■', num(-c.remaining) + ' km overdue')
    : c.st === 'soon' ? pill('soon', '▲', num(c.remaining) + ' km to go · due soon')
    : pill('ok', '●', num(c.remaining) + ' km to go · on track');

  const pos = c.pct < 12 ? 'left:0' : c.pct > 88 ? 'right:0' : 'left:' + c.pct + '%;transform:translateX(-50%)';
  $('#sv-meter').innerHTML =
    '<span class="pin-label" style="' + pos + '">Now ' + num(car.odo) + ' km</span>' +
    '<div class="mtrack" role="img" aria-label="' + Math.round(c.pct) + ' percent of the service interval used"><div class="mfill" style="width:' + c.pct + '%"></div></div>' +
    '<div class="mscale"><span>' + (c.hasService ? 'Last service' : 'Starting point') + '<b>' + num(c.last) + ' km</b></span><span class="r">Next service<b>' + num(c.next) + ' km</b></span></div>';

  $('#sv-then').textContent = car.odo === 0 && !state.logs.length
    ? 'Set your current odometer under Car settings to start tracking.'
    : 'Then at ' + num(c.next + car.interval) + ' km and ' + num(c.next + 2 * car.interval) + ' km, every ' + num(car.interval) + ' km.';

  const cost = sum(state.logs, (l) => l.cost);
  const driven = Math.max(0, car.odo - car.start);
  const carSpend = sum(
    state.expenses.filter((e) => e.cat === 'Car' && monthKey(e.date) === monthKey(TODAY)),
    (e) => e.amt
  );
  $('#car-tiles').innerHTML =
    tile('t1', 'Services and repairs', rm(cost), state.logs.length + (state.logs.length === 1 ? ' record' : ' records')) +
    tile('t2', 'Cost per km', driven > 0 && cost > 0 ? 'RM ' + (cost / driven).toFixed(3) : '—', driven > 0 ? 'over ' + num(driven) + ' km driven' : 'Set your odometer first') +
    tile('t3', 'Services done', String(c.services), c.services ? 'last at ' + num(c.last) + ' km' : 'none logged yet') +
    tile('t4', 'Car spending in ' + MON[NOW.getMonth()], rm(carSpend), 'petrol, toll, parking and more');

  const rems = state.reminders.slice().sort((a, b) => (a.due < b.due ? -1 : 1));
  $('#rem-list').innerHTML = rems.length ? rems.map((r) => {
    const d = daysUntil(r.due);
    const p = d < 0 ? pill('over', '■', 'Overdue by ' + (-d) + ' d')
      : d <= 30 ? pill('soon', '▲', d + ' days left')
      : pill('ok', '●', d + ' days left');
    return '<li><span class="rn">' + esc(r.name) + '<br><span class="rd">' + fmtDate(r.due) + '</span></span>' + p +
      '<button class="rm" type="button" data-action="del-rem" data-id="' + r.id + '" aria-label="Remove ' + esc(r.name) + '">Remove</button></li>';
  }).join('') : '<li class="empty">No reminders yet. Add road tax or insurance below.</li>';

  $('#log-chips').innerHTML = ['All', 'Service', 'Repair', 'Other'].map((t) =>
    '<button class="chip" type="button" data-action="log-filter" data-type="' + t + '" aria-pressed="' + (ui.logType === t) + '">' + t + '</button>'
  ).join('');
  const logs = filteredLogs();
  $('#log-sum').textContent = logs.length + (logs.length === 1 ? ' record' : ' records') + ' · ' + rm(sum(logs, (l) => l.cost));
  $('#log-body').innerHTML = logs.length ? logs.map((l) =>
    '<tr><td>' + fmtDate(l.date) + '</td><td class="n">' + num(l.odo) + ' km</td><td><span class="tag" style="background:' + TYPEC[l.type] + '">' + l.type + '</span></td><td>' + esc(l.desc) + '</td><td>' + esc(l.shop || '—') + '</td><td class="n">' + rm(l.cost) + '</td>' +
    '<td class="n"><button class="edit-btn" type="button" data-action="edit-log" data-id="' + l.id + '" aria-label="Edit ' + esc(l.desc) + '">Edit</button>' +
    '<button class="rm" type="button" data-action="del-log" data-id="' + l.id + '" aria-label="Remove ' + esc(l.desc) + '">Remove</button></td></tr>'
  ).join('') : '<tr><td colspan="7" class="empty">No records yet. Add your first service above.</td></tr>';

  // Do not overwrite settings the person is typing right now.
  if (!$('#car-form').contains(document.activeElement)) {
    $('#car-odo').value = car.odo;
    $('#car-int').value = car.interval;
    $('#car-start').value = car.start;
  }
}

function filteredLogs() {
  return state.logs
    .filter((l) => ui.logType === 'All' || l.type === ui.logType)
    .sort((a, b) => b.odo - a.odo || (a.date < b.date ? 1 : -1));
}

export const carActions = {
  'log-filter': (b) => { ui.logType = b.dataset.type; },
  'del-log': async (b) => {
    const l = state.logs.find((x) => x.id === b.dataset.id);
    const label = l ? l.desc + ' — ' + rm(l.cost) : 'this record';
    const ok = await confirmDelete('Delete this car record?', 'Are you sure you want to delete "' + label + '"? This cannot be undone.');
    if (!ok) return;
    await db.deleteLog(b.dataset.id);
    state.logs = state.logs.filter((x) => x.id !== b.dataset.id);
  },
  'del-rem': async (b) => {
    const r = state.reminders.find((x) => x.id === b.dataset.id);
    const label = r ? r.name : 'this reminder';
    const ok = await confirmDelete('Delete this reminder?', 'Are you sure you want to delete "' + label + '"? This cannot be undone.');
    if (!ok) return;
    await db.deleteReminder(b.dataset.id);
    state.reminders = state.reminders.filter((x) => x.id !== b.dataset.id);
  },
  'edit-log': (b) => {
    const l = state.logs.find((x) => x.id === b.dataset.id);
    if (!l) return;
    const $ = (s) => document.querySelector(s);
    $('#edit-log-id').value = l.id;
    $('#edit-log-date').value = l.date;
    $('#edit-log-odo').value = l.odo;
    $('#edit-log-type').value = l.type;
    $('#edit-log-cost').value = l.cost;
    $('#edit-log-desc').value = l.desc;
    $('#edit-log-shop').value = l.shop;
    setMsg('#edit-log-msg', '');
    $('#edit-log-modal').hidden = false;
  },
  'edit-log-cancel': () => {
    document.querySelector('#edit-log-modal').hidden = true;
  },
  'export-log': () => {
    const rows = filteredLogs().map((l) => [l.date, l.odo, l.type, l.desc, l.shop, l.cost.toFixed(2)]);
    downloadCsv('car-log-' + TODAY + '.csv', ['Date', 'Odometer (km)', 'Type', 'What was done', 'Workshop', 'Cost (RM)'], rows);
  },
};

export function initCarForms() {
  $('#log-date').value = TODAY;

  $('#log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = $('#log-date').value || TODAY;
    const odo = parseInt($('#log-odo').value, 10);
    const desc = $('#log-desc').value.trim();
    let cost = parseFloat($('#log-cost').value);
    if (!(cost > 0)) cost = 0;
    if (!(odo >= 0)) { setMsg('#log-msg', 'Enter the odometer reading in km.'); return; }
    if (!desc) { setMsg('#log-msg', 'Say what was done, for example "Engine oil + filter".'); return; }
    const type = $('#log-type').value;
    cost = Math.round(cost * 100) / 100;
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      state.logs.push(await db.addLog({ date, odo, type, desc, shop: $('#log-shop').value.trim(), cost }));
      if (odo > state.car.odo) {
        state.car.odo = odo;
        await db.saveCar(state.car);
      }
      if ($('#log-spend').checked && cost > 0) {
        state.expenses.push(await db.addExpense({ date, cat: 'Car', note: type + ': ' + desc, amt: cost }));
      }
      ['#log-odo', '#log-cost', '#log-desc', '#log-shop'].forEach((s) => { $(s).value = ''; });
      setMsg('#log-msg', 'Record added.');
      rerender();
    } catch (err) {
      setMsg('#log-msg', '');
      showError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  $('#rem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#rem-name').value.trim();
    const due = $('#rem-due').value;
    if (!name || !due) { setMsg('#rem-msg', 'Add a name and a due date.'); return; }
    try {
      state.reminders.push(await db.addReminder({ name, due }));
      $('#rem-name').value = '';
      $('#rem-due').value = '';
      setMsg('#rem-msg', 'Reminder added.');
      rerender();
    } catch (err) {
      showError(err);
    }
  });

  $('#car-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const odo = parseInt($('#car-odo').value, 10);
    const interval = parseInt($('#car-int').value, 10);
    const start = parseInt($('#car-start').value, 10);
    if (!(odo >= 0) || !(interval > 0) || !(start >= 0)) { setMsg('#car-msg', 'Fill in all three numbers.'); return; }
    try {
      state.car = { odo, interval, start };
      await db.saveCar(state.car);
      setMsg('#car-msg', 'Saved.');
      if (document.activeElement) document.activeElement.blur();
      rerender();
    } catch (err) {
      showError(err);
    }
  });

  $('#edit-log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#edit-log-id').value;
    const date = $('#edit-log-date').value;
    const odo = parseInt($('#edit-log-odo').value, 10);
    const desc = $('#edit-log-desc').value.trim();
    let cost = parseFloat($('#edit-log-cost').value);
    if (!(cost > 0)) cost = 0;
    if (!(odo >= 0)) { setMsg('#edit-log-msg', 'Enter the odometer reading in km.'); return; }
    if (!desc) { setMsg('#edit-log-msg', 'Say what was done.'); return; }
    const type = $('#edit-log-type').value;
    cost = Math.round(cost * 100) / 100;
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      const updated = await db.updateLog({ id, date, odo, type, desc, shop: $('#edit-log-shop').value.trim(), cost });
      const idx = state.logs.findIndex((x) => x.id === id);
      if (idx !== -1) state.logs[idx] = updated;
      if (odo > state.car.odo) {
        state.car.odo = odo;
        await db.saveCar(state.car);
      }
      $('#edit-log-modal').hidden = true;
      rerender();
    } catch (err) {
      setMsg('#edit-log-msg', '');
      showError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
