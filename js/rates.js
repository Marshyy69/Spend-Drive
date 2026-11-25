// rates.js: daily exchange rates for the trip expense form.
// Uses ExchangeRate-API (open.er-api.com, free, no key) once per day and caches in localStorage.

import { TODAY, fmtDate, rm } from './utils.js';

const $ = (s) => document.querySelector(s);

export const TRIP_CURRENCIES = [
  { code: 'MYR', label: '🇲🇾 MYR' },
  { code: 'IDR', label: '🇮🇩 IDR' },
  { code: 'JPY', label: '🇯🇵 JPY' },
  { code: 'CNY', label: '🇨🇳 CNY' },
  { code: 'USD', label: '🇺🇸 USD' },
  { code: 'PHP', label: '🇵🇭 PHP' },
  { code: 'THB', label: '🇹🇭 THB' },
];

const SUPPORTED_CODES = TRIP_CURRENCIES.map((c) => c.code);
const STORAGE_KEY = 'spend_drive_fx_rates_v1';
const API_URL = 'https://open.er-api.com/v6/latest/MYR';

let inflight = null;

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.rates || typeof parsed.date !== 'string') return null;
    const hasAll = SUPPORTED_CODES.every((code) => typeof parsed.rates[code] === 'number' && parsed.rates[code] > 0);
    return hasAll ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(entry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

// Fetch once per day from ExchangeRate-API and keep only the supported currencies.
export async function getDailyRates() {
  const cached = readCache();
  if (cached && cached.date === TODAY) return cached;

  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Rate lookup failed (' + res.status + ')');
        const data = await res.json();
        if (data.result !== 'success' || !data.rates) throw new Error('Invalid rate response');

        const rates = {};
        for (const code of SUPPORTED_CODES) {
          const val = Number(data.rates[code]);
          if (!(val > 0)) throw new Error('Missing rate for ' + code);
          rates[code] = val;
        }

        const entry = {
          date: TODAY,
          updatedAt: data.time_last_update_utc || TODAY,
          rates,
        };
        writeCache(entry);
        return entry;
      } catch (err) {
        if (cached) return { ...cached, stale: true };
        throw err;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

// How many RM one unit of `from` is worth.
export async function getRate(from) {
  const code = String(from || '').trim().toUpperCase();
  if (code === 'MYR') return { rate: 1, date: TODAY, stale: false };
  const daily = await getDailyRates();
  const perMyr = daily.rates[code];
  if (!(perMyr > 0)) throw new Error('Unsupported currency: ' + code);
  return { rate: 1 / perMyr, date: daily.date, stale: !!daily.stale };
}

// Call once at start. Populates the currency dropdown, fetches today's rates once,
// and auto-fills Amount (RM) when a local amount and currency are chosen.
export function initRates() {
  const curEl = $('#te-fx-cur');
  const fxEl = $('#te-fx-amt');
  const amtEl = $('#te-amt');
  const hint = $('#te-rate');

  curEl.innerHTML = '<option value="">Select place / currency</option>' +
    TRIP_CURRENCIES.map((c) => '<option value="' + c.code + '">' + c.label + '</option>').join('');

  // Warm the daily cache once per day in the background.
  getDailyRates().catch(() => {});

  let autoFilled = false;
  let timer = null;
  let seq = 0;

  amtEl.addEventListener('input', () => { autoFilled = false; });

  async function update() {
    const fxc = curEl.value.trim().toUpperCase();
    const fx = parseFloat(fxEl.value);
    if (!fxc || !(fx > 0)) { hint.hidden = true; return; }

    const mine = ++seq;
    hint.hidden = false;
    hint.textContent = 'Converting...';
    try {
      const r = await getRate(fxc);
      if (mine !== seq) return;
      const est = Math.round(fx * r.rate * 100) / 100;
      hint.textContent = fxc === 'MYR'
        ? '1 MYR = RM 1.00. Amount: ' + rm(est) + '.'
        : '1 ' + fxc + ' = RM ' + Number(r.rate.toPrecision(4)) + ' (ExchangeRate-API, ' + fmtDate(r.date) + (r.stale ? ', cached' : '') + '). About ' + rm(est) + '.';
      if (!amtEl.value || autoFilled) {
        amtEl.value = est.toFixed(2);
        autoFilled = true;
      }
    } catch {
      if (mine !== seq) return;
      hint.textContent = 'Could not get a rate. Type the RM amount yourself.';
    }
  }

  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 150); };
  fxEl.addEventListener('input', schedule);
  curEl.addEventListener('change', () => { clearTimeout(timer); update(); });

  $('#te-form').addEventListener('submit', () => {
    clearTimeout(timer);
    seq++;
    hint.hidden = true;
    autoFilled = false;
  });
}

// Keeps the trip's currency selected so you do not re-pick it for every expense.
let shownTrip = null;
export function prefillCurrency(tripId, tripExpenses) {
  const cur = $('#te-fx-cur');
  if (shownTrip !== tripId) {
    shownTrip = tripId;
    cur.value = '';
    $('#te-rate').hidden = true;
  }
  if (!cur.value) {
    const last = tripExpenses.filter((e) => e.fxc && SUPPORTED_CODES.includes(e.fxc))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
    if (last) cur.value = last.fxc;
  }
}
