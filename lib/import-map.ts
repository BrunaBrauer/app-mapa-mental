import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';
import type { MindMap, MindNode } from '../types';
import { autoLayout, uid } from './maps';
import { validMap } from './server-maps';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : textValue(record(value)['#text']);
const textValue = (value: unknown): string => typeof value === 'string' ? value : '';

// Imports always create a separate, private map. The source file is never overwritten.
export function parseMapFile(source: string, filename: string): { map: MindMap; warning?: string } {
  if (new TextEncoder().encode(source).length > 5 * 1024 * 1024) throw new Error('Use um mapa de até 5 MB.');
  const content = source.replace(/^\uFEFF/, '').trim();
  let raw: RecordValue;
  if (content.startsWith('<')) {
    if (/<!DOCTYPE|<!ENTITY/i.test(content) || XMLValidator.validate(content) !== true) throw new Error('O XML do mapa é inválido ou contém declarações não permitidas.');
    const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: false }).parse(content);
    raw = record(record(parsed).map);
  } else {
    try { raw = record(JSON.parse(content)); } catch { throw new Error('Formato não reconhecido. Use JSON do nodum ou .mom XML/JSON do Mindomo (sem pacote de anexos).'); }
  }
  if (Array.isArray(raw.nodes)) {
    const candidate = { ...raw, id: uid(), shareToken: null, updatedAt: Date.now() };
    if (!validMap(candidate) || !candidate.nodes.length) throw new Error('O mapa JSON contém dados inválidos (limite de 2.000 nós e 1.000 caracteres por nó).');
    validateTree(candidate.nodes);
    return { map: candidate };
  }
  const root = record(raw.map || raw);
  const roots = array(record(root.topics).topic ?? root.topics ?? root.topic);
  if (!roots.length) throw new Error('Esta versão do arquivo Mindomo não foi reconhecida. Envie um exemplo .mom para ampliarmos a compatibilidade.');
  const nodes: MindNode[] = [];
  const visit = (value: unknown, parentId: string | null, depth: number) => {
    const topic = record(value);
    if ('@_deleted' in topic || topic.deleted === true) return;
    if (depth > 100 || nodes.length >= 2000) throw new Error('O mapa excede 2.000 nós ou 100 níveis.');
    const label = text(topic.text);
    if (label.length > 1000) throw new Error('Um tópico excede 1.000 caracteres. Reduza seu texto antes de importar.');
    const node: MindNode = { id: uid(), parentId, text: label || 'Sem título', x: 0, y: 0, background: '#ffffff', border: '#000000', icon: '' };
    const note = text(topic.notes ?? topic.note);
    const url = text(topic.hyperlink ?? topic.url);
    if (note) node.note = note;
    if (/^https?:\/\//i.test(url)) node.url = url;
    if (!parentId && nodes.length) node.floating = true;
    nodes.push(node);
    array(record(topic.subTopics).topic ?? topic.subTopics ?? record(topic.children).topic ?? topic.children).forEach(child => visit(child, node.id, depth + 1));
  };
  roots.forEach(topic => visit(topic, null, 0));
  if (!nodes.length) throw new Error('Nenhum tópico foi encontrado no arquivo.');
  const title = (text(root.name ?? root.title) || filename.replace(/\.(mom|json)$/i, '')).slice(0, 160);
  const placed = autoLayout(nodes, 'right');
  // Keep independent roots apart; they do not become children of the main topic.
  let floatingRow = Math.max(...placed.map(node => node.y)) + 200;
  for (const node of placed) if (node.floating) {
    const branch = autoLayout(placed.filter(item => item.id === node.id || isDescendant(item, node.id, placed)), 'right');
    for (const item of branch) { const target = placed.find(n => n.id === item.id)!; target.x = item.x; target.y = item.y + floatingRow; }
    floatingRow = Math.max(...placed.map(item => item.y)) + 200;
  }
  return { map: { id: uid(), title, nodes: placed, layout: 'right', shareToken: null, updatedAt: Date.now() }, warning: 'Importado do Mindomo: tópicos, hierarquia, notas e links compatíveis. O layout foi organizado à direita. Estilos, anexos, tarefas e relações do Mindomo não são convertidos nesta versão.' };
}

