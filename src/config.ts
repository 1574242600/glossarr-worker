export interface Env {
  TVDB_API_KEY: string;
  GLOSSARR: KVNamespace;
  SHOW_TITLE_MODE?: string;
  SHOW_OVERVIEW_MODE?: string;
  CACHE_TTL_SECONDS?: string;
}

export type TranslationMode = 'always' | 'never' | 'native';

export interface Config {
  showTitleMode: TranslationMode;
  showOverviewMode: TranslationMode;
  cacheTtlSeconds: number;
}

export const LANG: ReadonlySet<string> = new Set([
  'ara',
  'bul',
  'ces',
  'dan',
  'deu',
  'ell',
  'eng',
  'fin',
  'fra',
  'hun',
  'ind',
  'ita',
  'jpn',
  'kor',
  'nld',
  'nor',
  'pol',
  'por',
  'ron',
  'rus',
  'spa',
  'swe',
  'tha',
  'tur',
  'ukr',
  'vie',
  'zho',
  'zhtw',
]);

export const DEFAULT_CACHE_TTL_SECONDS = 300;

function parseMode(value: string | undefined, fallback: TranslationMode): TranslationMode {
  if (value === 'always' || value === 'never' || value === 'native') {
    return value;
  }
  return fallback;
}

export function getConfig(env: Env): Config {
  return {
    showTitleMode: parseMode(env.SHOW_TITLE_MODE, 'native'),
    showOverviewMode: parseMode(env.SHOW_OVERVIEW_MODE, 'always'),
    cacheTtlSeconds: toPositiveInt(env.CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS),
  };
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
