'use client';
import { useState } from 'react';
import { Ban, Plus, Star } from 'lucide-react';

const hex = /^#[0-9a-f]{6}$/i;
const palette = ['#000000', '#ffffff', '#a0a0a0', '#b91c1c', '#e7983f', '#f2c230', '#77ac62'];
type Props = { label: string; value?: string; fallback: string; onChange: (color: string) => void; noneLabel?: string; favorites?: [string, string]; onFavorite?: (index: 0 | 1, color: string) => void; icon?: string };

export default function ColorSelector({ label, value, fallback, onChange, noneLabel, favorites = ['#7057e8', '#41baa3'], onFavorite, icon = 'A' }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const current = value && hex.test(value) ? value : fallback;
  const change = (color: string) => { setDraft(null); onChange(color); };
  return <div className="quick-color-control"><span>{label}</span><div className="text-color-row color-selector-row">
    <span className="text-color-icon" style={{ borderBottomColor: current }}>{icon}</span>
    <label className="text-color-picker" style={{ background: current }} title={`Escolher ${label.toLowerCase()}`}><Plus size={14}/><input type="color" aria-label={`Escolher ${label.toLowerCase()}`} value={current} onInput={event => change(event.currentTarget.value)}/></label>
    <input className="text-hex" aria-label={`Código hexadecimal de ${label.toLowerCase()}`} maxLength={7} value={draft ?? current} onChange={event => { setDraft(event.target.value); if (hex.test(event.target.value)) onChange(event.target.value); }} onBlur={() => setDraft(null)}/>
    {palette.map(color => <button key={color} type="button" className={`text-color-swatch ${value === color ? 'selected' : ''}`} aria-label={`${label}: ${color}`} title={color} style={{ background: color }} onClick={() => change(color)}/>)}
    {favorites.map((color, index) => <span className="color-favorite-slot" key={index}><button type="button" className="text-color-swatch" aria-label={`Aplicar cor favorita ${index + 1}: ${color}`} title={`Cor favorita ${index + 1}: ${color}`} style={{ background: color }} onClick={() => change(color)}/>{onFavorite && <button type="button" className="color-favorite-save" aria-label={`Salvar cor atual no favorito ${index + 1}`} title={`Salvar ${current} no favorito ${index + 1}`} onClick={() => onFavorite(index as 0 | 1, current)}><Star size={9} fill="currentColor"/></button>}</span>)}
    {noneLabel && <button type="button" className={`color-none ${value === 'transparent' ? 'selected' : ''}`} onClick={() => change('transparent')}><Ban size={13}/>{noneLabel}</button>}
  </div></div>;
}
