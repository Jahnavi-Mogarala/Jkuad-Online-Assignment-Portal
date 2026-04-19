// JKUAD 'Absolute Mirror' Mock Engine
// This script simulates a full Node.js/SQLite backend in the browser for the GH Pages showcase.

window.JKUAD_SESSION_DATA = JSON.parse(localStorage.getItem('jkuad_session_data')) || {
    submissions: [],
    feedback: [],
    assignments: []
};

function saveSession() {
    localStorage.setItem('jkuad_session_data', JSON.stringify(window.JKUAD_SESSION_DATA));
}

window.handleMockRequest = async function(endpoint, options) {
    const db = window.MOCK_DB;
    const method = options.method || 'GET';
    const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
    
    console.log(`[VIRTUAL BACKEND] ${method} ${endpoint}`, body);

    // --- AUTH REPLICATION ---
    if (endpoint === '/auth/login') {
        const user = db.users.find(u => u.email === body.email) || {
            name: (body.email.split('@')[0]).toUpperCase(),
            role_id: body.email.includes('teacher') ? 2 : (body.email.includes('admin') ? 1 : 3),
            id: 999
        };
        return {
            accessToken: 'session_' + Date.now(),
            user: { ...user, name: user.name + ' (LIVE)' },
            role_id: user.role_id,
            name: user.name,
            id: user.id
        };
    }

    // --- TEACHER REPLICATION ---
    if (endpoint.includes('/teacher/stats') || endpoint.includes('/teacher/analytics')) {
        return db.analytics;
    }

    if (endpoint.includes('/teacher/assignments')) {
        const parts = endpoint.split('/');
        const id = parts[parts.length - 2];
        const isSubmissions = endpoint.includes('submissions');

        if (isSubmissions && id) {
            // Merge original DB submissions with any new ones created in this session
            const base = db.submissions.filter(s => s.assignment_id == id);
            const extra = window.JKUAD_SESSION_DATA.submissions.filter(s => s.assignment_id == id);
            return [...base, ...extra].map(s => {
                const u = db.users.find(user => user.id == s.student_id) || { name: 'Student' };
                const f = [...db.feedback, ...window.JKUAD_SESSION_DATA.feedback].find(feed => feed.submission_id == s.id);
                return { ...s, student_name: u.name, graded_marks: f?.marks, teacher_feedback: f?.content };
            });
        }
        return [...db.assignments, ...window.JKUAD_SESSION_DATA.assignments];
    }

    if (endpoint.includes('/teacher/grade')) {
        const subId = endpoint.split('/').pop();
        const newFeedback = {
            submission_id: subId,
            teacher_id: localStorage.getItem('userId'),
            content: body.content,
            marks: body.marks
        };
        window.JKUAD_SESSION_DATA.feedback.push(newFeedback);
        saveSession();
        
        showEmailSimulation(`New Grade Dispatched!`, `Email sent to student regarding their ${body.marks} marks.`);
        return { message: 'Graded successfully (Session Saved)' };
    }

    if (endpoint.includes('plagiarism-report')) {
        return {
            comparisons_performed: 45,
            flags: [
                { student_1: 'Umesh', student_2: 'Jyothirmayee', similarity: '12%', status: 'Normal' },
                { student_1: 'Rahul', student_2: 'Suresh', similarity: '85%', status: 'CRITICAL PLAGIARISM' }
            ]
        };
    }

    // --- STUDENT REPLICATION ---
    if (endpoint.includes('/student/assignments')) {
        return [...db.assignments, ...window.JKUAD_SESSION_DATA.assignments];
    }

    if (endpoint.includes('/student/submissions')) {
        const sid = localStorage.getItem('userId');
        const base = db.submissions.filter(s => s.student_id == sid);
        const extra = window.JKUAD_SESSION_DATA.submissions.filter(s => s.student_id == sid);
        return [...base, ...extra];
    }

    if (endpoint.includes('/student/submit')) {
        const aid = endpoint.split('/').pop();
        const newSub = {
            id: 'S' + Date.now(),
            assignment_id: aid,
            student_id: localStorage.getItem('userId'),
            status: 'on-time',
            submitted_at: new Date().toISOString(),
            is_draft: body.get ? (body.get('is_draft') === '1' ? 1 : 0) : 0
        };
        window.JKUAD_SESSION_DATA.submissions.push(newSub);
        saveSession();
        
        showEmailSimulation(`Submission Received!`, `Confirmation email sent to Teacher Anjani and Student.`);
        return { message: 'Submission saved (Demo Persistence)' };
    }

    if (endpoint.includes('leaderboard')) return db.leaderboard;
    if (endpoint.includes('admin/users')) return db.users.filter(u => u.role_id === 3);

    return [];
};

function showEmailSimulation(title, desc) {
    const banner = document.createElement('div');
    banner.className = 'glass-card animate-slide-in';
    banner.style.cssText = `
        position: fixed; top: 80px; right: 20px; z-index: 9999;
        padding: 1.5rem; border-left: 4px solid var(--accent);
        min-width: 300px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
        <div class="flex items-center gap-3">
            <span style="font-size: 2rem;">📧</span>
            <div>
                <h4 style="margin:0; color: var(--accent);">${title}</h4>
                <p style="margin:0.25rem 0 0; font-size: 0.85rem; opacity: 0.8;">${desc}</p>
                <div style="margin-top: 0.5rem; height: 3px; background: #eee; width: 100%; position: relative;">
                     <div id="email-progress" style="height: 100%; background: var(--accent); width: 0%;"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(banner);
    
    const progress = banner.querySelector('#email-progress');
    let width = 0;
    const interval = setInterval(() => {
        width += 2;
        progress.style.width = width + '%';
        if (width >= 100) {
            clearInterval(interval);
            setTimeout(() => banner.remove(), 1000);
        }
    }, 30);
}

// Simulated CSV Export
window.simulateCSVExport = function(data, filename) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    showToast('CSV Report Generated Successfully!');
};
