'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShareViewer from './ShareViewer';
import type { MindMap } from '../types';
import { migrateMapLayouts } from '../lib/layout-migration';
export default function LocalShare({ token }: { token: string }) {
  const [map, setMap] = useState<MindMap | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { if (token === 'local' && window.location.hash) { try { setMap(migrateMapLayouts(JSON.parse(decodeURIComponent(window.location.hash.slice(1))) as MindMap)); return; } catch { /* Fall through to local records. */ } } const maps = JSON.parse(localStorage.getItem('mindora:maps:v1') || '[]') as MindMap[]; const found = maps.find(m => m.shareToken === token); setMap(found ? migrateMapLayouts(found) : null); }, 0); return () => window.clearTimeout(timer); }, [token]);
  return map ? <ShareViewer map={map}/> : <div className="local-share-empty"><h1>Mapa indisponível neste navegador</h1><p>Esta versão de teste guarda os mapas localmente. O compartilhamento entre dispositivos será ativado no deploy de produção.</p><Link href="/">Voltar ao editor</Link></div>;
}
