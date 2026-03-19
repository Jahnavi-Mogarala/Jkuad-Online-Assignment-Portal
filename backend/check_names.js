const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('backend/database.sqlite');
db.all('SELECT id, name FROM users WHERE role_id = 3', (err, rows) => {
    console.log(rows.filter(r => ['Varun', 'Dumku', 'Karthik', 'Anju', 'Nikhil', 'Nani'].includes(r.name)));
});
