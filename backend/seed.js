const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const defaultPass = bcrypt.hashSync('password123', 8);

db.serialize(() => {
    // Attempt Schema Migrations
    db.run(`ALTER TABLE users ADD COLUMN reg_no TEXT`, (err) => { /* ignore if exists */ });
    db.run(`ALTER TABLE assignments ADD COLUMN max_marks INTEGER DEFAULT 20`, (err) => { /* ignore if exists */ });

    // Clean DB
    db.run(`DELETE FROM feedback`);
    db.run(`DELETE FROM submission_files`);
    db.run(`DELETE FROM submissions`);
    db.run(`DELETE FROM assignments`);
    db.run(`DELETE FROM activity_logs`);
    db.run(`DELETE FROM notifications`);
    db.run(`DELETE FROM users`);

    // Insert Admin & Teacher
    db.run(`INSERT INTO users (id, name, email, password, role_id) VALUES (1, 'Admin', 'admin@jkuad.edu', '${defaultPass}', 1)`);
    db.run(`INSERT INTO users (id, name, email, password, role_id) VALUES (2, 'Prof. Smith', 'smith@jkuad.edu', '${defaultPass}', 2)`);

    // Students (Explicitly listing the main crew)
    const students = [
        {id: 3, name: 'Jahn', reg: '351'},
        {id: 4, name: 'Jyo', reg: '352'},
        {id: 5, name: 'Amma', reg: '353'},
        {id: 6, name: 'Appus', reg: '354'},
        {id: 7, name: 'Dumku', reg: '355'},
        {id: 8, name: 'Kutty', reg: '356'},
        {id: 9, name: 'Adi', reg: '357'},
        {id: 10, name: 'Harini', reg: '358'},
        {id: 11, name: 'Ravi', reg: '359'},
        {id: 12, name: 'Dikku', reg: '360'},
        {id: 13, name: 'Meghu', reg: '361'},
        {id: 14, name: 'Karthik', reg: '362'},
        {id: 15, name: 'Divya', reg: '363'},
        {id: 16, name: 'Nikhil', reg: '364'},
        {id: 17, name: 'Pooja', reg: '365'},
        {id: 18, name: 'Varun', reg: '366'},
        {id: 19, name: 'Kavya', reg: '367'},
        {id: 20, name: 'Manoj', reg: '368'},
        {id: 21, name: 'Riya', reg: '369'},
        {id: 22, name: 'Sanjay', reg: '370'}
    ];

    const stmtUser = db.prepare(`INSERT INTO users (id, name, email, password, role_id, reg_no) VALUES (?, ?, ?, ?, 3, ?)`);
    students.forEach(s => stmtUser.run(s.id, s.name, `${s.name.toLowerCase()}@student.jkuad.edu`, defaultPass, s.reg));
    stmtUser.finalize();

    // CSE Subjects & Assignments
    const subjects = ['Data Structures', 'Algorithms', 'Database Management Systems', 'Operating Systems', 'Computer Networks'];
    
    const past = new Date(Date.now() - 86400000 * 5).toISOString();
    const future = new Date(Date.now() + 86400000 * 5).toISOString();

    const stmtAssign = db.prepare(`INSERT INTO assignments (id, title, description, teacher_id, subject, due_date, max_marks) VALUES (?, ?, ?, 2, ?, ?, 20)`);
    
    // Create assignments (A1 is DS, A3 is Algo, A5 is DBMS...)
    let assignId = 1;
    subjects.forEach(sub => {
        stmtAssign.run(`A${assignId}`, `${sub} Implementation`, `Detailed technical assignment for ${sub}`, sub, past);
        assignId++;
        stmtAssign.run(`A${assignId}`, `Advanced ${sub} Topics`, `Deep dive report into ${sub}`, sub, future);
        assignId++;
    });
    stmtAssign.finalize();

    // Submissions Logic
    const stmtSub = db.prepare(`INSERT INTO submissions (id, assignment_id, student_id, submitted_at, status, marks, is_draft) VALUES (?, ?, ?, ?, 'on-time', ?, 0)`);
    const stmtFb = db.prepare(`INSERT INTO feedback (submission_id, teacher_id, content, marks) VALUES (?, 2, ?, ?)`);
    const stmtFile = db.prepare(`INSERT INTO submission_files (submission_id, file_path, original_name) VALUES (?, ?, ?)`);
    
    let subId = 1;
    function addSub(a_id, s_id, marks, remark) {
        stmtSub.run(subId, a_id, s_id, past, marks);
        stmtFb.run(subId, remark, marks);
        stmtFile.run(subId, '#', `Final_Report_${a_id}.pdf`);
        subId++;
    }

    // Main Crew Specifically Targeted! (Jahn, Jyo, Amma, Appus, Dumku, Kutty)
    const activeCrew = [
        {id: 3, name: 'Jahn', scores: [18, 19, 17]},
        {id: 4, name: 'Jyo', scores: [16, 17, 18]},
        {id: 5, name: 'Amma', scores: [15, 14, 16]},
        {id: 6, name: 'Appus', scores: [19, 18, 19]}, // Appus doing really well!
        {id: 7, name: 'Dumku', scores: [14, 15, 17]},
        {id: 8, name: 'Kutty', scores: [17, 16, 15]}
    ];

    activeCrew.forEach(st => {
        addSub('A1', st.id, st.scores[0], `Great start ${st.name}! Focus on efficiency.`); // Data Structures (A1)
        addSub('A3', st.id, st.scores[1], 'Detailed algorithm implementation.'); // Algorithms (A3)
        addSub('A5', st.id, st.scores[2], 'Well structured schema tables.'); // DBMS (A5)
    });

    // Randomize graded past submissions for remaining students
    for(let sid=9; sid<=22; sid++) {
        [1,3,5,7,9].forEach(aid => {
            if(Math.random() > 0.4) { // 60% chance to submit
                let m = Math.floor(Math.random() * 12) + 6; // marks between 6 and 17
                addSub(`A${aid}`, sid, m, 'Graded continuous evaluation');
            }
        });
    }

    // MASSIVE FLOOD OF UNGRADED ACTIVE SUBMISSIONS
    // Make many students submit the ACTIVE ALIVE assignments (Even IDs like A2, A4, A6, A8, A10)
    for(let sid=3; sid<=22; sid++) {
        [2, 4, 6, 8, 10].forEach(aid => {
            if(Math.random() > 0.3) { // 70% submit rate for active assignments!
                // Submit without marks (Waiting for Teacher to grade!)
                stmtSub.run(subId, `A${aid}`, sid, new Date().toISOString(), 'on-time', null, 0);
                stmtFile.run(subId, '#', `Code_Project_${aid}_Final.zip`);
                subId++;
            }
        });
    }

    stmtSub.finalize();
    stmtFb.finalize();
    stmtFile.finalize();

    console.log("Database perfectly seeded with Jahn, Jyo, Amma, Appus, Dumku, and Kutty specifically added and heavily graded!");
});