export function parseMindomoArchive(bytes: Uint8Array, filename: string): { map: MindMap; warning?: string } {
  if (bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('O arquivo .mom não é um pacote Mindomo válido de até 5 MB.');
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes, { filter: entry => ['document.json', 'nodes.json'].includes(entry.name) && entry.originalSize <= 10 * 1024 * 1024 }); }
  catch { throw new Error('Não foi possível abrir o pacote .mom.'); }
  if (!files['document.json'] || !files['nodes.json']) throw new Error('O pacote .mom não contém o mapa e seus tópicos.');
  let document: RecordValue; let topics: RecordValue[];
  try {
    document = record(JSON.parse(strFromU8(files['document.json'])));
    const raw = JSON.parse(strFromU8(files['nodes.json']));
    if (!Array.isArray(raw)) throw new Error('nodes');
    topics = raw.map(record);
  } catch { throw new Error('Os dados do pacote .mom estão inválidos.'); }
  if (topics.length > 4000) throw new Error('O arquivo contém tópicos demais.');
  const info = record(document.mapInfo);
  const rootId = text(info.rootId);
  const byId = new Map(topics.map(topic => [text(topic.id), topic]));
  if (!rootId || !byId.has(rootId)) throw new Error('O tópico central do arquivo .mom não foi encontrado.');
  const children = new Map<string, RecordValue[]>();
  for (const topic of topics) {
    const parent = text(topic.parentId);
    if (parent) children.set(parent, [...(children.get(parent) || []), topic]);
  }
  const nodes: MindNode[] = [];
  const seen = new Set<string>();
  const visit = (topic: RecordValue, parentId: string | null, depth: number) => {
    const sourceId = text(topic.id);
    if (seen.has(sourceId) || topic.deleted === true || topic.deleted === 1) return;
    if (depth > 100 || nodes.length >= 2000) throw new Error('O mapa excede 2.000 tópicos ativos ou 100 níveis.');
    seen.add(sourceId);
    const title = text(topic.title).replace(/<[^>]*>/g, '').trim() || 'Sem título';
    const node: MindNode = { id: uid(), parentId, text: title.slice(0, 1000), x: 0, y: 0, background: '#ffffff', border: '#000000', icon: '' };
    nodes.push(node);
    (children.get(sourceId) || []).sort((a, b) => Number(a.index || 0) - Number(b.index || 0)).forEach(child => visit(child, node.id, depth + 1));
  };
  visit(byId.get(rootId)!, null, 0);
  if (!nodes.length) throw new Error('O arquivo .mom não contém tópicos ativos.');
  const title = (text(info.name) || filename.replace(/\.mom$/i, '')).slice(0, 160);
  return { map: { id: uid(), title, nodes: autoLayout(nodes, 'right'), layout: 'right', shareToken: null, updatedAt: Date.now() }, warning: `Importados ${nodes.length} tópicos do Mindomo. A estrutura foi organizada à direita; estilos e anexos ainda não são convertidos.` };
}

function isDescendant(node: MindNode, ancestor: string, nodes: MindNode[]): boolean {
  let parent = node.parentId;
  while (parent) { if (parent === ancestor) return true; parent = nodes.find(item => item.id === parent)?.parentId ?? null; }
  return false;
}

function validateTree(nodes: MindNode[]) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (byId.size !== nodes.length) throw new Error('O mapa contém identificadores de nós duplicados.');
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (seen.has(parent) || !byId.has(parent)) throw new Error('A hierarquia do mapa contém um ciclo ou um pai inexistente.');
      seen.add(parent); parent = byId.get(parent)!.parentId;
    }
  }
}
