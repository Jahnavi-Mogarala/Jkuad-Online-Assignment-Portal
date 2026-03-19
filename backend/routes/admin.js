const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createObjectCsvStringifier } = require('csv-writer');

// Protect all admin routes
router.use(verifyToken, isAdmin);

// View all users
router.get('/users', (req, res) => {
    db.all(`SELECT id, name, email, role_id, status, created_at FROM users`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add user directly
router.post('/users', (req, res) => {
    const { name, email, password, role_id } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(
        `INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)`,
        [name, email, hashedPassword, role_id],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [req.userId, 'CREATE_USER', `Admin created user ${email}`]);
                
            res.json({ message: 'User created successfully', id: this.lastID });
        }
    );
});

// Remove user
router.delete('/users/:id', (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.userId, 'DELETE_USER', `Admin deleted user ID ${req.params.id}`]);
            
        res.json({ message: 'User deleted successfully' });
    });
});

// View activity logs
router.get('/logs', (req, res) => {
    db.all(`
        SELECT l.*, u.name as user_name, u.email as user_email 
        FROM activity_logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        ORDER BY l.created_at DESC LIMIT 100
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Export Data (CSV)
router.get('/export/:table', (req, res) => {
    const validTables = ['users', 'assignments', 'submissions', 'activity_logs'];
    const table = req.params.table;
    
    if (!validTables.includes(table)) return res.status(400).json({ message: 'Invalid table for export' });

    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.json({ message: 'No data to export' });
        
        const csvStringifier = createObjectCsvStringifier({
            header: Object.keys(rows[0]).map(k => ({ id: k, title: k.toUpperCase() }))
        });
        
        const header = csvStringifier.getHeaderString();
        const records = csvStringifier.stringifyRecords(rows);
        
        const csvData = header + records;
        
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.userId, 'EXPORT_DATA', `Admin exported ${table} to CSV`]);
            
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${table}_export.csv"`);
        res.send(csvData);
    });
});

// Backup System Setup
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// Download Backup
router.get('/backup', (req, res) => {
    const dbFile = path.join(__dirname, '../database.sqlite');
    const backupFile = path.join(backupDir, `backup_${Date.now()}.sqlite`);
    
    if (fs.existsSync(dbFile)) {
        fs.copyFileSync(dbFile, backupFile);
        
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.userId, 'BACKUP_DB', `Admin triggered database backup`]);
            
        res.download(backupFile, 'database_backup.sqlite');
    } else {
        res.status(404).json({ message: 'Database file not found' });
    }
});

// Restore System Setup via multer
const upload = multer({ dest: path.join(__dirname, '../backups/') });

router.post('/restore', upload.single('dbfile'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    
    const dbFile = path.join(__dirname, '../database.sqlite');
    
    try {
        fs.copyFileSync(req.file.path, dbFile);
        fs.unlinkSync(req.file.path);
        
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.userId, 'RESTORE_DB', `Admin restored database from backup`]);
            
        res.json({ message: 'Database restored successfully! Changes are immediate.' });
    } catch (err) {
        res.status(500).json({ message: 'Restore failed', error: err.message });
    }
});

module.exports = router;
