'use client';

export type ImportedFont = { id: string; name: string; family: string };
type FontRecord = ImportedFont & { data: ArrayBuffer };
const DB_NAME = 'mindora-fonts';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function registerFont(record: FontRecord): Promise<void> {
  const face = new FontFace(record.family, record.data);
  await face.load();
  document.fonts.add(face);
}

export async function loadImportedFonts(): Promise<ImportedFont[]> {
  const database = await openDb();
  const records = await new Promise<FontRecord[]>((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  const available: ImportedFont[] = [];
  for (const record of records) {
    try { await registerFont(record); available.push({ id: record.id, name: record.name, family: record.family }); }
    catch { /* Ignore a damaged or unsupported font file; keep other fonts usable. */ }
  }
  return available;
}

export async function importFontFile(file: File): Promise<ImportedFont> {
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) throw new Error('Use um arquivo WOFF, WOFF2, TTF ou OTF.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A fonte deve ter até 8 MB.');
  const name = file.name.replace(/\.(woff2?|ttf|otf)$/i, '');
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').slice(0, 32) || 'Font';
  const family = `MindoraImported${slug}${file.size}`;
  const record: FontRecord = { id: family, name, family, data: await file.arrayBuffer() };
  await registerFont(record);
  const database = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return { id: family, name, family };
}
