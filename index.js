require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const db = require('./database');

// ── Config ────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || '8536388509:AAF2_J8tRu-aOwmzrBy5dh0Q6BkMX3h_YnU';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-mini-app.railway.app';
const PORT = process.env.PORT || 3000;
const NOTIFICATION_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Bot Setup ─────────────────────────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
  console.error('[BOT POLLING ERROR]', err.message);
});

// ── /start command ────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'Crypto Earner';
  const username = msg.from.username || '';

  // Save user to DB
  db.saveUser(userId, chatId, firstName, username);

  const welcomeText =
    `👋 *Welcome, ${firstName}!*\n\n` +
    `💎 *ETH Reward Mini App* mein aapka swagat hai!\n\n` +
    `🎯 *Kya kar sakte ho:*\n` +
    `• Ads dekho aur ETH kamao\n` +
    `• Har ad pe earn karo *0.00005 ETH*\n` +
    `• Daily *5 ads* dekh sakte ho\n` +
    `• Minimum withdrawal: *0.001 ETH*\n\n` +
    `⬇️ Neeche button dabao aur earning shuru karo!`;

  await bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Open ETH Reward App',
            web_app: { url: MINI_APP_URL }
          }
        ]
      ]
    }
  });
});

// ── Express API Server ────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Schedule notification endpoint (called from Mini App)
app.post('/api/schedule-notification', async (req, res) => {
  try {
    const { userId, chatId, firstName } = req.body;

    if (!userId || !chatId) {
      return res.status(400).json({ error: 'userId and chatId required' });
    }

    db.scheduleNotification(userId, chatId, NOTIFICATION_DELAY_MS);

    console.log(`[NOTIFICATION SCHEDULED] user=${userId} chat=${chatId}`);
    res.json({ success: true, scheduledIn: '6 hours' });
  } catch (err) {
    console.error('[SCHEDULE ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Notification Cron (every 60 seconds) ─────────────────────────────────────
async function sendDueNotifications() {
  try {
    const due = db.getDueNotifications();

    for (const notif of due) {
      try {
        await bot.sendMessage(notif.chat_id,
          `⏰ *ETH Earn karne ka waqt aa gaya!*\n\n` +
          `💰 Aaj ke 5 ads abhi available hain.\n` +
          `Jaldi karo — har ad se earn karo *0.00005 ETH*!\n\n` +
          `👇 Tap karke earning shuru karo:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '💎 ETH Earn Karo Abhi!',
                    web_app: { url: MINI_APP_URL }
                  }
                ]
              ]
            }
          }
        );

        db.markNotificationSent(notif.id);
        console.log(`[NOTIFICATION SENT] user=${notif.user_id}`);
      } catch (sendErr) {
        console.error(`[SEND ERROR] user=${notif.user_id}`, sendErr.message);
        db.markNotificationSent(notif.id); // Mark sent to avoid retry loop
      }
    }
  } catch (err) {
    console.error('[CRON ERROR]', err);
  }
}

setInterval(sendDueNotifications, 60 * 1000);

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ ETH Telegram Bot running on port ${PORT}`);
  console.log(`🤖 Bot polling started`);
  console.log(`🔔 Notification cron active (every 60s)`);
});
