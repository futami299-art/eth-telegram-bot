const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const BOT_TOKEN = '8536388509:AAF2_J8tRu-aOwmzrBy5dh0Q6BkMX3h_YnU';
const MINI_APP_URL = 'eth-mini-app-production-60a0.up.railway.app';

let db;
async function initDB() {
    db = await open({ filename: './users.db', driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS scheduled_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, notify_at DATETIME, status TEXT DEFAULT 'pending');`);
}
async function addUser(userId, username, firstName) { await db.run('INSERT OR IGNORE INTO users (user_id, username, first_name) VALUES (?, ?, ?)', userId, username || '', firstName || ''); }
async function saveNotification(userId, notifyAt) { await db.run('INSERT INTO scheduled_notifications (user_id, notify_at) VALUES (?, ?)', userId, notifyAt); }
async function getPending() { const now = new Date().toISOString(); return await db.all("SELECT * FROM scheduled_notifications WHERE status='pending' AND notify_at <= ?", now); }
async function markSent(id) { await db.run('UPDATE scheduled_notifications SET status="sent" WHERE id=?', id); }

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());
initDB();

bot.start(async (ctx) => {
    const user = ctx.from;
    await addUser(user.id, user.username, user.first_name);
    await ctx.reply(`🎮 *Welcome ${user.first_name || 'User'}!*\n\n💰 Earn Ethereum by watching ads\n⚡ 0.00005 ETH per ad | 5 ads/day\n💎 Min withdrawal: 0.001 ETH\n\n👇 *Tap below to start earning!*`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([ [Markup.button.webApp('🚀 Open Mini App', MINI_APP_URL)] ]) });
});

async function sendNotification(userId) {
    try {
        await bot.telegram.sendMessage(userId, `🎁 *Reward Ready!*\n\nYour next ETH reward is available.\nWatch an ad now to get 0.00005 ETH!`,
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard([ [Markup.button.webApp('🎮 Claim Reward Now', MINI_APP_URL)] ]) });
        console.log(`✅ Notification sent to ${userId}`);
    } catch(e) { console.log(`❌ Failed: ${userId}`, e.message); }
}

app.post('/api/schedule-notification', async (req, res) => {
    const { user_id, notify_at } = req.body;
    if (!user_id || !notify_at) return res.status(400).json({ error: 'Missing fields' });
    await saveNotification(user_id, notify_at);
    res.json({ success: true });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

cron.schedule('* * * * *', async () => {
    const pending = await getPending();
    for (const n of pending) { await sendNotification(n.user_id); await markSent(n.id); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 API on port ${PORT}`));
bot.launch();
console.log('🤖 Bot running');
process.once('SIGINT', () => bot.stop('SIGINT'));
