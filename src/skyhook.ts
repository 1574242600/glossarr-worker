import { StatusError } from 'itty-router';
import { cachedFetch } from './cache';
import type { ShowResource } from './types';

export const SKYHOOK_BASE = 'https://skyhook.sonarr.tv/v1/tvdb';

export async function fetchShow(tvdbId: string, cacheTtlSeconds: number): Promise<ShowResource> {
  const res = await cachedFetch(`${SKYHOOK_BASE}/shows/en/${tvdbId}`, {}, cacheTtlSeconds);
  if (res.status === 404) throw new StatusError(404, `Show not found: ${tvdbId}`);
  if (!res.ok) throw new StatusError(502, `Skyhook returned ${res.status}`);
  return res.json() as Promise<ShowResource>;
}

export async function fetchSearch(term: string, cacheTtlSeconds: number): Promise<ShowResource[]> {
  const url = `${SKYHOOK_BASE}/search/en/?term=${encodeURIComponent(term)}`;
  const res = await cachedFetch(url, {}, cacheTtlSeconds);
  if (!res.ok) throw new StatusError(502, `Skyhook returned ${res.status}`);
  return res.json() as Promise<ShowResource[]>;
}

export function truncateSearch(shows: ShowResource[], max = 5): ShowResource[] {
  return shows.slice(0, max);
}

export async function passthrough(pathname: string, search: string, cacheTtlSeconds: number): Promise<Response> {
  const res = await cachedFetch(`https://skyhook.sonarr.tv${pathname}${search}`, {}, cacheTtlSeconds);
  return new Response(res.body, res);
}
