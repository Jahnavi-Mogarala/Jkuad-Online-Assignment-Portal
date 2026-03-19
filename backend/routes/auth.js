const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
    const { name, email, password, role_id, reg_no } = req.body;
    
    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    if (role_id === 1) return res.status(400).json({ message: 'Cannot register as Admin directly' });

    // Check if the user is trying to register a name that we already Seeded in the DB (like Adi, Harini, Jahn, Jyo, etc.)!
    db.get('SELECT id FROM users WHERE name = ? COLLATE NOCASE AND role_id = ?', [name.trim(), role_id], (err, existingDummy) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        
        if (existingDummy) {
            // MERGE! Overwrite the dummy's email and password so the new user hijacks their massive submission history flawlessly!
            db.run('UPDATE users SET email = ?, password = ?, reg_no = COALESCE(?, reg_no) WHERE id = ?', 
                [email, hashedPassword, reg_no || null, existingDummy.id], 
                function(err) {
                    if(err) return res.status(500).json({ message: 'Error merging with seeded profile', error: err.message });
                    res.status(201).json({ message: 'Profile safely mapped to existing seeded data!', userId: existingDummy.id });
                }
            );
        } else {
            // Standard Insert for completely new unique names
            db.run(
                `INSERT INTO users (name, email, password, role_id, reg_no) VALUES (?, ?, ?, ?, ?)`,
                [name.trim(), email, hashedPassword, role_id, reg_no || null],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed') || err.message.includes('UNIQUE')) {
                            if(err.message.includes('reg_no')) return res.status(400).json({ message: 'Registration Number already exists' });
                            return res.status(400).json({ message: 'Email already exists' });
                        }
                        return res.status(500).json({ message: 'Database error', error: err.message });
                    }
                    res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
                }
            );
        }
    });
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.status !== 'active') return res.status(403).json({ message: 'Account is deactivated' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Invalid Password' });

        const token = jwt.sign({ id: user.id, role_id: user.role_id, name: user.name }, JWT_SECRET, {
            expiresIn: 86400 // 24 hours
        });

        // Add to activity log that user logged in
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`, 
               [user.id, 'LOGIN', 'User logged into the system']);

        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role_id: user.role_id,
            reg_no: user.reg_no,
            accessToken: token
        });
    });
});

module.exports = router;
