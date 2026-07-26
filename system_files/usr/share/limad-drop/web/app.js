const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');
const toastBox = $('#toast');

let adminToken = '';
let deviceToken = localStorage.getItem('limadDropDeviceToken') || '';
let state = null;
let refreshTimer = null;
let lastPairToken = '';
let activeTransferController = null;
let refreshFailures = 0;
let activeView = 'send';
const pairFromUrl = new URLSearchParams(location.search).get('pair') || '';

if (location.hash.startsWith('#admin=')) {
  adminToken = decodeURIComponent(location.hash.slice(7));
  history.replaceState(null, '', location.pathname);
}

const fmt = (value) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let amount = Number(value) || 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmtRate = (value) => `${fmt(value)}/s`;
const fmtEta = (seconds) => !Number.isFinite(seconds) || seconds < 0
  ? '–'
  : seconds < 60
    ? `${Math.ceil(seconds)} Sek.`
    : `${Math.floor(seconds / 60)} Min. ${Math.ceil(seconds % 60)} Sek.`;

function toast(message, bad = false) {
  toastBox.textContent = message;
  toastBox.classList.toggle('error', bad);
  toastBox.classList.add('show');
  setTimeout(() => toastBox.classList.remove('show'), 2800);
}

function authHeaders(extra = {}) {
  const headers = new Headers(extra);
  if (adminToken) headers.set('X-LiMaD-Admin', adminToken);
  else if (deviceToken) headers.set('Authorization', `Bearer ${deviceToken}`);
  return headers;
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const retries = options.retries ?? (method === 'GET' ? 2 : 0);
  const headers = authHeaders(options.headers || {});
  const request = { ...options, method, headers };
  delete request.json;
  delete request.retries;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    request.body = JSON.stringify(options.json);
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let timeoutController = null;
    let timeoutId = null;
    try {
      if (!request.signal && method === 'GET') {
        timeoutController = new AbortController();
        request.signal = timeoutController.signal;
        timeoutId = setTimeout(() => timeoutController.abort(), 9000);
      }
      const response = await fetch(path, request);
      if (timeoutId) clearTimeout(timeoutId);
      const type = response.headers.get('content-type') || '';
      const data = type.includes('json') ? await response.json() : await response.blob();
      if (!response.ok) {
        const error = new Error(data?.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = error;
      if (options.signal?.aborted || error?.name === 'AbortError' && options.signal) throw error;
      const retryable = error instanceof TypeError || error?.name === 'AbortError' || [408, 429, 502, 503, 504].includes(error?.status);
      if (!retryable || attempt >= retries) throw error;
      await sleep(Math.min(3200, 350 * (2 ** attempt)) + Math.random() * 180);
      if (timeoutController) delete request.signal;
    }
  }
  throw lastError || new Error('Netzwerkfehler');
}

function progressMarkup() {
  return `<div id="uploadProgress" class="transfer-progress hidden">
    <div class="progress-head">
      <div><strong data-progress-title>Übertragung wird vorbereitet …</strong><span data-progress-state>Startet sofort</span></div>
      <b data-progress-percent>0%</b>
    </div>
    <div class="progress"><span></span></div>
    <div class="progress-details"><span data-progress-bytes>0 B von 0 B</span><span data-progress-rate>0 B/s</span><span data-progress-eta>Restzeit –</span></div>
    <button type="button" class="progress-cancel" data-progress-cancel>Abbrechen</button>
  </div>`;
}

function setProgress(box, info) {
  if (!box) return;
  box.classList.remove('hidden');
  const total = Math.max(0, Number(info.total) || 0);
  const received = Math.max(0, Number(info.received) || 0);
  const percent = total ? Math.min(100, received / total * 100) : 0;
  const labels = {
    preparing: 'Wird vorbereitet …', uploading: 'Wird übertragen …', downloading: 'Wird heruntergeladen …',
    verifying: 'Prüfsumme wird kontrolliert …', done: 'Übertragung abgeschlossen',
    cancelled: 'Übertragung abgebrochen', error: 'Übertragung fehlgeschlagen'
  };
  $('[data-progress-title]', box).textContent = info.file || 'Dateiübertragung';
  $('[data-progress-state]', box).textContent = labels[info.phase] || info.phase || '';
  $('[data-progress-percent]', box).textContent = `${Math.round(percent)}%`;
  $('[data-progress-bytes]', box).textContent = `${fmt(received)} von ${fmt(total)}`;
  $('[data-progress-rate]', box).textContent = info.rate ? fmtRate(info.rate) : '0 B/s';
  $('[data-progress-eta]', box).textContent = `Restzeit ${info.eta === undefined ? '–' : fmtEta(info.eta)}`;
  $('.progress span', box).style.width = `${percent}%`;
  box.dataset.phase = info.phase || '';
  const cancel = $('[data-progress-cancel]', box);
  cancel.disabled = ['done', 'error', 'cancelled'].includes(info.phase);
  cancel.textContent = info.phase === 'verifying' ? 'Prüfung läuft …' : 'Abbrechen';
}

function busyUi(busy) {
  const pick = $('#pick');
  const drop = $('#dropzone');
  if (pick) {
    pick.disabled = busy;
    pick.textContent = busy ? 'Übertragung läuft …' : 'Dateien auswählen';
  }
  if (drop) drop.classList.toggle('busy', busy);
}

async function uploadFile(file, direction, deviceId = '', onProgress = () => {}, signal) {
  onProgress({ phase: 'preparing', file: file.name, received: 0, total: file.size, rate: 0 });
  let transfer = await api('/api/upload/init', {
    method: 'POST', signal,
    json: { direction, deviceId, name: file.name, size: file.size, lastModified: file.lastModified }
  });
  let offset = Number(transfer.received) || 0;
  const chunkSize = file.size <= 32 * 1024 * 1024 ? 256 * 1024 : 512 * 1024;
  const started = performance.now();
  const initial = offset;
  onProgress({ phase: 'uploading', file: file.name, received: offset, total: file.size, rate: 0 });

  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Übertragung abgebrochen', 'AbortError');
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    let attempts = 0;
    while (true) {
      try {
        const result = await api(`/api/upload/${transfer.id}?offset=${offset}`, {
          method: 'PUT', body: chunk, signal, headers: { 'Content-Type': 'application/octet-stream' }
        });
        offset = Number(result.received) || end;
        break;
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error;
        attempts += 1;
        if (attempts >= 8) throw error;
        await sleep(Math.min(5000, 400 * (2 ** (attempts - 1))) + Math.random() * 220);
        transfer = await api('/api/upload/init', {
          method: 'POST', signal,
          json: { direction, deviceId, name: file.name, size: file.size, lastModified: file.lastModified }
        });
        offset = Number(transfer.received) || 0;
        if (offset >= end) break;
      }
    }
    const elapsed = Math.max(.25, (performance.now() - started) / 1000);
    const rate = Math.max(0, (offset - initial) / elapsed);
    const remaining = Math.max(0, file.size - offset);
    onProgress({ phase: 'uploading', file: file.name, received: offset, total: file.size, rate, eta: rate ? remaining / rate : undefined });
  }

  onProgress({ phase: 'verifying', file: file.name, received: file.size, total: file.size, rate: 0 });
  await api(`/api/upload/${transfer.id}/complete`, { method: 'POST', signal });
  onProgress({ phase: 'done', file: file.name, received: file.size, total: file.size, rate: 0, eta: 0 });
  return transfer.id;
}

