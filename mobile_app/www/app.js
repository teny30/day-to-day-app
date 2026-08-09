// ── Standalone Mobile Engine (Offline + Cloud Sync) ──────────────────────────
let activeTab = 'tasks';
const SERVER_URL = 'http://192.168.1.26:5000'; // Default local server URL

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
        activeTab = tab;
        if (tab === 'tasks') loadTasks();
    });
});

// ── Auth & Profile Initialization ───────────────────────────────────────────
let currentUser = localStorage.getItem('secureapp_user') || 'My Account';
(async () => {
    try {
        const r = await fetch('/api/me');
        if (r.ok) {
            const d = await r.json();
            currentUser = d.username;
            localStorage.setItem('secureapp_user', currentUser);
        }
    } catch(e) {}
    const chip = document.getElementById('username-chip');
    if (chip) chip.textContent = currentUser;
    updateNotifBellState();
})();

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
        const name = prompt('Enter your name / account:', currentUser);
        if (name) {
            currentUser = name.trim();
            localStorage.setItem('secureapp_user', currentUser);
            document.getElementById('username-chip').textContent = currentUser;
            loadTasks();
        }
    });
}

// ── NOTIFICATIONS ENGINE ────────────────────────────────────────────────────
const notifBtn = document.getElementById('notif-btn');

function updateNotifBellState() {
    if (!notifBtn) return;
    if (!('Notification' in window)) {
        notifBtn.style.display = 'none';
        return;
    }
    if (Notification.permission === 'granted') {
        notifBtn.classList.add('notif-active');
        notifBtn.title = 'Notifications Active (Tap to test)';
    } else {
        notifBtn.classList.remove('notif-active');
        notifBtn.title = 'Tap to Enable Due Date Notifications';
    }
}

async function sendNotification(title, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, {
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    ...options
                });
                return;
            }
        }
        new Notification(title, { icon: 'icons/icon-192.png', ...options });
    } catch(e) {}
}

if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            alert('Notifications not supported in this browser environment.');
            return;
        }
        if (Notification.permission === 'granted') {
            sendNotification('🔔 Notifications Active!', { body: 'You will receive reminders when tasks are due.' });
            return;
        }
        const permission = await Notification.requestPermission();
        updateNotifBellState();
        if (permission === 'granted') {
            sendNotification('⚡ SecureApp Reminders Activated!', { body: 'Task due reminders are now enabled.' });
            loadTasks();
        }
    });
}

function checkDueNotifications(tasks) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const todayStr = new Date().toISOString().split('T')[0];
    const notifiedKey = `notified_tasks_${todayStr}`;
    let notifiedIds = [];
    try { notifiedIds = JSON.parse(localStorage.getItem(notifiedKey) || '[]'); } catch(e) {}

    let newlyNotified = false;

    tasks.forEach(t => {
        if (t.completed || !t.due_date) return;
        if (notifiedIds.includes(t.id)) return;

        if (t.due_date === todayStr) {
            sendNotification(`📅 Task Due Today: ${t.title}`, {
                body: t.description || `Priority: ${t.priority.toUpperCase()}`,
                tag: `task-due-${t.id}`
            });
            notifiedIds.push(t.id); newlyNotified = true;
        } else if (t.due_date < todayStr) {
            sendNotification(`⚠️ Task Overdue: ${t.title}`, {
                body: `Was due on ${t.due_date}. Tap to review!`,
                tag: `task-overdue-${t.id}`
            });
            notifiedIds.push(t.id); newlyNotified = true;
        }
    });

    if (newlyNotified) {
        localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
    }
}

// ── LOCAL TASKS DB (Standalone Engine) ──────────────────────────────────────
let currentPriority = 'all', searchTimer = null;

function getLocalTasks() {
    try {
        return JSON.parse(localStorage.getItem(`secureapp_tasks_${currentUser}`) || '[]');
    } catch(e) { return []; }
}

function saveLocalTasks(tasks) {
    localStorage.setItem(`secureapp_tasks_${currentUser}`, JSON.stringify(tasks));
}

const loadTasks = async () => {
    let tasks = [];
    // Try remote server sync first
    try {
        const params = new URLSearchParams({ priority: currentPriority });
        const s = document.getElementById('search-input').value.trim();
        if (s) params.set('search', s);
        const r = await fetch(`/api/tasks?${params}`);
        if (r.ok) {
            tasks = await r.json();
            saveLocalTasks(tasks); // cache locally
        } else {
            tasks = getLocalTasks();
        }
    } catch(e) {
        // Unreachable server (e.g. friend phone) -> use local DB!
        tasks = getLocalTasks();
    }

    // Apply priority & search filters locally
    const s = document.getElementById('search-input').value.trim().toLowerCase();
    let filtered = tasks;
    if (currentPriority !== 'all') {
        filtered = filtered.filter(t => t.priority === currentPriority);
    }
    if (s) {
        filtered = filtered.filter(t =>
            (t.title && t.title.toLowerCase().includes(s)) ||
            (t.description && t.description.toLowerCase().includes(s))
        );
    }

    renderTasks(filtered, tasks.length);
    checkDueNotifications(tasks);
};

