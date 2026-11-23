// confirm.js: a reusable double-confirm delete modal.
// Returns a promise that resolves true if the user confirms, false if cancelled.

const $ = (s) => document.querySelector(s);

let _resolve = null;

export function confirmDelete(title, body) {
  $('#confirm-title').textContent = title || 'Delete this entry?';
  $('#confirm-body').textContent = body || 'This action cannot be undone.';
  $('#confirm-modal').hidden = false;

  // First click: change button text to "Confirm delete" (second confirm)
  const btn = $('#confirm-ok-btn');
  btn.textContent = 'Delete';
  btn.classList.remove('confirm-step2');

  return new Promise((resolve) => {
    _resolve = resolve;
  });
}

// These are wired up via data-action in app.js
export const confirmActions = {
  'confirm-cancel': () => {
    $('#confirm-modal').hidden = true;
    if (_resolve) { _resolve(false); _resolve = null; }
  },
  'confirm-ok': () => {
    const btn = $('#confirm-ok-btn');
    if (!btn.classList.contains('confirm-step2')) {
      // First click -> change to second confirm
      btn.textContent = 'Yes, permanently delete';
      btn.classList.add('confirm-step2');
      return; // Don't resolve yet — wait for the second click
    }
    // Second click -> confirmed
    $('#confirm-modal').hidden = true;
    btn.classList.remove('confirm-step2');
    if (_resolve) { _resolve(true); _resolve = null; }
  },
};

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (e.target === $('#confirm-modal')) {
    confirmActions['confirm-cancel']();
  }
  if (e.target === $('#edit-exp-modal')) {
    $('#edit-exp-modal').hidden = true;
  }
  if (e.target === $('#edit-log-modal')) {
    $('#edit-log-modal').hidden = true;
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#confirm-modal').hidden) confirmActions['confirm-cancel']();
    if (!$('#edit-exp-modal').hidden) $('#edit-exp-modal').hidden = true;
    if (!$('#edit-log-modal').hidden) $('#edit-log-modal').hidden = true;
  }
});