async function runUploadQueue(files, direction, deviceId, after) {
  if (!files.length || activeTransferController) return;
  const box = $('#uploadProgress');
  activeTransferController = new AbortController();
  const controller = activeTransferController;
  busyUi(true);
  $('[data-progress-cancel]', box).onclick = () => controller.abort();
  try {
    for (const file of files) {
      await uploadFile(file, direction, deviceId, (info) => setProgress(box, info), controller.signal);
      toast(`${file.name} wurde vollständig übertragen.`);
      await sleep(450);
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      setProgress(box, { phase: 'cancelled', file: 'Übertragung', received: 0, total: 0 });
      toast('Übertragung wurde abgebrochen.');
    } else {
      setProgress(box, { phase: 'error', file: 'Übertragung', received: 0, total: 0 });
      toast(error.message || String(error), true);
    }
  } finally {
    activeTransferController = null;
    busyUi(false);
    const input = $('#files');
    if (input) input.value = '';
    await after(false);
    setTimeout(() => {
      if (!activeTransferController) box?.classList.add('hidden');
    }, 1800);
  }
}

function topbar(sub = 'Direkt im lokalen WLAN') {
  return `<div class="topbar"><div class="brand"><div class="brand-mark">⇅</div><div><h1>LiDrop</h1><p>${esc(sub)}</p></div></div><div class="status"><span class="dot"></span><span>Netzwerk verbunden</span></div></div>`;
}

