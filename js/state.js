// state.js: the data currently on screen, plus which view/month/filter is selected.
// Every module imports these two objects and changes them directly.

import { TODAY, monthKey } from './utils.js';

export const state = {
  expenses: [], // { id, date, cat, note, amt }
  logs: [], //     { id, date, odo, type, desc, shop, cost }
  reminders: [], // { id, name, due }
  car: { odo: 0, interval: 10000, start: 0 },
};

export const ui = {
  view: 'spending',
  month: monthKey(TODAY),
  cat: 'All',
  q: '',
  logType: 'All',
};

// app.js registers the real render function here so other modules can ask for a redraw.
let renderFn = () => {};
export const setRender = (fn) => { renderFn = fn; };
export const rerender = () => renderFn();
