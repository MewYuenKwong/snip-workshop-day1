'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_BASE_URL = 'http://localhost:3000';
const BASE_URL = process.env.SNIP_API || DEFAULT_BASE_URL;

function printUsage() {
  console.log('Usage: snip <command> [args]');
  console.log('');
  console.log('Commands:');
  console.log('  snip add <url>    Create a short link');
  console.log('  snip ls           List all links');
  console.log('  snip open <code>  Open a short link target in the browser');
  console.log('  snip help         Show this help text');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureUrl(value) {
  if (!value || !/^https?:\/\//i.test(value)) {
    throw new Error('Invalid URL. Please provide a valid http(s) URL.');
  }
  return value;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payloadText = await response.text();
  let payload = null;
  try {
    payload = payloadText ? JSON.parse(payloadText) : null;
  } catch {
    payload = payloadText;
  }

  if (!response.ok) {
    const msg = typeof payload === 'object' && payload && payload.error ? payload.error : `Request failed (${response.status})`;
    throw new Error(msg);
  }

  return payload;
}

async function cmdAdd(urlValue) {
  const url = ensureUrl(urlValue);
  const result = await requestJson(`${BASE_URL}/api/links`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  console.log(result.shortUrl);
}

async function cmdLs() {
  const items = await requestJson(`${BASE_URL}/api/links`);

  if (!Array.isArray(items) || items.length === 0) {
    console.log('No links yet.');
    return;
  }

  const rows = items.map((item) => ({
    code: item.code,
    hits: String(item.hits),
    url: item.url,
  }));

  const widths = {
    code: Math.max(...rows.map((row) => row.code.length), 'CODE'.length),
    hits: Math.max(...rows.map((row) => row.hits.length), 'HITS'.length),
    url: Math.max(...rows.map((row) => row.url.length), 'URL'.length),
  };

  const head = ` ${'CODE'.padEnd(widths.code, ' ')}  ${'HITS'.padEnd(widths.hits, ' ')}  ${'URL'.padEnd(widths.url, ' ')}`;
  console.log(head);
  console.log(`${'-'.repeat(head.length)}`);

  for (const row of rows) {
    console.log(` ${row.code.padEnd(widths.code, ' ')}  ${row.hits.padEnd(widths.hits, ' ')}  ${row.url.padEnd(widths.url, ' ')}`);
  }
}

async function cmdOpen(code) {
  if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) {
    throw new Error('Invalid code. Expected a 6-character code.');
  }

  const response = await fetch(`${BASE_URL}/${code}`, { method: 'GET', redirect: 'manual' });

  if (response.status === 404) {
    throw new Error('Unknown code.');
  }

  if (response.status >= 400) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new Error('No redirect target returned.');
  }

  const platform = os.platform();
  const commandMap = {
    win32: ['cmd', '/c', 'start', '', location],
    darwin: ['open', location],
    linux: ['xdg-open', location],
  };

  const command = commandMap[platform];
  if (!command) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  if (platform === 'win32') {
    command[2] = location;
    spawn(command[0], [command[1], command[2]], { stdio: 'ignore', detached: true }).unref();
  } else {
    spawn(command[0], command.slice(1), { stdio: 'ignore', detached: true }).unref();
  }

  console.log(location);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return;
  }

  try {
    switch (args[0]) {
      case 'add':
        if (args.length !== 2) {
          throw new Error('Usage: snip add <url>');
        }
        await cmdAdd(args[1]);
        break;
      case 'ls':
        if (args.length !== 1) {
          throw new Error('Usage: snip ls');
        }
        await cmdLs();
        break;
      case 'open':
        if (args.length !== 2) {
          throw new Error('Usage: snip open <code>');
        }
        await cmdOpen(args[1]);
        break;
      default:
        throw new Error(`Unknown command: ${args[0]}`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
