import type { RequestInitCfProperties } from '@cloudflare/workers-types';

export interface CachedRequestInit extends RequestInit {
  cf?: RequestInitCfProperties;
}

// Skyhook rejects requests without a User-Agent (HTTP 400 "invalid request"),
// and Workers' outbound fetch sends none by default.
const DEFAULT_USER_AGENT = 'Sonarr/4 (glossarr-worker)';

export function cachedFetch(
  url: string | URL,
  init: CachedRequestInit,
  cacheTtlSeconds: number,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', DEFAULT_USER_AGENT);
  return fetch(url, {
    ...init,
    headers,
    cf: {
      cacheEverything: true,
      cacheTtl: cacheTtlSeconds,
      ...init.cf,
    },
  });
}
