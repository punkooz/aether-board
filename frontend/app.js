const STORAGE_KEY = 'aetherboard_api_base';

const els = {
  apiBase: document.getElementById('apiBase'),
  saveApiBase: document.getElementById('saveApiBase'),
  refreshAll: document.getElementById('refreshAll'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
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
  reviewsList: document.getElementById('reviewsList')
};

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

function getBaseUrl() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function basePath(path) {
  const base = getBaseUrl().trim();
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

const API_HEADERS = {
  'x-role': 'CEO',
  'x-user-id': 'sameer'
};

async function fetchJson(path) {
  const res = await fetch(basePath(path), { headers: API_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
      const tasks = await fetchJson(`/api/tasks?status=${encodeURIComponent(status)}`);
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
    const task = await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`);
    els.taskDetailPanel.innerHTML = `
      <div><strong>${task.title || task.id}</strong></div>
      <div class="meta">ID: ${task.id}</div>
      <div class="meta">Status: ${task.status || 'unknown'} | Priority: ${task.priority || 'n/a'}</div>
      <p>${task.description || '(No description)'}</p>
      <div class="meta">Owner: ${task.assigneeAgentId || 'unassigned'} | Updated: ${dt(task.updatedAt)}</div>
    `;

    const comments = await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}/comments`);
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
    const agents = await fetchJson('/api/agents');
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
    const rooms = await fetchJson('/api/rooms');
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
    const feed = await fetchJson(`/api/rooms/${encodeURIComponent(roomId)}/messages`);
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
    const milestones = await fetchJson('/api/milestones');
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
    const reviews = await fetchJson('/api/tasks?status=review');
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

tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
els.saveApiBase.addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEY, els.apiBase.value.trim());
  refreshAll();
});
els.refreshAll.addEventListener('click', refreshAll);
els.loadTaskBtn.addEventListener('click', () => loadTaskDetails(els.taskIdInput.value.trim()));

(function init() {
  els.apiBase.value = getBaseUrl();
  refreshAll();
})();