const renderTasks = (filteredTasks, totalCount) => {
    const active    = filteredTasks.filter(t => !t.completed);
    const completed = filteredTasks.filter(t => t.completed);
    const aList = document.getElementById('active-tasks');
    const cList = document.getElementById('completed-tasks');
    aList.innerHTML = active.length    ? '' : '<li class="empty-state">No active tasks 🎉</li>';
    cList.innerHTML = completed.length ? '' : '<li class="empty-state">Nothing yet</li>';
    active.forEach(t    => aList.appendChild(buildItem(t)));
    completed.forEach(t => cList.appendChild(buildItem(t)));
    document.getElementById('task-count-badge').textContent = `${totalCount} task${totalCount !== 1 ? 's' : ''}`;
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

    li.querySelector('.task-checkbox').addEventListener('change', async e => {
        const newState = e.target.checked;
        try {
            await fetch(`/api/tasks/${task.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ completed: newState }) });
        } catch(err) {}
        const local = getLocalTasks();
        const target = local.find(t => t.id === task.id);
        if (target) { target.completed = newState; saveLocalTasks(local); }
        loadTasks();
    });

    li.querySelector('.delete-btn').addEventListener('click', async () => {
        try { await fetch(`/api/tasks/${task.id}`, { method:'DELETE' }); } catch(err) {}
        const local = getLocalTasks().filter(t => t.id !== task.id);
        saveLocalTasks(local);
        loadTasks();
    });
    return li;
};

document.getElementById('add-task-btn').addEventListener('click', async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    const newTask = {
        id: Date.now(),
        title,
        description: document.getElementById('task-desc').value.trim(),
        priority: document.getElementById('task-priority').value,
        due_date: document.getElementById('task-due').value || null,
        completed: false
    };

    try {
        await fetch('/api/tasks', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(newTask)
        });
    } catch(err) {}

    const local = getLocalTasks();
    local.unshift(newTask);
    saveLocalTasks(local);

    document.getElementById('task-title').value  = '';
    document.getElementById('task-desc').value   = '';
    document.getElementById('task-due').value    = '';
    document.getElementById('task-priority').value = 'medium';
    loadTasks();
});

document.getElementById('task-title').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('add-task-btn').click(); });

document.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        currentPriority = p.dataset.priority;
        loadTasks();
    });
});

document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTasks, 300);
});

document.getElementById('clear-completed-btn').addEventListener('click', async () => {
    if (!confirm('Delete all completed tasks?')) return;
    try { await fetch('/api/tasks/clear-completed', { method:'DELETE' }); } catch(err) {}
    const local = getLocalTasks().filter(t => !t.completed);
    saveLocalTasks(local);
    loadTasks();
});

loadTasks();
setInterval(loadTasks, 60000);

// ── CLIENT-SIDE CRYPTOGRAPHIC PASSWORD GENERATOR ─────────────────────────────
const pwResult      = document.getElementById('pw-result');
const strengthBar   = document.getElementById('strength-bar');
const strengthLabel = document.getElementById('strength-label');
let pwHistory = [];

document.getElementById('pw-length').addEventListener('input', e => document.getElementById('length-val').textContent = e.target.value);
document.getElementById('pw-count').addEventListener('input',  e => document.getElementById('count-val').textContent  = e.target.value);

function getRandomChar(pool) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return pool[array[0] % pool.length];
}

function generateSinglePassword(length, uppercase, lowercase, numbers, symbols, no_ambiguous, name) {
    let pool = '';
    let reqChars = [];

    let upperSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lowerSet = 'abcdefghijklmnopqrstuvwxyz';
    let numSet   = '0123456789';
    let symSet   = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (no_ambiguous) {
        upperSet = upperSet.replace(/[O]/g, '');
        lowerSet = lowerSet.replace(/[l]/g, '');
        numSet   = numSet.replace(/[01]/g, '');
    }

    if (uppercase) { pool += upperSet; reqChars.push(getRandomChar(upperSet)); }
    if (lowercase) { pool += lowerSet; reqChars.push(getRandomChar(lowerSet)); }
    if (numbers)   { pool += numSet;   reqChars.push(getRandomChar(numSet)); }
    if (symbols)   { pool += symSet;   reqChars.push(getRandomChar(symSet)); }

    if (!pool) return 'Select at least one set';

    let remLen = length - reqChars.length;
    if (name) remLen -= name.length;
    if (remLen < 0) remLen = 0;

    let randomPart = [];
    for (let i = 0; i < remLen; i++) {
        randomPart.push(getRandomChar(pool));
    }

    let combined = [...reqChars, ...randomPart];
    // Fisher-Yates Shuffle
    for (let i = combined.length - 1; i > 0; i--) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        const j = arr[0] % (i + 1);
        [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    let resultStr = combined.join('');
    if (name) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        const insertPos = arr[0] % (resultStr.length + 1);
        resultStr = resultStr.slice(0, insertPos) + name + resultStr.slice(insertPos);
    }
    return resultStr;
}

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

document.getElementById('pw-generate-btn').addEventListener('click', () => {
    document.getElementById('pw-error').textContent = '';
    document.getElementById('pw-multi').classList.add('hidden');

    const length       = parseInt(document.getElementById('pw-length').value, 10);
    const count        = parseInt(document.getElementById('pw-count').value, 10);
    const uppercase    = document.getElementById('pw-upper').checked;
    const lowercase    = document.getElementById('pw-lower').checked;
    const numbers      = document.getElementById('pw-nums').checked;
    const symbols      = document.getElementById('pw-syms').checked;
    const no_ambiguous = document.getElementById('pw-noambig').checked;
    const name         = document.getElementById('pw-name').value.trim();

    if (!uppercase && !lowercase && !numbers && !symbols) {
        document.getElementById('pw-error').textContent = 'Please select at least one character type.';
        return;
    }

    const passwords = [];
    for (let c = 0; c < count; c++) {
        passwords.push(generateSinglePassword(length, uppercase, lowercase, numbers, symbols, no_ambiguous, name));
    }

    const primary = passwords[0];
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
