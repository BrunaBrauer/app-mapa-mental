export type TreeEdgePoints = { sourceX: number; sourceY: number; targetX: number; targetY: number };

/** Route siblings through one shared axis measured from their common parent. */
export function treeEdgePath(points: TreeEdgePoints, direction: 'left' | 'right' | 'top' | 'bottom'): [string, number, number] {
  const { sourceX, sourceY, targetX, targetY } = points;
  if (direction === 'left' || direction === 'right') {
    const step = Math.min(24, Math.max(0, Math.abs(targetX - sourceX) / 2));
    const trunkX = sourceX + (direction === 'right' ? step : -step);
    return [`M ${sourceX} ${sourceY} H ${trunkX} V ${targetY} H ${targetX}`, (trunkX + targetX) / 2, targetY];
  }
  const step = Math.min(24, Math.max(0, Math.abs(targetY - sourceY) / 2));
  const trunkY = sourceY + (direction === 'bottom' ? step : -step);
  return [`M ${sourceX} ${sourceY} V ${trunkY} H ${targetX} V ${targetY}`, targetX, (trunkY + targetY) / 2];
}
