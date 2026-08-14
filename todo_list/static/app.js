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
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
        try {
            await window.Capacitor.Plugins.LocalNotifications.schedule({
                notifications: [{
                    title: title,
                    body: options.body || '',
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 100) }
                }]
            });
            return;
        } catch(e) {}
    }

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
            sendNotification('⚡ Day to Day Notifications On!', {
                body: 'Task due reminders are now active!'
            });
            fetchTasks();
        }
    });
}

function checkDueNotifications(tasks) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    let notifiedMap = {};
    try {
        notifiedMap = JSON.parse(localStorage.getItem('notified_task_times') || '{}');
    } catch(e) {}

    let newlyNotified = false;

    tasks.forEach(t => {
        if (t.completed || !t.due_date) return;

        let targetTime;
        if (t.due_time) {
            targetTime = new Date(`${t.due_date}T${t.due_time}:00`);
        } else {
            // Default to start of due day (9 AM) if no specific time set
            targetTime = new Date(`${t.due_date}T09:00:00`);
        }

        const notifyKey = `${t.id}_${t.due_date}_${t.due_time || 'allday'}`;
        if (notifiedMap[notifyKey]) return;

        if (now >= targetTime) {
            const timeTag = t.due_time ? formatTime12(t.due_time) : 'Today';
            sendNotification(`⏰ Task Reminder: ${t.title}`, {
                body: `${t.description ? t.description + ' • ' : ''}Due: ${timeTag} (${t.priority.toUpperCase()} priority)`,
                tag: `task-time-${t.id}`
            });
            notifiedMap[notifyKey] = true;
            newlyNotified = true;
        }
    });

    if (newlyNotified) {
        localStorage.setItem('notified_task_times', JSON.stringify(notifiedMap));
    }
}

function formatTime12(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

function formatModernDateTime(dateStr, timeStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    const taskDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel = '';
    if (taskDate.getTime() === today.getTime()) {
        dateLabel = 'Today';
    } else if (taskDate.getTime() === tomorrow.getTime()) {
        dateLabel = 'Tomorrow';
    } else if (taskDate.getTime() === yesterday.getTime()) {
        dateLabel = 'Yesterday';
    } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateLabel = `${months[taskDate.getMonth()]} ${taskDate.getDate()}${taskDate.getFullYear() !== now.getFullYear() ? ', ' + taskDate.getFullYear() : ''}`;
    }

    const timeLabel = timeStr ? ` at ${formatTime12(timeStr)}` : '';
    return `${dateLabel}${timeLabel}`;
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
        const now = new Date();
        let targetTime;
        if (task.due_time) {
            targetTime = new Date(`${task.due_date}T${task.due_time}:00`);
        } else {
            targetTime = new Date(`${task.due_date}T23:59:59`);
        }

        const isOverdue = !task.completed && now > targetTime;
        const formattedDisplay = formatModernDateTime(task.due_date, task.due_time);
        const statusText = isOverdue ? ' · Overdue' : '';

        due = `<span class="due-date-tag ${isOverdue ? 'overdue' : ''}">📅 ${formattedDisplay}${statusText}</span>`;
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

// ── CUSTOM GRAPHICAL CALENDAR MODAL LOGIC ────────────────────────────────────
let calYear, calMonth, selectedCalDateStr = '';

function initCalendarModal() {
    const calModal = document.getElementById('calendar-modal');
    const calGrid = document.getElementById('calendar-grid');
    const calTitle = document.getElementById('cal-month-year-title');
    const dueInput = document.getElementById('task-due');
    if (!calModal || !dueInput) return;

    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();

    function renderCalendar() {
        if (!calGrid) return;
        calGrid.innerHTML = '';
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        calTitle.textContent = `${months[calMonth]} ${calYear}`;

        const firstDay = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            calGrid.appendChild(empty);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            const mStr = String(calMonth + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const dateVal = `${calYear}-${mStr}-${dStr}`;
            dayEl.textContent = d;

            if (dateVal === todayStr) dayEl.classList.add('today');
            if (dateVal === selectedCalDateStr) dayEl.classList.add('selected');

            dayEl.addEventListener('click', () => {
                selectedCalDateStr = dateVal;
                dueInput.dataset.date = dateVal;
                dueInput.value = formatModernDateTime(dateVal, null);
                closeCalModal();
            });

            calGrid.appendChild(dayEl);
        }
    }

    function openCalModal() {
        if (dueInput.dataset.date) {
            const parts = dueInput.dataset.date.split('-').map(Number);
            calYear = parts[0];
            calMonth = parts[1] - 1;
            selectedCalDateStr = dueInput.dataset.date;
        } else {
            const n = new Date();
            calYear = n.getFullYear();
            calMonth = n.getMonth();
        }
        renderCalendar();
        calModal.classList.remove('hidden');
    }

    function closeCalModal() {
        calModal.classList.add('hidden');
    }

    const trigger = document.getElementById('date-picker-trigger');
    if (trigger) trigger.addEventListener('click', openCalModal);
    dueInput.addEventListener('click', openCalModal);
    document.getElementById('cal-overlay').addEventListener('click', closeCalModal);
    document.getElementById('cal-close-btn').addEventListener('click', closeCalModal);

    document.getElementById('cal-prev-month').addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar();
    });
    document.getElementById('cal-next-month').addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
    });
    document.getElementById('cal-today-btn').addEventListener('click', () => {
        const n = new Date();
        const yStr = n.getFullYear();
        const mStr = String(n.getMonth() + 1).padStart(2, '0');
        const dStr = String(n.getDate()).padStart(2, '0');
        selectedCalDateStr = `${yStr}-${mStr}-${dStr}`;
        dueInput.dataset.date = selectedCalDateStr;
        dueInput.value = formatModernDateTime(selectedCalDateStr, null);
        closeCalModal();
    });
    document.getElementById('cal-clear-btn').addEventListener('click', () => {
        selectedCalDateStr = '';
        dueInput.dataset.date = '';
        dueInput.value = '';
        closeCalModal();
    });
}

