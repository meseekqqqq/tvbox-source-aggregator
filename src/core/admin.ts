export const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TVBox Aggregator - Admin</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Outfit:wght@300;400;600;700&display=swap');

*{margin:0;padding:0;box-sizing:border-box}

:root{
  --bg:#0a0e14;
  --surface:#111720;
  --surface-2:#161d2a;
  --border:#1e2a3a;
  --border-glow:#2a3f5f;
  --green:#00e5a0;
  --green-dim:#00e5a033;
  --green-glow:#00e5a066;
  --amber:#f0a030;
  --amber-dim:#f0a03033;
  --red:#ff4060;
  --red-dim:#ff406033;
  --blue:#4da6ff;
  --blue-dim:#4da6ff33;
  --text:#c8d6e5;
  --text-dim:#5a6d82;
  --mono:'JetBrains Mono',monospace;
  --sans:'Outfit',sans-serif;
}

html{font-size:16px}
body{
  background:var(--bg);
  color:var(--text);
  font-family:var(--sans);
  min-height:100vh;
  overflow-x:hidden;
  position:relative;
}

body::after{
  content:'';
  position:fixed;
  inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);
  pointer-events:none;
  z-index:1000;
}

body::before{
  content:'';
  position:fixed;
  inset:0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, #00e5a008 0%, transparent 70%),
    linear-gradient(rgba(30,42,58,0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(30,42,58,0.3) 1px, transparent 1px);
  background-size:100% 100%, 60px 60px, 60px 60px;
  pointer-events:none;
  z-index:0;
}

.container{
  max-width:860px;
  margin:0 auto;
  padding:40px 24px 80px;
  position:relative;
  z-index:1;
}

/* Login overlay */
.login-overlay{
  position:fixed;
  inset:0;
  background:var(--bg);
  z-index:900;
  display:flex;
  align-items:center;
  justify-content:center;
}

.login-box{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:8px;
  padding:40px;
  width:360px;
  max-width:90vw;
  animation:fadeSlideUp 0.4s ease-out;
}

.login-box h2{
  font-family:var(--sans);
  font-size:1.4rem;
  font-weight:700;
  color:#fff;
  margin-bottom:8px;
}

.login-box p{
  font-family:var(--mono);
  font-size:0.7rem;
  color:var(--text-dim);
  letter-spacing:0.1em;
  text-transform:uppercase;
  margin-bottom:24px;
}

.login-box input{
  width:100%;
  font-family:var(--mono);
  font-size:0.85rem;
  padding:12px 16px;
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:4px;
  color:#fff;
  outline:none;
  margin-bottom:16px;
  transition:border-color 0.2s;
}

.login-box input:focus{
  border-color:var(--green);
}

.login-box .error-msg{
  font-family:var(--mono);
  font-size:0.75rem;
  color:var(--red);
  margin-bottom:12px;
  display:none;
}

/* Header */
.header{
  margin-bottom:36px;
  animation:fadeSlideDown 0.6s ease-out;
}

.header-label{
  font-family:var(--mono);
  font-size:0.7rem;
  letter-spacing:0.2em;
  text-transform:uppercase;
  color:var(--green);
  opacity:0.7;
  margin-bottom:8px;
  display:flex;
  align-items:center;
  gap:8px;
}

.header-label::before{
  content:'';
  display:inline-block;
  width:8px;height:8px;
  background:var(--green);
  border-radius:50%;
  animation:pulse 2s ease-in-out infinite;
}

.header-title{
  font-family:var(--sans);
  font-size:2rem;
  font-weight:700;
  letter-spacing:-0.02em;
  color:#fff;
  line-height:1.2;
}

.header-title span{color:var(--green)}

.header-nav{
  display:flex;
  gap:12px;
  margin-top:16px;
}

.header-nav a{
  font-family:var(--mono);
  font-size:0.7rem;
  letter-spacing:0.1em;
  text-transform:uppercase;
  color:var(--text-dim);
  text-decoration:none;
  padding:4px 10px;
  border:1px solid var(--border);
  border-radius:4px;
  transition:all 0.2s;
}

.header-nav a:hover{
  border-color:var(--text-dim);
  color:var(--text);
}

/* Section cards */
.section{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:8px;
  padding:24px;
  margin-bottom:20px;
  position:relative;
  overflow:hidden;
  animation:fadeSlideUp 0.5s ease-out both;
}

.section:nth-child(2){animation-delay:0.1s}
.section:nth-child(3){animation-delay:0.15s}
.section:nth-child(4){animation-delay:0.2s}

.section::before{
  content:'';
  position:absolute;
  top:0;left:0;right:0;
  height:1px;
  background:linear-gradient(90deg, transparent, var(--green-dim), transparent);
}

.section-title{
  font-family:var(--mono);
  font-size:0.7rem;
  letter-spacing:0.15em;
  text-transform:uppercase;
  color:var(--text-dim);
  margin-bottom:16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
}

.section-title .count{
  font-size:0.75rem;
  color:var(--green);
  font-weight:600;
}

/* Add source form */
.add-form{
  display:flex;
  gap:10px;
  margin-bottom:8px;
}

.add-form input{
  flex:1;
  font-family:var(--mono);
  font-size:0.8rem;
  padding:10px 14px;
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:4px;
  color:#fff;
  outline:none;
  transition:border-color 0.2s;
}

.add-form input:focus{
  border-color:var(--green);
}

.add-form input::placeholder{
  color:var(--text-dim);
  opacity:0.6;
}

.add-form .name-input{
  max-width:160px;
}

@media(max-width:560px){
  .add-form{flex-wrap:wrap}
  .add-form .name-input{max-width:100%}
}

/* Buttons */
.btn{
  font-family:var(--mono);
  font-size:0.75rem;
  font-weight:600;
  letter-spacing:0.1em;
  text-transform:uppercase;
  padding:10px 20px;
  background:transparent;
  border:1px solid var(--green);
  color:var(--green);
  border-radius:4px;
  cursor:pointer;
  transition:all 0.3s;
  white-space:nowrap;
}

.btn:hover{
  background:var(--green-dim);
  box-shadow:0 0 20px var(--green-dim);
}

.btn:active{transform:scale(0.97)}

.btn.loading{
  color:var(--amber);
  border-color:var(--amber);
  pointer-events:none;
}

.btn-danger{
  border-color:var(--red);
  color:var(--red);
}

.btn-danger:hover{
  background:var(--red-dim);
  box-shadow:0 0 20px var(--red-dim);
}

.btn-sm{
  padding:6px 12px;
  font-size:0.65rem;
}

/* Source list */
.source-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}

