/** Geometry for a branch boundary. Coordinates are in canvas units, before zoom. */
export type BoundaryBox = { id: string; parentId: string | null; x: number; y: number; width: number; height: number };
export type BoundaryRect = { x: number; y: number; width: number; height: number };
export type BoundaryGeometry = { x: number; y: number; width: number; height: number; path: string; parts: BoundaryRect[] };

const right = (box: BoundaryRect) => box.x + box.width;
const bottom = (box: BoundaryRect) => box.y + box.height;
const overlaps = (a: BoundaryRect, b: BoundaryRect) => a.x < right(b) && right(a) > b.x && a.y < bottom(b) && bottom(a) > b.y;
const rounded = (value: number) => Math.round(value * 10) / 10;

function safePadding(box: BoundaryBox, outsiders: BoundaryBox[]): number {
  let padding = 10;
  for (const other of outsiders) {
    // A gap on either axis is enough to keep two expanded rectangles apart.
    const horizontal = Math.max(0, other.x - right(box), box.x - right(other));
    const vertical = Math.max(0, other.y - bottom(box), box.y - bottom(other));
    padding = Math.min(padding, Math.max(0, Math.max(horizontal, vertical) / 2 - 1));
  }
  return padding;
}

function corridor(a: BoundaryBox, b: BoundaryBox): BoundaryRect[] {
  const acx = a.x + a.width / 2, acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2, bcy = b.y + b.height / 2;
  const half = 3;
  if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
    const start = bcx >= acx ? right(a) : a.x;
    const end = bcx >= acx ? b.x : right(b);
    const middle = (start + end) / 2;
    return [
      { x: Math.min(start, middle), y: acy - half, width: Math.abs(middle - start), height: half * 2 },
      { x: middle - half, y: Math.min(acy, bcy), width: half * 2, height: Math.abs(bcy - acy) },
      { x: Math.min(middle, end), y: bcy - half, width: Math.abs(end - middle), height: half * 2 },
    ];
  }
  const start = bcy >= acy ? bottom(a) : a.y;
  const end = bcy >= acy ? b.y : bottom(b);
  const middle = (start + end) / 2;
  return [
    { x: acx - half, y: Math.min(start, middle), width: half * 2, height: Math.abs(middle - start) },
    { x: Math.min(acx, bcx), y: middle - half, width: Math.abs(bcx - acx), height: half * 2 },
    { x: bcx - half, y: Math.min(middle, end), width: half * 2, height: Math.abs(end - middle) },
  ];
}

export function createBoundaryGeometry(boxes: BoundaryBox[], scopeIds: Set<string>): BoundaryGeometry | null {
  const inside = boxes.filter(box => scopeIds.has(box.id) && box.width > 0 && box.height > 0);
  if (!inside.length) return null;
  const outside = boxes.filter(box => !scopeIds.has(box.id));
  const byId = new Map(inside.map(box => [box.id, box]));
  const parts: BoundaryRect[] = inside.map(box => {
    const pad = safePadding(box, outside);
    return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  });
  for (const box of inside) {
    const parent = box.parentId && byId.get(box.parentId);
    if (!parent) continue;
    const segments = corridor(parent, box).filter(rect => rect.width > 0 && rect.height > 0);
    // A corridor is omitted if an unrelated node occupies its route.
    if (segments.every(segment => outside.every(other => !overlaps(segment, other)))) parts.push(...segments);
  }
  const x = Math.min(...parts.map(part => part.x));
  const y = Math.min(...parts.map(part => part.y));
  const width = Math.max(...parts.map(right)) - x;
  const height = Math.max(...parts.map(bottom)) - y;
  const xs = [...new Set(parts.flatMap(part => [rounded(part.x), rounded(right(part))]))].sort((a, b) => a - b);
  const ys = [...new Set(parts.flatMap(part => [rounded(part.y), rounded(bottom(part))]))].sort((a, b) => a - b);
  const columns = xs.length - 1, rows = ys.length - 1;
  const filled = new Uint8Array(columns * rows);
  const xIndex = new Map(xs.map((value, index) => [value, index]));
  const yIndex = new Map(ys.map((value, index) => [value, index]));
  for (const part of parts) {
    const left = xIndex.get(rounded(part.x))!, endX = xIndex.get(rounded(right(part)))!;
    const top = yIndex.get(rounded(part.y))!, endY = yIndex.get(rounded(bottom(part)))!;
    for (let row = top; row < endY; row++) filled.fill(1, row * columns + left, row * columns + endX);
  }
  const edge: string[] = [];
  const occupied = (column: number, row: number) => column >= 0 && row >= 0 && column < columns && row < rows && filled[row * columns + column] === 1;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    if (!occupied(column, row)) continue;
    const left = xs[column] - x, top = ys[row] - y, rightEdge = xs[column + 1] - x, bottomEdge = ys[row + 1] - y;
    if (!occupied(column, row - 1)) edge.push(`M${left} ${top}H${rightEdge}`);
    if (!occupied(column + 1, row)) edge.push(`M${rightEdge} ${top}V${bottomEdge}`);
    if (!occupied(column, row + 1)) edge.push(`M${rightEdge} ${bottomEdge}H${left}`);
    if (!occupied(column - 1, row)) edge.push(`M${left} ${bottomEdge}V${top}`);
  }
  return { x, y, width, height, path: edge.join(''), parts };
}
