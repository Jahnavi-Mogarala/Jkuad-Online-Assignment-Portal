const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isTeacher } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads dir
const uploadDir = path.join(__dirname, '../uploads/assignments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'A_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const createCsvWriter = require('csv-writer').createObjectCsvWriter;

router.use(verifyToken, isTeacher);

// Export Results
router.get('/export-results', async (req, res) => {
    console.log(`[CSV EXPORT] Request received by Teacher ID: ${req.userId}`);
    const query = `
        SELECT u.reg_no, u.name, a.subject, a.title, s.status, s.marks, a.max_marks
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.is_draft = 0
        ORDER BY a.subject, u.name
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Simple memory-based CSV generation
        const header = ['REG NO', 'STUDENT NAME', 'SUBJECT', 'ASSIGNMENT', 'STATUS', 'MARKS', 'MAX MARKS'];
        const csvRows = [header.join(',')];
        
        rows.forEach(r => {
            const row = [
                `"${r.reg_no || ''}"`,
                `"${r.name || ''}"`,
                `"${r.subject || ''}"`,
                `"${r.title || ''}"`,
                `"${r.status || ''}"`,
                r.marks !== null ? r.marks : 'N/A',
                r.max_marks || 0
            ];
            csvRows.push(row.join(','));
        });
        
        const csvString = csvRows.join('\r\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=JKUAD_Results_${Date.now()}.csv`);
        res.status(200).send(csvString);
    });
});

// Create Assignment
router.post('/assignments', upload.single('file'), (req, res) => {
    const { title, description, subject, due_date, is_important } = req.body;
    const file_url = req.file ? `/uploads/assignments/${req.file.filename}` : null;
    const id = 'A' + Math.floor(Math.random() * 1000000); // Simple unique ID
    
    db.run(
        `INSERT INTO assignments (id, title, description, teacher_id, subject, due_date, file_url, is_important) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, description, req.userId, subject, due_date, file_url, is_important === 'true' || is_important === true ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Notify students
            db.all(`SELECT id FROM users WHERE role_id = 3 AND status = 'active'`, [], (err, students) => {
                if (students) {
                    const stmt = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`);
                    students.forEach(s => stmt.run(s.id, `New Assignment: ${title}`, 'ASSIGNMENT'));
                    stmt.finalize();
                }
            });

            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [req.userId, 'CREATE_ASSIGNMENT', `Teacher created assignment ${id}`]);
                
            res.json({ message: 'Assignment created successfully', id });
        }
    );
});

// Get Teacher's Assignments
router.get('/assignments', (req, res) => {
    db.all(`SELECT * FROM assignments ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// View Submissions for an assignment
router.get('/assignments/:id/submissions', (req, res) => {
    const query = `
        SELECT s.*, u.name as student_name, u.email as student_email,
               (SELECT group_concat(file_url) FROM submission_files WHERE submission_id = s.id) as files,
               (SELECT group_concat(original_name) FROM submission_files WHERE submission_id = s.id) as file_names,
               f.marks as graded_marks, f.content as teacher_feedback
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        LEFT JOIN feedback f ON f.submission_id = s.id
        WHERE s.assignment_id = ? AND s.is_draft = 0
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const processed = rows.map(r => ({
            ...r,
            files: r.files ? r.files.split(',') : [],
            file_names: r.file_names ? r.file_names.split(',') : []
        }));
        
        res.json(processed);
    });
});

