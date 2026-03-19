const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.serialize(() => {
    // We already have a Dumku (ID 7). We are renaming Varun (ID 18) to Dumku as requested.
    db.run("UPDATE users SET name = 'Dumku', email = 'dumku2@student.jkuad.edu' WHERE name = 'Varun'", function(err) {
        if(err) console.error(err);
        else console.log("Updated Varun -> Dumku. Rows affected:", this.changes);
    });

    db.run("UPDATE users SET name = 'Anju', email = 'anju@student.jkuad.edu' WHERE name = 'Karthik'", function(err) {
        if(err) console.error(err);
        else console.log("Updated Karthik -> Anju. Rows affected:", this.changes);
    });

    db.run("UPDATE users SET name = 'Nani', email = 'nani@student.jkuad.edu' WHERE name = 'Nikhil'", function(err) {
        if(err) console.error(err);
        else console.log("Updated Nikhil -> Nani. Rows affected:", this.changes);
    });
});
