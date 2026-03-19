const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Get Notifications
router.get('/notifications', (req, res) => {
    db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Mark Notification as read
router.post('/notifications/:id/read', (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// Dashboard Overview (Counts and Quick Stats for any role)
router.get('/dashboard-summary', (req, res) => {
    const roleId = req.userRole;
    
    if (roleId === 1) { // Admin
        db.get(`SELECT COUNT(*) as users_count FROM users`, [], (err, r1) => {
            db.get(`SELECT COUNT(*) as assignments_count FROM assignments`, [], (err, r2) => {
                res.json({ total_users: r1?.users_count, total_assignments: r2?.assignments_count });
            });
        });
    } else if (roleId === 2) { // Teacher
        db.get(`SELECT COUNT(*) as active FROM assignments`, [], (err, r1) => {
            res.json({ active_assignments: r1?.active });
        });
    } else { // Student
        db.get(`
            SELECT 
                COUNT(*) as total_completed,
                SUM(marks) as total_marks,
                (SELECT SUM(a.max_marks) FROM submissions s2 JOIN assignments a ON s2.assignment_id = a.id WHERE s2.student_id = ? AND s2.is_draft = 0 AND s2.marks IS NOT NULL) as total_possible
            FROM submissions WHERE student_id = ? AND is_draft = 0 AND marks IS NOT NULL
        `, [req.userId, req.userId], (err, row) => {
            const possible = row.total_possible || 0;
            const obtained = row.total_marks || 0;
            const percentage = possible > 0 ? ((obtained / possible) * 100).toFixed(1) : 0;
            let grade = 'N/A';
            if(percentage >= 90) grade = 'O';
            else if(percentage >= 80) grade = 'A+';
            else if(percentage >= 70) grade = 'A';
            else if(percentage >= 60) grade = 'B';
            else if(percentage >= 50) grade = 'C';
            else if(percentage > 0) grade = 'F';

            res.json({ 
                completed_assignments: row.total_completed,
                total_marks: obtained,
                total_possible: possible,
                percentage: percentage,
                grade: grade
            });
        });
    }
});

module.exports = router;
