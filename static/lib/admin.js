'use strict';

const log = (...a) => console.log('[Group‑Enhancer]', ...a);

let csrfToken = null;

// Fetch CSRF token once and cache it
async function getCSRFToken() {
  if (csrfToken) return csrfToken;
  try {
    const cfg = await $.getJSON('/api/config');
    csrfToken = cfg.csrf_token;
    return csrfToken;
  } catch (err) {
    console.error('[Group‑Enhancer] Could not fetch CSRF token', err);
    return null;
  }
}

async function putGroup(slug, payload) {
  const token = await getCSRFToken();
  if (!token) {
    throw new Error('CSRF token not available');
  }

  const res = await fetch(`/api/v3/plugins/group-enhancer/groups/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const error = errBody.error || res.statusText || 'Unknown error';
    throw new Error(error);
  }

  return res.json();
}

function isEditPage(url) {
  return url.startsWith('admin/manage/groups/') && !url.endsWith('/new');
}

function inject() {
  const $form = $('.group-settings-form');
  if (!$form.length || $('#change-group-extradesc').length) return;

  log('Injecting extra inputs…');
  $form.find('#change-group-desc').closest('.mb-3').after(`
    <div class="mb-3">
      <label class="form-label" for="change-group-extradesc">Long Description</label>
      <textarea id="change-group-extradesc" name="extraDesc" class="form-control" rows="4" maxlength="2048"></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-logo">Logo image URL</label>
      <input id="change-group-logo" name="logo" class="form-control" type="text">
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-url">Website</label>
      <input id="change-group-url" name="url" class="form-control" type="url">
    </div>
    <div class="mb-3">
      <label class="form-label" for="change-group-address">Address</label>
      <input id="change-group-address" name="address" class="form-control" type="text">
    </div>
  `);

  const g = ajaxify?.data?.group || ajaxify?.data || {};
  $('#change-group-extradesc').val(g.extraDesc || '');
  $('#change-group-logo').val(g.logo || '');
  $('#change-group-url').val(g.url || '');
  $('#change-group-address').val(g.address || '');
}

function showAlertSuccess(message) {
  if (typeof app !== 'undefined' && app.alert) {
    app.alert({
      type: 'success',
      alert_id: 'group-enhancer-success',
      title: 'Success',
      message,
    });
  } else {
    alert(message);
  }
}

function showAlertError(message) {
  if (typeof app !== 'undefined' && app.alert) {
    app.alert({
      type: 'danger',
      alert_id: 'group-enhancer-error',
      title: 'Error',
      message,
    });
  } else {
    alert(`Error: ${message}`);
  }
}

function wireSaveButton(data = {}) {
  log('Wiring save button...', data);

  const $btn = $('#save');
  if (!$btn.length) {
    console.warn('[Group‑Enhancer] Save button not found');
    return;
  }

  const slug = data?.group?.slug || ajaxify?.data?.group?.slug;
  if (!slug) {
    console.warn('[Group‑Enhancer] Missing slug. ajaxify.data:', ajaxify?.data);
    showAlertError('Missing group slug!');
    return;
  }

  log('Found save button. Using slug:', slug);

  $btn.off('click.groupEnhancer').on('click.groupEnhancer', async (e) => {
    log('Save button clicked');

    e.preventDefault();
    e.stopImmediatePropagation();

    const payload = {
      // core fields
      name: $('#change-group-name').val()?.trim(),
      description: $('#change-group-desc').val()?.trim(),
      hidden: $('#group-hidden').is(':checked'),
      private: $('#group-private').is(':checked'),
      disableJoinRequests: $('#group-disableJoinRequests').is(':checked'),
      // extra fields
      extraDesc: $('#change-group-extradesc').val()?.trim(),
      logo: $('#change-group-logo').val()?.trim(),
      url: $('#change-group-url').val()?.trim(),
      address: $('#change-group-address').val()?.trim(),
    };

    log('Payload to save:', payload);

    try {
      await putGroup(slug, payload);
      log('Save success, redirecting...');
      showAlertSuccess('Group saved successfully!');
      ajaxify.go(`admin/manage/groups/${encodeURIComponent(slug)}`);
    } catch (err) {
      console.error('[Group‑Enhancer] Save error', err);
      showAlertError(err.message || 'Save failed');
    }
  });
}

function onPageLoad(_ev, data = {}) {
  const url = data.url || window.location.pathname.replace(/^\/+/, '');
  if (!isEditPage(url)) {
    log('Not on group edit page:', url);
    return;
  }

  log('On group edit page:', url);

  const wait = setInterval(() => {
    if (!$('.group-settings-form').length) return;
    clearInterval(wait);
    inject();
    wireSaveButton(data);
  }, 50);
}

onPageLoad();
$(window).on('action:ajaxify.end', onPageLoad);

log('Admin script loaded');
