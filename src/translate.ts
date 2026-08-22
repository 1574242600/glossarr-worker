import type { Config, TranslationMode } from './config';
import type { ShowResource, ShowTranslation } from './types';

export function isNativeLanguage(translation: ShowTranslation | null, lang: string): boolean {
  return translation?.originalLanguage === lang;
}

export function applyShow(
  show: ShowResource,
  translation: ShowTranslation | null,
  lang: string,
  config: Config,
): void {
  if (!translation) return;

  const native = isNativeLanguage(translation, lang);

  if (shouldApply(config.showTitleMode, native) && translation.name) {
    show.title = translation.name;
  }
  if (shouldApply(config.showOverviewMode, native) && translation.overview) {
    show.overview = translation.overview;
  }
}

function shouldApply(mode: TranslationMode, native: boolean): boolean {
  return mode === 'always' || (mode === 'native' && native);
}
