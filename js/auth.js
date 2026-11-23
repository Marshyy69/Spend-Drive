// auth.js: the login screen. Accounts are created in the Supabase dashboard (see README), not here.

import { configured, signIn, getSession, supabase } from './db.js';
import { setMsg } from './utils.js';

export async function initAuth(onSignedIn, onSignedOut) {
  const form = document.getElementById('login-form');

  if (!configured) {
    onSignedOut();
    setMsg('#login-msg', 'Not connected yet. Add your Supabase URL and key in js/config.js.');
    return;
  }

  // Signing out (here or in another tab) returns to the login screen.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onSignedOut();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    if (!email || !pass) { setMsg('#login-msg', 'Enter your email and password.'); return; }
    setMsg('#login-msg', 'Signing in...');
    const { data, error } = await signIn(email, pass);
    if (error) { setMsg('#login-msg', 'Could not sign in. Check your email and password.'); return; }
    document.getElementById('login-pass').value = '';
    setMsg('#login-msg', '');
    onSignedIn(data.session);
  });

  try {
    const { data } = await getSession();
    if (data.session) onSignedIn(data.session);
    else onSignedOut();
  } catch (err) {
    onSignedOut();
    setMsg('#login-msg', 'Could not reach the database. If you have not used it for a week, open the Supabase dashboard and restore the project.');
  }
}
