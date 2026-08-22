import { Router, error, json } from 'itty-router';
import type { IRequest } from 'itty-router';
import { getConfig, LANG } from './config';
import type { Env } from './config';
import { fetchSearch, fetchShow, passthrough, truncateSearch } from './skyhook';
import { getShowTranslation } from './tvdb';
import { applyShow } from './translate';
import type { ShowResource } from './types';

type CFArgs = [Env, ExecutionContext];

const router = Router<IRequest, CFArgs>({ catch: error });

function isValidLang(lang: string | undefined): lang is string {
  return typeof lang === 'string' && LANG.has(lang);
}

router
  .get('/v1/tvdb/shows/:lang/:tvdbId', async (request, env) => {
    const config = getConfig(env);
    const { lang, tvdbId } = request.params;

    if (!isValidLang(lang)) return error(400, { error: `Unsupported language: ${lang}` });
    if (!tvdbId) return error(400, { error: 'Missing tvdbId' });

    const show = await fetchShow(tvdbId, config.cacheTtlSeconds);

    if (lang === 'eng') return json(show);

    const translation = await getShowTranslation(env, tvdbId, lang, config.cacheTtlSeconds);
    applyShow(show, translation, lang, config);
    return json(show);
  })

  .get('/v1/tvdb/search/:lang', searchHandler)
  .get('/v1/tvdb/search/:lang/', searchHandler)

  .all('/v1/tvdb/*', async (request, env) => {
    const config = getConfig(env);
    const url = new URL(request.url);
    return passthrough(url.pathname, url.search, config.cacheTtlSeconds);
  })

  .all('*', () => error(404, { error: 'Not found' }));

async function searchHandler(request: IRequest, env: Env): Promise<Response> {
  const config = getConfig(env);
  const lang = request.params.lang;

  if (!isValidLang(lang)) return error(400, { error: `Unsupported language: ${lang}` });

  const term = new URL(request.url).searchParams.get('term') ?? '';
  const shows = await fetchSearch(term, config.cacheTtlSeconds);

  if (lang === 'eng') return json(shows);

  const translated = await Promise.all(
    truncateSearch(shows).map(async (show: ShowResource) => {
      if (show.tvdbId) {
        const translation = await getShowTranslation(env, String(show.tvdbId), lang, config.cacheTtlSeconds);
        applyShow(show, translation, lang, config);
      }
      return show;
    }),
  );

  return json(translated);
}

export default { ...router };
