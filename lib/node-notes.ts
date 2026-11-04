import type { MindNode, NodeNote } from '../types';

/** Older maps store one note as a string; materialize it only when editing. */
export function notesForNode(node: MindNode): NodeNote[] {
  if (node.notes) return node.notes;
  return node.note ? [{ id: `legacy:${node.id.slice(0, 93)}`, text: node.note, createdAt: 0 }] : [];
}

export function appendNodeNote(node: MindNode, text = ''): Pick<MindNode, 'note' | 'notes'> {
  const notes = notesForNode(node);
  if (notes.length >= 100 || notes.reduce((length, note) => length + note.text.length, text.length) > 200_000) throw new Error('Este nó atingiu o limite de notas. Exclua ou reduza uma nota antes de adicionar outra.');
  return { note: undefined, notes: [...notes, { id: crypto.randomUUID(), text, createdAt: Date.now() }] };
}

export function updateNodeNote(node: MindNode, id: string, text: string): Pick<MindNode, 'note' | 'notes'> {
  return { note: undefined, notes: notesForNode(node).map(note => note.id === id ? { ...note, text } : note) };
}

export function removeNodeNote(node: MindNode, id: string): Pick<MindNode, 'note' | 'notes'> {
  return { note: undefined, notes: notesForNode(node).filter(note => note.id !== id) };
}
