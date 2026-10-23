'use client';

import type { MindMap } from '../types';

type PickerDocument = { id: string; name?: string; mimeType?: string; url?: string };
type PickerResult = { action?: string; docs?: PickerDocument[] };
type PickerBuilder = { addView: (view: string | object) => PickerBuilder; setOAuthToken: (token: string) => PickerBuilder; setDeveloperKey: (key: string) => PickerBuilder; setAppId: (id: string) => PickerBuilder; setOrigin: (origin: string) => PickerBuilder; setCallback: (callback: (result: PickerResult) => void) => PickerBuilder; build: () => { setVisible: (visible: boolean) => void } };
type PickerApi = { PickerBuilder: new () => PickerBuilder; DocsView: new () => { setMode: (mode: string) => object }; DocsViewMode: { LIST: string }; Action: { PICKED: string; CANCEL: string }; Response: { ACTION: 'action'; DOCUMENTS: 'docs' } };
type GoogleApi = { accounts: { oauth2: { initTokenClient: (options: { client_id: string; scope: string; error_callback?: (error: { type: string }) => void; callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void }) => { requestAccessToken: (options: { prompt: string }) => void } } }; picker: PickerApi };
type WindowWithGoogle = Window & { google?: GoogleApi; gapi?: { load: (name: string, callback: () => void) => void } };

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || '';
const driveScope = 'https://www.googleapis.com/auth/drive.file';
const scriptPromises = new Map<string, Promise<void>>();
let accessToken = '';
let expiresAt = 0;

export function driveConfigured() { return Boolean(clientId && apiKey && appId); }
export function preloadDrive() { if (driveConfigured()) void Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadScript('https://apis.google.com/js/api.js')]).catch(() => {}); }
function assertConfigured() { if (!driveConfigured()) throw new Error('O Google Drive aguarda Client ID OAuth, chave de API e número do projeto Google Cloud na configuração do nodum.'); }

function loadScript(url: string): Promise<void> {
  const prior = scriptPromises.get(url); if (prior) return prior;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = url; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca do Google.'));
    document.head.appendChild(script);
  });
  scriptPromises.set(url, promise); return promise;
}

async function token(): Promise<string> {
  assertConfigured();
  if (accessToken && Date.now() < expiresAt) return accessToken;
  await loadScript('https://accounts.google.com/gsi/client');
  const google = (window as WindowWithGoogle).google; if (!google) throw new Error('A autenticação do Google não está disponível.');
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: driveScope, error_callback: () => reject(new Error('A janela do Google foi fechada ou bloqueada. Permita pop-ups e tente novamente.')), callback: response => {
      if (response.error || !response.access_token) reject(new Error(response.error || 'A autorização do Google foi cancelada.'));
      else { accessToken = response.access_token; expiresAt = Date.now() + Math.max(0, Number(response.expires_in || 3600) - 60) * 1000; resolve(accessToken); }
    } });
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function pickerApi(): Promise<PickerApi> {
  await loadScript('https://apis.google.com/js/api.js');
  const host = window as WindowWithGoogle; if (!host.gapi) throw new Error('O seletor do Google Drive não carregou.');
  await new Promise<void>(resolve => host.gapi!.load('picker', resolve));
  if (!host.google?.picker) throw new Error('O seletor do Google Drive não está disponível.');
  return host.google.picker;
}

export async function pickDriveFile(): Promise<PickerDocument | null> {
  const oauthToken = await token(); const picker = await pickerApi();
  return new Promise<PickerDocument | null>(resolve => {
    const view = new picker.DocsView().setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder().addView(view).setOAuthToken(oauthToken).setDeveloperKey(apiKey).setAppId(appId).setOrigin(window.location.origin).setCallback(result => {
      if (result[picker.Response.ACTION] === picker.Action.PICKED) resolve(result[picker.Response.DOCUMENTS]?.[0] || null);
      else if (result[picker.Response.ACTION] === picker.Action.CANCEL) resolve(null);
    }).build().setVisible(true);
  });
}

export async function downloadDriveFile(id: string): Promise<Blob> {
  const oauthToken = await token();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: `Bearer ${oauthToken}` } });
  if (response.status === 401) { accessToken = ''; expiresAt = 0; }
  if (!response.ok) throw new Error(`Não foi possível baixar o arquivo do Drive (${response.status}).`);
  return response.blob();
}

export async function saveMapToDrive(map: MindMap): Promise<void> {
  const oauthToken = await token(); const json = JSON.stringify(map, null, 2); const boundary = `nodum_${crypto.randomUUID().replace(/-/g, '')}`;
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: `${map.title}.nodum.json`, mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`, json, `\r\n--${boundary}--`]);
  if (body.size > 5 * 1024 * 1024) throw new Error('O mapa excede 5 MB. Reduza as imagens antes de enviar ao Drive.');
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${oauthToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (response.status === 401) { accessToken = ''; expiresAt = 0; }
  if (!response.ok) throw new Error(`Não foi possível salvar no Drive (${response.status}).`);
}
