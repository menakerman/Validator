import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PROTOCOL_ENDPOINT,
  buildCurl,
  fetchProtocol,
  isValidId,
  prettyJson,
} from './kehilanetProtocol';

function mockFetch(status: number, payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isValidId', () => {
  it('accepts digit-only ids with surrounding spaces', () => {
    expect(isValidId('13318')).toBe(true);
    expect(isValidId(' 24423 ')).toBe(true);
  });

  it('rejects empty and non-numeric values', () => {
    expect(isValidId('')).toBe(false);
    expect(isValidId('13318a')).toBe(false);
    expect(isValidId('133-18')).toBe(false);
  });
});

describe('prettyJson', () => {
  it('formats a JSON body', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('returns null for a non-JSON body', () => {
    expect(prettyJson('<html>error</html>')).toBeNull();
  });
});

describe('buildCurl', () => {
  it('includes the endpoint and both ids, and redacts the credentials', () => {
    const curl = buildCurl({ communityId: '13318', protocolId: '24423' });
    expect(curl).toContain('getProtocolById.asp');
    expect(curl).toContain('"communityId": "13318"');
    expect(curl).toContain('"protocolId": "24423"');
    expect(curl).toContain('MEKOME_AUTH: <token>');
    expect(curl).not.toContain('ASPSESSIONID');
  });
});

describe('fetchProtocol', () => {
  it('posts trimmed ids to the proxy and returns the upstream response', async () => {
    const fetchMock = mockFetch(200, {
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
      durationMs: 42,
    });

    const result = await fetchProtocol({ communityId: ' 13318 ', protocolId: '24423' });

    expect(fetchMock).toHaveBeenCalledWith(PROTOCOL_ENDPOINT, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ communityId: '13318', protocolId: '24423' }),
    }));
    expect(result).toEqual({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}',
      durationMs: 42,
    });
  });

  it('maps a proxy error code to an i18n key', async () => {
    mockFetch(502, { error: 'upstream_unreachable', message: 'socket hang up' });
    await expect(fetchProtocol({ communityId: '1', protocolId: '2' })).rejects.toThrow(
      'protocol.errors.upstream',
    );
  });

  it('reports a transport failure as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchProtocol({ communityId: '1', protocolId: '2' })).rejects.toThrow(
      'protocol.errors.network',
    );
  });

  it('falls back to an unexpected error for an unknown failure', async () => {
    mockFetch(500, { error: 'boom' });
    await expect(fetchProtocol({ communityId: '1', protocolId: '2' })).rejects.toThrow(
      'protocol.errors.unexpected',
    );
  });
});
