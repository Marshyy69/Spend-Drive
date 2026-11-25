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
const fromExpense = (r) => ({
  id: r.id, date: r.date, createdAt: r.created_at || null, cat: r.category, note: r.note || '', amt: Number(r.amount),
  trip: r.trip_id || null,
  fx: r.foreign_amount == null ? null : Number(r.foreign_amount),
  fxc: r.foreign_currency || '',
});
const fromTrip = (r) => ({
  id: r.id, name: r.name, start: r.start_date, end: r.end_date,
  budget: r.budget == null ? null : Number(r.budget),
});
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

async function fetchTrips() {
  try {
    return await fetchAll('trips', 'start_date', false);
  } catch (err) {
    console.warn('Trips table not found yet. Run supabase/trips.sql.', err);
    return [];
  }
}

export async function loadAll() {
   const [e, l, r, c, t] = await Promise.all([
    fetchAll('expenses', 'date', false),                       // e
    fetchAll('car_logs', 'odometer', false),                   // l
    fetchAll('reminders', 'due', true),                        // r
    supabase.from('car_settings').select('*').maybeSingle(),   // c
    fetchTrips(),                                              // t  (must be last)
  ]);
  if (c.error) throw c.error;
  return {
    expenses: e.map(fromExpense),
    trips: t.map(fromTrip),
    logs: l.map(fromLog),
    reminders: r.map(fromReminder),
    car: c.data
      ? { odo: c.data.odometer, interval: c.data.service_interval, start: c.data.start_odometer }
      : { odo: 0, interval: 10000, start: 0 },
  };
}

// ---- expenses ----
export async function addExpense(x) {
  const row = { date: x.date, category: x.cat, note: x.note, amount: x.amt };
  if (x.trip) row.trip_id = x.trip;
  if (x.fx) { row.foreign_amount = x.fx; row.foreign_currency = x.fxc || null; }
  const { data, error } = await supabase.from('expenses').insert(row).select().single();
  if (error) throw error;
  return fromExpense(data);
}
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
export async function updateExpense(x) {
  const { data, error } = await supabase.from('expenses')
    .update({ date: x.date, category: x.cat, note: x.note, amount: x.amt })
    .eq('id', x.id).select().single();
  if (error) throw error;
  return fromExpense(data);
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
export async function updateLog(x) {
  const { data, error } = await supabase.from('car_logs')
    .update({ date: x.date, odometer: x.odo, type: x.type, description: x.desc, workshop: x.shop, cost: x.cost })
    .eq('id', x.id).select().single();
  if (error) throw error;
  return fromLog(data);
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

export async function addTrip(t) {
  const { data, error } = await supabase.from('trips')
    .insert({ name: t.name, start_date: t.start, end_date: t.end, budget: t.budget }).select().single();
  if (error) throw error;
  return fromTrip(data);
}
export async function updateTrip(id, t) {
  const { data, error } = await supabase.from('trips')
    .update({ name: t.name, start_date: t.start, end_date: t.end, budget: t.budget })
    .eq('id', id).select().single();
  if (error) throw error;
  return fromTrip(data);
}
export async function deleteTrip(id) {
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}