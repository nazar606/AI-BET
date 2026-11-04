import express from "express";
import crypto from "node:crypto";
import OpenAI from "openai";
import { Bot, InlineKeyboard } from "grammy";

const token = process.env.BOT_TOKEN;
const publicUrl = process.env.RENDER_EXTERNAL_URL;
const openaiKey = process.env.OPENAI_API_KEY;
const webhookSecret = process.env.WEBHOOK_SECRET || crypto.randomBytes(24).toString("hex");
const port = process.env.PORT || 3000;

if (!token || !publicUrl) {
  console.error("Missing BOT_TOKEN or RENDER_EXTERNAL_URL");
  process.exit(1);
}

const bot = new Bot(token);
await bot.init();

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/api/matches", async (req, res) => {
  try {
    const events = await getSportsEvents();
    res.json(events);
  } catch (error) {
    console.error("Ошибка матчей:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/analyze", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "OpenAI API не подключён или нет средств на балансе."
      });
    }

    const { match, sport, league } = req.body;

    if (!match) {
      return res.status(400).json({ error: "Не указан матч." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Ты спортивный аналитик. Оцени вероятности исходов матча в процентах. Не выдумывай точные статистические данные. Если информации недостаточно, честно сообщи об этом. Вероятности должны в сумме составлять 100%."
        },
        {
          role: "user",
          content: `Оцени вероятности исходов матча: ${match}. Вид спорта: ${sport || "не указан"}. Лига: ${league || "не указана"}. Верни только проценты вероятностей победы каждой команды и ничьей, если она возможна.`
        }
      ]
    });

    res.json({
      probabilities: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("Ошибка AI-анализа:", error);
    res.status(500).json({ error: "Не удалось выполнить анализ." });
  }
});

const menu = new InlineKeyboard()
  .text("⚽ Спортивные прогнозы", "predictions").row()
  .text("📊 AI-анализ матча", "analysis").row()
  .text("📜 История прогнозов", "history")
  .text("👤 Профиль", "profile");

async function getSportsEvents() {
  const date = new Date().toISOString().slice(0, 10);

  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}`;

  const response = await fetch(url);

  if (!response.ok) {
  throw new Error("Sports API unavailable: " + response.status);
}

  const data = await response.json();

  return data.events || [];
}

  
  

bot.command("start", async (ctx) => {
  await ctx.reply(
    "🤖 Добро пожаловать в AI BET!\n\nНажми кнопку ниже, чтобы открыть приложение:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⚡ ОТКРЫТЬ AI BET",
              web_app: { url: process.env.RENDER_EXTERNAL_URL }
            }
          ]
        ]
      }
    }
  );
});

bot.callbackQuery("predictions", async (ctx) => {
  await ctx.answerCallbackQuery();

  try {
    const events = await getSportsEvents();

    if (!events.length) {
      return ctx.reply("На сегодня спортивных событий не найдено.");
    }

    const list = events.slice(0, 15).map((event, index) => {
      return `${index + 1}. ${event.strEvent || "Матч"}\n` +
        `🏆 ${event.strLeague || event.strSport || "Спорт"}\n` +
        `📅 ${event.dateEvent || "Дата неизвестна"}\n` +
        `🕒 ${event.strTime || "Время неизвестно"}`;
    });

    await ctx.reply(
      "⚽ СПОРТИВНЫЕ СОБЫТИЯ\n\n" +
      list.join("\n\n") +
      "\n\nЭто список событий, а не гарантированные прогнозы."
    );
  } catch (error) {
    console.error("Sports API error:", error);
    await ctx.reply("Не удалось загрузить события. Попробуй позже.");
  }
});

bot.callbackQuery("analysis", async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!openai) {
    return ctx.reply("AI API не подключён. Проверь OPENAI_API_KEY в Render.");
  }

  try {
    const events = await getSportsEvents();

    if (!events.length) {
      return ctx.reply("Сегодня нет событий для анализа.");
    }

    const matches = events.slice(0, 10).map((event) => ({
      match: event.strEvent,
      league: event.strLeague,
      sport: event.strSport,
      date: event.dateEvent,
      time: event.strTime
    }));

    const response = await openai.responses.create({
      model: "gpt-5",
      instructions:
        "Ты спортивный аналитик AI BET. Анализируй только переданные данные. " +
        "Не выдумывай статистику, травмы, форму команд и вероятности. " +
        "Объясняй, каких данных не хватает. Не обещай выигрыш.",
      input:
        "Проанализируй спортивные события:\n" +
        JSON.stringify(matches, null, 2) +
        "\nВыдели интересные матчи и объясни, каких данных не хватает для полноценного анализа."
    });

    await ctx.reply(
      "🤖 AI BET — АНАЛИЗ\n\n" +
      (response.output_text || "AI не вернул текст анализа.")
    );
  } catch (error) {
    console.error("AI analysis error:", error);
    await ctx.reply(
      "Не удалось выполнить AI-анализ. Проверь API-ключ, доступ к модели и баланс OpenAI API."
    );
  }
});

bot.callbackQuery("history", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("📜 История прогнозов пока пуста.");
});

bot.callbackQuery("profile", async (ctx) => {
  await ctx.answerCallbackQuery();

  const name = [ctx.from.first_name, ctx.from.last_name]
    .filter(Boolean)
    .join(" ");

  await ctx.reply(
    `👤 ПРОФИЛЬ\n\nИмя: ${name || "Пользователь"}\nTelegram ID: ${ctx.from.id}`
  );
});

app.get("/", (_req, res) => {
  res.sendFile("index.html", {
    root: "public"
  });
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
