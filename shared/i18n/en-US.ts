import type { Translation } from '../i18n';
import type en from './en';

/** The shared texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  favouriteGame: 'Favorite {game}',
  genreFavourites: 'Favorites',
  tinyKingdomCard: 'Place farms, houses and towers on a small island. Each one scores against its neighbors, so plan the layout before the tiles run out.',
};

export default enUS;
