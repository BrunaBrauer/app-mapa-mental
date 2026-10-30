import type { MindNode } from '../types';
import { visualSize } from './movement';

/** Pick the two facing sides from the current, including in-flight, positions. */
export function alignedHandles(source: MindNode, target: MindNode): { sourceHandle: string; targetHandle: string } {
  const a = visualSize(source), b = visualSize(target);
  const dx = target.x + b.width / 2 - source.x - a.width / 2;
  const dy = target.y + b.height / 2 - source.y - a.height / 2;
  const horizontalGap = Math.abs(dx) - (a.width + b.width) / 2;
  const verticalGap = Math.abs(dy) - (a.height + b.height) / 2;
  const vertical = verticalGap > horizontalGap && Math.abs(dy) > Math.abs(dx) * .7;
  return vertical
    ? { sourceHandle: dy < 0 ? 'source-top' : 'source-bottom', targetHandle: dy < 0 ? 'source-bottom' : 'source-top' }
    : { sourceHandle: dx < 0 ? 'source-left' : 'source-right', targetHandle: dx < 0 ? 'source-right' : 'source-left' };
}
