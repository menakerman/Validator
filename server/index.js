// Production server: serves the built SPA from dist/ and exposes the Kehilanet
// protocol proxy. Used by `npm start` (Railway); in development the same proxy
// handler is mounted on the Vite dev server (see vite.config.ts).
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_PATH, handleProtocolRequest } from './kehilanetProxy.js';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  if (pathname === PROTOCOL_PATH) {
    await handleProtocolRequest(req, res);
    return;
  }

  // Static assets, with an index.html fallback so client-side routing works.
  const filePath = await resolveFile(pathname);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

async function resolveFile(pathname) {
  const candidate = resolve(join(ROOT, decodeURIComponent(pathname)));
  // Reject anything that escapes dist/ via ".." segments.
  if (candidate !== ROOT && !candidate.startsWith(ROOT + '/')) return null;

  if (await isFile(candidate)) return candidate;
  const index = join(ROOT, 'index.html');
  return (await isFile(index)) ? index : null;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} on http://localhost:${PORT}`);
});
