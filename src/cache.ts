import type { RequestInitCfProperties } from '@cloudflare/workers-types';

export interface CachedRequestInit extends RequestInit {
  cf?: RequestInitCfProperties;
}

export function cachedFetch(
  url: string | URL,
  init: CachedRequestInit,
  cacheTtlSeconds: number,
): Promise<Response> {
  return fetch(url, {
    ...init,
    cf: {
      cacheEverything: true,
      cacheTtl: cacheTtlSeconds,
      ...init.cf,
    },
  });
}
