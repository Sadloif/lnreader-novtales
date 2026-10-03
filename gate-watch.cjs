#!/usr/bin/env node
/**
 * gate-watch — reports NovTales' current reachability state.
 *
 * The published LNReader plugin (v1.0.2, commit 34df63b) parses NovTales
 * correctly; the variable is whether the site serves this client at all. This
 * script polls a lightweight page (robots.txt), using the same kind of fetch
 * the plugin uses, and confirms any "open" result against /explore, the page
 * the plugin actually requests. Only state transitions are logged, next to
 * this file in gate-watch.log.
 *
 * Usage:
 *   node gate-watch.cjs          watch; check every 30 minutes
 *   node gate-watch.cjs 10       check every 10 minutes
 *   node gate-watch.cjs --once   single check, then exit
 *
 * Exit codes with --once:
 *   0  open -> refresh the NovTales source in LNReader
 *   1  unavailable
 *   2  network error (site unreachable from this machine)
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://novtales.com';
const PROBE = '/robots.txt';
const CONFIRM = '/explore';
const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like ' +
  'Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const LOG = path.join(__dirname, 'gate-watch.log');

const args = process.argv.slice(2);
const once = args.includes('--once');
const minutes = Number(args.find(a => /^\d+(\.\d+)?$/.test(a)) || 30);

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function log(line) {
  const entry = `${stamp()}  ${line}`;
  console.log(entry);
  try {
    fs.appendFileSync(LOG, entry + '\n');
  } catch (e) {
    /* read-only location: console only */
  }
}

async function probe(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    redirect: 'manual',
  });
  const body = await res.text();
  const mitigated = res.headers.get('x-vercel-mitigated') || '-';
  const challenged =
    res.status === 429 ||
    mitigated === 'challenge' ||
    /Vercel Security Checkpoint/i.test(body);
  return { status: res.status, mitigated, challenged };
}

async function check() {
  let first;
  try {
    first = await probe(SITE + PROBE);
  } catch (e) {
    return { state: 'ERROR', detail: e.message };
  }
  if (first.challenged) {
    return {
      state: 'UNAVAILABLE',
      detail: `HTTP ${first.status} (${first.mitigated})`,
    };
  }
  // Confirm against the page the plugin actually requests.
  let second;
  try {
    second = await probe(SITE + CONFIRM);
  } catch (e) {
    return { state: 'ERROR', detail: `confirm fetch failed: ${e.message}` };
  }
  if (second.challenged) {
    return {
      state: 'UNAVAILABLE',
      detail: `robots.txt open (HTTP ${first.status}) but /explore HTTP ${second.status}`,
    };
  }
  return { state: 'OPEN', detail: `/explore HTTP ${second.status}` };
}

(async () => {
  log(`gate-watch started (interval ${minutes} min${once ? ', --once' : ''})`);
  let previous = null;
  for (;;) {
    const { state, detail } = await check();
    if (state !== previous) {
      log(`state: ${state} - ${detail}`);
      if (state === 'OPEN') {
        log('  >>> SITE AVAILABLE. Refresh the NovTales source in LNReader — the plugin works now.');
      }
      previous = state;
    }
    if (once) {
      process.exit(state === 'OPEN' ? 0 : state === 'ERROR' ? 2 : 1);
    }
    await new Promise(r => setTimeout(r, minutes * 60 * 1000));
  }
})();
