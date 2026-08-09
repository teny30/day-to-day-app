// ── Tab Navigation ──────────────────────────────────────────────────────────
let activeTab = 'tasks';

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
        activeTab = tab;
        if (tab === 'tasks') fetchTasks();
    });
});

// ── Auth / Init ─────────────────────────────────────────────────────────────
(async () => {
    try {
        const r = await fetch('/api/me');
        if (!r.ok) { window.location.href = '/'; return; }
        const d = await r.json();
        document.getElementById('username-chip').textContent = d.username;
        updateNotifBellState();
    } catch(e) {}
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
const notifBtn = document.getElementById('notif-btn');

function updateNotifBellState() {
    if (!notifBtn) return;
    if (!('Notification' in window)) {
        notifBtn.style.display = 'none';
        return;
    }
    if (Notification.permission === 'granted') {
        notifBtn.classList.add('notif-active');
        notifBtn.title = 'Notifications Enabled (Tap to send test)';
    } else {
        notifBtn.classList.remove('notif-active');
        notifBtn.title = 'Tap to Enable Task Due Notifications';
    }
}

async function sendNotification(title, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, {
                    icon: '/static/icons/icon-192.png',
                    badge: '/static/icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    ...options
                });
                return;
            }
        }
        new Notification(title, {
            icon: '/static/icons/icon-192.png',
            ...options
        });
    } catch(e) {
        console.error('Notification error:', e);
    }
}

if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            alert('Notifications are not supported in your browser.');
            return;
        }
        if (Notification.permission === 'granted') {
            sendNotification('🔔 Notifications Enabled!', {
                body: 'You will receive reminders when tasks are due.'
            });
            return;
        }
        if (Notification.permission === 'denied') {
            alert('Notifications are blocked in your browser settings. Please enable them to receive due date alerts.');
            return;
        }
        const permission = await Notification.requestPermission();
        updateNotifBellState();
        if (permission === 'granted') {
            sendNotification('⚡ SecureApp Notifications On!', {
                body: 'Task due reminders are now active!'
            });
            fetchTasks();
        }
    });
}

function checkDueNotifications(tasks) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const todayStr = new Date().toISOString().split('T')[0];
    const notifiedKey = `notified_tasks_${todayStr}`;
    let notifiedIds = [];
    try {
        notifiedIds = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
    } catch(e) {}

    let newlyNotified = false;

    tasks.forEach(t => {
        if (t.completed || !t.due_date) return;
        if (notifiedIds.includes(t.id)) return;

        if (t.due_date === todayStr) {
            sendNotification(`📅 Task Due Today: ${t.title}`, {
                body: t.description || `Priority: ${t.priority.toUpperCase()}`,
                tag: `task-due-${t.id}`
            });
            notifiedIds.push(t.id);
            newlyNotified = true;
        } else if (t.due_date < todayStr) {
            sendNotification(`⚠️ Task Overdue: ${t.title}`, {
                body: `Was due on ${t.due_date}. Tap to complete!`,
                tag: `task-overdue-${t.id}`
            });
            notifiedIds.push(t.id);
            newlyNotified = true;
        }
    });

    if (newlyNotified) {
        localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
    }
}

// ── TASKS ────────────────────────────────────────────────────────────────────
let currentPriority = 'all', searchTimer = null;

const fetchTasks = async () => {
    const params = new URLSearchParams({ priority: currentPriority });
    const s = document.getElementById('search-input').value.trim();
    if (s) params.set('search', s);
    try {
        const r = await fetch(`/api/tasks?${params}`);
        if (r.status === 401) { window.location.href = '/'; return; }
        const tasks = await r.json();
        renderTasks(tasks);
        checkDueNotifications(tasks);
    } catch(e) {}
};

const renderTasks = (tasks) => {
    const active    = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    const aList = document.getElementById('active-tasks');
    const cList = document.getElementById('completed-tasks');
    aList.innerHTML = active.length    ? '' : '<li class="empty-state">No active tasks 🎉</li>';
    cList.innerHTML = completed.length ? '' : '<li class="empty-state">Nothing yet</li>';
    active.forEach(t    => aList.appendChild(buildItem(t)));
    completed.forEach(t => cList.appendChild(buildItem(t)));
    document.getElementById('task-count-badge').textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
    document.getElementById('active-count').textContent    = active.length;
    document.getElementById('completed-count').textContent = completed.length;
};

const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

