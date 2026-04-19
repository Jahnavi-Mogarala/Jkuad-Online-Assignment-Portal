const API_URL = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}

async function fetchAPI(endpoint, options = {}) {
    const isGitHub = window.location.hostname.toLowerCase().includes('github.io');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // IF ON GITHUB AND NO LOCAL SERVER, FORCE DEMO MODE INSTANTLY
    if (isGitHub && !isLocal) {
        console.warn(`[GITHUB LIVE DEMO] Force-Mocking endpoint: ${endpoint}`);
        return getMockData(endpoint, options);
    }

    const token = localStorage.getItem('token');
    const defaultHeaders = {};
    if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) defaultHeaders['Content-Type'] = 'application/json';

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        });

        // TRIGGER DEMO MODE on 404 / API Failure (common on GitHub Pages)
        if (!res.ok && useDemo) {
            console.warn(`[DEMO MODE] API ${endpoint} returned ${res.status}. Falling back to Mock data...`);
            return getMockData(endpoint, options);
        }

        if (res.headers.get('content-type')?.includes('text/csv')) {
            if (!res.ok) throw new Error('Export failed: ' + res.statusText);
            return res; // Return raw response for downloads
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                if (endpoint !== '/auth/login' && endpoint !== '/auth/register') {
                    localStorage.clear();
                    window.location.href = '../pages/login.html';
                }
            }
            throw new Error(data.message || data.error || 'API Error');
        }
        return data;

    } catch (error) {
        // FALLBACK TO DEMO MODE ON NETWORK ERROR
        if (useDemo) {
            return getMockData(endpoint, options);
        }
        throw error;
    }
}

// Helper to provide fake data for the live link using the MOCK_DB snapshot
function getMockData(endpoint, options) {
    console.log(`[MOCKING] ${endpoint}`);
    
    // Check if the exported snapshot exists, otherwise use defaults
    const db = window.MOCK_DB || { assignments: [], students: [], submissions: [], leaderboard: [], analytics: {} };

    if (endpoint === '/auth/login') {
        const body = JSON.parse(options.body || '{}');
        const roleId = body.email?.includes('admin') ? 1 : (body.email?.includes('teacher') ? 2 : 3);
        
        return {
            accessToken: 'demo-token-' + Date.now(),
            role_id: roleId,
            name: (body.email?.split('@')[0] || 'DEMO USER').toUpperCase() + ' (DEMO)',
            id: 999
        };
    }

    // Teacher & Admin Stats
    if (endpoint.includes('stats') || endpoint.includes('dashboard-summary') || endpoint.includes('analytics')) {
        return {
            ...db.analytics,
            total_users: db.students.length + 2,
            total_assignments: db.assignments.length,
            total_submissions: db.submissions.length,
            completed_assignments: db.submissions.filter(s => s.student_id == localStorage.getItem('userId')).length
        };
    }

    // Assignments List
    if (endpoint.includes('assignments') && !endpoint.includes('submissions')) {
        return db.assignments;
    }

    // Submissions
    if (endpoint.includes('submissions')) {
        const parts = endpoint.split('/');
        const assignmentId = parts[3] || parts[parts.length - 2];
        
        if (assignmentId && assignmentId !== 'submissions') {
            return db.submissions.filter(s => s.assignment_id == assignmentId).map(s => {
                const student = db.students.find(u => u.id == s.student_id) || { name: 'Student' };
                return { ...s, student_name: student.name };
            });
        }
        
        // Global student submissions
        const studentId = localStorage.getItem('userId');
        return db.submissions.filter(s => s.student_id == 999 || s.student_id == studentId);
    }

    if (endpoint.includes('leaderboard')) return db.leaderboard.map(s => ({...s, marks: s.total_marks || 0}));
    if (endpoint.includes('admin/users')) return db.students;
    if (endpoint === '/notifications') return [{ id: 1, message: 'Welcome to JKUAD Live Snapshot Demo!', is_read: 0 }];
    
    return [];
}

function logout() {
    localStorage.clear();
    window.location.href = '../index.html';
}

function createNavbar(title) {
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    nav.innerHTML = `
        <div class="nav-brand">JKUAD PORTAL</div>
        <div style="font-weight: 600; color: var(--text-muted);">${title}</div>
        <div class="flex items-center gap-4">
            <div id="notificationBell" style="position: relative; cursor: pointer;">
                <span style="font-size: 1.5rem;">🔔</span>
                <span id="notifBadge" style="position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; display: none;">0</span>
                <div id="notifDropdown" class="glass-card" style="display: none; position: absolute; right: -50px; top: 50px; width: 320px; padding: 1rem; z-index: 1001; max-height: 400px; overflow-y: auto; text-align: left;">
                    <h4 class="mb-2">Notifications</h4>
                    <div id="notifList">Loading...</div>
                </div>
            </div>
            <span class="badge badge-primary" id="userNameBadge">User</span>
            <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            <button class="btn btn-outline" onclick="logout()">Logout</button>
        </div>
    `;
    document.body.prepend(nav);

    const name = localStorage.getItem('name');
    if (name) document.getElementById('userNameBadge').textContent = name;

    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notifDropdown');

    bell.addEventListener('click', async (e) => {
        if (e.target.closest('#notifDropdown')) return;
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';

        if (dropdown.style.display === 'block') {
            try {
                const notifs = await fetchAPI('/notifications');
                const list = document.getElementById('notifList');
                if (notifs.length === 0) {
                    list.innerHTML = '<p class="text-center" style="color: var(--text-muted);">No notifications</p>';
                    return;
                }

                list.innerHTML = notifs.map(n => `
                    <div style="padding: 0.75rem; border-bottom: 1px solid var(--border); background: ${n.is_read ? 'transparent' : 'rgba(37,99,235,0.05)'}">
                        <p class="mb-1" style="font-size: 0.9rem; color: var(--text-main)">${n.message}</p>
                        ${!n.is_read ? `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="markRead(${n.id}, event)">Mark Read</button>` : ''}
                    </div>
                `).join('');
            } catch (e) { console.error(e); }
        }
    });

    fetchNotifs();
    setInterval(fetchNotifs, 30000); // target 30s
}

async function fetchNotifs() {
    try {
        const notifs = await fetchAPI('/notifications');
        const unread = notifs.filter(n => !n.is_read).length;
        const badge = document.getElementById('notifBadge');
        if (unread > 0) {
            badge.style.display = 'flex';
            badge.textContent = unread;
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { }
}

window.markRead = async function (id, e) {
    if (e) e.stopPropagation();
    await fetchAPI(`/notifications/${id}/read`, { method: 'POST' });
    fetchNotifs();
    document.getElementById('notifDropdown').style.display = 'none';
}

initTheme();