function adminView() {
  app.innerHTML = `<div class="desktop-shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">⇅</div><div><h1>LiDrop</h1><small>0.11.0-preview4</small></div></div>
      <nav class="top-tabs" aria-label="Bereiche">
        <button class="active" data-view="send">Senden</button>
        <button data-view="receive">Empfangen</button>
      </nav>
      <div class="top-actions">
        <div id="networkStatus" class="network-pill"><span class="dot"></span><span>Verbunden</span></div>
        <button id="settingsBtn" class="icon-btn ghost" title="Einstellungen">⚙</button>
        <button id="moreBtn" class="icon-btn ghost" title="Verlauf öffnen">⋯</button>
      </div>
    </header>

    <div class="workspace">
      <main class="content">
        <section id="sendView" class="view">
          <div class="view-heading">
            <div><h2>Dateien senden</h2><p>Zielgerät wählen und Dateien ablegen.</p></div>
            <div class="target-wrap"><select id="target"><option value="">Zielgerät auswählen</option></select></div>
          </div>
          <div id="dropzone" class="dropzone">
            <div class="drop-icon">⇧</div>
            <strong>Dateien hier ablegen</strong>
            <span>oder zum Auswählen klicken</span>
            <button id="pick" class="primary">Dateien auswählen</button>
            <input id="files" class="hidden" type="file" multiple>
            <div class="drop-notes"><span>⌁ Schnell & sicher</span><span>⌁ Direkt im lokalen Netzwerk</span><span>⌁ Keine Cloud</span></div>
          </div>
          ${progressMarkup()}
        </section>

        <section id="receiveView" class="view hidden">
          <div class="view-heading"><div><h2>Empfangen</h2><p>Laufende, wartende und abgeschlossene Übertragungen.</p></div></div>
          <div class="receive-grid">
            <section class="receive-section"><div class="section-title"><h3>Eingehende Dateien</h3><button id="clearFailedBtn" class="ghost compact-action">Abgebrochene löschen</button></div><p>Unbekannte Geräte benötigen eine Bestätigung.</p><div id="incoming" class="list"></div></section>
            <section class="receive-section"><h3>Bereit zum Senden</h3><p>Dateien aus dem Dateimanager einem Zielgerät zuordnen.</p><div id="outgoing" class="list"></div></section>
            <section class="receive-section"><div class="section-title"><h3>Verlauf</h3><button id="clearHistoryBtn" class="ghost compact-action">Verlauf leeren</button></div><p>Kürzlich abgeschlossene Übertragungen.</p><div id="history" class="list"></div></section>
          </div>
        </section>
      </main>

      <aside class="right-rail">
        <section class="rail-section">
          <div class="this-device"><div class="device-icon">▣</div><div><span>Dieses Gerät</span><strong id="localDeviceName">LiMaD-PC</strong><span id="localAddress">Adresse wird geladen …</span></div></div>
        </section>
        <section class="rail-section">
          <div class="section-title"><h3>Verbundene Geräte</h3><div class="section-tools"><button id="clearOfflineBtn" class="ghost compact-action" title="Nicht erreichbare Geräte entfernen">Offline löschen</button><button id="refreshBtn" class="ghost" title="Aktualisieren">↻</button></div></div>
          <div id="connectedDevices" class="device-list"></div>
          <button id="pairBtn" class="connect-button">＋ Neues Gerät verbinden</button>
        </section>
        <section class="rail-section">
          <div class="section-title"><h3>Übertragungen</h3><button id="showReceiveBtn" class="ghost">Alle anzeigen</button></div>
          <div id="railTransfers" class="transfer-list"></div>
        </section>
      </aside>
    </div>

    <footer class="footerbar"><span>LiDrop 0.11.0-preview4</span><span class="secure">◇ Lokale Direktübertragung · Wiederaufnahme aktiv</span><button id="footerHistory" class="ghost">◷ Verlauf öffnen</button></footer>

    <dialog id="pairDialog" class="modal">
      <div class="modal-head"><h2>Neues Gerät verbinden</h2><button class="close-btn ghost" data-close-dialog="pairDialog">×</button></div>
      <div class="modal-body">
        <div class="pairing"><img id="qr" class="qr" alt="LiDrop QR-Code"><div><div id="pairCode" class="code">------</div><div id="address" class="address"></div><p class="fine">QR-Code scannen oder den sechsstelligen Code eingeben. Gültig für fünf Minuten.</p><div class="ready-line"><b>✓</b><span>Bereit zum Verbinden</span></div></div></div>
      </div>
    </dialog>

    <dialog id="settingsDialog" class="modal">
      <div class="modal-head"><h2>Einstellungen</h2><button class="close-btn ghost" data-close-dialog="settingsDialog">×</button></div>
      <div class="modal-body settings-grid">
        <section class="settings-block"><h3>Vertrauenswürdige Geräte</h3><p>Automatische Annahme ist nur für ausdrücklich freigegebene Geräte möglich.</p><div id="devices" class="list"></div></section>
        <section class="settings-block"><div class="section-title"><h3>AirDrop-Kompatibilität</h3><button id="airdropRecheck" class="ghost">Neu prüfen</button></div><p>Der Modus wird nur freigeschaltet, wenn WLAN, Bluetooth, aktiver Monitor-Modus, AWDL/OWL und OpenDrop wirklich vorhanden sind.</p><div id="airdropState" class="airdrop-state"></div><div class="airdrop-controls"><label class="toggle-row"><span class="switch"><input id="airdropEnabled" type="checkbox"><span class="slider"></span></span><span>AirDrop aktivieren</span></label><select id="airdropVisibility"><option value="off">Aus</option><option value="contacts" disabled>Nur bekannte Geräte · noch nicht verfügbar</option><option value="everyone10">Für alle · 10 Minuten</option></select><button id="airdropApply">Übernehmen</button></div></section>
      </div>
    </dialog>
  </div>`;
  bindAdmin();
  refreshAdmin(false);
}

