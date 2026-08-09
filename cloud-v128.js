(() => {
  'use strict';

  const bridge = window.SPRITE_CLOUD_BRIDGE;
  if (!bridge?.createBackup || !bridge?.restoreBackup) return;

  const config = window.SPRITE_CLOUD_CONFIG || {};
  const scope = String(bridge.scope || 'root').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
  const SESSION_KEY = `galaxy_sprite_tracker_cloud_session_v1_${scope}`;
  const SYNC_META_KEY = `galaxy_sprite_tracker_cloud_sync_v1_${scope}`;
  const DEVICE_KEY = `galaxy_sprite_tracker_cloud_device_v1_${scope}`;
  const AUTO_SYNC_DELAY = Number.isFinite(Number(config.autoSyncDelay))
    ? Math.max(20,Math.min(10000,Number(config.autoSyncDelay)))
    : 2400;
  const tableName = /^[a-z][a-z0-9_]{0,62}$/i.test(config.saveTable || '') ? config.saveTable : 'sprite_tracker_saves';
  const baseUrl = String(config.supabaseUrl || '').trim().replace(/\/+$/,'');
  const anonKey = String(config.supabaseAnonKey || '').trim();
  const configured = /^https:\/\//i.test(baseUrl) && anonKey.length >= 20;

  let session = readJson(SESSION_KEY);
  let currentCloudRow = null;
  let autoSyncTimer = 0;
  let ignoreLocalChanges = false;
  let busy = false;
  let syncState = configured ? (session ? 'checking' : 'signed-out') : 'setup';
  let syncDetail = configured ? (session ? 'Checking cloud save…' : 'Sign in to protect progress') : 'Cloud setup needed';
  let choiceResolver = null;

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  function writeJson(key,value) {
    try {
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch { /* The in-memory session still closes. */ }
  }

  function deviceId() {
    try {
      const existing = localStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
      const id = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY,id);
      return id;
    } catch {
      return 'browser-device';
    }
  }

  function cleanSession(value) {
    if (!value || typeof value !== 'object' || !value.access_token || !value.refresh_token || !value.user?.id) return null;
    const expiresAt = Number(value.expires_at) || (Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600));
    return {
      access_token:String(value.access_token),
      refresh_token:String(value.refresh_token),
      token_type:'bearer',
      expires_at:expiresAt,
      user:{
        id:String(value.user.id),
        email:String(value.user.email || ''),
        user_metadata:value.user.user_metadata && typeof value.user.user_metadata === 'object' ? value.user.user_metadata : {}
      }
    };
  }

  session = cleanSession(session);

  function saveSession(value) {
    session = cleanSession(value);
    if (session) writeJson(SESSION_KEY,session);
    else removeStored(SESSION_KEY);
    renderAccount();
    window.dispatchEvent(new CustomEvent('sprite-cloud-session-changed',{
      detail:{ signedIn:Boolean(session),userId:String(session?.user?.id || '') }
    }));
    return session;
  }

  function syncMeta() {
    const value = readJson(SYNC_META_KEY);
    return value?.userId === session?.user?.id ? value : null;
  }

  function saveSyncMeta(row,localFingerprint) {
    const meta = {
      userId:session.user.id,
      cloudRevision:Number(row?.revision) || 0,
      cloudUpdatedAt:String(row?.updated_at || new Date().toISOString()),
      localFingerprint,
      lastSyncedAt:new Date().toISOString(),
      deviceId:deviceId()
    };
    writeJson(SYNC_META_KEY,meta);
    return meta;
  }

  async function api(path,{ method = 'GET', body = null, token = '', headers = {} } = {}) {
    if (!configured) throw new Error('Cloud setup is not complete.');
    if (navigator.onLine === false) throw new Error('You are offline. Your browser progress is still safe.');
    const response = await fetch(`${baseUrl}${path}`,{
      method,
      headers:{
        apikey:anonKey,
        ...(token ? { Authorization:`Bearer ${token}` } : {}),
        ...(body !== null ? { 'Content-Type':'application/json' } : {}),
        ...headers
      },
      body:body === null ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      let message = '';
      try {
        const payload = await response.json();
        message = payload?.msg || payload?.message || payload?.error_description || payload?.error || '';
      } catch {
        try { message = await response.text(); } catch { /* Use the status fallback. */ }
      }
      const error = new Error(String(message || `Cloud request failed (${response.status}).`).slice(0,240));
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function refreshSession(force = false) {
    if (!session) return null;
    const expiresSoon = Number(session.expires_at) <= (Math.floor(Date.now() / 1000) + 90);
    if (!force && !expiresSoon) return session;
    try {
      const refreshed = await api('/auth/v1/token?grant_type=refresh_token',{
        method:'POST',
        body:{ refresh_token:session.refresh_token }
      });
      return saveSession(refreshed);
    } catch (error) {
      if (error?.status === 400 || error?.status === 401) {
        saveSession(null);
        setSyncStatus('signed-out','Session expired · sign in again');
      }
      throw error;
    }
  }

  async function accessToken() {
    const current = await refreshSession();
    if (!current?.access_token) throw new Error('Sign in to use cloud saving.');
    return current.access_token;
  }

  async function cloudRow() {
    const token = await accessToken();
    const rows = await api(`/rest/v1/${tableName}?select=save_data,state_version,revision,updated_at,device_id&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,{
      token
    });
    currentCloudRow = Array.isArray(rows) ? rows[0] || null : null;
    return currentCloudRow;
  }

  async function writeCloudBackup(backup,row) {
    const token = await accessToken();
    const expectedRevision = Number(row?.revision) || 0;
    const nextRevision = expectedRevision + 1;
    const record = {
      save_data:backup,
      state_version:Number(backup?.version) || 4,
      revision:nextRevision,
      device_id:deviceId()
    };
    let rows;
    if (row) {
      rows = await api(`/rest/v1/${tableName}?user_id=eq.${encodeURIComponent(session.user.id)}&revision=eq.${expectedRevision}`,{
        method:'PATCH',
        token,
        headers:{ Prefer:'return=representation' },
        body:record
      });
      if (!Array.isArray(rows) || !rows.length) {
        const error = new Error('The cloud save changed on another device. Choose which progress to keep.');
        error.code = 'CLOUD_CONFLICT';
        throw error;
      }
    } else {
      rows = await api(`/rest/v1/${tableName}`,{
        method:'POST',
        token,
        headers:{ Prefer:'return=representation' },
        body:{ user_id:session.user.id,...record }
      });
    }
    currentCloudRow = Array.isArray(rows) ? rows[0] || { ...record,updated_at:new Date().toISOString() } : { ...record,updated_at:new Date().toISOString() };
    return currentCloudRow;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  async function backupFingerprint(backup) {
    const copy = JSON.parse(JSON.stringify(backup || {}));
    delete copy.exportedAt;
    const text = stableStringify(copy);
    if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2,'0')).join('');
    }
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash,16777619);
    }
    return `fallback-${(hash >>> 0).toString(16)}`;
  }

  function backupStats(backup) {
    return bridge.backupStats?.(backup) || { collected:0,mastered:0,journal:0,runs:0,dustReceipts:0 };
  }

  function statsText(backup) {
    const stats = backupStats(backup);
    return `${stats.collected || 0} collected · ${stats.mastered || 0} mastered · ${stats.journal || 0} Journal entries`;
  }

  function setSyncStatus(state,detail) {
    syncState = state;
    syncDetail = detail;
    renderAccount();
  }

  function accountMessage(message,state = '') {
    accountStatus.textContent = message || '';
    accountStatus.dataset.state = state;
  }

  function formatDate(value) {
    const date = new Date(value || '');
    if (!Number.isFinite(date.getTime())) return 'Not synced yet';
    return new Intl.DateTimeFormat(undefined,{ month:'short',day:'numeric',hour:'numeric',minute:'2-digit' }).format(date);
  }

  function setBusy(value) {
    busy = Boolean(value);
    cloudDialog.querySelectorAll('button,input').forEach((control) => {
      if (control.dataset.busyIgnore === 'true') return;
      control.disabled = busy;
    });
    cloudDialog.setAttribute('aria-busy',String(busy));
  }

  function renderAccount() {
    if (!cloudDialog) return;
    setupPanel.hidden = configured;
    signedOutPanel.hidden = !configured || Boolean(session);
    signedInPanel.hidden = !configured || !session;
    const labels = {
      setup:'Setup needed',
      'signed-out':'Local only',
      checking:'Checking…',
      syncing:'Saving…',
      synced:'Cloud protected',
      pending:'Save pending',
      attention:'Choose progress',
      offline:'Offline · local safe',
      error:'Cloud needs attention'
    };
    menuCloudStatus.textContent = labels[syncState] || 'Account & Cloud';
    menuCloudStatus.dataset.state = syncState;
    cloudStateLabel.textContent = labels[syncState] || 'Cloud status';
    cloudStateLabel.dataset.state = syncState;
    cloudStateDetail.textContent = syncDetail;
    if (session) {
      cloudAccountEmail.textContent = session.user.email || 'Signed-in account';
      const name = String(session.user.user_metadata?.display_name || '').trim();
      cloudAccountName.textContent = name || 'My Sprite Tracker account';
      const meta = syncMeta();
      cloudLastSync.textContent = meta ? `Last protected ${formatDate(meta.lastSyncedAt)}` : 'First cloud sync not completed';
    }
  }

  function showAuthMode(mode) {
    const create = mode === 'create';
    signInForm.hidden = create;
    signUpForm.hidden = !create;
    authModeButtons.forEach((button) => {
      const active = button.dataset.cloudAuthMode === (create ? 'create' : 'signin');
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    accountMessage('');
  }

  function resolveChoice(value) {
    if (!choiceResolver) return;
    const resolve = choiceResolver;
    choiceResolver = null;
    if (choiceDialog.open) choiceDialog.close();
    resolve(value);
  }

  function chooseProgress(localBackup,remoteRow) {
    choiceDeviceStats.textContent = statsText(localBackup);
    choiceCloudStats.textContent = statsText(remoteRow?.save_data);
    choiceCloudDate.textContent = `Cloud save: ${formatDate(remoteRow?.updated_at)}`;
    if (!choiceDialog.open) choiceDialog.showModal();
    return new Promise((resolve) => { choiceResolver = resolve; });
  }

  async function uploadLocalBackup(localBackup,row = currentCloudRow) {
    setSyncStatus('syncing','Protecting this device’s progress…');
    const localFingerprint = await backupFingerprint(localBackup);
    const saved = await writeCloudBackup(localBackup,row);
    saveSyncMeta(saved,localFingerprint);
    setSyncStatus('synced',`Cloud save current · revision ${Number(saved.revision) || 1}`);
    accountMessage('This device’s progress is protected in the cloud.','success');
    return saved;
  }

  async function restoreCloudBackup(row = currentCloudRow) {
    if (!row?.save_data) throw new Error('No cloud save is available for this account.');
    setSyncStatus('syncing','Restoring cloud progress safely…');
    ignoreLocalChanges = true;
    try {
      await bridge.restoreBackup(row.save_data);
    } finally {
      ignoreLocalChanges = false;
    }
    const localBackup = await bridge.createBackup();
    const localFingerprint = await backupFingerprint(localBackup);
    saveSyncMeta(row,localFingerprint);
    setSyncStatus('synced',`Cloud progress restored · revision ${Number(row.revision) || 1}`);
    accountMessage('Cloud progress restored. An undo copy was saved on this device.','success');
  }

  async function reconcile({ interactive = false } = {}) {
    if (!session || busy) return;
    if (navigator.onLine === false) {
      setSyncStatus('offline','Changes remain saved in this browser until you reconnect.');
      return;
    }
    setBusy(true);
    setSyncStatus('checking','Comparing this device with the cloud…');
    try {
      const localBackup = await bridge.createBackup();
      const localFingerprint = await backupFingerprint(localBackup);
      const row = await cloudRow();
      if (!row) {
        await uploadLocalBackup(localBackup,null);
        return;
      }
      const remoteFingerprint = await backupFingerprint(row.save_data);
      if (localFingerprint === remoteFingerprint) {
        saveSyncMeta(row,localFingerprint);
        setSyncStatus('synced',`Cloud save current · revision ${Number(row.revision) || 1}`);
        return;
      }
      const meta = syncMeta();
      const cloudUnchanged = Boolean(meta && Number(meta.cloudRevision) === Number(row.revision));
      const localUnchanged = Boolean(meta && meta.localFingerprint === localFingerprint);
      if (cloudUnchanged && !localUnchanged) {
        await uploadLocalBackup(localBackup,row);
        return;
      }
      if (!interactive) {
        setSyncStatus('attention',localUnchanged ? 'New cloud progress is available.' : 'This device and the cloud both have progress.');
        return;
      }
      setBusy(false);
      const choice = await chooseProgress(localBackup,row);
      setBusy(true);
      if (choice === 'device') await uploadLocalBackup(localBackup,row);
      else if (choice === 'cloud') await restoreCloudBackup(row);
      else setSyncStatus('attention','No progress was replaced. Choose when you are ready.');
    } catch (error) {
      if (error?.code === 'CLOUD_CONFLICT') {
        setSyncStatus('attention',error.message);
      } else if (navigator.onLine === false) {
        setSyncStatus('offline','Changes remain saved in this browser until you reconnect.');
      } else {
        setSyncStatus('error',error?.message || 'Cloud saving could not be completed.');
        accountMessage(error?.message || 'Cloud saving could not be completed.','error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (!configured || busy) return;
    accountMessage('Signing in…');
    setBusy(true);
    try {
      const result = await api('/auth/v1/token?grant_type=password',{
        method:'POST',
        body:{ email:signInEmail.value.trim(),password:signInPassword.value }
      });
      if (!saveSession(result)) throw new Error('The account session could not be started.');
      signInForm.reset();
      accountMessage('Signed in. Checking your saved progress…','success');
      setBusy(false);
      await reconcile({ interactive:true });
    } catch (error) {
      accountMessage(error?.message || 'Sign in failed.','error');
      setSyncStatus('signed-out','Sign in to protect progress');
    } finally {
      setBusy(false);
    }
  }

  async function signUp(event) {
    event.preventDefault();
    if (!configured || busy) return;
    accountMessage('Creating account…');
    setBusy(true);
    try {
      const result = await api('/auth/v1/signup',{
        method:'POST',
        body:{
          email:signUpEmail.value.trim(),
          password:signUpPassword.value,
          data:{ display_name:signUpName.value.trim().slice(0,50) }
        }
      });
      if (result?.access_token && saveSession(result)) {
        signUpForm.reset();
        accountMessage('Account created. Checking your progress…','success');
        setBusy(false);
        await reconcile({ interactive:true });
      } else {
        accountMessage('Account created. Check your email, then return here to sign in.','success');
        showAuthMode('signin');
      }
    } catch (error) {
      accountMessage(error?.message || 'The account could not be created.','error');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    const token = session?.access_token || '';
    try {
      if (token && navigator.onLine !== false) await api('/auth/v1/logout',{ method:'POST',token });
    } catch {
      /* Local sign-out still completes if the network request fails. */
    }
    saveSession(null);
    currentCloudRow = null;
    setSyncStatus('signed-out','Browser progress remains on this device');
    accountMessage('Signed out. Nothing was deleted from this browser.','success');
    setBusy(false);
  }

  function openCloudDialog() {
    document.getElementById('appMenuDialog')?.close();
    document.documentElement.classList.add('cloud-dialog-open');
    document.body.classList.add('cloud-dialog-open');
    accountMessage('');
    renderAccount();
    if (!cloudDialog.open) cloudDialog.showModal();
    if (session && configured) reconcile({ interactive:false });
  }

  function closeCloudDialog() {
    if (cloudDialog.open) cloudDialog.close();
  }

  function scheduleAutoSync() {
    window.clearTimeout(autoSyncTimer);
    if (!session || !configured || ignoreLocalChanges) return;
    setSyncStatus(navigator.onLine === false ? 'offline' : 'pending',navigator.onLine === false
      ? 'Saved in this browser · waiting for internet'
      : 'Browser progress saved · cloud update pending');
    autoSyncTimer = window.setTimeout(() => reconcile({ interactive:false }),AUTO_SYNC_DELAY);
  }

  const menuButton = document.createElement('button');
  menuButton.className = 'app-menu-item cloud-menu-item';
  menuButton.id = 'accountCloudMenuBtn';
  menuButton.type = 'button';
  menuButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M17.7 18.5H8.1a5.6 5.6 0 0 1-.7-11.2A6.5 6.5 0 0 1 19.7 9.7a4.5 4.5 0 0 1-2 8.8Z"></path>
      <path d="M12.5 10.5v5M10.3 12.7l2.2-2.2 2.2 2.2"></path>
    </svg>
    <span><strong>Account &amp; Cloud</strong><small id="menuCloudStatus">Local only</small></span>`;
  document.querySelector('.app-menu-nav')?.appendChild(menuButton);

  const cloudDialog = document.createElement('dialog');
  cloudDialog.className = 'cloud-account-dialog';
  cloudDialog.id = 'cloudAccountDialog';
  cloudDialog.setAttribute('aria-labelledby','cloudAccountTitle');
  cloudDialog.innerHTML = `
    <div class="cloud-account-panel">
      <header class="cloud-account-head">
        <div><span>PRIVATE SYNC</span><h2 id="cloudAccountTitle" tabindex="-1">Account &amp; Cloud</h2></div>
        <button class="cloud-close-button" id="closeCloudAccountBtn" type="button" aria-label="Close Account and Cloud">×</button>
      </header>
      <section class="cloud-setup-panel" id="cloudSetupPanel" hidden>
        <strong>Cloud setup needed</strong>
        <p>Add your Supabase Project URL and publishable anon key to <code>cloud-config-v128.js</code>. The tracker will keep saving normally in this browser until setup is finished.</p>
      </section>
      <section class="cloud-signed-out" id="cloudSignedOut">
        <div class="cloud-auth-tabs" role="group" aria-label="Account action">
          <button class="is-active" type="button" data-cloud-auth-mode="signin" aria-pressed="true">Sign in</button>
          <button type="button" data-cloud-auth-mode="create" aria-pressed="false">Create account</button>
        </div>
        <form class="cloud-auth-form" id="cloudSignInForm">
          <label>Email<input id="cloudSignInEmail" type="email" autocomplete="email" required></label>
          <label>Password<input id="cloudSignInPassword" type="password" autocomplete="current-password" minlength="8" required></label>
          <button class="cloud-primary-button" type="submit">Sign in</button>
        </form>
        <form class="cloud-auth-form" id="cloudSignUpForm" hidden>
          <label>Display name<input id="cloudSignUpName" type="text" autocomplete="name" maxlength="50" placeholder="Optional"></label>
          <label>Email<input id="cloudSignUpEmail" type="email" autocomplete="email" required></label>
          <label>Password<input id="cloudSignUpPassword" type="password" autocomplete="new-password" minlength="8" required></label>
          <small>Use at least 8 characters. Your existing browser progress will not be replaced without asking.</small>
          <button class="cloud-primary-button" type="submit">Create account</button>
        </form>
      </section>
      <section class="cloud-signed-in" id="cloudSignedIn" hidden>
        <article class="cloud-profile-card">
          <span class="cloud-profile-icon" aria-hidden="true">✓</span>
          <div><strong id="cloudAccountName">My Sprite Tracker account</strong><small id="cloudAccountEmail"></small></div>
        </article>
        <article class="cloud-state-card">
          <div><strong id="cloudStateLabel">Checking…</strong><span id="cloudStateDetail">Checking cloud save…</span></div>
          <small id="cloudLastSync">First cloud sync not completed</small>
        </article>
        <div class="cloud-account-actions">
          <button id="openSpriteProfileBtn" type="button">Open profile</button>
          <button class="cloud-primary-button" id="syncCloudNowBtn" type="button">Sync now</button>
          <button id="restoreCloudBtn" type="button">Compare progress</button>
          <button class="cloud-sign-out-button" id="cloudSignOutBtn" type="button">Sign out</button>
        </div>
        <p class="cloud-local-note">Browser saving and manual backups stay active even while signed in.</p>
      </section>
      <p class="cloud-account-status" id="cloudAccountStatus" role="status" aria-live="polite"></p>
    </div>`;
  document.body.appendChild(cloudDialog);

  const choiceDialog = document.createElement('dialog');
  choiceDialog.className = 'cloud-choice-dialog';
  choiceDialog.id = 'cloudChoiceDialog';
  choiceDialog.setAttribute('aria-labelledby','cloudChoiceTitle');
  choiceDialog.innerHTML = `
    <div class="cloud-choice-panel">
      <span>SAFE FIRST SYNC</span>
      <h2 id="cloudChoiceTitle" tabindex="-1">Choose your progress</h2>
      <p>Nothing will be overwritten until you choose.</p>
      <div class="cloud-choice-grid">
        <article><strong>This device</strong><span id="choiceDeviceStats"></span><button id="chooseDeviceProgressBtn" type="button">Keep this device</button></article>
        <article><strong>Cloud save</strong><span id="choiceCloudStats"></span><small id="choiceCloudDate"></small><button id="chooseCloudProgressBtn" type="button">Use cloud save</button></article>
      </div>
      <button class="cloud-choice-cancel" id="cancelCloudChoiceBtn" type="button">Cancel</button>
    </div>`;
  document.body.appendChild(choiceDialog);

  const setupPanel = document.getElementById('cloudSetupPanel');
  const signedOutPanel = document.getElementById('cloudSignedOut');
  const signedInPanel = document.getElementById('cloudSignedIn');
  const menuCloudStatus = document.getElementById('menuCloudStatus');
  const cloudStateLabel = document.getElementById('cloudStateLabel');
  const cloudStateDetail = document.getElementById('cloudStateDetail');
  const cloudLastSync = document.getElementById('cloudLastSync');
  const cloudAccountEmail = document.getElementById('cloudAccountEmail');
  const cloudAccountName = document.getElementById('cloudAccountName');
  const accountStatus = document.getElementById('cloudAccountStatus');
  const signInForm = document.getElementById('cloudSignInForm');
  const signUpForm = document.getElementById('cloudSignUpForm');
  const signInEmail = document.getElementById('cloudSignInEmail');
  const signInPassword = document.getElementById('cloudSignInPassword');
  const signUpName = document.getElementById('cloudSignUpName');
  const signUpEmail = document.getElementById('cloudSignUpEmail');
  const signUpPassword = document.getElementById('cloudSignUpPassword');
  const authModeButtons = [...cloudDialog.querySelectorAll('[data-cloud-auth-mode]')];
  const choiceDeviceStats = document.getElementById('choiceDeviceStats');
  const choiceCloudStats = document.getElementById('choiceCloudStats');
  const choiceCloudDate = document.getElementById('choiceCloudDate');

  menuButton.addEventListener('click',openCloudDialog);
  document.getElementById('closeCloudAccountBtn').addEventListener('click',closeCloudDialog);
  cloudDialog.addEventListener('close',() => {
    document.documentElement.classList.remove('cloud-dialog-open');
    document.body.classList.remove('cloud-dialog-open');
  });
  cloudDialog.addEventListener('click',(event) => { if (event.target === cloudDialog) closeCloudDialog(); });
  authModeButtons.forEach((button) => button.addEventListener('click',() => showAuthMode(button.dataset.cloudAuthMode)));
  signInForm.addEventListener('submit',signIn);
  signUpForm.addEventListener('submit',signUp);
  document.getElementById('syncCloudNowBtn').addEventListener('click',() => reconcile({ interactive:true }));
  document.getElementById('restoreCloudBtn').addEventListener('click',() => reconcile({ interactive:true }));
  document.getElementById('openSpriteProfileBtn').addEventListener('click',() => {
    closeCloudDialog();
    location.hash = '#profile';
  });
  document.getElementById('cloudSignOutBtn').addEventListener('click',signOut);
  document.getElementById('chooseDeviceProgressBtn').addEventListener('click',() => resolveChoice('device'));
  document.getElementById('chooseCloudProgressBtn').addEventListener('click',() => resolveChoice('cloud'));
  document.getElementById('cancelCloudChoiceBtn').addEventListener('click',() => resolveChoice('cancel'));
  choiceDialog.addEventListener('cancel',(event) => { event.preventDefault();resolveChoice('cancel'); });
  choiceDialog.addEventListener('close',() => {
    if (choiceResolver) resolveChoice('cancel');
  });
  window.addEventListener('sprite-local-save-changed',() => {
    if (!ignoreLocalChanges) scheduleAutoSync();
  });
  window.addEventListener('online',() => {
    if (session) scheduleAutoSync();
  });
  window.addEventListener('offline',() => {
    if (session) setSyncStatus('offline','Changes remain saved in this browser until you reconnect.');
  });

  window.SPRITE_ACCOUNT_BRIDGE = Object.freeze({
    version:1,
    configured:() => configured,
    session:() => session ? JSON.parse(JSON.stringify(session)) : null,
    accessToken,
    request:api,
    openAccount:openCloudDialog
  });

  window.dispatchEvent(new Event('sprite-account-bridge-ready'));
  renderAccount();
  if (session && configured) {
    window.setTimeout(() => reconcile({ interactive:false }),250);
  }
})();
