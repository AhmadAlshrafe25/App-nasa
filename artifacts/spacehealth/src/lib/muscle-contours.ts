/** Illustrative muscle-group contours, normalized to each artwork hotspot.
 * These are visual selection masks, not patient anatomy or diagnostic boundaries.
 * Coordinates use absolute M/L/Q/C commands; no elliptical sensor rings.
 */
const front: Record<string, string> = {
  head: 'M -.5 -.95 Q 0 -1.1 .5 -.95 L .83 -.48 Q .9 .1 .62 .55 L .23 .96 L -.24 .96 L -.65 .55 Q -.9 .1 -.82 -.48 Z',
  neck: 'M -.65 -1 L -.25 -.85 L .08 .5 L .52 -.85 L .85 -.95 L .36 .95 L -.45 1 L -.9 .15 Z',
  shoulder: 'M -.95 .25 C -1 -.4 -.5 -.95 .12 -.98 Q .7 -.9 .98 -.45 Q .65 .12 .28 .95 Q -.4 .9 -.95 .25 Z',
  chest: 'M -.95 -.45 Q -.5 -.95 .25 -.9 L .95 -.78 L .95 .45 Q .55 .92 -.14 .8 Q -.65 .55 -.95 -.45 Z',
  core: 'M -.7 -.95 Q -.28 -1 -.09 -.86 L -.09 -.43 Q -.36 -.3 -.75 -.42 Z M .09 -.86 Q .4 -1 .7 -.95 L .75 -.42 Q .36 -.3 .09 -.43 Z M -.75 -.34 Q -.4 -.22 -.09 -.34 L -.09 .18 Q -.4 .3 -.7 .15 Z M .09 -.34 Q .4 -.22 .75 -.34 L .7 .15 Q .4 .3 .09 .18 Z M -.7 .24 Q -.4 .38 -.09 .28 L -.09 .94 Q -.36 .98 -.56 .72 Z M .09 .28 Q .4 .38 .7 .24 L .56 .72 Q .36 .98 .09 .94 Z',
  upperArm: 'M -.38 -.98 C -.92 -.6 -.95 .05 -.52 .65 L -.1 1 Q .45 .68 .75 .1 C .95 -.45 .64 -.92 .12 -1 Z',
  forearm: 'M -.4 -.98 Q -.95 -.55 -.72 -.05 L -.18 1 L .15 .95 Q .45 .35 .85 -.6 L .34 -.98 Z',
  hand: 'M -.5 -.5 L -.8 -.2 L -.55 .3 L -.44 .95 L -.22 1 L -.18 .35 L .03 1 L .23 .96 L .12 .24 L .43 .84 L .61 .72 L .36 .03 L .81 .49 L .96 .3 L .55 -.36 L .31 -.95 L -.35 -.95 Z',
  pelvis: 'M -.94 -.6 Q -.6 -.9 -.1 -.35 L 0 .95 L -.35 .6 Z M .94 -.6 Q .6 -.9 .1 -.35 L 0 .95 L .35 .6 Z',
  thigh: 'M -.4 -1 C -.95 -.7 -.96 .1 -.62 .7 Q -.36 .96 -.07 1 L .15 .55 Q -.04 -.08 .15 -.68 L .28 -.99 Z M .36 -.95 Q .95 -.6 .87 .16 Q .79 .74 .32 .94 L .2 .45 Q .13 -.15 .36 -.95 Z',
  knee: 'M -.64 -.8 Q 0 -1 .64 -.8 L .44 .08 L .16 .92 L -.14 .92 L -.44 .08 Z',
  lowerLeg: 'M -.48 -.98 Q -.95 -.5 -.6 .04 L -.05 .98 L .2 .98 Q .52 .22 .82 -.72 L .35 -1 Z',
  foot: 'M -.2 -.98 L .28 -.98 Q .4 -.45 .82 -.08 L .95 .43 L .46 .86 L -.1 1 L -.76 .78 L -.95 .4 Q -.54 -.09 -.2 -.98 Z',
};

const back: Record<string, string> = {
  ...front,
  neck: 'M -.3 -.98 L .3 -.98 Q .56 -.2 .98 .75 L .28 .98 L 0 .28 L -.28 .98 L -.98 .75 Q -.56 -.2 -.3 -.98 Z',
  shoulder: 'M -.98 -.1 Q -.94 -.75 -.24 -.98 Q .5 -.93 .94 -.4 L .45 .76 Q -.02 1 -.5 .6 Z',
  chest: 'M -.7 -.95 Q -.15 -.9 .93 -.25 L .75 .95 Q .1 .65 -.45 .02 Q -.86 -.4 -.7 -.95 Z',
  core: 'M -.55 -.95 Q -.12 -.68 -.08 .05 L -.14 .96 L -.66 .74 Q -.86 -.05 -.55 -.95 Z M .55 -.95 Q .12 -.68 .08 .05 L .14 .96 L .66 .74 Q .86 -.05 .55 -.95 Z',
  pelvis: 'M -.1 -.84 C -.5 -1 -.98 -.65 -.92 .05 Q -.9 .8 -.2 .95 L -.05 .5 Z M .1 -.84 C .5 -1 .98 -.65 .92 .05 Q .9 .8 .2 .95 L .05 .5 Z',
  upperArm: 'M -.45 -.98 Q -.96 -.6 -.8 .1 L -.18 .97 L .18 .6 L .2 -.5 Z M .32 -.86 Q .93 -.46 .82 .08 L .22 .92 L .1 .5 Z',
  thigh: 'M -.5 -.98 Q -.96 -.25 -.55 .55 L -.15 1 L .08 .85 L -.08 -.08 L .16 -.98 Z M .32 -.98 Q .96 -.7 .83 .1 L .35 .97 L .15 .58 L .17 -.24 Z',
  lowerLeg: 'M -.3 -1 C -.94 -.91 -1 -.2 -.53 .3 L -.08 .95 L .02 .98 L -.04 .1 Q .15 -.55 -.3 -1 Z M .14 -1 C .85 -.9 .98 -.12 .46 .37 L .12 .98 L .04 .98 L .1 .1 Q .3 -.55 .14 -1 Z',
};

export function muscleContour(
  segment: string,
  view: 'front' | 'back',
  [cx, cy, rx, ry]: [number, number, number, number],
  mirrored: boolean,
): string {
  const contour = (view === 'front' ? front : back)[segment];
  if (!contour) throw new Error(`Missing muscle contour: ${segment}`);
  let coordinate = 0;
  return contour.replace(/-?(?:\d*\.?\d+)/g, raw => {
    const value = Number(raw);
    const result = coordinate++ % 2 === 0
      ? cx + value * rx * (mirrored ? -1 : 1)
      : cy + value * ry;
    return result.toFixed(2);
  });
}
