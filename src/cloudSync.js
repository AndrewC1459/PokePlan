// Cloud accounts for Poképlan.
//
// The legacy scripts read and write every account through `accounts()` /
// `saveAccounts()` backed by localStorage. Here localStorage becomes a cache:
// Supabase Auth handles sign-up/log-in, and each user's save lives in the
// `planner_saves` table (see supabase/schema.sql), so it follows them to any browser.
import { createClient } from '@supabase/supabase-js';

const STORE_KEY = 'pokeplan.accounts.v1';
const SESSION_KEY = 'pokeplan.session.v1';
const SAVE_DELAY_MS = 600;

// The project URL is public; the key comes from Vercel's Supabase integration at build time.
const SUPABASE_URL = __SUPABASE_URL__ || 'https://bvnwaihcijkttokbieos.supabase.co';
const SUPABASE_KEY = __SUPABASE_KEY__;

const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
if (!supabase) console.warn('Poképlan: Supabase key missing, accounts are saved in this browser only.');

let currentUserId = null;
let currentEmail = null;

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (Array.isArray(raw)) return Object.fromEntries(raw.filter(x => x && x.email).map(x => [x.email.trim().toLowerCase(), x]));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function writeLocal(all) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}

function findKey(all, email) {
  return Object.keys(all).find(k => k.trim().toLowerCase() === email) || null;
}

function todayKey() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Passwords are Supabase's job now; never keep them in a save.
function cleanRecord(record, email) {
  const { password, ...rest } = record || {};
  return { ...rest, email };
}

function saveRow(record) {
  return { user_id: currentUserId, data: cleanRecord(record, currentEmail), updated_at: new Date().toISOString() };
}

// Fetch this user's cloud save (creating it on first login) and hand it to the legacy scripts.
async function loadSave(user, name) {
  const email = user.email.trim().toLowerCase();
  const { data, error } = await supabase.from('planner_saves').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;

  currentUserId = user.id;
  currentEmail = email;
  let record = data?.data;
  if (!record || !Object.keys(record).length) {
    // First cloud login: carry over a save this browser already has for the email.
    const local = readLocal()[findKey(readLocal(), email)];
    record = local
      ? cleanRecord(local, email)
      : { email, name: name || user.user_metadata?.name || 'Trainer', pokemon: null, tasks: [], selectedDate: todayKey() };
    const { error: insertError } = await supabase.from('planner_saves').upsert(saveRow(record));
    if (insertError) throw insertError;
  }

  const all = readLocal();
  const oldKey = findKey(all, email);
  if (oldKey) delete all[oldKey];
  all[email] = cleanRecord(record, email);
  writeLocal(all);
  localStorage.setItem(SESSION_KEY, email);
  return email;
}

function forgetLocalAccount(email) {
  const all = readLocal();
  const key = email && findKey(all, email);
  if (key) { delete all[key]; writeLocal(all); }
}

function friendlyError(err) {
  const code = err?.code || '';
  const message = err?.message || '';
  if (code === 'invalid_credentials') return 'Email or password is incorrect. Check the spelling and try again.';
  if (code === 'email_not_confirmed') return 'Please confirm your email first. Check your inbox for the link.';
  if (code === 'user_already_exists') return 'An account already exists for this email. Choose Log in.';
  if (code === 'weak_password' || /password.*(6|characters)/i.test(message)) return 'Passwords need at least 6 characters.';
  if (code.startsWith('over_') || err?.status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (code === '42P01' || code === 'PGRST205') return 'Cloud saves are not set up yet (the planner_saves table is missing).';
  if (/fetch|network/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}

// Before the legacy scripts run: reopen a signed-in user's cloud save, if any.
export async function restoreSession() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) { await loadSave(session.user); return; }
  } catch (err) {
    console.error('Poképlan: could not load cloud save', err);
  }
  // Not signed in to the cloud: don't auto-open a browser-only account.
  localStorage.removeItem(SESSION_KEY);
}

// After the legacy scripts run: route log-in, sign-up, saving and log-out through Supabase.
export function installCloudSync() {
  if (!supabase) return () => {};
  const originalSave = window.saveAccounts;
  const originalLogout = window.logout;
  let timer = null;
  let pending = null;
  let busy = false;

  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const row = pending;
    pending = null;
    const { error } = await supabase.from('planner_saves').upsert(row);
    if (error) {
      console.error('Poképlan: cloud save failed, retrying', error);
      pending = pending || row;
      timer = setTimeout(flush, 5000);
    }
  }

  window.saveAccounts = function (all) {
    const result = originalSave.apply(this, arguments);
    const key = currentUserId && all && findKey(all, currentEmail);
    if (key) {
      pending = saveRow(all[key]);
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    }
    return result;
  };

  window.logout = function () {
    const email = currentEmail;
    currentUserId = null;
    currentEmail = null;
    flush().finally(() => supabase.auth.signOut().catch(err => console.error(err)));
    forgetLocalAccount(email);
    return originalLogout.apply(this, arguments);
  };

  async function onSubmit(event) {
    const form = document.getElementById('accountForm');
    if (!form || event.target !== form) return;
    // Replace the browser-only login handlers entirely.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;

    const mode = document.querySelector('[data-auth].active')?.dataset.auth === 'login' ? 'login' : 'signup';
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const name = document.getElementById('trainerName').value.trim() || 'Trainer';
    const errorBox = document.getElementById('authError');
    const submit = document.getElementById('accountSubmit');
    const say = text => { errorBox.textContent = text; };

    busy = true;
    submit.disabled = true;
    say('');
    try {
      let result;
      if (mode === 'signup') {
        result = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (result.error) throw result.error;
        if (result.data.user?.identities?.length === 0) throw { code: 'user_already_exists' };
        if (!result.data.session) { say('Almost there! Check your email for a confirmation link, then come back and log in.'); return; }
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error?.code === 'invalid_credentials') {
          // An account created before cloud saves: move it online with the same details.
          const local = readLocal()[findKey(readLocal(), email)];
          if (local && local.password === password) {
            result = await supabase.auth.signUp({ email, password, options: { data: { name: local.name } } });
            if (!result.error && !result.data.session) {
              say('Your account is moving online! Check your email for a confirmation link, then log in again.');
              return;
            }
          }
        }
        if (result.error) throw result.error;
      }
      window.openAccount(await loadSave(result.data.user, name));
    } catch (err) {
      console.error('Poképlan: sign-in failed', err);
      say(friendlyError(err));
    } finally {
      busy = false;
      submit.disabled = false;
    }
  }

  const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return () => {
    document.removeEventListener('submit', onSubmit, true);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    window.saveAccounts = originalSave;
    window.logout = originalLogout;
  };
}
