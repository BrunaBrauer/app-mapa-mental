'use client';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import type { MindMap, MindNode } from '../types';

type Props = { map: MindMap; mode: 'outline' | 'gantt'; onView: (mode: 'map' | 'outline' | 'gantt') => void; onPatch: (id: string, patch: Partial<MindNode>) => void; onToggle: (id: string) => void };
const day = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (value: number) => new Date(value).toISOString().slice(0, 10);

export default function MapAlternateView({ map, mode, onView, onPatch, onToggle }: Props) {
  const children = new Map<string, MindNode[]>();
  for (const node of map.nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node]);
  const roots = map.nodes.filter(node => !node.parentId);
  const label = (node: MindNode) => <span className="alternate-title">{node.icon && <span>{node.icon} </span>}{node.text}</span>;
  const toggle = (node: MindNode) => children.has(node.id) && <button className="alternate-collapse" aria-label={node.collapsed ? 'Expandir ramo' : 'Recolher ramo'} onClick={() => onToggle(node.id)}>{node.collapsed ? <ChevronRight size={15}/> : <ChevronDown size={15}/>}</button>;
  const switcher = <div className="alternate-view-switch"><button onClick={() => onView('map')}>Mapa</button><button className={mode === 'outline' ? 'active' : ''} onClick={() => onView('outline')}>Esquema</button><button className={mode === 'gantt' ? 'active' : ''} onClick={() => onView('gantt')}>Gantt</button></div>;
  const startTimes = map.nodes.map(node => node.task?.start && time(node.task.start)).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const endTimes = map.nodes.map(node => node.task?.due ? time(node.task.due) : node.task?.start ? time(node.task.start) + Math.max(1, node.task.duration || 1) * day : NaN).filter(Number.isFinite);
  const today = time(new Date().toISOString().slice(0, 10));
  const from = startTimes.length ? Math.min(...startTimes) : today;
  const until = endTimes.length ? Math.max(...endTimes, from + 27 * day) : from + 27 * day;
  const days = Math.min(3650, Math.max(28, Math.ceil((until - from) / day) + 2));
  const cell = days > 365 ? 8 : days > 120 ? 12 : 28;
  const ticks = Array.from({ length: Math.ceil(days / (days > 120 ? 14 : 7)) }, (_, index) => index * (days > 120 ? 14 : 7));
  const rows: { node: MindNode; depth: number }[] = [];
  const visit = (node: MindNode, depth: number, path: Set<string>) => {
    if (path.has(node.id)) return;
    rows.push({ node, depth });
    if (!node.collapsed) for (const child of children.get(node.id) || []) visit(child, depth + 1, new Set([...path, node.id]));
  };
  roots.forEach(root => visit(root, 0, new Set()));
  if (mode === 'outline') return <div className="alternate-view outline-view"><div className="alternate-heading">{switcher}<span>ESQUEMA</span><h1>{map.title}</h1><p>Explore a hierarquia sem alterar a organização do mapa. Edite o texto na visualização de mapa.</p></div><div className="outline-tree">{rows.map(({ node, depth }) => <div className={`outline-row ${depth === 0 ? 'outline-root' : ''}`} key={node.id} style={{ paddingLeft: `${Math.min(depth, 16) * 23 + 8}px` }}>{toggle(node)}{!children.has(node.id) && <span className="outline-leaf">•</span>}{label(node)}{node.task && <span className="outline-task">{node.task.done ? 'Concluída' : 'Tarefa'}</span>}</div>)}</div></div>;
  return <div className="alternate-view gantt-view"><div className="alternate-heading">{switcher}<span>CRONOGRAMA</span><h1>{map.title}</h1><p>Adicione datas às tarefas no próprio cronograma. Nós sem data continuam visíveis na lista.</p></div><div className="gantt-scroll"><div className="gantt-sheet"><div className="gantt-row gantt-header"><div className="gantt-topic">Tarefa / nó</div><div className="gantt-date-field">Início</div><div className="gantt-date-field">Fim</div><div className="gantt-timeline" style={{ width: days * cell }}>{ticks.map(offset => <span key={offset} style={{ left: offset * cell }}>{new Date(from + offset * day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</span>)}</div></div>{rows.map(({ node, depth }) => {
      const start = node.task?.start && Number.isFinite(time(node.task.start)) ? time(node.task.start) : null;
      const end = node.task?.due && Number.isFinite(time(node.task.due)) ? time(node.task.due) : start === null ? null : start + Math.max(1, node.task?.duration || 1) * day;
      const left = start === null ? 0 : Math.max(0, Math.round((start - from) / day) * cell);
      const width = start === null || end === null ? 0 : Math.max(cell, Math.min(days * cell - left, (Math.max(start, end) - start + day) / day * cell));
      return <div className="gantt-row" key={node.id}><div className="gantt-topic" style={{ paddingLeft: `${Math.min(depth, 10) * 14 + 9}px` }}>{toggle(node)}{label(node)}</div><label className="gantt-date-field"><input aria-label={`Início de ${node.text}`} type="date" value={node.task?.start || ''} onChange={event => onPatch(node.id, { task: { ...node.task, done: node.task?.done ?? false, start: event.target.value || undefined, due: node.task?.due && event.target.value && node.task.due < event.target.value ? event.target.value : node.task?.due } })}/></label><label className="gantt-date-field"><input aria-label={`Fim de ${node.text}`} type="date" min={node.task?.start} value={node.task?.due || ''} onChange={event => onPatch(node.id, { task: { ...node.task, done: node.task?.done ?? false, due: event.target.value || undefined } })}/></label><div className="gantt-timeline gantt-track" style={{ width: days * cell, backgroundSize: `${cell}px 100%` }}>{start !== null && <div className="gantt-bar" style={{ left, width, opacity: node.task?.done ? .55 : 1 }} title={`${node.text}: ${iso(start)} a ${iso(end ?? start)}`}><span style={{ width: `${Math.max(0, Math.min(100, node.task?.progress ?? (node.task?.done ? 100 : 0)))}%` }}/></div>}{start === null && <span className="gantt-undated"><CalendarDays size={13}/> Sem data</span>}</div></div>;
    })}</div></div></div>;
}
