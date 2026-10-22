'use client';
import { BaseEdge, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from '@xyflow/react';
import type { LineStyle } from '../types';

export default function StyledEdge(props: EdgeProps & { data?: { line?: LineStyle } }) {
  const line = props.data?.line;
  const points = { sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY, sourcePosition: props.sourcePosition, targetPosition: props.targetPosition };
  const [path, labelX, labelY] = line?.curve === 'straight' ? getStraightPath(points) : line?.curve === 'smooth' ? getBezierPath(points) : getSmoothStepPath({ ...points, borderRadius: line?.curve === 'step' ? 0 : 12 });
  const color = line?.color || '#b9b4db';
  const width = line?.width ?? 2;
  const dash = line?.pattern === 'dashed' ? '8 5' : line?.pattern === 'dotted' ? '2 5' : undefined;
  return <>
    <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY} label={props.label} markerStart={props.markerStart} markerEnd={props.markerEnd} style={{ stroke: color, strokeWidth: line?.pattern === 'double' ? width + 4 : width, strokeDasharray: dash }} />
    {line?.pattern === 'double' && <path d={path} fill="none" stroke="var(--bg, #f8f9fd)" strokeWidth={Math.max(1, width)} pointerEvents="none" />}
  </>;
}
