export interface ShowResource {
  tvdbId?: number | null;
  title?: string | null;
  overview?: string | null;
  slug?: string | null;
  firstAired?: string | null;
  lastAired?: string | null;
  tvRageId?: number | null;
  tvMazeId?: number | null;
  tmdbId?: number | null;
  malIds?: number[];
  aniListIds?: number[];
  status?: string | null;
  runtime?: number | null;
  timeOfDay?: TimeOfDayResource | null;
  network?: string | null;
  originalLanguage?: string | null;
  originalCountry?: string | null;
  contentRating?: string | null;
  rating?: RatingResource | null;
  genres?: string[];
  actors?: ActorResource[];
  images?: ImageResource[];
  seasons?: SeasonResource[];
  episodes?: EpisodeResource[];
}

export interface SeasonResource {
  seasonNumber?: number | null;
  images?: ImageResource[];
  name?: string | null;
  overview?: string | null;
}

export interface EpisodeResource {
  tvdbId?: number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  absoluteEpisodeNumber?: number | null;
  airedAfterSeasonNumber?: number | null;
  airedBeforeSeasonNumber?: number | null;
  airedBeforeEpisodeNumber?: number | null;
  title?: string | null;
  airDate?: string | null;
  airDateUtc?: string | null;
  runtime?: number | null;
  finaleType?: string | null;
  overview?: string | null;
  image?: string | null;
  rating?: RatingResource | null;
}

export interface ActorResource {
  name?: string | null;
  character?: string | null;
  image?: string | null;
}

export interface ImageResource {
  coverType?: string | null;
  url?: string | null;
}

export interface TimeOfDayResource {
  hours?: number | null;
  minutes?: number | null;
}

export interface RatingResource {
  count?: number | null;
  value?: number | null;
}

export interface ShowTranslation {
  name: string | null;
  overview: string | null;
  originalLanguage: string | null;
}
