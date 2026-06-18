# KeeperLive

A small uptime keeper. It periodically checks the URLs you register and emails
your recipients when a site becomes unreachable (and again when it recovers).
URLs and recipients are managed from a web backoffice — **no rebuild or restart
needed** to add or remove them.

## Features

- ⏱️ Checks every registered URL on a schedule (default: **every 5 minutes**).
- 📋 Add/remove **URLs** from the backoffice — changes take effect immediately.
- 📧 Add/remove **alert recipients** from the backoffice.
- 🔴 Sends an email when a URL goes **down**, 🟢 and when it **recovers**
  (no repeated spam while it stays down).
- 💾 State is stored in SQLite (`data/keeperlive.db`), so it survives restarts.
- ✉️ Sender account configured via `.env` (Gmail-ready).

## Quick start

```bash
npm install
cp .env.example .env   # then edit it
npm start
```

Open the backoffice at <http://localhost:3000>.

## Run with Docker

```bash
cp .env.example .env   # then edit it

# Option A — docker compose (recommended)
docker compose up -d --build

# Option B — plain docker
docker build -t keeperlive .
docker run -d --name keeperlive \
  --env-file .env \
  -p 3000:3000 \
  -v keeperlive-data:/app/data \
  keeperlive
```

The SQLite database is stored in `/app/data` inside the container, mounted to the
named volume `keeperlive-data`, so your URLs and recipients **survive container
restarts and rebuilds**. If you change `PORT` in `.env`, compose maps that port
automatically.

## Configuring Gmail as the sender

Gmail blocks plain password logins, so create an **App Password**:

1. Enable 2-Step Verification on the Google account.
2. Go to <https://myaccount.google.com/apppasswords> and create an app password.
3. Put the values in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-16-char-app-password
MAIL_FROM=KeeperLive <your-address@gmail.com>
```

If `SMTP_USER`/`SMTP_PASS` are not set, the app still runs and logs status to
the console, but no emails are sent.

## Configuration reference (`.env`)

| Variable           | Default          | Description                                            |
| ------------------ | ---------------- | ------------------------------------------------------ |
| `PORT`             | `3000`           | HTTP port for the backoffice.                          |
| `ADMIN_USER`       | _(unset)_        | If both ADMIN_* are set, the backoffice requires Basic Auth. |
| `ADMIN_PASS`       | _(unset)_        | Password for the backoffice.                           |
| `CHECK_CRON`       | `*/5 * * * *`    | Cron expression for how often to check.                |
| `CHECK_TIMEOUT_MS` | `10000`          | Per-request timeout in milliseconds.                   |
| `SMTP_HOST`        | `smtp.gmail.com` | SMTP server.                                           |
| `SMTP_PORT`        | `465`            | SMTP port.                                             |
| `SMTP_SECURE`      | `true`           | Use TLS on connect (`true` for port 465).              |
| `SMTP_USER`        | _(unset)_        | SMTP username / Gmail address.                         |
| `SMTP_PASS`        | _(unset)_        | SMTP password / Gmail app password.                    |
| `MAIL_FROM`        | `SMTP_USER`      | `From` header on alert emails.                          |

## How "down" is decided

A URL is considered **up** if it responds with an HTTP status below `500`.
Network errors, timeouts, and `5xx` responses count as **down**. Redirects are
followed. A `HEAD` request is tried first, falling back to `GET`.

## API (used by the backoffice)

| Method   | Path                   | Body              |
| -------- | ---------------------- | ----------------- |
| `GET`    | `/api/urls`            | —                 |
| `POST`   | `/api/urls`            | `{ "url": "…" }`  |
| `DELETE` | `/api/urls/:id`        | —                 |
| `GET`    | `/api/recipients`      | —                 |
| `POST`   | `/api/recipients`      | `{ "email": "…" }`|
| `DELETE` | `/api/recipients/:id`  | —                 |
| `POST`   | `/api/check-now`       | —                 |
