// app.js: starts everything. Handles login state, tabs, and routes button clicks to the right module.

import { state, ui, setRender, rerender } from './state.js';
import { initAuth } from './auth.js';
import { loadAll, setUser, signOut } from './db.js';
import { renderSpending, spendingActions, initSpendingForms } from './spending.js';
import { renderCar, carActions, initCarForms } from './car.js';
import { renderTrips, tripActions, initTripForms } from './trips.js';
import { confirmActions } from './confirm.js';
import { initTooltip } from './tooltip.js';
import { NOW, DAYS, MONTHS, showStatus, showError } from './utils.js';

const $ = (s) => document.querySelector(s);

function render() {
  $('#tab-spending').setAttribute('aria-selected', ui.view === 'spending');
  $('#tab-car').setAttribute('aria-selected', ui.view === 'car');
  $('#tab-trips').setAttribute('aria-selected', ui.view === 'trips');
  $('#view-spending').hidden = ui.view !== 'spending';
  $('#view-car').hidden = ui.view !== 'car';
  $('#view-trips').hidden = ui.view !== 'trips';
  if (ui.view === 'spending') renderSpending();
  else if (ui.view === 'car') renderCar();
  else renderTrips();
}
setRender(render);

function setView(v) {
  ui.view = v === 'car' || v === 'trips' ? v : 'spending';
  render();
}
function fromHash() {
  setView((location.hash || '').replace('#', ''));
}

// ---- signed in / signed out ----
async function onSignedIn(session) {
  setUser(session.user.id);
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  showStatus('');
  try {
    Object.assign(state, await loadAll());
  } catch (err) {
    showError(err);
    showStatus('Could not load your data. If you have not used the app for a week, open the Supabase dashboard and restore the project, then refresh.');
  }
  fromHash();
}
function onSignedOut() {
  Object.assign(state, { expenses: [], trips: [], logs: [], reminders: [], car: { odo: 0, interval: 10000, start: 0 } });
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
}

// ---- clicks ----
const actions = {
  ...spendingActions,
  ...carActions,
  ...tripActions,
  ...confirmActions,
  signout: async () => { await signOut(); },
};

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    try { location.hash = tab.dataset.tab; } catch (x) { /* ignore */ }
    setView(tab.dataset.tab);
    return;
  }
  const b = e.target.closest('[data-action]');
  if (!b || !actions[b.dataset.action]) return;
  try {
    showStatus('');
    await actions[b.dataset.action](b);
  } catch (err) {
    showError(err);
  }
  if (b.dataset.action !== 'signout') rerender();
});

// ---- start ----
$('#today-line').textContent = DAYS[NOW.getDay()] + ', ' + NOW.getDate() + ' ' + MONTHS[NOW.getMonth()] + ' ' + NOW.getFullYear();
window.addEventListener('hashchange', fromHash);
initTooltip();
initSpendingForms();
initCarForms();
initTripForms();
initAuth(onSignedIn, onSignedOut);