const buildItem = (task) => {
    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    let due = '';
    if (task.due_date) {
        const today = new Date().toISOString().split('T')[0];
        const ov = !task.completed && task.due_date < today;
        due = `<span class="due-date-tag ${ov ? 'overdue' : ''}">📅 ${task.due_date}${ov ? ' · Overdue' : ''}</span>`;
    }
    li.innerHTML = `
        <div class="task-content">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <div class="task-text">
                <span class="task-title">${esc(task.title)}</span>
                ${task.description ? `<span class="task-desc">${esc(task.description)}</span>` : ''}
                <div class="task-meta">
                    <span class="priority-tag ${task.priority}">${task.priority}</span>${due}
                </div>
            </div>
        </div>
        <div class="task-actions">
            <button class="delete-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>`;
    li.querySelector('.task-checkbox').addEventListener('change', e => {
        fetch(`/api/tasks/${task.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ completed: e.target.checked }) }).then(fetchTasks);
    });
    li.querySelector('.delete-btn').addEventListener('click', () => {
        fetch(`/api/tasks/${task.id}`, { method:'DELETE' }).then(fetchTasks);
    });
    return li;
};

document.getElementById('add-task-btn').addEventListener('click', async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    await fetch('/api/tasks', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            title, description: document.getElementById('task-desc').value.trim(),
            priority: document.getElementById('task-priority').value,
            due_date: document.getElementById('task-due').value || null
        })
    });
    document.getElementById('task-title').value  = '';
    document.getElementById('task-desc').value   = '';
    document.getElementById('task-due').value    = '';
    document.getElementById('task-priority').value = 'medium';
    fetchTasks();
});

document.getElementById('task-title').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('add-task-btn').click(); });

document.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        currentPriority = p.dataset.priority;
        fetchTasks();
    });
});

document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fetchTasks, 300);
});

document.getElementById('clear-completed-btn').addEventListener('click', async () => {
    if (!confirm('Delete all completed tasks?')) return;
    await fetch('/api/tasks/clear-completed', { method:'DELETE' });
    fetchTasks();
});

fetchTasks();

// Periodically check notifications every 60 seconds
setInterval(fetchTasks, 60000);

// ── PASSWORD GENERATOR ────────────────────────────────────────────────────────
const pwResult   = document.getElementById('pw-result');
const strengthBar   = document.getElementById('strength-bar');
const strengthLabel = document.getElementById('strength-label');
let pwHistory = [];

document.getElementById('pw-length').addEventListener('input', e => document.getElementById('length-val').textContent = e.target.value);
document.getElementById('pw-count').addEventListener('input',  e => document.getElementById('count-val').textContent  = e.target.value);

function scorePassword(pw) {
    let s = 0;
    if (pw.length >= 12) s++; if (pw.length >= 20) s++;
    if (/[A-Z]/.test(pw)) s++; if (/[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
}

function updateStrength(pw) {
    if (!pw || pw === 'Tap Generate') { strengthBar.style.width='0%'; strengthLabel.textContent=''; return; }
    const lvls = [
        {l:'Very Weak',c:'#ef4444',p:'15%'},{l:'Weak',c:'#f97316',p:'30%'},
        {l:'Fair',c:'#eab308',p:'50%'},{l:'Good',c:'#84cc16',p:'70%'},
        {l:'Strong',c:'#22c55e',p:'85%'},{l:'Very Strong',c:'#10b981',p:'100%'}
    ];
    const lv = lvls[Math.min(scorePassword(pw), 5)];
    strengthBar.style.width = lv.p; strengthBar.style.backgroundColor = lv.c;
    strengthLabel.textContent = lv.l; strengthLabel.style.color = lv.c;
}

function addToHistory(pw) {
    pwHistory = [pw, ...pwHistory.filter(p => p !== pw)].slice(0, 5);
    renderHistory();
}

function renderHistory() {
    const ul = document.getElementById('pw-history');
    ul.innerHTML = '';
    if (!pwHistory.length) { ul.innerHTML = '<li class="empty-state">No history yet</li>'; return; }
    pwHistory.forEach(pw => {
        const li = document.createElement('li');
        li.className = 'history-entry'; li.title = 'Tap to copy'; li.textContent = pw;
        li.addEventListener('click', () => { navigator.clipboard.writeText(pw); li.style.borderColor='#10b981'; setTimeout(() => li.style.borderColor='',1200); });
        ul.appendChild(li);
    });
}

document.getElementById('clear-history').addEventListener('click', () => { pwHistory=[]; renderHistory(); });

document.getElementById('pw-generate-btn').addEventListener('click', async () => {
    document.getElementById('pw-error').textContent = '';
    document.getElementById('pw-multi').classList.add('hidden');
    const params = new URLSearchParams({
        length: document.getElementById('pw-length').value,
        count:  document.getElementById('pw-count').value,
        uppercase:    document.getElementById('pw-upper').checked,
        lowercase:    document.getElementById('pw-lower').checked,
        numbers:      document.getElementById('pw-nums').checked,
        symbols:      document.getElementById('pw-syms').checked,
        no_ambiguous: document.getElementById('pw-noambig').checked,
        name:         document.getElementById('pw-name').value.trim(),
    });
    try {
        const r = await fetch(`/api/generate?${params}`);
        const d = await r.json();
        if (!r.ok) { document.getElementById('pw-error').textContent = d.error || 'Error'; return; }
        const passwords = d.passwords;
        const primary   = passwords[0];
        const name      = document.getElementById('pw-name').value.trim();
        if (name && primary.includes(name)) {
            const i = primary.indexOf(name);
            pwResult.innerHTML = esc(primary.slice(0,i)) + `<mark>${esc(name)}</mark>` + esc(primary.slice(i+name.length));
        } else {
            pwResult.textContent = primary;
        }
        updateStrength(primary); addToHistory(primary);
        if (passwords.length > 1) {
            const multi = document.getElementById('pw-multi');
            multi.classList.remove('hidden');
            multi.innerHTML = passwords.map(pw =>
                `<div class="multi-item"><span>${esc(pw)}</span><button class="multi-copy" data-pw="${esc(pw)}">Copy</button></div>`
            ).join('');
            multi.querySelectorAll('.multi-copy').forEach(btn => {
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(btn.dataset.pw);
                    btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy',1500);
                });
            });
            passwords.forEach(addToHistory);
        }
    } catch(e) { document.getElementById('pw-error').textContent = 'Network error.'; }
});

document.getElementById('pw-copy-btn').addEventListener('click', () => {
    const txt = pwResult.textContent;
    if (txt && txt !== 'Tap Generate') {
        navigator.clipboard.writeText(txt).then(() => {
            const btn = document.getElementById('pw-copy-btn');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            setTimeout(() => btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`, 2000);
        });
    }
});
