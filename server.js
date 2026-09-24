const PORT = Number(process.env.PORT || 3000);
const BASE_URL =
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`);
const PUBLIC_DIR = process.env.PUBLIC_DIR ? require('node:path').resolve(process.env.PUBLIC_DIR) : null;

const links = new Map();
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomCode() {
  let value = '';
  for (let i = 0; i < 6; i += 1) {
    value += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return value;
}

function generateUniqueCode() {
  let code = randomCode();
  while (links.has(code)) {
    code = randomCode();
  }
  return code;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

async function serveStaticFile(pathname) {
  if (!PUBLIC_DIR) {
    return null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const baseDir = require('node:path').resolve(PUBLIC_DIR);
  const requestedPath = require('node:path').resolve(baseDir, relativePath);

  if (!requestedPath.startsWith(baseDir)) {
    return null;
  }

  try {
    const file = Bun.file(requestedPath);
    if (!(await file.exists())) {
      return null;
    }

    const ext = require('node:path').extname(requestedPath).toLowerCase();
    const typeMap = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8',
    };

    return new Response(await file.text(), {
      status: 200,
      headers: {
        'Content-Type': typeMap[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }

    if (request.method === 'GET' && pathname === '/api/links') {
      return jsonResponse(Array.from(links.values()));
    }

    if (request.method === 'POST' && pathname === '/api/links') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400);
      }

      if (!body || typeof body !== 'object' || typeof body.url !== 'string') {
        return jsonResponse({ error: 'Invalid JSON' }, 400);
      }

      let submittedUrl;
      try {
        submittedUrl = new URL(body.url);
      } catch {
        return jsonResponse({ error: 'Invalid URL' }, 400);
      }

      if (submittedUrl.protocol !== 'http:' && submittedUrl.protocol !== 'https:') {
        return jsonResponse({ error: 'URL must use http or https' }, 400);
      }

      const code = generateUniqueCode();
      const entry = {
        code,
        url: submittedUrl.toString(),
        shortUrl: `${BASE_URL.replace(/\/$/, '')}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };

      links.set(code, entry);
      return jsonResponse(entry, 201);
    }

    if (request.method === 'GET') {
      const staticFile = await serveStaticFile(pathname);
      if (staticFile) {
        return staticFile;
      }

      const code = pathname.replace(/^\/+|\/+$/g, '');
      if (code && links.has(code)) {
        const entry = links.get(code);
        entry.hits += 1;
        return Response.redirect(entry.url, 302);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
});

console.log(`Snip backend running on http://localhost:${PORT}`);
console.log(`Using BASE_URL=${BASE_URL}`);
if (PUBLIC_DIR) {
  console.log(`Serving static files from ${PUBLIC_DIR}`);
}
