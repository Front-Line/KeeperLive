'use strict';

const { urls, recipients } = require('./db');
const { sendMail } = require('./mailer');

const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS) || 10000;

/**
 * Probe a single URL. Considered "up" on any HTTP response < 500.
 * Network errors and 5xx responses count as "down".
 */
async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // HEAD first; some servers reject HEAD, so fall back to GET.
    let res;
    try {
      res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
      }
    } catch (headErr) {
      if (headErr.name === 'AbortError') throw headErr;
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { up: res.status < 500, status: String(res.status) };
  } catch (err) {
    const status = err.name === 'AbortError' ? 'TIMEOUT' : err.code || err.message || 'ERROR';
    return { up: false, status };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check every registered URL once. Sends an email when a URL transitions
 * up→down, and a recovery email when it transitions down→up.
 */
async function runChecks() {
  const list = urls.all();
  if (list.length === 0) return;

  const to = recipients.emails();
  const now = new Date().toISOString();

  for (const row of list) {
    const prevUp = row.is_up; // 1, 0, or null
    const { up, status } = await probe(row.url);
    urls.updateStatus(row.id, up, status, now);

    const wasUp = prevUp === 1 || prevUp === null; // treat "unknown" as up so we don't alert on first ever check being up
    if (!up && prevUp !== 0) {
      // Went down (or first check found it down).
      console.warn(`[checker] DOWN: ${row.url} (${status})`);
      try {
        await sendMail(
          to,
          `🔴 KeeperLive: ${row.url} is DOWN`,
          `KeeperLive detected that the following URL is unreachable:\n\n` +
            `  URL:     ${row.url}\n` +
            `  Status:  ${status}\n` +
            `  Checked: ${now}\n\n` +
            `You will receive another email when it recovers.`
        );
      } catch (e) {
        console.error('[checker] Failed to send DOWN email:', e.message);
      }
    } else if (up && prevUp === 0) {
      // Recovered.
      console.info(`[checker] RECOVERED: ${row.url} (${status})`);
      try {
        await sendMail(
          to,
          `🟢 KeeperLive: ${row.url} has RECOVERED`,
          `Good news — the following URL is reachable again:\n\n` +
            `  URL:     ${row.url}\n` +
            `  Status:  ${status}\n` +
            `  Checked: ${now}\n`
        );
      } catch (e) {
        console.error('[checker] Failed to send RECOVERED email:', e.message);
      }
    } else {
      console.info(`[checker] ${up ? 'up' : 'down'}: ${row.url} (${status})`);
    }
  }
}

module.exports = { runChecks, probe };
