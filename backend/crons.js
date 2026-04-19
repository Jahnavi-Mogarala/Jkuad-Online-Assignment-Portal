const cron = require('node-cron');
const db = require('./db');
const { sendEmail, sendSMS } = require('./services/mailer');

function initCrons() {
    // Run every 10 minutes to sweep for impending deadlines
    cron.schedule('*/10 * * * *', () => {
        console.log('[CRON-WORKER] Running Background Auto-Deadline Enforcer...');
        
        // Find assignments due in the next 24 hours
        db.all(`
            SELECT id, title, due_date FROM assignments 
            WHERE due_date > datetime('now') AND due_date <= datetime('now', '+1 day')
        `, [], (err, assignments) => {
            if (err) return console.error('CRON Error:', err);
            
            assignments.forEach(a => {
                // Find all active students who HAVEN'T submitted it yet
                db.all(`
                    SELECT u.id, u.name, u.email, u.mobile 
                    FROM users u
                    LEFT JOIN submissions s ON u.id = s.student_id AND s.assignment_id = ? AND s.is_draft = 0
                    WHERE u.role_id = 3 AND s.id IS NULL
                `, [a.id], (err, students) => {
                    if (err) return console.error('CRON Student Error:', err);
                    
                    students.forEach(s => {
                        const msg = `URGENT RED ALERT 🚨: ${s.name}, you have less than 24 Hours to submit "${a.title}". Do it NOW or face the penalty!`;
                        db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'URGENT_DEADLINE')`, [s.id, msg]);
                        sendEmail(s.email, 'mogaralajahnavi9@gmail.com', `🚨 HURRY: "${a.title}" IS DUE SOON!`, msg);
                        if (s.mobile) sendSMS(s.mobile, msg);
                    });
                });
            });
        });
    });
    console.log('[CRON-WORKER] Automated Deadline Enforcer Initialized!');
}

module.exports = { initCrons };