// ── CUSTOM DIGITAL CLOCK MODAL LOGIC ─────────────────────────────────────────
let clockHour = 2, clockMin = 30, clockAmPm = 'PM';

function initClockModal() {
    const clockModal = document.getElementById('clock-modal');
    const timeInput = document.getElementById('task-time');
    if (!clockModal || !timeInput) return;

    function updateClockDisplay() {
        const hhStr = String(clockHour).padStart(2, '0');
        const mmStr = String(clockMin).padStart(2, '0');
        document.getElementById('clock-display-hh').textContent = hhStr;
        document.getElementById('clock-display-mm').textContent = mmStr;
        document.getElementById('clock-display-ampm').textContent = clockAmPm;
        document.getElementById('hour-val').textContent = hhStr;
        document.getElementById('min-val').textContent = mmStr;

        document.getElementById('ampm-am').classList.toggle('active', clockAmPm === 'AM');
        document.getElementById('ampm-pm').classList.toggle('active', clockAmPm === 'PM');
    }

    function openClockModal() {
        if (timeInput.dataset.time) {
            const parts = timeInput.dataset.time.split(':').map(Number);
            let h = parts[0];
            clockMin = parts[1] || 0;
            if (h >= 12) {
                clockAmPm = 'PM';
                clockHour = h % 12 || 12;
            } else {
                clockAmPm = 'AM';
                clockHour = h || 12;
            }
        } else {
            const n = new Date();
            let h = n.getHours();
            clockMin = n.getMinutes();
            clockAmPm = h >= 12 ? 'PM' : 'AM';
            clockHour = h % 12 || 12;
        }
        updateClockDisplay();
        clockModal.classList.remove('hidden');
    }

    function closeClockModal() {
        clockModal.classList.add('hidden');
    }

    const trigger = document.getElementById('time-picker-trigger');
    if (trigger) trigger.addEventListener('click', openClockModal);
    timeInput.addEventListener('click', openClockModal);
    document.getElementById('clock-overlay').addEventListener('click', closeClockModal);

    document.getElementById('hour-up').addEventListener('click', () => {
        clockHour = clockHour % 12 + 1;
        updateClockDisplay();
    });
    document.getElementById('hour-down').addEventListener('click', () => {
        clockHour = (clockHour - 2 + 12) % 12 + 1;
        updateClockDisplay();
    });
    document.getElementById('min-up').addEventListener('click', () => {
        clockMin = (clockMin + 1) % 60;
        updateClockDisplay();
    });
    document.getElementById('min-down').addEventListener('click', () => {
        clockMin = (clockMin - 1 + 60) % 60;
        updateClockDisplay();
    });

    document.getElementById('ampm-am').addEventListener('click', () => { clockAmPm = 'AM'; updateClockDisplay(); });
    document.getElementById('ampm-pm').addEventListener('click', () => { clockAmPm = 'PM'; updateClockDisplay(); });

    document.querySelectorAll('.quick-min').forEach(btn => {
        btn.addEventListener('click', () => {
            clockMin = parseInt(btn.dataset.m, 10);
            updateClockDisplay();
        });
    });

    document.getElementById('clock-now-btn').addEventListener('click', () => {
        const n = new Date();
        let h = n.getHours();
        clockMin = n.getMinutes();
        clockAmPm = h >= 12 ? 'PM' : 'AM';
        clockHour = h % 12 || 12;
        updateClockDisplay();
    });

    document.getElementById('clock-clear-btn').addEventListener('click', () => {
        timeInput.dataset.time = '';
        timeInput.value = '';
        closeClockModal();
    });

    document.getElementById('clock-set-btn').addEventListener('click', () => {
        let h24 = clockHour % 12;
        if (clockAmPm === 'PM') h24 += 12;
        const time24Str = `${String(h24).padStart(2,'0')}:${String(clockMin).padStart(2,'0')}`;
        timeInput.dataset.time = time24Str;
        timeInput.value = `${clockHour}:${String(clockMin).padStart(2,'0')} ${clockAmPm}`;
        closeClockModal();
    });
}