function bindAdmin() {
  const input = $('#files');
  const drop = $('#dropzone');
  $('#pick').onclick = () => { if (!activeTransferController) input.click(); };
  drop.onclick = (event) => {
    if (event.target.closest('button')) return;
    if (!activeTransferController) input.click();
  };
  input.onchange = () => sendFiles([...input.files]);
  ['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => {
    event.preventDefault();
    if (!activeTransferController) drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.remove('drag');
  }));
  drop.addEventListener('drop', (event) => {
    if (!activeTransferController) sendFiles([...event.dataTransfer.files]);
  });

  $$('[data-view]').forEach((button) => button.onclick = () => setView(button.dataset.view));
  $('#showReceiveBtn').onclick = () => setView('receive');
  $('#footerHistory').onclick = () => setView('receive');
  $('#moreBtn').onclick = () => setView('receive');
  $('#pairBtn').onclick = () => $('#pairDialog').showModal();
  $('#settingsBtn').onclick = () => $('#settingsDialog').showModal();
  $('#refreshBtn').onclick = () => refreshAdmin(false);
  $('#clearOfflineBtn').onclick = () => bulkDeleteDevices('offline');
  $('#clearFailedBtn').onclick = () => bulkDeleteTransfers('failed');
  $('#clearHistoryBtn').onclick = () => bulkDeleteTransfers('finished');
  $$('[data-close-dialog]').forEach((button) => button.onclick = () => $(`#${button.dataset.closeDialog}`).close());
  $('#airdropApply').onclick = applyAirDrop;
  $('#airdropRecheck').onclick = async () => {
    const button = $('#airdropRecheck');
    button.disabled = true;
    try {
      const result = await api('/api/admin/airdrop', {
        method: 'POST',
        json: { enabled: $('#airdropEnabled').checked, visibility: $('#airdropVisibility').value }
      });
      renderAirDrop(result.airdrop);
      toast('AirDrop-Voraussetzungen wurden neu geprüft.');
    } catch (error) {
      toast(error.message, true);
    } finally {
      button.disabled = false;
    }
  };
}

function setView(view) {
  activeView = view === 'receive' ? 'receive' : 'send';
  $('#sendView').classList.toggle('hidden', activeView !== 'send');
  $('#receiveView').classList.toggle('hidden', activeView !== 'receive');
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === activeView));
}

async function sendFiles(files) {
  const target = $('#target').value;
  if (!target) return toast('Bitte zuerst ein Zielgerät auswählen.', true);
  await runUploadQueue(files, 'outbound', target, refreshAdmin);
}

function scheduleRefresh(delay) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAdmin(true), delay);
}

function markNetwork(ok) {
  const pill = $('#networkStatus');
  if (!pill) return;
  pill.classList.toggle('offline', !ok);
  $('span:last-child', pill).textContent = ok ? 'Verbunden' : 'Verbindung wird wiederhergestellt';
}

async function refreshAdmin(silent = true) {
  try {
    const next = await api('/api/admin/state');
    state = next;
    refreshFailures = 0;
    markNetwork(true);
    renderAdmin(next);
    if (next.pairing.token !== lastPairToken) {
      lastPairToken = next.pairing.token;
      const qr = await api('/api/admin/qr');
      const image = $('#qr');
      const old = image.src;
      if (old.startsWith('blob:')) URL.revokeObjectURL(old);
      image.src = URL.createObjectURL(qr);
    }
  } catch (error) {
    refreshFailures += 1;
    markNetwork(false);
    if (!silent || refreshFailures === 1) toast('Verbindung unterbrochen – LiDrop verbindet sich automatisch neu.', true);
  } finally {
    const delay = refreshFailures ? Math.min(15000, 1200 * (2 ** Math.min(refreshFailures, 4))) : 1400;
    scheduleRefresh(delay);
  }
}

function transferProgress(transfer) {
  if (transfer.status !== 'uploading') return '';
  const percent = transfer.size ? Math.min(100, (Number(transfer.received) || 0) / transfer.size * 100) : 0;
  return `<div class="inline-progress"><div class="progress"><span style="width:${percent}%"></span></div><span>${Math.round(percent)}% · ${fmt(transfer.received)} von ${fmt(transfer.size)}</span></div>`;
}

function renderAirDrop(airdrop) {
  const box = $('#airdropState');
  const enabled = $('#airdropEnabled');
  const visibility = $('#airdropVisibility');
  const apply = $('#airdropApply');
  if (!box) return;
  const available = Boolean(airdrop.available);
  enabled.checked = available && Boolean(airdrop.enabled);
  enabled.disabled = !available;
  visibility.value = available ? (airdrop.visibility || 'off') : 'off';
  visibility.disabled = !available || !enabled.checked;
  apply.disabled = !available;
  enabled.onchange = () => {
    visibility.disabled = !enabled.checked;
    if (!enabled.checked) visibility.value = 'off';
  };
  const checks = [
    ['WLAN', airdrop.wifi],
    ['Bluetooth', airdrop.bluetooth],
    ['Monitor-Modus', airdrop.monitor],
    ['AWDL / OWL', airdrop.awdl],
    ['OpenDrop', airdrop.backend === 'ready']
  ];
  const hardware = [
    airdrop.interface ? `Schnittstelle: ${airdrop.interface}` : '',
    airdrop.driver ? `Treiber: ${airdrop.driver}` : '',
    airdrop.adapter ? airdrop.adapter : ''
  ].filter(Boolean);
  box.innerHTML = `<div class="airdrop-badge ${available ? 'ready' : 'preview'}">${available ? 'Technisch bereit' : 'Noch nicht aktivierbar'}</div><p>${esc(airdrop.message || 'Status wird geprüft …')}</p><div class="airdrop-checks">${checks.map(([name, ok]) => `<span class="${ok ? 'ok' : ''}">${ok ? '✓' : '×'} ${name}</span>`).join('')}</div>${hardware.length ? `<div class="airdrop-details">${hardware.map((line) => `<span>${esc(line)}</span>`).join('')}</div>` : ''}`;
}

