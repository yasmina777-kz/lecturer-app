/** Playback seconds map to the original eight-second Blender clips.
 * Letter holds are shortened; approach and release remain continuous.
 */
export function playbackDuration(letter: boolean) {
  return letter ? 4 : 6;
}
export function animationTime(time: number, letter: boolean) {
  const t = Math.max(0, Math.min(playbackDuration(letter), time));
  if (!letter) return (t * 8) / 6;
  if (t < 1.2) return (t * 2) / 1.2;
  if (t < 2.8) return 2 + ((t - 1.2) * 4.2) / 1.6;
  return 6.2 + ((t - 2.8) * 1.8) / 1.2;
}
