'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cron = require('node-cron');

const { urls, recipients } = require('./db');
const { runChecks } = require('./checker');

const app = express();
app.use(express.json());

// ── Optional HTTP Basic Auth for the whole app ──────────────────────────────
const { ADMIN_USER, ADMIN_PASS } = process.env;
if (ADMIN_USER && ADMIN_PASS) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
      if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="KeeperLive"');
    return res.status(401).send('Authentication required.');
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ── URL API ─────────────────────────────────────────────────────────────────
app.get('/api/urls', (req, res) => {
  res.json(urls.all());
});

app.post('/api/urls', (req, res) => {
  const url = (req.body.url || '').trim();
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid http(s) URL.' });
  }
  try {
    urls.add(url);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'That URL is already registered.' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/urls/:id', (req, res) => {
  urls.remove(Number(req.params.id));
  res.json({ ok: true });
});

// ── Recipient API ───────────────────────────────────────────────────────────
app.get('/api/recipients', (req, res) => {
  res.json(recipients.all());
});

app.post('/api/recipients', (req, res) => {
  const email = (req.body.email || '').trim();
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  try {
    recipients.add(email);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'That email is already registered.' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/recipients/:id', (req, res) => {
  recipients.remove(Number(req.params.id));
  res.json({ ok: true });
});

// ── Run all checks immediately on demand ────────────────────────────────────
app.post('/api/check-now', async (req, res) => {
  try {
    await runChecks();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Backoffice (static) ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Schedule periodic checks ────────────────────────────────────────────────
const CHECK_CRON = process.env.CHECK_CRON || '*/5 * * * *';
if (!cron.validate(CHECK_CRON)) {
  console.error(`[server] Invalid CHECK_CRON "${CHECK_CRON}" — falling back to */5 * * * *`);
}
cron.schedule(cron.validate(CHECK_CRON) ? CHECK_CRON : '*/5 * * * *', () => {
  runChecks().catch((e) => console.error('[checker] run failed:', e.message));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`KeeperLive running on http://localhost:${PORT}`);
  console.log(`Health checks scheduled with cron: ${CHECK_CRON}`);
  // Kick off one check shortly after boot.
  setTimeout(() => runChecks().catch(() => {}), 3000);
});
