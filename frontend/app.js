const STORAGE_KEY = 'aetherboard_api_base';

const els = {
  apiBase: document.getElementById('apiBase'),
  saveApiBase: document.getElementById('saveApiBase'),
  adminToken: document.getElementById('adminToken'),
  clearAdminToken: document.getElementById('clearAdminToken'),
  tokenStatus: document.getElementById('tokenStatus'),
  refreshAll: document.getElementById('refreshAll'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  adminWriteStatus: document.getElementById('adminWriteStatus'),
  boardGrid: document.getElementById('boardGrid'),
  taskIdInput: document.getElementById('taskIdInput'),
  loadTaskBtn: document.getElementById('loadTaskBtn'),
  taskDetailPanel: document.getElementById('taskDetailPanel'),
  taskComments: document.getElementById('taskComments'),
  agentsList: document.getElementById('agentsList'),
  roomsList: document.getElementById('roomsList'),
  roomFeedTitle: document.getElementById('roomFeedTitle'),
  roomFeed: document.getElementById('roomFeed'),
  milestonesList: document.getElementById('milestonesList'),
  reviewsList: document.getElementById('reviewsList'),
  createTaskForm: document.getElementById('createTaskForm'),
  updateTaskForm: document.getElementById('updateTaskForm'),
  transitionTaskForm: document.getElementById('transitionTaskForm'),
  commentTaskForm: document.getElementById('commentTaskForm'),
  createAgentForm: document.getElementById('createAgentForm'),
  createRoomForm: document.getElementById('createRoomForm'),
  roomMessageForm: document.getElementById('roomMessageForm'),
  createMilestoneForm: document.getElementById('createMilestoneForm')
};

let adminToken = '';

const tabs = [...document.querySelectorAll('.tabs button')];
const sections = [...document.querySelectorAll('.tab')];

function activateTab(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  sections.forEach((s) => s.classList.toggle('active', s.id === `tab-${name}`));
}

function setStatus(text, ok = true) {
  els.statusText.textContent = text;
  els.statusDot.classList.remove('status-ok', 'status-error');
  els.statusDot.classList.add(ok ? 'status-ok' : 'status-error');
}

function setWriteStatus(text, ok = true) {
  els.adminWriteStatus.textContent = text;
  els.adminWriteStatus.classList.remove('status-ok-border', 'status-error-border');
  els.adminWriteStatus.classList.add(ok ? 'status-ok-border' : 'status-error-border');
}

function setAdminToken(token) {
  adminToken = token.trim();
  els.tokenStatus.textContent = adminToken ? 'Loaded (memory only)' : 'Not set';
}

function requireAdminToken() {
  if (!adminToken) {
    throw new Error('Admin token missing. Set it in the top bar first.');
  }
}

function getBaseUrl() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function basePath(path) {
  const base = getBaseUrl().trim();
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

const ACTOR_HEADERS = {
  'x-role': 'CEO',
  'x-user-id': 'sameer'
};

async function fetchJson(path, options = {}) {
  const res = await fetch(basePath(path), options);
  if (!res.ok) {
    let details = '';
    try {
      const data = await res.json();
      details = data?.error ? `: ${data.error}` : '';
    } catch {
      details = '';
    }
    throw new Error(`${res.status} ${res.statusText}${details}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function apiGet(path) {
  return fetchJson(path, {
    method: 'GET',
    headers: {
      ...ACTOR_HEADERS
    }
  });
}

function apiWrite(path, method, payload) {
  requireAdminToken();
  return fetchJson(path, {
    method,
    headers: {
      ...ACTOR_HEADERS,
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
}

function readForm(form) {
  const data = new FormData(form);
  return Object.fromEntries([...data.entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

function compactFields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null));
}

function dt(ts) {
  if (!ts) return 'n/a';
  const d = new Date(ts);
  return d.toLocaleString();
}

function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

async function loadBoard() {
  const statuses = ['todo', 'in-progress', 'blocked', 'review', 'done'];
  els.boardGrid.innerHTML = '';

  for (const status of statuses) {
    const col = el(`<div class="column"><h3>${status}</h3><div class="items">Loading...</div></div>`);
    els.boardGrid.appendChild(col);

    try {
      const tasks = await apiGet(`/api/tasks?status=${encodeURIComponent(status)}`);
      const items = col.querySelector('.items');
      items.innerHTML = '';
      if (!tasks.length) {
        items.textContent = 'No tasks';
        continue;
      }

      tasks.forEach((task) => {
        const item = el(`
          <div class="task-item">
            <div><strong>${task.title || task.id}</strong></div>
            <div class="meta">#${task.id} • owner: ${task.assigneeAgentId || 'unassigned'}</div>
            <button data-task-id="${task.id}">Open details</button>
          </div>
        `);

        item.querySelector('button').addEventListener('click', () => {
          activateTab('task');
          els.taskIdInput.value = task.id;
          loadTaskDetails(task.id);
        });
        items.appendChild(item);
      });
    } catch (err) {
      col.querySelector('.items').textContent = `Error: ${err.message}`;
    }
  }
}

async function loadTaskDetails(taskId) {
  if (!taskId) return;
  try {
    const task = await apiGet(`/api/tasks/${encodeURIComponent(taskId)}`);
    els.taskDetailPanel.innerHTML = `
      <div><strong>${task.title || task.id}</strong></div>
      <div class="meta">ID: ${task.id}</div>
      <div class="meta">Status: ${task.status || 'unknown'} | Priority: ${task.priority || 'n/a'}</div>
      <p>${task.description || '(No description)'}</p>
      <div class="meta">Owner: ${task.assigneeAgentId || 'unassigned'} | Updated: ${dt(task.updatedAt)}</div>
    `;

    const comments = await apiGet(`/api/tasks/${encodeURIComponent(taskId)}/comments`);
    els.taskComments.innerHTML = comments.map((c) => `
      <li>
        <div><strong>${c.authorId || 'system'}</strong> <span class="meta">${dt(c.createdAt)}</span></div>
        <div>${c.body || ''}</div>
      </li>
    `).join('') || '<li>No comments</li>';
  } catch (err) {
    els.taskDetailPanel.textContent = `Error loading task: ${err.message}`;
    els.taskComments.innerHTML = '';
  }
}

async function loadAgents() {
  try {
    const agents = await apiGet('/api/agents');
    els.agentsList.innerHTML = agents.map((a) => `
      <div class="card">
        <h3>${a.name || a.id}</h3>
        <div class="meta">Role: ${a.role || 'n/a'}</div>
        <div class="meta">Status: ${a.status || 'idle'}</div>
        <p>${a.summary || 'No profile summary.'}</p>
        <div class="meta">Room: ${a.room || 'none'}</div>
      </div>
    `).join('') || '<div class="panel">No agents</div>';
  } catch (err) {
    els.agentsList.innerHTML = `<div class="panel">Error: ${err.message}</div>`;
  }
}

async function loadRooms() {
  try {
    const rooms = await apiGet('/api/rooms');
    els.roomsList.innerHTML = '';

    if (!rooms.length) {
      els.roomsList.innerHTML = '<li>No rooms</li>';
      return;
    }

    rooms.forEach((r) => {
      const li = el(`<li><button data-room-id="${r.id}">${r.name || r.id}</button></li>`);
      li.querySelector('button').addEventListener('click', () => loadRoomFeed(r.id, r.name || r.id));
      els.roomsList.appendChild(li);
    });
  } catch (err) {
    els.roomsList.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

async function loadRoomFeed(roomId, roomName = roomId) {
  els.roomFeedTitle.textContent = `${roomName} feed`;
  try {
    const feed = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/messages`);
    els.roomFeed.innerHTML = feed.map((e) => `
      <li>
        <div><strong>${e.senderId || 'system'}</strong> <span class="meta">${dt(e.createdAt)}</span></div>
        <div>${e.body || ''}</div>
      </li>
    `).join('') || '<li>No feed events</li>';
  } catch (err) {
    els.roomFeed.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

async function loadMilestones() {
  try {
    const milestones = await apiGet('/api/milestones');
    els.milestonesList.innerHTML = milestones.map((m) => `
      <li>
        <div><strong>${m.title || m.id}</strong></div>
        <div class="meta">Actor: ${m.actorId || 'system'} | Created: ${dt(m.createdAt)}</div>
        <div>${m.detail || ''}</div>
      </li>
    `).join('') || '<li>No milestones</li>';
  } catch (err) {
    els.milestonesList.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

async function loadReviews() {
  try {
    const reviews = await apiGet('/api/tasks?status=review');
    els.reviewsList.innerHTML = reviews.map((r) => `
      <li>
        <div><strong>${r.title || r.id}</strong></div>
        <div class="meta">Task: ${r.id} | Requested by: ${r.createdBy || 'system'}</div>
        <div class="meta">Status: ${r.status} | Created: ${dt(r.createdAt)}</div>
        <div>${r.description || ''}</div>
      </li>
    `).join('') || '<li>No pending CEO reviews</li>';
  } catch (err) {
    els.reviewsList.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

async function refreshAll() {
  setStatus('Refreshing...', true);
  try {
    await Promise.all([
      loadBoard(),
      loadAgents(),
      loadRooms(),
      loadMilestones(),
      loadReviews()
    ]);
    setStatus('Connected', true);
  } catch (err) {
    setStatus(`Error: ${err.message}`, false);
  }
}

async function runWrite(label, work, { refresh = true } = {}) {
  setWriteStatus(`${label}...`, true);
  try {
    const result = await work();
    setWriteStatus(`${label} succeeded`, true);
    if (refresh) await refreshAll();
    return result;
  } catch (err) {
    setWriteStatus(`${label} failed: ${err.message}`, false);
    throw err;
  }
}

function bindWriteForms() {
  els.createTaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.createTaskForm);
    await runWrite('Create task', async () => {
      const created = await apiWrite('/api/tasks', 'POST', compactFields(values));
      if (created?.id) {
        els.taskIdInput.value = created.id;
        await loadTaskDetails(created.id);
      }
    });
  });

  els.updateTaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.updateTaskForm);
    const id = values.id;
    await runWrite('Update task', async () => {
      await apiWrite(`/api/tasks/${encodeURIComponent(id)}`, 'PATCH', compactFields({
        title: values.title,
        description: values.description,
        assigneeAgentId: values.assigneeAgentId
      }));
      els.taskIdInput.value = id;
      await loadTaskDetails(id);
    });
  });

  els.transitionTaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.transitionTaskForm);
    const id = values.id;
    await runWrite('Transition task', async () => {
      await apiWrite(`/api/tasks/${encodeURIComponent(id)}/transition`, 'POST', { to: values.to });
      els.taskIdInput.value = id;
      await loadTaskDetails(id);
    });
  });

  els.commentTaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.commentTaskForm);
    const id = values.id;
    await runWrite('Add task comment', async () => {
      await apiWrite(`/api/tasks/${encodeURIComponent(id)}/comments`, 'POST', { body: values.body });
      els.taskIdInput.value = id;
      await loadTaskDetails(id);
    });
  });

  els.createAgentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.createAgentForm);
    await runWrite('Create agent', async () => {
      await apiWrite('/api/agents', 'POST', compactFields({
        name: values.name,
        role: values.role,
        pod: values.pod
      }));
    });
  });

  els.createRoomForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.createRoomForm);
    await runWrite('Create room', async () => {
      await apiWrite('/api/rooms', 'POST', compactFields({
        name: values.name,
        kind: values.kind,
        pod: values.pod
      }));
    });
  });

  els.roomMessageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.roomMessageForm);
    await runWrite('Post room message', async () => {
      await apiWrite(`/api/rooms/${encodeURIComponent(values.id)}/messages`, 'POST', { body: values.body });
      await loadRoomFeed(values.id, values.id);
    }, { refresh: false });
  });

  els.createMilestoneForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(els.createMilestoneForm);
    await runWrite('Create milestone', async () => {
      await apiWrite('/api/milestones', 'POST', compactFields(values));
    });
  });
}

tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
els.saveApiBase.addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEY, els.apiBase.value.trim());
  refreshAll();
});
els.adminToken.addEventListener('input', () => setAdminToken(els.adminToken.value));
els.clearAdminToken.addEventListener('click', () => {
  els.adminToken.value = '';
  setAdminToken('');
});
els.refreshAll.addEventListener('click', refreshAll);
els.loadTaskBtn.addEventListener('click', () => loadTaskDetails(els.taskIdInput.value.trim()));

(function init() {
  els.apiBase.value = getBaseUrl();
  setAdminToken('');
  bindWriteForms();
  refreshAll();
})();
