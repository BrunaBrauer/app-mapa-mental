import type { MindNode, NodeStyle } from '../types';

const sizeKeys = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
const formatKeys = ['background', 'border', 'color', 'shape', 'icon', 'fontSize', 'fontFamily', 'lineSpacing', 'letterSpacing', 'bold', 'italic', 'underline', 'strike', 'textAlign', 'textVerticalAlign', 'wrapText', 'textTransform', 'cornerRadius', 'borderWidth', 'borderStyle'] as const;
export function pickNodeStyle(node: MindNode, mode: 'size' | 'format' | 'both' = 'both'): Partial<NodeStyle> {
  const keys: readonly (keyof NodeStyle)[] = mode === 'size' ? sizeKeys : mode === 'format' ? formatKeys : [...sizeKeys, ...formatKeys];
  const style: Partial<NodeStyle> = {};
  for (const key of keys) (style as Record<string, unknown>)[key] = node[key];
  return style;
}

export function copyNodeFormatting(node: MindNode, includeDimensions: boolean): Partial<MindNode> {
  const style: Partial<MindNode> = { ...pickNodeStyle(node), connectionStyle: node.connectionStyle ? { ...node.connectionStyle } : undefined };
  if (includeDimensions) style.sizeMode = node.sizeMode;
  else for (const key of ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) delete style[key];
  return style;
}
