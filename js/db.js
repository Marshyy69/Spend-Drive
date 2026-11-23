// db.js: everything that talks to Supabase. No other file calls the database.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_KEY.includes('YOUR-PUBLIC');
export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let userId = null;
export const setUser = (id) => { userId = id; };

// ---- sign in / out ----
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();

// ---- row shapes: database columns -> what the app uses ----
const fromExpense = (r) => ({ id: r.id, date: r.date, cat: r.category, note: r.note || '', amt: Number(r.amount) });
const fromLog = (r) => ({
  id: r.id, date: r.date, odo: r.odometer, type: r.type, desc: r.description,
  shop: r.workshop || '', cost: Number(r.cost),
});
const fromReminder = (r) => ({ id: r.id, name: r.name, due: r.due });

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll(table, orderCol, ascending) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*')
      .order(orderCol, { ascending }).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function loadAll() {
  const [e, l, r, c] = await Promise.all([
    fetchAll('expenses', 'date', false),
    fetchAll('car_logs', 'odometer', false),
    fetchAll('reminders', 'due', true),
    supabase.from('car_settings').select('*').maybeSingle(),
  ]);
  if (c.error) throw c.error;
  return {
    expenses: e.map(fromExpense),
    logs: l.map(fromLog),
    reminders: r.map(fromReminder),
    car: c.data
      ? { odo: c.data.odometer, interval: c.data.service_interval, start: c.data.start_odometer }
      : { odo: 0, interval: 10000, start: 0 },
  };
}

// ---- expenses ----
export async function addExpense(x) {
  const { data, error } = await supabase.from('expenses')
    .insert({ date: x.date, category: x.cat, note: x.note, amount: x.amt }).select().single();
  if (error) throw error;
  return fromExpense(data);
}
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// ---- car records ----
export async function addLog(x) {
  const { data, error } = await supabase.from('car_logs').insert({
    date: x.date, odometer: x.odo, type: x.type, description: x.desc, workshop: x.shop, cost: x.cost,
  }).select().single();
  if (error) throw error;
  return fromLog(data);
}
export async function deleteLog(id) {
  const { error } = await supabase.from('car_logs').delete().eq('id', id);
  if (error) throw error;
}

// ---- reminders ----
export async function addReminder(x) {
  const { data, error } = await supabase.from('reminders')
    .insert({ name: x.name, due: x.due }).select().single();
  if (error) throw error;
  return fromReminder(data);
}
export async function deleteReminder(id) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

// ---- car settings (one row per user) ----
export async function saveCar(car) {
  const { error } = await supabase.from('car_settings').upsert({
    user_id: userId, odometer: car.odo, service_interval: car.interval, start_odometer: car.start,
  });
  if (error) throw error;
}