document.querySelectorAll('.timing-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('quick-min') || btn.id.startsWith('cal-') || btn.id.startsWith('clock-')) return;
        const preset = btn.dataset.preset;
        if (!preset) return;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const dueInput = document.getElementById('task-due');
        const timeInput = document.getElementById('task-time');

        if (preset === 'today') {
            dueInput.dataset.date = todayStr;
            dueInput.value = formatModernDateTime(todayStr, null);
        } else if (preset === 'tomorrow') {
            const tom = new Date(now);
            tom.setDate(tom.getDate() + 1);
            const tomY = tom.getFullYear();
            const tomM = String(tom.getMonth() + 1).padStart(2, '0');
            const tomD = String(tom.getDate()).padStart(2, '0');
            const tomStr = `${tomY}-${tomM}-${tomD}`;
            dueInput.dataset.date = tomStr;
            dueInput.value = formatModernDateTime(tomStr, null);
        } else if (preset === '1h') {
            dueInput.dataset.date = todayStr;
            dueInput.value = formatModernDateTime(todayStr, null);
            const in1h = new Date(now.getTime() + 60 * 60 * 1000);
            const h24 = String(in1h.getHours()).padStart(2, '0');
            const m = String(in1h.getMinutes()).padStart(2, '0');
            timeInput.dataset.time = `${h24}:${m}`;
            timeInput.value = formatTime12(`${h24}:${m}`);
        } else if (preset === 'tonight') {
            dueInput.dataset.date = todayStr;
            dueInput.value = formatModernDateTime(todayStr, null);
            timeInput.dataset.time = '20:00';
            timeInput.value = '8:00 PM';
        }
    });
});

// ── TOGGLE NEW TASK FORM ──────────────────────────────────────────────────
const toggleAddFormBtn = document.getElementById('toggle-add-form-btn');
const closeAddFormBtn  = document.getElementById('close-add-form-btn');
const addTaskCard      = document.getElementById('add-task-card');

function openTaskForm() {
    if (!addTaskCard) return;
    addTaskCard.classList.remove('hidden');
    if (toggleAddFormBtn) toggleAddFormBtn.style.display = 'none';
    const titleInput = document.getElementById('task-title');
    if (titleInput) setTimeout(() => titleInput.focus(), 100);
}

function closeTaskForm() {
    if (!addTaskCard) return;
    addTaskCard.classList.add('hidden');
    if (toggleAddFormBtn) toggleAddFormBtn.style.display = 'flex';
}

if (toggleAddFormBtn) {
    toggleAddFormBtn.addEventListener('click', openTaskForm);
}

if (closeAddFormBtn) {
    closeAddFormBtn.addEventListener('click', closeTaskForm);
}

document.getElementById('add-task-btn').addEventListener('click', async () => {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    const due_date = document.getElementById('task-due').dataset.date || null;
    const due_time = document.getElementById('task-time').dataset.time || null;
    await fetch('/api/tasks', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            title,
            description: document.getElementById('task-desc').value.trim(),
            priority: document.getElementById('task-priority').value,
            due_date: due_date,
            due_time: due_time
        })
    });
    document.getElementById('task-title').value  = '';
    document.getElementById('task-desc').value   = '';
    document.getElementById('task-due').value    = '';
    document.getElementById('task-due').dataset.date = '';
    document.getElementById('task-time').value   = '';
    document.getElementById('task-time').dataset.time = '';
    document.getElementById('task-priority').value = 'medium';
    closeTaskForm();
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

// Periodically check notifications every 10 seconds for timely delivery
setInterval(fetchTasks, 10000);

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
            setTimeout(() => btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2"/></svg>`, 2000);
        });
    }
});

// Initialize Graphical Calendar & Digital Clock Modals
initCalendarModal();
initClockModal();
