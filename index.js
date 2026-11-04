import express from "express";
import crypto from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";

const token = process.env.BOT_TOKEN;
const publicUrl = process.env.RENDER_EXTERNAL_URL;
const webhookSecret =
  process.env.WEBHOOK_SECRET || crypto.randomBytes(24).toString("hex");
const port = process.env.PORT || 3000;

if (!token || !publicUrl) {
  console.error("Missing BOT_TOKEN or RENDER_EXTERNAL_URL");
  process.exit(1);
}

const bot = new Bot(token);
await bot.init();

const app = express();
app.use(express.json());

const menu = new InlineKeyboard()
  .text("⚽ Спортивные прогнозы", "predictions").row()
  .text("📊 Анализ матча", "analysis").row()
  .text("📜 История прогнозов", "history")
  .text("👤 Профиль", "profile");

async function getSportsEvents() {
  const date = new Date().toISOString().slice(0, 10);
  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Sports API unavailable");

  const data = await response.json();
  return data.events || [];
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Добро пожаловать в AI BET!\n\nВыбери раздел:",
    { reply_markup: menu }
  );
});

bot.callbackQuery("predictions", async (ctx) => {
  await ctx.answerCallbackQuery();

  try {
    const events = await getSportsEvents();

    if (!events.length) {
      return ctx.reply("На сегодня в спортивной базе событий не найдено. Попробуй позже.");
    }

    const list = events.slice(0, 15).map((event, index) => {
      const time = event.strTime || "Время не указано";
      const homeScore = event.intHomeScore;
      const awayScore = event.intAwayScore;
      const score =
        homeScore !== null && awayScore !== null
          ? ` | Счёт: ${homeScore}:${awayScore}`
          : "";

      return `${index + 1}. ${event.strEvent || "Матч"}\n🏆 ${event.strLeague || event.strSport || "Спорт"}\n🕒 ${time}${score}`;
    });

    await ctx.reply(
      `⚽ СОБЫТИЯ НА ${new Date().toLocaleDateString("ru-RU")}\n\n${list.join("\n\n")}\n\nЭто расписание событий, не готовые прогнозы.`
    );
  } catch (error) {
    console.error("Sports API error:", error);
    await ctx.reply("Не удалось загрузить матчи. Попробуй немного позже.");
  }
});

bot.callbackQuery("analysis", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("📊 AI-анализ матчей пока находится в разработке. Сейчас подключаем спортивные данные.");
});

bot.callbackQuery("history", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("📜 История прогнозов пока пуста.");
});

bot.callbackQuery("profile", async (ctx) => {
  await ctx.answerCallbackQuery();
  const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");
  await ctx.reply(`👤 ПРОФИЛЬ\n\nИмя: ${name || "Пользователь"}\nTelegram ID: ${ctx.from.id}`);
});

app.get("/", (_req, res) => {
  res.status(200).send("AI BET bot is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, app: "AI BET" });
});

app.post("/telegram-webhook", async (req, res) => {
  const receivedSecret = req.get("X-Telegram-Bot-Api-Secret-Token");

  if (receivedSecret !== webhookSecret) {
    return res.sendStatus(403);
  }

  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram update error:", error);
    res.sendStatus(500);
  }
});

async function start() {
  app.listen(port, async () => {
    console.log(`AI BET server listening on port ${port}`);

    try {
      await bot.api.setWebhook(`${publicUrl}/telegram-webhook`, {
        secret_token: webhookSecret,
        drop_pending_updates: true
      });
      console.log("Telegram webhook configured.");
    } catch (error) {
      console.error("Could not configure Telegram webhook:", error);
      process.exit(1);
    }
  });
}

start();



