import { CARD_METRICS, OVERLAY_BELOW_WIDTH, type CardFaceSize } from './cardMetrics';

export type CardFaceLayers = {
  /** 'image' when baked art exists for this card, else a drawn vector card. */
  base: 'image' | 'vector';
  /** Draw the code rank badge + suit emblem over the base (small sizes with art). */
  overlay: boolean;
  /** Vector base only: show the card-name line. Catalog size only. */
  showName: boolean;
};

export function cardFaceLayers(size: CardFaceSize, hasArt: boolean): CardFaceLayers {
  const width = CARD_METRICS[size].width;
  return {
    base: hasArt ? 'image' : 'vector',
    overlay: hasArt && width < OVERLAY_BELOW_WIDTH,
    showName: !hasArt && size === 'catalog',
  };
}