async function applyAirDrop() {
  const button = $('#airdropApply');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await api('/api/admin/airdrop', {
      method: 'POST',
      json: { enabled: $('#airdropEnabled').checked, visibility: $('#airdropVisibility').value }
    });
    renderAirDrop(result.airdrop);
    toast(result.airdrop.available ? 'AirDrop-Einstellung wurde übernommen.' : 'AirDrop-Backend ist nicht verfügbar.', !result.airdrop.available);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function isRecentlySeen(device) {
  const stamp = Date.parse(device.last_seen);
  return Number.isFinite(stamp) && Date.now() - stamp < 45000;
}

function compactDevice(device) {
  const online = isRecentlySeen(device);
  return `<div class="device-row"><div class="device-icon" style="width:38px;height:38px;font-size:18px">▯</div><div class="device-copy"><strong>${esc(device.name)}</strong><span>${online ? 'Direkt erreichbar' : 'Bekanntes Gerät'}</span></div><div class="device-state ${online ? '' : 'known'}"><span class="mini-dot"></span>${online ? 'Verbunden' : 'Offline'}</div><button class="row-delete ghost" data-remove-device="${device.id}" title="Gerät entfernen">×</button></div>`;
}

function railTransfer(transfer) {
  const good = ['accepted', 'downloaded'].includes(transfer.status);
  const bad = ['rejected', 'revoked', 'error', 'cancelled'].includes(transfer.status);
  return `<div class="transfer-row"><div class="file-icon">▤</div><div class="transfer-copy"><div class="item-title">${esc(transfer.filename)}</div><div class="item-meta">${fmt(transfer.size)} · ${esc(transfer.device_name || 'LiMaD-PC')}</div>${transferProgress(transfer)}</div><span class="status-text ${good ? 'good' : bad ? 'bad' : ''}">${statusLabel(transfer.status)}</span><button class="row-delete ghost" data-delete-transfer="${transfer.id}" title="Übertragung entfernen">×</button></div>`;
}

function renderAdmin(current) {
  renderAirDrop(current.airdrop || {});
  $('#pairCode').textContent = `${current.pairing.code.slice(0, 3)} ${current.pairing.code.slice(3)}`;
  $('#address').textContent = current.pairing.address;
  $('#localDeviceName').textContent = current.hostname || 'LiMaD-PC';
  try { $('#localAddress').textContent = new URL(current.pairing.address).hostname; }
  catch { $('#localAddress').textContent = current.pairing.address; }

  const target = $('#target');
  const selected = target.value;
  target.innerHTML = '<option value="">Zielgerät auswählen</option>' + current.devices.map((device) => `<option value="${device.id}">${esc(device.name)}</option>`).join('');
  target.value = current.devices.some((device) => device.id === selected) ? selected : '';

  const sortedDevices = [...current.devices].sort((a, b) => Number(isRecentlySeen(b)) - Number(isRecentlySeen(a)) || String(b.last_seen).localeCompare(String(a.last_seen)));
  $('#connectedDevices').innerHTML = sortedDevices.length ? sortedDevices.slice(0, 5).map(compactDevice).join('') : '<div class="empty">Noch kein Gerät verbunden.</div>';

  $('#devices').innerHTML = current.devices.length ? current.devices.map(deviceCard).join('') : '<div class="empty">Noch kein Gerät gekoppelt.</div>';
  $$('[data-device]').forEach(bindDevice);

  const incoming = current.transfers.filter((transfer) => transfer.direction === 'inbound' && ['uploading', 'pending'].includes(transfer.status));
  $('#incoming').innerHTML = incoming.length ? incoming.map((transfer) => transferCard(transfer, transfer.status === 'pending')).join('') : '<div class="empty">Keine laufende oder wartende Übertragung.</div>';
  $$('[data-accept]').forEach((button) => button.onclick = () => transferAction(button.dataset.accept, 'accept'));
  $$('[data-reject]').forEach((button) => button.onclick = () => transferAction(button.dataset.reject, 'reject'));

  const outgoing = current.transfers.filter((transfer) => transfer.direction === 'outbound' && ['draft', 'ready'].includes(transfer.status));
  $('#outgoing').innerHTML = outgoing.length ? outgoing.map(outgoingCard).join('') : '<div class="empty">Keine Datei vorgemerkt.</div>';
  $$('[data-target-transfer]').forEach((select) => select.onchange = () => setTarget(select.dataset.targetTransfer, select.value));

  const history = current.transfers.filter((transfer) => !['uploading', 'pending', 'draft', 'ready'].includes(transfer.status)).slice(0, 16);
  $('#history').innerHTML = history.length ? history.map((transfer) => transferCard(transfer, false)).join('') : '<div class="empty">Noch keine abgeschlossene Übertragung.</div>';

  const rail = current.transfers.filter((transfer) => ['uploading', 'pending', 'draft', 'ready'].includes(transfer.status)).slice(0, 5);
  const fallback = current.transfers.filter((transfer) => ['accepted', 'downloaded'].includes(transfer.status)).slice(0, 3);
  $('#railTransfers').innerHTML = (rail.length ? rail : fallback).length ? (rail.length ? rail : fallback).map(railTransfer).join('') : '<div class="empty">Keine Übertragung.</div>';
  $$('[data-remove-device]').forEach((button) => button.onclick = () => removeDevice(button.dataset.removeDevice));
  $$('[data-delete-transfer]').forEach((button) => button.onclick = () => deleteTransfer(button.dataset.deleteTransfer));
}

function deviceCard(device) {
  return `<div class="item" data-device="${device.id}"><div><div class="item-title">${esc(device.name)}</div><div class="item-meta">Zuletzt gesehen: ${new Date(device.last_seen).toLocaleString()}</div><div class="toggle-row" style="margin-top:10px"><label class="switch"><input data-trusted type="checkbox" ${device.trusted ? 'checked' : ''}><span class="slider"></span></label><span>Vertrauenswürdig</span><label class="switch"><input data-auto type="checkbox" ${device.auto_accept ? 'checked' : ''} ${device.trusted ? '' : 'disabled'}><span class="slider"></span></label><span>Automatisch annehmen</span></div></div><div class="item-actions"><button class="danger" data-remove>Entfernen</button></div></div>`;
}

function bindDevice(element) {
  const id = element.dataset.device;
  const trusted = $('[data-trusted]', element);
  const auto = $('[data-auto]', element);
  trusted.onchange = async () => {
    auto.disabled = !trusted.checked;
    if (!trusted.checked) auto.checked = false;
    await api(`/api/admin/device/${id}`, { method: 'POST', json: { trusted: trusted.checked, autoAccept: auto.checked } });
    await refreshAdmin(false);
  };
  auto.onchange = async () => {
    await api(`/api/admin/device/${id}`, { method: 'POST', json: { trusted: trusted.checked, autoAccept: auto.checked } });
    await refreshAdmin(false);
  };
  $('[data-remove]', element).onclick = async () => {
    if (confirm('Gerät wirklich entfernen?')) {
      await api(`/api/admin/device/${id}`, { method: 'DELETE' });
      await refreshAdmin(false);
    }
  };
}

function statusLabel(status) {
  return ({
    uploading: 'Wird übertragen', accepted: 'Empfangen', rejected: 'Abgelehnt', ready: 'Bereit',
    downloaded: 'Heruntergeladen', revoked: 'Widerrufen', error: 'Fehler', cancelled: 'Abgebrochen', pending: 'Wartet', draft: 'Ziel fehlt'
  })[status] || status;
}

function transferCard(transfer, actions) {
  return `<div class="item transfer-item"><div class="transfer-copy"><div class="item-title">${esc(transfer.filename)}</div><div class="item-meta">${fmt(transfer.size)} · ${esc(transfer.device_name || 'LiMaD-PC')} · ${statusLabel(transfer.status)}</div>${transferProgress(transfer)}</div><div class="item-actions">${actions ? `<button data-accept="${transfer.id}">Annehmen</button><button class="danger" data-reject="${transfer.id}">Ablehnen</button>` : `<span class="badge ${['accepted', 'downloaded'].includes(transfer.status) ? 'good' : ''}">${statusLabel(transfer.status)}</span>`}<button class="row-delete ghost" data-delete-transfer="${transfer.id}" title="Übertragung löschen">×</button></div></div>`;
}

function outgoingCard(transfer) {
  const options = state.devices.map((device) => `<option value="${device.id}" ${device.id === transfer.device_id ? 'selected' : ''}>${esc(device.name)}</option>`).join('');
  return `<div class="item"><div><div class="item-title">${esc(transfer.filename)}</div><div class="item-meta">${fmt(transfer.size)} · ${transfer.status === 'draft' ? 'Ziel fehlt' : `Bereit für ${esc(transfer.device_name || 'Gerät')}`}</div></div><div class="item-actions"><select data-target-transfer="${transfer.id}" style="min-width:180px"><option value="">Ziel wählen</option>${options}</select><button class="row-delete ghost" data-delete-transfer="${transfer.id}" title="Vorgemerkte Datei löschen">×</button></div></div>`;
}

async function removeDevice(id) {
  if (!confirm('Dieses Gerät wirklich entfernen? Die Kopplung muss danach neu hergestellt werden.')) return;
  try {
    await api(`/api/admin/device/${id}`, { method: 'DELETE' });
    toast('Gerät wurde entfernt.');
    await refreshAdmin(false);
  } catch (error) { toast(error.message, true); }
}

async function bulkDeleteDevices(scope) {
  if (!confirm('Alle derzeit offline angezeigten Geräte entfernen?')) return;
  try {
    const result = await api(`/api/admin/devices?scope=${encodeURIComponent(scope)}`, { method: 'DELETE' });
    toast(`${result.deleted || 0} Gerät(e) entfernt.`);
    await refreshAdmin(false);
  } catch (error) { toast(error.message, true); }
}

async function deleteTransfer(id) {
  if (!confirm('Diese Übertragung entfernen? Teil- und Zwischendateien werden ebenfalls gelöscht.')) return;
  try {
    await api(`/api/admin/transfer/${id}`, { method: 'DELETE' });
    toast('Übertragung wurde gelöscht.');
    await refreshAdmin(false);
  } catch (error) { toast(error.message, true); }
}

async function bulkDeleteTransfers(scope) {
  const question = scope === 'failed' ? 'Alle abgebrochenen und fehlgeschlagenen Übertragungen löschen?' : 'Den abgeschlossenen Übertragungsverlauf leeren?';
  if (!confirm(question)) return;
  try {
    const result = await api(`/api/admin/transfers?scope=${encodeURIComponent(scope)}`, { method: 'DELETE' });
    toast(`${result.deleted || 0} Übertragung(en) gelöscht.`);
    await refreshAdmin(false);
  } catch (error) { toast(error.message, true); }
}

async function transferAction(id, action) {
  try {
    await api(`/api/admin/transfer/${id}/${action}`, { method: 'POST' });
    toast(action === 'accept' ? 'Datei wurde angenommen.' : 'Datei wurde abgelehnt.');
    await refreshAdmin(false);
  } catch (error) {
    toast(error.message, true);
  }
}

async function setTarget(id, deviceId) {
  if (!deviceId) return;
  try {
    await api(`/api/admin/outbound/${id}/target`, { method: 'POST', json: { deviceId } });
    toast('Zielgerät wurde gesetzt.');
    await refreshAdmin(false);
  } catch (error) {
    toast(error.message, true);
  }
}

function pairView() {
  app.innerHTML = `<div class="pair-screen">${topbar('Smartphone verbinden')}<section class="panel"><div class="brand-mark">⇅</div><h1>Mit LiMaD-PC koppeln</h1><p class="panel-sub">Beide Geräte müssen sich im gleichen WLAN befinden.</p><form id="pairForm"><label>Gerätename<input id="deviceName" type="text" value="${esc(localStorage.getItem('limadDropDeviceName') || 'Mein Smartphone')}" maxlength="80" required></label><label>Sechsstelliger Code<input id="pairCodeInput" type="text" inputmode="numeric" pattern="[0-9 ]{6,7}" placeholder="000 000" ${pairFromUrl ? '' : 'required'}></label><button type="submit" class="primary">Gerät verbinden</button></form><p class="fine">Das Gerät wird zunächst als bekannt gespeichert. Automatische Annahme muss am LiMaD-PC ausdrücklich aktiviert werden.</p></section></div>`;
  $('#pairForm').onsubmit = pairDevice;
}

async function pairDevice(event) {
  event.preventDefault();
  const button = $('button[type=submit]', event.currentTarget);
  const name = $('#deviceName').value.trim();
  const code = $('#pairCodeInput').value;
  button.disabled = true;
  button.textContent = 'Wird verbunden …';
  try {
    const data = await api('/api/pair', { method: 'POST', json: { name, code, token: pairFromUrl } });
    deviceToken = data.deviceToken;
    localStorage.setItem('limadDropDeviceToken', deviceToken);
    localStorage.setItem('limadDropDeviceName', data.name);
    history.replaceState(null, '', location.pathname);
    toast('Gerät wurde gekoppelt.');
    mobileView();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Gerät verbinden';
    toast(error.message, true);
  }
}

async function mobileView() {
  app.innerHTML = `<div class="mobile-main">${topbar(localStorage.getItem('limadDropDeviceName') || 'Gekoppeltes Gerät')}<div class="dashboard"><div class="stack"><section class="panel"><h2>Dieses Gerät</h2><p class="panel-sub"><span class="dot" style="display:inline-block;margin-right:7px"></span>Sichtbar und mit LiMaD-PC gekoppelt.</p><div class="mobile-actions"><div class="quick-tile"><b>⇧</b>Senden</div><div class="quick-tile"><b>⇩</b>Empfangen</div></div></section><section class="panel"><h2>Dateien senden</h2><p class="panel-sub">Unterbrochene Übertragungen werden automatisch fortgesetzt.</p><div id="dropzone" class="dropzone" style="min-height:260px"><strong>Dateien auswählen</strong><span>Mehrere Dateien können nacheinander übertragen werden.</span><button id="pick" class="primary">Dateien auswählen</button><input id="files" class="hidden" type="file" multiple></div>${progressMarkup()}</section><section class="panel"><h2>Vom LiMaD-PC</h2><div id="downloads" class="list"></div></section><section class="panel"><h2>Verlauf</h2><div id="mobileHistory" class="list"></div></section></div></div><div class="actions" style="margin-top:14px"><button id="forget" class="danger">Kopplung auf diesem Gerät löschen</button></div></div>`;
  bindMobile();
  await refreshMobile();
  refreshTimer = setInterval(refreshMobile, 1800);
}

function bindMobile() {
  const input = $('#files');
  const drop = $('#dropzone');
  $('#pick').onclick = () => { if (!activeTransferController) input.click(); };
  input.onchange = () => mobileSend([...input.files]);
  ['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); if (!activeTransferController) drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (event) => { if (!activeTransferController) mobileSend([...event.dataTransfer.files]); });
  $('#forget').onclick = () => {
    if (confirm('Lokale Kopplung löschen? Das Gerät muss anschließend erneut gekoppelt werden.')) {
      localStorage.removeItem('limadDropDeviceToken');
      deviceToken = '';
      clearInterval(refreshTimer);
      pairView();
    }
  };
}

async function mobileSend(files) {
  await runUploadQueue(files, 'inbound', '', refreshMobile);
}

async function downloadFile(transfer, button) {
  if (activeTransferController) return;
  const box = $('#uploadProgress');
  activeTransferController = new AbortController();
  const controller = activeTransferController;
  button.disabled = true;
  button.textContent = 'Wird geladen …';
  $('[data-progress-cancel]', box).onclick = () => controller.abort();
  setProgress(box, { phase: 'preparing', file: transfer.filename, received: 0, total: transfer.size, rate: 0 });
  try {
    const started = performance.now();
    const response = await fetch(transfer.downloadUrl, { headers: authHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error(`Download fehlgeschlagen: HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length')) || Number(transfer.size) || 0;
    const reader = response.body?.getReader();
    if (!reader) {
      const blob = await response.blob();
      saveBlob(blob, transfer.filename);
      setProgress(box, { phase: 'done', file: transfer.filename, received: blob.size, total: blob.size, rate: 0, eta: 0 });
    } else {
      let received = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        const elapsed = Math.max(.25, (performance.now() - started) / 1000);
        const rate = received / elapsed;
        setProgress(box, { phase: 'downloading', file: transfer.filename, received, total, rate, eta: rate ? (total - received) / rate : undefined });
      }
      setProgress(box, { phase: 'verifying', file: transfer.filename, received, total, rate: 0 });
      saveBlob(new Blob(chunks), transfer.filename);
      setProgress(box, { phase: 'done', file: transfer.filename, received: total, total, rate: 0, eta: 0 });
    }
    toast(`${transfer.filename} wurde heruntergeladen.`);
  } catch (error) {
    if (error?.name === 'AbortError') {
      setProgress(box, { phase: 'cancelled', file: transfer.filename, received: 0, total: transfer.size });
      toast('Download wurde abgebrochen.');
    } else {
      setProgress(box, { phase: 'error', file: transfer.filename, received: 0, total: transfer.size });
      toast(error.message || String(error), true);
    }
  } finally {
    activeTransferController = null;
    button.disabled = false;
    button.textContent = 'Herunterladen';
    await refreshMobile();
    setTimeout(() => box.classList.add('hidden'), 1800);
  }
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function refreshMobile() {
  try {
    const current = await api('/api/mobile/state');
    const ready = current.outbound.filter((transfer) => transfer.status === 'ready');
    $('#downloads').innerHTML = ready.length ? ready.map((transfer) => `<div class="item"><div><div class="item-title">${esc(transfer.filename)}</div><div class="item-meta">${fmt(transfer.size)}</div></div><div class="item-actions"><button data-download="${esc(transfer.id)}">Herunterladen</button></div></div>`).join('') : '<div class="empty">Der LiMaD-PC hat keine Datei bereitgestellt.</div>';
    $$('[data-download]').forEach((button) => {
      const transfer = ready.find((item) => item.id === button.dataset.download);
      button.onclick = () => downloadFile(transfer, button);
    });
    const historyItems = [...current.inbound, ...current.outbound].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 12);
    $('#mobileHistory').innerHTML = historyItems.length ? historyItems.map((transfer) => transferCard(transfer, false)).join('') : '<div class="empty">Noch keine Übertragung.</div>';
  } catch (error) {
    if (String(error.message).includes('gekoppelt')) {
      clearInterval(refreshTimer);
      localStorage.removeItem('limadDropDeviceToken');
      deviceToken = '';
      pairView();
    }
  }
}

(async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (adminToken) return adminView();
  if (deviceToken) return mobileView();
  pairView();
})().catch((error) => {
  app.innerHTML = `<div class="pair-screen"><section class="panel"><h1>LiDrop konnte nicht geladen werden</h1><p>${esc(error.message)}</p></section></div>`;
});
