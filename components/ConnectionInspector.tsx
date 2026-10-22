'use client';
import type { LineStyle, MindNode } from '../types';

export default function ConnectionInspector({ node, onPatch, onApplyLevel }: { node: MindNode; onPatch: (patch: Partial<MindNode>) => void; onApplyLevel?: () => void }) {
  if (!node.parentId) return null;
  const style = node.connectionStyle || {};
  const update = (patch: Partial<LineStyle>) => onPatch({ connectionStyle: { ...style, ...patch } });
  return <div className="inspector-section inspector-group" data-inspector-field="connection">
    <h3 className="inspector-group-title"><span>03</span> Linha de ligação</h3>
    <p className="inspector-hint">Edite a linha entre este nó e o pai. Depois, se quiser, aplique a todos os irmãos.</p>
    <label className="field-label">Cor da linha</label><div className="line-color"><input type="color" aria-label="Cor da linha" value={style.color || '#b9b4db'} onChange={event => update({ color: event.target.value })}/><input aria-label="Código da cor da linha" value={style.color || '#b9b4db'} onChange={event => { if (/^#[0-9a-f]{6}$/i.test(event.target.value)) update({ color: event.target.value }); }}/><button onClick={() => update({ color: undefined })}>Padrão</button></div>
    <label className="field-label">Espessura</label><div className="weight-presets">{[1, 2, 4].map(width => <button key={width} className={(style.width ?? 2) === width ? 'active' : ''} onClick={() => update({ width })}><span style={{ borderTopWidth: width }}/>{width} px</button>)}</div>
    <div className="inspector-inline-controls"><input type="number" aria-label="Espessura da linha em pixels" min="1" max="20" value={style.width ?? 2} onChange={event => update({ width: Math.max(1, Math.min(20, Number(event.target.value))) })}/><select aria-label="Padrão da linha" value={style.pattern ?? 'solid'} onChange={event => update({ pattern: event.target.value as LineStyle['pattern'] })}><option value="solid">Contínua</option><option value="dashed">Tracejada</option><option value="dotted">Pontilhada</option><option value="double">Dupla</option></select></div>
    <label className="field-label">Traçado</label><select className="inspector-select" value={style.curve ?? 'rounded'} onChange={event => update({ curve: event.target.value as LineStyle['curve'] })}><option value="rounded">Canto arredondado</option><option value="smooth">Curvada</option><option value="straight">Reta</option><option value="step">Em ângulo</option></select>
    <div className="inspector-inline-controls"><label>Origem<select value={style.start ?? 'none'} onChange={event => update({ start: event.target.value as LineStyle['start'] })}><option value="none">Sem símbolo</option><option value="arrow">Seta</option><option value="circle">Círculo</option><option value="diamond">Losango</option></select></label><label>Chegada<select value={style.end ?? 'arrow'} onChange={event => update({ end: event.target.value as LineStyle['end'] })}><option value="none">Sem símbolo</option><option value="arrow">Seta</option><option value="circle">Círculo</option><option value="diamond">Losango</option></select></label></div>
    <button className="apply-level" onClick={onApplyLevel}>Aplicar esta linha a todo o nível</button>
  </div>;
}
