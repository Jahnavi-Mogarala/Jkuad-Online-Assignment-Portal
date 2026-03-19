const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isStudent } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/submissions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, 'S_' + Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

router.use(verifyToken, isStudent);

// Get All Assignments
router.get('/assignments', (req, res) => {
    db.all(`
        SELECT a.*, u.name as teacher_name 
        FROM assignments a
        LEFT JOIN users u ON a.teacher_id = u.id
        ORDER BY a.due_date ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get Student's Submissions
router.get('/submissions', (req, res) => {
    db.all(`
        SELECT s.*, a.title as assignment_title, a.due_date,
               (SELECT group_concat(file_url) FROM submission_files WHERE submission_id = s.id) as files,
               (SELECT group_concat(original_name) FROM submission_files WHERE submission_id = s.id) as file_names,
               f.marks as graded_marks, f.content as teacher_feedback
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        LEFT JOIN feedback f ON f.submission_id = s.id
        WHERE s.student_id = ?
    `, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const processed = rows.map(r => ({
            ...r,
            files: r.files ? r.files.split(',') : [],
            file_names: r.file_names ? r.file_names.split(',') : []
        }));
        
        res.json(processed);
    });
});

// Submit Assignment (Supports Draft and Multiple Files)
router.post('/submit/:assignment_id', upload.array('files', 5), (req, res) => {
    const { is_draft } = req.body;
    const assignment_id = req.params.assignment_id;
    const student_id = req.userId;
    
    db.get(`SELECT due_date FROM assignments WHERE id = ?`, [assignment_id], (err, assignment) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        
        const dueDate = new Date(assignment.due_date);
        const now = new Date();
        const status = now > dueDate ? 'late' : 'on-time';
        
        // Prevent Submission if deadline passed and it's not a draft
        if (now > dueDate && is_draft !== '1' && is_draft !== true && req.body.force !== 'true') {
            return res.status(400).json({ message: 'Deadline has passed. Cannot submit unless forced or late submissions are enabled.' });
        }

        db.run(
            `INSERT INTO submissions (assignment_id, student_id, status, is_draft) VALUES (?, ?, ?, ?)`,
            [assignment_id, student_id, status, is_draft === '1' || is_draft === true ? 1 : 0],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const submission_id = this.lastID;
                
                if (req.files && req.files.length > 0) {
                    const stmt = db.prepare(`INSERT INTO submission_files (submission_id, file_url, original_name) VALUES (?, ?, ?)`);
                    req.files.forEach(f => {
                        stmt.run(submission_id, `/uploads/submissions/${f.filename}`, f.originalname);
                    });
                    stmt.finalize();
                }

                if (is_draft !== '1' && is_draft !== true) {
                    db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                        [student_id, 'SUBMIT_ASSIGNMENT', `Student submitted assignment ${assignment_id}`]);
                }
                
                res.json({ message: 'Submission saved successfully', submission_id });
            }
        );
    });
});

// Leaderboard
router.get('/leaderboard', (req, res) => {
    db.all(`
        SELECT u.id, u.name, SUM(s.marks) as total_marks, COUNT(s.id) as completed_assignments
        FROM users u
        JOIN submissions s ON u.id = s.student_id
        WHERE u.role_id = 3 AND s.marks IS NOT NULL AND s.is_draft = 0
        GROUP BY u.id
        ORDER BY total_marks DESC
        LIMIT 10
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
