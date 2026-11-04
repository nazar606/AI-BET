# AI BET — Telegram bot starter

This repository contains the first runnable version of the AI BET Telegram bot.

## What works in this version

- `/start` opens the bot menu.
- Buttons for sports predictions, match analysis, prediction history and profile.
- A health-check endpoint at `/health`.
- Telegram webhook integration for deployment as a Render Web Service.

The sports content is currently a demonstration. It does not fetch live fixtures, calculate real probabilities, place bets, accept deposits or promise winnings.

## Deploy on Render

1. Create a GitHub repository and upload these project files.
2. In Render, choose **New + → Web Service** and connect the GitHub repository.
3. Use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variable:
   - `BOT_TOKEN` = your Telegram bot token from BotFather
5. Deploy. Render provides `RENDER_EXTERNAL_URL` automatically.
6. Open the service logs. Look for `Telegram webhook configured.`
7. Open your Telegram bot and send `/start`.

`WEBHOOK_SECRET` is generated automatically at startup if you do not set it yourself. You can optionally set your own random string in Render Environment.

## Important security note

Never commit your bot token to GitHub, send it in chat, or put it in source code. Add it only in Render's Environment settings. If a token has been exposed, revoke it with BotFather and use a replacement.

## Phone workflow

On iPhone, extract the ZIP in the Files app. In GitHub, create a new empty repository, then use **Add file → Upload files** to upload `index.js`, `package.json`, `.gitignore` and `README.md` from the extracted folder. Commit the files, then connect that repository in Render.
