const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.serialize(() => {
    db.run("UPDATE users SET name = 'Harini', email = 'harini@student.jkuad.edu' WHERE name = 'Rahul'");
    db.run("UPDATE users SET name = 'Ravi', email = 'ravi@student.jkuad.edu' WHERE name = 'Sneha'");
    db.run("UPDATE users SET name = 'Dikku', email = 'dikku@student.jkuad.edu' WHERE name = 'Arjun'");
    db.run("UPDATE users SET name = 'Meghu', email = 'meghu@student.jkuad.edu' WHERE name = 'Meena'");
    db.run("UPDATE users SET name = 'Anjani', email = 'anjani@teacher.jkuad.edu' WHERE role_id = 2 AND name = 'Prof. Smith'");
});
