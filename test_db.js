const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) throw err;
    
    console.log("Checking DB...");
    db.all("SELECT COUNT(*) as c FROM assignments", (err, row) => {
        console.log("Assignments:", row[0].c);
    });
    db.all("SELECT COUNT(*) as c FROM users", (err, row) => {
        console.log("Users:", row[0].c);
    });
    db.all("SELECT COUNT(*) as c FROM submissions", (err, row) => {
        console.log("Submissions:", row[0].c);
    });
});
