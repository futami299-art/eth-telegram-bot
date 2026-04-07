require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const { initDB, addUser, saveNotificationSchedule, getPendingNotifications, markNotificationSent } = require('./database');

// Railway automatically provides PORT
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL;

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Initialize database
initDB();

// ──────────────────────────────────────────────
// TELEGRAM BOT COMMANDS
// ──────────────────────────────────────────────

bot.start(async (ctx) => {
    const user = ctx.from;
    await addUser(user.id, user.username, user.first_name);
    
    await ctx.reply(
        `🎮 *Welcome ${user.first_name || 'User'}!*\n\n` +
        `💰 Earn Ethereum by watching ads\n` +
        `⚡ 0.00005 ETH per ad | 5 ads/day\n` +
        `💎 Min withdrawal: 0.001 ETH\n\n` +
        `👇 *Tap below to start earning!*`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 Open Mini App & Earn', MINI_APP_URL)]
            ])
        }
    );
});

// Send notification function
async function sendRewardNotification(userId) {
    try {
        await bot.telegram.sendMessage(
            userId,
            `🎁 *Reward Ready!*\n\n` +
            `Your next ETH reward is available.\n` +
            `Watch an ad now to get 0.00005 ETH!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('🎮 Claim Reward Now', MINI_APP_URL)]
                ])
            }
        );
        console.log(`✅ Notification sent to ${userId}`);
    } catch (error) {
        console.log(`❌ Failed to send to ${userId}:`, error.message);
    }
}

// ──────────────────────────────────────────────
// API FOR MINI APP (Schedule notification)
// ──────────────────────────────────────────────

app.post('/api/schedule-notification', async (req, res) => {
    const { user_id, notify_at } = req.body;
    
    if (!user_id || !notify_at) {
        return res.status(400).json({ error: 'user_id and notify_at required' });
    }
    
    await saveNotificationSchedule(user_id, notify_at);
    console.log(`📅 Scheduled for user ${user_id} at ${notify_at}`);
    
    res.json({ success: true });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ──────────────────────────────────────────────
// CRON JOB - Check every minute
// ──────────────────────────────────────────────

cron.schedule('* * * * *', async () => {
    const pending = await getPendingNotifications();
    
    for (const notification of pending) {
        await sendRewardNotification(notification.user_id);
        await markNotificationSent(notification.id);
    }
});

// ──────────────────────────────────────────────
// START SERVER (Railway uses PORT)
// ──────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 API server on port ${PORT}`);
});

bot.launch();
console.log('🤖 Bot running');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));