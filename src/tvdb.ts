import { StatusError } from 'itty-router';
import { cachedFetch } from './cache';
import type { Env } from './config';
import type { ShowTranslation } from './types';

const TVDB_BASE = 'https://api4.thetvdb.com/v4';
const TOKEN_KEY = 'tvdb_token';
const TOKEN_TTL_SECONDS = 23 * 60 * 60;

interface TvdbToken {
  token: string;
  expiry: number;
}

async function login(env: Env): Promise<string> {
  const res = await fetch(`${TVDB_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: env.TVDB_API_KEY }),
  });
  if (!res.ok) throw new StatusError(502, `TVDB login failed: ${res.status}`);
  const data = (await res.json()) as { data?: { token?: string } };
  const token = data?.data?.token;
  if (!token) throw new StatusError(502, 'TVDB login returned no token');
  return token;
}

async function getToken(env: Env): Promise<string> {
  const cached = await env.GLOSSARR.get<TvdbToken>(TOKEN_KEY, 'json');
  if (cached?.token && cached.expiry > Date.now()) return cached.token;

  inflightLogin ??= loginAndStore(env).finally(() => {
    inflightLogin = null;
  });
  return inflightLogin;
}

let inflightLogin: Promise<string> | null = null;

async function loginAndStore(env: Env): Promise<string> {
  const token = await login(env);
  await env.GLOSSARR.put(
    TOKEN_KEY,
    JSON.stringify({ token, expiry: Date.now() + TOKEN_TTL_SECONDS * 1000 }),
    { expirationTtl: TOKEN_TTL_SECONDS },
  );
  return token;
}

async function invalidateToken(env: Env): Promise<void> {
  await env.GLOSSARR.delete(TOKEN_KEY);
}

export async function getShowTranslation(
  env: Env,
  tvdbId: string,
  lang: string,
  cacheTtlSeconds: number,
): Promise<ShowTranslation | null> {
  return getShowTranslationInner(env, tvdbId, lang, cacheTtlSeconds, true);
}

async function getShowTranslationInner(
  env: Env,
  tvdbId: string,
  lang: string,
  cacheTtlSeconds: number,
  canRetry: boolean,
): Promise<ShowTranslation | null> {
  const token = await getToken(env);
  const headers = { Authorization: `Bearer ${token}` };

  const [transRes, seriesRes] = await Promise.all([
    cachedFetch(`${TVDB_BASE}/series/${tvdbId}/translations/${lang}`, { headers }, cacheTtlSeconds),
    cachedFetch(`${TVDB_BASE}/series/${tvdbId}`, { headers }, cacheTtlSeconds),
  ]);

  if ((transRes.status === 401 || seriesRes.status === 401) && canRetry) {
    await invalidateToken(env);
    return getShowTranslationInner(env, tvdbId, lang, cacheTtlSeconds, false);
  }

  if (transRes.status === 404) return null;
  if (!transRes.ok) return null;

  const trans = (await transRes.json()) as { data?: { name?: string; overview?: string } };
  const series = seriesRes.ok
    ? ((await seriesRes.json()) as { data?: { originalLanguage?: string } }).data
    : undefined;

  return {
    name: trans.data?.name ?? null,
    overview: trans.data?.overview ?? null,
    originalLanguage: series?.originalLanguage ?? null,
  };
}