// Recent Submissions (Global Feed)
router.get('/recent-submissions', (req, res) => {
    const query = `
        SELECT s.*, u.name as student_name, u.email as student_email, a.title as assignment_title,
               (SELECT group_concat(file_url) FROM submission_files WHERE submission_id = s.id) as files,
               (SELECT group_concat(original_name) FROM submission_files WHERE submission_id = s.id) as file_names,
               f.marks as graded_marks, f.content as teacher_feedback
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        LEFT JOIN feedback f ON f.submission_id = s.id
        WHERE s.is_draft = 0
        ORDER BY s.submitted_at DESC
        LIMIT 50
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(r => ({
            ...r,
            files: r.files ? r.files.split(',') : [],
            file_names: r.file_names ? r.file_names.split(',') : []
        }));
        res.json(processed);
    });
});

// Grade and leave Feedback
router.post('/grade/:submission_id', (req, res) => {
    const { marks, content } = req.body;
    
    db.run(
        `INSERT INTO feedback (submission_id, teacher_id, content, marks) VALUES (?, ?, ?, ?)`,
        [req.params.submission_id, req.userId, content, marks],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Update marks in submissions table
            db.run(`UPDATE submissions SET marks = ? WHERE id = ?`, [marks, req.params.submission_id]);
            
            // Notify student
            db.get(`SELECT student_id, assignment_id FROM submissions WHERE id = ?`, [req.params.submission_id], (err, sub) => {
                if (sub) {
                    db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`,
                        [sub.student_id, `Your submission for ${sub.assignment_id} has been graded: ${marks} marks`, 'GRADE']);
                }
            });
            
            res.json({ message: 'Graded successfully' });
        }
    );
});

// Dashboard Stats
router.get('/stats', (req, res) => {
    const statsQuery = `
        SELECT 
            COUNT(DISTINCT a.id) as total_assignments,
            COUNT(DISTINCT s.id) as total_submissions,
            AVG(s.marks) as average_marks
        FROM assignments a
        LEFT JOIN submissions s ON a.id = s.assignment_id AND s.is_draft = 0
    `;
    db.get(statsQuery, [], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            total_assignments: stats.total_assignments || 0,
            total_submissions: stats.total_submissions || 0,
            average_marks: stats.average_marks ? parseFloat(stats.average_marks).toFixed(2) : 0
        });
    });
});

// Smart Class Insights Analytics
router.get('/analytics', (req, res) => {
    const query = `
        SELECT u.id, u.name, SUM(s.marks) as total_marks,
               (SELECT SUM(a.max_marks) FROM submissions s2 JOIN assignments a ON s2.assignment_id = a.id WHERE s2.student_id = u.id AND s2.is_draft = 0 AND s2.marks IS NOT NULL) as total_possible
        FROM users u
        LEFT JOIN submissions s ON u.id = s.student_id AND s.is_draft = 0
        WHERE u.role_id = 3
        GROUP BY u.id
    `;
    
    db.all(query, [], (err, students) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let topper = null;
        let lowScorers = 0;
        let topPerformers = 0;
        let maxMarks = -1;

        students.forEach(st => {
            const possible = st.total_possible || 0;
            const obtained = st.total_marks || 0;
            const pct = possible > 0 ? (obtained / possible) * 100 : 0;
            
            if (obtained > maxMarks && possible > 0) {
                maxMarks = obtained;
                topper = st.name;
            }
            
            if (possible > 0 && pct < 40) lowScorers++;
            if (possible > 0 && pct >= 80) topPerformers++;
        });

        db.get(`
            SELECT COUNT(*) as missing FROM assignments a
            CROSS JOIN users u
            LEFT JOIN submissions s ON a.id = s.assignment_id AND u.id = s.student_id AND s.is_draft = 0
            WHERE u.role_id = 3 AND s.id IS NULL AND a.due_date < datetime('now')
        `, [], (err, r) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                topper: topper || 'N/A',
                lowScorers: lowScorers,
                topPerformers: topPerformers,
                missingSubmissions: r && r.missing ? r.missing : 0
            });
        });
    });
});

// Students Directory
router.get('/students', (req, res) => {
    db.all(`
        SELECT u.id, u.reg_no, u.name, u.email, u.created_at as joined_at,
               COUNT(DISTINCT s.id) as submissions_count
        FROM users u
        LEFT JOIN submissions s ON u.id = s.student_id AND s.is_draft = 0
        WHERE u.role_id = 3
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
