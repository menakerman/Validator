// Server-side proxy for the Kehilanet "get protocol by id" endpoint.
//
// The browser cannot issue this request itself: fetch() refuses a body on a GET
// request, Cookie is a forbidden header, and kehilanet.co.il sends no CORS
// headers. So the UI POSTs { communityId, protocolId } here and this module
// replays the original curl request from Node, where none of that applies.
//
// Credentials default to the values from the original curl and can be
// overridden with env vars (the ASP session cookie in particular goes stale).
import { request } from 'node:https';

export const PROTOCOL_PATH = '/api/kehilanet/protocol';

const TARGET_URL =
  process.env.KEHILANET_PROTOCOL_URL ?? 'https://www.kehilanet.co.il/mekome/getProtocolById.asp';
const AUTH = process.env.MEKOME_AUTH ?? 'GbV6&543DsA12Erth';
const COOKIE = process.env.KEHILANET_COOKIE ?? 'ASPSESSIONIDQGSADSST=PGEOBFOCHFDDJCMCPBCFBFDB';
const TIMEOUT_MS = Number(process.env.KEHILANET_TIMEOUT_MS ?? 30_000);
const MAX_BODY_BYTES = 64 * 1024;

/** Handles POST /api/kehilanet/protocol. Shared by the dev server and `npm start`. */
export async function handleProtocolRequest(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' });
  }

  const communityId = String(payload.communityId ?? '').trim();
  const protocolId = String(payload.protocolId ?? '').trim();
  if (!communityId || !protocolId) {
    return sendJson(res, 400, { error: 'missing_ids' });
  }

  const startedAt = Date.now();
  try {
    const upstream = await callKehilanet({ communityId, protocolId });
    sendJson(res, 200, { ...upstream, durationMs: Date.now() - startedAt });
  } catch (err) {
    sendJson(res, 502, { error: 'upstream_unreachable', message: err.message });
  }
}

// Performs the upstream call: GET with a JSON body, exactly like the curl.
function callKehilanet({ communityId, protocolId }) {
  const url = new URL(TARGET_URL);
  const body = Buffer.from(JSON.stringify({ communityId, protocolId }), 'utf-8');

  return new Promise((resolve, reject) => {
    const upstream = request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          MEKOME_AUTH: AUTH,
          'Content-Type': 'application/json',
          Cookie: COOKIE,
          'Content-Length': body.byteLength,
        },
      },
      (upstreamRes) => {
        const chunks = [];
        upstreamRes.on('data', (chunk) => chunks.push(chunk));
        upstreamRes.on('end', () => {
          const contentType = upstreamRes.headers['content-type'] ?? '';
          resolve({
            status: upstreamRes.statusCode ?? 0,
            contentType,
            body: decode(Buffer.concat(chunks), contentType),
          });
        });
      },
    );

    upstream.setTimeout(TIMEOUT_MS, () => upstream.destroy(new Error('upstream timed out')));
    upstream.on('error', reject);
    upstream.end(body);
  });
}

// Israeli ASP endpoints often answer in windows-1255, so honour the charset the
// response declares instead of assuming UTF-8.
function decode(buffer, contentType) {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString('utf-8');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('request body too large'));
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
