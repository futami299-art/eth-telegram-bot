const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'notifications.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      sent INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      first_name TEXT,
      username TEXT,
      registered_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);
}

function saveUser(userId, chatId, firstName, username) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO users (user_id, chat_id, first_name, username)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      chat_id = excluded.chat_id,
      first_name = excluded.first_name,
      username = excluded.username
  `);
  stmt.run(String(userId), String(chatId), firstName || '', username || '');
}

function scheduleNotification(userId, chatId, delayMs) {
  const database = getDb();
  const scheduledAt = Date.now() + delayMs;

  // Remove any existing unsent notification for this user
  const del = database.prepare(`
    DELETE FROM scheduled_notifications
    WHERE user_id = ? AND sent = 0
  `);
  del.run(String(userId));

  const stmt = database.prepare(`
    INSERT INTO scheduled_notifications (user_id, chat_id, scheduled_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(String(userId), String(chatId), scheduledAt);
}

function getDueNotifications() {
  const database = getDb();
  const now = Date.now();
  const stmt = database.prepare(`
    SELECT * FROM scheduled_notifications
    WHERE sent = 0 AND scheduled_at <= ?
  `);
  return stmt.all(now);
}

function markNotificationSent(id) {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE scheduled_notifications SET sent = 1 WHERE id = ?
  `);
  stmt.run(id);
}

module.exports = {
  saveUser,
  scheduleNotification,
  getDueNotifications,
  markNotificationSent
};
