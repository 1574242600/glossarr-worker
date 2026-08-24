import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src';
import type { ShowResource } from '../src/types';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const SHOW: ShowResource = {
  tvdbId: 81189,
  title: 'Breaking Bad',
  overview: 'An English overview.',
  originalLanguage: 'eng',
  status: 'ended',
  seasons: [],
  episodes: [],
};

const SEARCH_RESULTS: ShowResource[] = Array.from({ length: 7 }, (_, i) => ({
  tvdbId: 100 + i,
  title: `Show ${i}`,
  overview: 'overview',
  originalLanguage: 'eng',
}));

type Route = {
  match: RegExp;
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>;
};

function mockFetch(routes: Route[]): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const href =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const route of routes) {
      if (route.match.test(href)) return route.handler(new URL(href), init);
    }
    throw new Error(`Unexpected fetch: ${href}`);
  });
}

function tvdbLoginRoute(onLogin?: () => void): Route {
  return {
    match: /api4\.thetvdb\.com\/v4\/login$/,
    handler: () => {
      onLogin?.();
      return Response.json({ data: { token: 'test-token' } });
    },
  };
}

function tvdbTranslationRoute(lang: string, data: { name?: string; overview?: string }): Route {
  return {
    match: new RegExp(`/series/\\d+/translations/${lang}$`),
    handler: () => Response.json({ data }),
  };
}

function tvdbSeriesRoute(data: { originalLanguage?: string }): Route {
  return {
    match: /\/v4\/series\/\d+$/,
    handler: () => Response.json({ data }),
  };
}

async function run(path: string, overrides: Record<string, string> = {}): Promise<Response> {
  const request = new IncomingRequest(`http://example.com${path}`);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, { ...env, ...overrides }, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('glossarr-worker smoke tests', () => {
  beforeEach(async () => {
    await env.GLOSSARR.delete('tvdb_token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows/eng returns the skyhook response unmodified (no TVDB calls)', async () => {
    const onLogin = vi.fn();
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/shows\/en\/81189$/, handler: () => Response.json(SHOW) },
      tvdbLoginRoute(onLogin),
    ]);

    const res = await run('/v1/tvdb/shows/eng/81189');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SHOW);
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('rejects an unsupported language with 400', async () => {
    mockFetch([]);

    const res = await run('/v1/tvdb/shows/xxz/81189');

    expect(res.status).toBe(400);
  });

  it('shows/fra translates the title and overview (always mode)', async () => {
    const onLogin = vi.fn();
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/shows\/en\/81189$/, handler: () => Response.json(SHOW) },
      tvdbLoginRoute(onLogin),
      tvdbTranslationRoute('fra', { name: 'Breaking Bad (FR)', overview: 'Une vue d’ensemble en français.' }),
      tvdbSeriesRoute({ originalLanguage: 'eng' }),
    ]);

    const res = await run('/v1/tvdb/shows/fra/81189');
    const body = (await res.json()) as ShowResource;

    expect(res.status).toBe(200);
    expect(body.title).toBe('Breaking Bad (FR)');
    expect(body.overview).toBe('Une vue d’ensemble en français.');
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('shows/fra translates the title for a French-native show (native mode)', async () => {
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/shows\/en\/295231$/, handler: () => Response.json({ ...SHOW, tvdbId: 295231 }) },
      tvdbLoginRoute(),
      tvdbTranslationRoute('fra', { name: 'Titre en français', overview: 'Résumé en français.' }),
      tvdbSeriesRoute({ originalLanguage: 'fra' }),
    ]);

    const res = await run('/v1/tvdb/shows/fra/295231', { SHOW_TITLE_MODE: 'native' });
    const body = (await res.json()) as ShowResource;

    expect(body.title).toBe('Titre en français');
    expect(body.overview).toBe('Résumé en français.');
  });

  it('shows/fra keeps the title of a non-native show under native mode', async () => {
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/shows\/en\/81189$/, handler: () => Response.json(SHOW) },
      tvdbLoginRoute(),
      tvdbTranslationRoute('fra', { name: 'Breaking Bad (FR)', overview: 'Une vue d’ensemble en français.' }),
      tvdbSeriesRoute({ originalLanguage: 'eng' }),
    ]);

    const res = await run('/v1/tvdb/shows/fra/81189', { SHOW_TITLE_MODE: 'native' });
    const body = (await res.json()) as ShowResource;

    expect(body.title).toBe('Breaking Bad');
    expect(body.overview).toBe('Une vue d’ensemble en français.');
  });

  it('search/fra truncates skyhook results to 5 and translates each', async () => {
    const onLogin = vi.fn();
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/search\/en\/\?term=breaking/, handler: () => Response.json(SEARCH_RESULTS) },
      tvdbLoginRoute(onLogin),
      tvdbTranslationRoute('fra', { name: 'T', overview: 'O' }),
      tvdbSeriesRoute({ originalLanguage: 'eng' }),
    ]);

    const res = await run('/v1/tvdb/search/fra/?term=breaking');
    const body = (await res.json()) as ShowResource[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(5);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('search/eng returns the skyhook results unmodified (no truncation)', async () => {
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/search\/en\/\?term=breaking/, handler: () => Response.json(SEARCH_RESULTS) },
    ]);

    const res = await run('/v1/tvdb/search/eng/?term=breaking');
    const body = (await res.json()) as ShowResource[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(7);
    expect(body).toEqual(SEARCH_RESULTS);
  });

  it('search/fra works without a trailing slash', async () => {
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/search\/en\/\?term=breaking/, handler: () => Response.json(SEARCH_RESULTS) },
      tvdbLoginRoute(),
      tvdbTranslationRoute('fra', { name: 'T', overview: 'O' }),
      tvdbSeriesRoute({ originalLanguage: 'eng' }),
    ]);

    const res = await run('/v1/tvdb/search/fra?term=breaking');

    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(5);
  });
  it('forwards unknown /v1/tvdb routes transparently', async () => {

    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/other\/thing/, handler: () => new Response('passthrough body', { status: 201, headers: { 'content-type': 'text/plain' } }) },
    ]);

    const res = await run('/v1/tvdb/other/thing');

    expect(res.status).toBe(201);
    expect(await res.text()).toBe('passthrough body');
  });

  it('stores the TVDB token in KV and reuses it across requests', async () => {
    const onLogin = vi.fn();
    mockFetch([
      { match: /skyhook\.sonarr\.tv\/v1\/tvdb\/shows\/en\/81189$/, handler: () => Response.json(SHOW) },
      tvdbLoginRoute(onLogin),
      tvdbTranslationRoute('fra', { name: 'T', overview: 'O' }),
      tvdbSeriesRoute({ originalLanguage: 'eng' }),
    ]);

    await run('/v1/tvdb/shows/fra/81189');
    await run('/v1/tvdb/shows/fra/81189');

    expect(onLogin).toHaveBeenCalledTimes(1);
    const stored = (await env.GLOSSARR.get('tvdb_token', 'json')) as {
      token: string;
      expiry: number;
    };
    expect(stored.token).toBe('test-token');
    expect(stored.expiry).toBeGreaterThan(Date.now());
  });
});