.source-item{
  display:flex;
  align-items:center;
  gap:12px;
  padding:12px 16px;
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:4px;
  transition:border-color 0.2s;
}

.source-item:hover{
  border-color:var(--border-glow);
}

.source-tag{
  font-family:var(--mono);
  font-size:0.6rem;
  font-weight:600;
  letter-spacing:0.08em;
  text-transform:uppercase;
  padding:3px 8px;
  border-radius:3px;
  flex-shrink:0;
}

.source-tag.scraped{
  background:var(--blue-dim);
  color:var(--blue);
  border:1px solid var(--blue);
}

.source-tag.manual{
  background:var(--green-dim);
  color:var(--green);
  border:1px solid var(--green);
}

.source-info{
  flex:1;
  min-width:0;
  overflow:hidden;
}

.source-name{
  font-family:var(--sans);
  font-size:0.85rem;
  color:#fff;
  font-weight:500;
  margin-bottom:2px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.source-url{
  font-family:var(--mono);
  font-size:0.7rem;
  color:var(--text-dim);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.source-actions{
  flex-shrink:0;
}

/* Action bar */
.action-bar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.action-bar .status-text{
  font-family:var(--mono);
  font-size:0.75rem;
  color:var(--text-dim);
}

.action-bar .status-text.success{color:var(--green)}
.action-bar .status-text.error{color:var(--red)}

/* Empty state */
.empty{
  text-align:center;
  padding:32px 16px;
  font-family:var(--mono);
  font-size:0.8rem;
  color:var(--text-dim);
}

/* Toast */
.toast{
  position:fixed;
  bottom:24px;
  right:24px;
  font-family:var(--mono);
  font-size:0.75rem;
  padding:12px 20px;
  border-radius:4px;
  z-index:999;
  animation:fadeSlideUp 0.3s ease-out;
  transition:opacity 0.3s;
}

.toast.success{
  background:var(--green-dim);
  border:1px solid var(--green);
  color:var(--green);
}

.toast.error{
  background:var(--red-dim);
  border:1px solid var(--red);
  color:var(--red);
}

/* Footer */
.footer{
  margin-top:36px;
  padding-top:20px;
  border-top:1px solid var(--border);
  font-family:var(--mono);
  font-size:0.65rem;
  color:var(--text-dim);
  text-align:center;
  letter-spacing:0.05em;
}

/* Loading skeleton */
.skeleton{
  background:linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
  background-size:200% 100%;
  animation:shimmer 1.5s infinite;
  border-radius:4px;
  color:transparent !important;
}

@keyframes fadeSlideDown{
  from{opacity:0;transform:translateY(-12px)}
  to{opacity:1;transform:translateY(0)}
}

@keyframes fadeSlideUp{
  from{opacity:0;transform:translateY(12px)}
  to{opacity:1;transform:translateY(0)}
}

@keyframes pulse{
  0%,100%{opacity:1}
  50%{opacity:0.4}
}

@keyframes shimmer{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}
</style>
</head>
<body>

<!-- Login -->
<div class="login-overlay" id="loginOverlay">
  <div class="login-box">
    <h2>Admin Access</h2>
    <p>TVBox Aggregator Management</p>
    <div class="error-msg" id="loginError">Invalid token</div>
    <input type="password" id="loginInput" placeholder="Enter admin token" autocomplete="off">
    <button class="btn" style="width:100%" onclick="doLogin()">Login</button>
  </div>
</div>

<!-- Main content -->
<div class="container" id="mainContent" style="display:none">
  <header class="header">
    <div class="header-label">Admin Console</div>
    <h1 class="header-title">Source <span>Manager</span></h1>
    <nav class="header-nav">
      <a href="/">Config</a>
      <a href="/status">Dashboard</a>
    </nav>
  </header>

  <!-- Add source -->
  <div class="section">
    <div class="section-title">Add Source</div>
    <div class="add-form">
      <input class="name-input" type="text" id="addName" placeholder="Name (optional)">
      <input type="url" id="addUrl" placeholder="TVBox config JSON URL">
      <button class="btn" id="addBtn" onclick="addSource()">Add</button>
    </div>
  </div>

  <!-- Aggregation control -->
  <div class="section">
    <div class="section-title">Aggregation</div>
    <div class="action-bar">
      <span class="status-text" id="aggStatus">Last update: loading...</span>
      <button class="btn" id="refreshBtn" onclick="triggerRefresh()">Refresh</button>
    </div>
  </div>

  <!-- Source list -->
  <div class="section">
    <div class="section-title">
      <span>Sources</span>
      <span class="count" id="sourceCount">0</span>
    </div>
    <div class="source-list" id="sourceList">
      <div class="empty">Loading sources...</div>
    </div>
  </div>

  <div class="footer">
    TVBox Source Aggregator &middot; Admin Console
  </div>
</div>

<script>
let token = '';
const $ = id => document.getElementById(id);

// --- Auth ---
function doLogin() {
  token = $('loginInput').value.trim();
  if (!token) return;
  // Verify token by making a request
  fetch('/admin/sources', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => {
    if (r.ok) {
      $('loginOverlay').style.display = 'none';
      $('mainContent').style.display = 'block';
      sessionStorage.setItem('admin_token', token);
      loadAll();
    } else {
      $('loginError').style.display = 'block';
      $('loginInput').value = '';
      $('loginInput').focus();
    }
  }).catch(() => {
    $('loginError').textContent = 'Connection failed';
    $('loginError').style.display = 'block';
  });
}

$('loginInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Auto-login from session
const saved = sessionStorage.getItem('admin_token');
if (saved) {
  token = saved;
  fetch('/admin/sources', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => {
    if (r.ok) {
      $('loginOverlay').style.display = 'none';
      $('mainContent').style.display = 'block';
      loadAll();
    }
  });
}

// --- API helpers ---
function authFetch(url, opts = {}) {
  opts.headers = { ...opts.headers, 'Authorization': 'Bearer ' + token };
  return fetch(url, opts);
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// --- Load data ---
function loadAll() {
  loadSources();
  loadStatus();
}

async function loadStatus() {
  try {
    const res = await fetch('/status-data');
    const d = await res.json();
    if (d.lastUpdate && d.lastUpdate !== 'never') {
      const date = new Date(d.lastUpdate);
      const fmt = date.toLocaleString('zh-CN', {
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit',
        hour12: false
      });
      $('aggStatus').textContent = 'Last update: ' + fmt + ' | ' + d.sites + ' sites, ' + d.parses + ' parses, ' + d.lives + ' lives';
      $('aggStatus').className = 'status-text';
    } else {
      $('aggStatus').textContent = 'Never updated — click Refresh';
      $('aggStatus').className = 'status-text error';
    }
  } catch {
    $('aggStatus').textContent = 'Failed to load status';
    $('aggStatus').className = 'status-text error';
  }
}

async function loadSources() {
  const list = $('sourceList');
  try {
    const res = await authFetch('/admin/sources');
    const sources = await res.json();
    $('sourceCount').textContent = sources.length;

    if (sources.length === 0) {
      list.innerHTML = '<div class="empty">No sources configured. Add one above.</div>';
      return;
    }

    list.innerHTML = sources.map(s => \`
      <div class="source-item">
        <div class="source-info">
          <div class="source-name">\${esc(s.name || 'Unnamed')}</div>
          <div class="source-url">\${esc(s.url)}</div>
        </div>
        <div class="source-actions">
          <button class="btn btn-sm btn-danger" onclick="removeSource('\${esc(s.url)}')">Remove</button>
        </div>
      </div>
    \`).join('');
  } catch {
    list.innerHTML = '<div class="empty">Failed to load sources</div>';
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- Add source ---
async function addSource() {
  const url = $('addUrl').value.trim();
  if (!url) { $('addUrl').focus(); return; }
  const name = $('addName').value.trim() || '';

  const btn = $('addBtn');
  btn.textContent = 'Adding...';
  btn.className = 'btn loading';

  try {
    const res = await authFetch('/admin/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });
    const d = await res.json();
    if (res.ok) {
      toast('Source added');
      $('addUrl').value = '';
      $('addName').value = '';
      loadSources();
    } else {
      toast(d.error || 'Failed to add', 'error');
    }
  } catch {
    toast('Network error', 'error');
  }

  btn.textContent = 'Add';
  btn.className = 'btn';
}

// --- Remove source ---
async function removeSource(url) {
  try {
    const res = await authFetch('/admin/sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      toast('Source removed');
      loadSources();
    } else {
      const d = await res.json();
      toast(d.error || 'Failed to remove', 'error');
    }
  } catch {
    toast('Network error', 'error');
  }
}

// --- Refresh ---
async function triggerRefresh() {
  const btn = $('refreshBtn');
  btn.textContent = 'Running...';
  btn.className = 'btn loading';

  try {
    const res = await authFetch('/refresh', { method: 'POST' });
    const d = await res.json();
    if (d.success) {
      toast('Aggregation started');
      setTimeout(loadStatus, 3000);
    } else {
      toast('Refresh failed', 'error');
    }
  } catch {
    toast('Network error', 'error');
  }

  setTimeout(() => {
    btn.textContent = 'Refresh';
    btn.className = 'btn';
  }, 3000);
}
</script>
</body>
</html>`;
