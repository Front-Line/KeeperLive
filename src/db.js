'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Persist data outside the source tree so it survives rebuilds/restarts.
const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'keeperlive.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT NOT NULL UNIQUE,
    is_up           INTEGER,                 -- 1 up, 0 down, NULL not yet checked
    last_status     TEXT,                    -- e.g. "200" or "ECONNREFUSED"
    last_checked_at TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── URLs ────────────────────────────────────────────────────────────────────
const urls = {
  all: () => db.prepare('SELECT * FROM urls ORDER BY created_at DESC').all(),
  add: (url) =>
    db.prepare('INSERT INTO urls (url) VALUES (?)').run(url),
  remove: (id) =>
    db.prepare('DELETE FROM urls WHERE id = ?').run(id),
  updateStatus: (id, isUp, status, checkedAt) =>
    db
      .prepare(
        'UPDATE urls SET is_up = ?, last_status = ?, last_checked_at = ? WHERE id = ?'
      )
      .run(isUp ? 1 : 0, status, checkedAt, id),
};

// ── Recipients ──────────────────────────────────────────────────────────────
const recipients = {
  all: () => db.prepare('SELECT * FROM recipients ORDER BY created_at DESC').all(),
  emails: () => db.prepare('SELECT email FROM recipients').all().map((r) => r.email),
  add: (email) =>
    db.prepare('INSERT INTO recipients (email) VALUES (?)').run(email),
  remove: (id) =>
    db.prepare('DELETE FROM recipients WHERE id = ?').run(id),
};

module.exports = { db, urls, recipients };
