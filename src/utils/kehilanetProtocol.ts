// Client side of the Kehilanet protocol request. The actual call is made by
// the app's own proxy (see server/kehilanetProxy.js) because a browser cannot
// send a GET with a body, set a Cookie header, or reach kehilanet.co.il
// cross-origin.

export const PROTOCOL_ENDPOINT = '/api/kehilanet/protocol';

const CURL_URL = 'https://www.kehilanet.co.il/mekome/getProtocolById.asp';

export interface ProtocolInput {
  communityId: string;
  protocolId: string;
}

export interface ProtocolResponse {
  /** HTTP status returned by Kehilanet (not by the proxy). */
  status: number;
  contentType: string;
  body: string;
  durationMs: number;
}

// Proxy error codes mapped to i18n keys shown in the UI.
const ERROR_KEYS: Record<string, string> = {
  invalid_json: 'protocol.errors.badRequest',
  method_not_allowed: 'protocol.errors.badRequest',
  missing_ids: 'protocol.errors.missingIds',
  upstream_unreachable: 'protocol.errors.upstream',
};

/** Ids are numeric strings; anything else is a typo, not a request worth sending. */
export function isValidId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/** The equivalent curl, shown in the UI so a run can be reproduced in a terminal. */
export function buildCurl({ communityId, protocolId }: ProtocolInput): string {
  const body = JSON.stringify({ communityId, protocolId }, null, 4);
  return [
    `curl --location --request GET '${CURL_URL}' \\`,
    `--header 'MEKOME_AUTH: <token>' \\`,
    `--header 'Content-Type: application/json' \\`,
    `--header 'Cookie: <session>' \\`,
    `--data '${body}'`,
  ].join('\n');
}

/** Pretty-prints a JSON body, or returns null when the body is not JSON. */
export function prettyJson(body: string): string | null {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return null;
  }
}

/**
 * Runs the request through the proxy. Rejects with an i18n key as the message
 * so the caller can translate it.
 */
export async function fetchProtocol(
  input: ProtocolInput,
  signal?: AbortSignal,
): Promise<ProtocolResponse> {
  let response: Response;
  try {
    response = await fetch(PROTOCOL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        communityId: input.communityId.trim(),
        protocolId: input.protocolId.trim(),
      }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error('protocol.errors.network');
  }

  const payload = (await response.json().catch(() => null)) as
    | (ProtocolResponse & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(
      (payload?.error && ERROR_KEYS[payload.error]) ?? 'protocol.errors.unexpected',
    );
  }

  return {
    status: payload.status,
    contentType: payload.contentType ?? '',
    body: payload.body ?? '',
    durationMs: payload.durationMs ?? 0,
  };
}
