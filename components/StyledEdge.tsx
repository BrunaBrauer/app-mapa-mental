'use client';
import { BaseEdge, getBezierPath, getSmoothStepPath, getStraightPath, Position, type EdgeProps } from '@xyflow/react';
import type { LineStyle } from '../types';

function Endpoint({ symbol, x, y, color, width, position }: { symbol?: LineStyle['end']; x: number; y: number; color: string; width: number; position: Position }) {
  const size = Math.max(5, width + 3);
  if (symbol === 'circle' || symbol === 'hollow-circle') return <circle cx={x} cy={y} r={size} fill={symbol === 'circle' ? color : 'var(--surface, #fff)'} stroke={color} strokeWidth={Math.max(2, width)} pointerEvents="none"/>;
  if (symbol === 'diamond') return <path d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`} fill={color} stroke={color} pointerEvents="none"/>;
  if (symbol === 'square') return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} fill={color} pointerEvents="none"/>;
  if (symbol === 'bar') return <line x1={position === Position.Left || position === Position.Right ? x : x - size} y1={position === Position.Left || position === Position.Right ? y - size : y} x2={position === Position.Left || position === Position.Right ? x : x + size} y2={position === Position.Left || position === Position.Right ? y + size : y} stroke={color} strokeWidth={Math.max(3, width + 1)} pointerEvents="none"/>;
  return null;
}

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
    <Endpoint symbol={line?.start} x={props.sourceX} y={props.sourceY} color={color} width={width} position={props.sourcePosition}/>
    <Endpoint symbol={line?.end} x={props.targetX} y={props.targetY} color={color} width={width} position={props.targetPosition}/>
  </>;
}
