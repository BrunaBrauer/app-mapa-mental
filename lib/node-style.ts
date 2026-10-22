import type { MindNode, NodeStyle } from '../types';

const sizeKeys = ['width', 'height', 'padding'] as const;
const formatKeys = ['background', 'border', 'color', 'shape', 'icon', 'fontSize', 'fontFamily', 'bold', 'italic', 'underline', 'strike', 'textAlign', 'textTransform', 'borderWidth', 'borderStyle'] as const;
export function pickNodeStyle(node: MindNode, mode: 'size' | 'format' | 'both' = 'both'): Partial<NodeStyle> {
  const keys: readonly (keyof NodeStyle)[] = mode === 'size' ? sizeKeys : mode === 'format' ? formatKeys : [...sizeKeys, ...formatKeys];
  const style: Partial<NodeStyle> = {};
  for (const key of keys) (style as Record<string, unknown>)[key] = node[key];
  return style;
}
