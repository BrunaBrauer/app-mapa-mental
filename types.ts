export type LayoutMode = 'right' | 'left' | 'balanced' | 'down' | 'up' | 'split-down' | 'radial' | 'org' | 'org-left' | 'fishbone' | 'fishbone-left' | 'timeline' | 'timeline-left' | 'free';
export type NodeShape = 'rounded' | 'rectangle' | 'pill' | 'ellipse' | 'diamond' | 'hexagon';
export type NodeComment = { id: string; text: string; createdAt: number };
export type MindNode = {
  id: string; parentId: string | null; text: string; x: number; y: number;
  side?: 'left' | 'right'; branchLayout?: LayoutMode; collapsed?: boolean; note?: string; url?: string;
  icon?: string; shape?: NodeShape; background?: string; border?: string; color?: string;
  image?: string; comments?: NodeComment[]; task?: { done: boolean; priority?: 'p0' | 'p1' | 'p2' | 'p3' | 'p4' | 'low' | 'medium' | 'high'; progress?: number; start?: string; duration?: number; due?: string; assignee?: string };
  mediaUrl?: string; mediaType?: 'video' | 'audio'; label?: string; equation?: string; floating?: boolean; boundary?: boolean; summary?: string;
  fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean;
  underline?: boolean; strike?: boolean; textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
};
export type MindMap = { id: string; title: string; nodes: MindNode[]; layout: LayoutMode; updatedAt: number; shareToken?: string | null; relationships?: { id: string; source: string; target: string; label?: string }[]; spacing?: { x: number; y: number } };
