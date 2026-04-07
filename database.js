const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function initDB() {
    db = await open({
        filename: './users.db',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS scheduled_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            notify_at DATETIME,
            status TEXT DEFAULT 'pending'
        );
    `);
    
    return db;
}

async function addUser(userId, username, firstName) {
    await db.run(
        'INSERT OR IGNORE INTO users (user_id, username, first_name) VALUES (?, ?, ?)',
        userId, username || '', firstName || ''
    );
}

async function saveNotificationSchedule(userId, notifyAt) {
    await db.run(
        'INSERT INTO scheduled_notifications (user_id, notify_at) VALUES (?, ?)',
        userId, notifyAt
    );
}

async function getPendingNotifications() {
    const now = new Date().toISOString();
    return await db.all(
        "SELECT * FROM scheduled_notifications WHERE status = 'pending' AND notify_at <= ?",
        now
    );
}

async function markNotificationSent(id) {
    await db.run('UPDATE scheduled_notifications SET status = "sent" WHERE id = ?', id);
}

module.exports = { 
    initDB, 
    addUser, 
    saveNotificationSchedule, 
    getPendingNotifications, 
    markNotificationSent 
};
