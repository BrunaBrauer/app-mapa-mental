export type LayoutMode = 'right' | 'left' | 'balanced' | 'down' | 'up' | 'split-down' | 'radial' | 'org' | 'org-left' | 'fishbone' | 'fishbone-left' | 'timeline' | 'timeline-left' | 'free';
export type NodeShape = 'rounded' | 'rectangle' | 'pill' | 'ellipse' | 'circle' | 'diamond' | 'hexagon' | 'underline' | 'transparent' | 'tag-right' | 'tag-left' | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down' | 'bookmark-right' | 'bookmark-left' | 'half-rounded-right' | 'half-rounded-left';
export type RichRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; highlight?: string };
export type LineStyle = { color?: string; width?: number; pattern?: 'solid' | 'dashed' | 'dotted' | 'double'; curve?: 'smooth' | 'straight' | 'step' | 'rounded'; start?: 'none' | 'arrow' | 'circle' | 'diamond' | 'square' | 'bar' | 'hollow-circle'; end?: 'none' | 'arrow' | 'circle' | 'diamond' | 'square' | 'bar' | 'hollow-circle' };
export type NodeStyle = Pick<MindNode, 'background' | 'border' | 'color' | 'shape' | 'icon' | 'fontSize' | 'fontFamily' | 'bold' | 'italic' | 'underline' | 'strike' | 'textAlign' | 'textTransform' | 'width' | 'height' | 'padding' | 'borderWidth' | 'borderStyle'>;
export type NodeComment = { id: string; text: string; createdAt: number };
export type MindNode = {
  id: string; parentId: string | null; text: string; x: number; y: number;
  side?: 'left' | 'right'; branchLayout?: LayoutMode; collapsed?: boolean; note?: string; url?: string;
  icon?: string; shape?: NodeShape; background?: string; border?: string; color?: string;
  image?: string; comments?: NodeComment[]; task?: { done: boolean; priority?: 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'low' | 'medium' | 'high'; progress?: number; start?: string; duration?: number; due?: string; assignee?: string };
  mediaUrl?: string; mediaType?: 'video' | 'audio'; label?: string; equation?: string; floating?: boolean; boundary?: boolean; summary?: string;
  fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean; richText?: RichRun[];
  width?: number; height?: number; padding?: number; borderWidth?: number; borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double'; connectionStyle?: LineStyle;
  underline?: boolean; strike?: boolean; textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
};
export type MindMap = { id: string; title: string; nodes: MindNode[]; layout: LayoutMode; updatedAt: number; shareToken?: string | null; relationships?: { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string; style?: LineStyle }[]; favoriteIcons?: string[]; spacing?: { x: number; y: number }; defaultNodeStyle?: Partial<NodeStyle>; stylePresets?: { id: string; name: string; style: Partial<NodeStyle> }[]; levelReferences?: { parentId: string | null; mode: 'size' | 'format' | 'both'; style: Partial<NodeStyle> }[]; levelConnections?: { parentId: string; style: LineStyle }[] };
