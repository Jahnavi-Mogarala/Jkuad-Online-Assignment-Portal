const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening db:', err.message);
        process.exit(1);
    }
    
    // Attempt to add the new column
    db.run("ALTER TABLE users ADD COLUMN mobile TEXT", function(err) {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Mobile column already exists.');
            } else {
                console.error('Error adding column:', err.message);
            }
        } else {
            console.log('Added mobile column to users table successfully.');
        }
        db.close();
    });
});
