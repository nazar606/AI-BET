import express from "express";
import crypto from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";

const token = process.env.BOT_TOKEN;
const publicUrl = process.env.RENDER_EXTERNAL_URL;
const webhookSecret =
  process.env.WEBHOOK_SECRET || crypto.randomBytes(24).toString("hex");
const port = process.env.PORT || 3000;

if (!token) {
  console.error("Missing BOT_TOKEN environment variable.");
  process.exit(1);
}

if (!publicUrl) {
  console.error("Missing RENDER_EXTERNAL_URL.");
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

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Добро пожаловать в AI BET!\n\nВыбери нужный раздел. Сейчас это стартовая версия: демонстрационные прогнозы не являются советом по ставкам и не гарантируют результат.",
    { reply_markup: menu }
  );
});

bot.callbackQuery("predictions", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "⚽ СПОРТИВНЫЕ ПРОГНОЗЫ\n\nПока доступен демонстрационный пример. Подключение актуальных матчей и статистики будет следующим этапом.\n\nПример: Реал Мадрид — Барселона\nДемо-идея: обе команды забьют.\nЭто не реальный прогноз и не рекомендация ставить."
  );
});

bot.callbackQuery("analysis", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "📊 АНАЛИЗ МАТЧА\n\nМодуль анализа пока находится в разработке."
  );
});

bot.callbackQuery("history", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("📜 ИСТОРИЯ ПРОГНОЗОВ\n\nПока прогнозов в истории нет.");
});

bot.callbackQuery("profile", async (ctx) => {
  await ctx.answerCallbackQuery();
  const name = [ctx.from.first_name, ctx.from.last_name]
    .filter(Boolean)
    .join(" ");

  await ctx.reply(
    `👤 ПРОФИЛЬ\n\nИмя: ${name || "Пользователь"}\nTelegram ID: ${ctx.from.id}\n\nЭто базовая версия профиля.`
  );
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
