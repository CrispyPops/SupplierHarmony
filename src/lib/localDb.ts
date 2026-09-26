const SCHEMA = `Local web server owns the SQLite schema.`;
let initialized = false;

export function isTauriDesktop(): boolean { return false; }

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await res.text();
  let data: any = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function initLocalDb() {
  if (initialized) return;
  await api('/api/health');
  initialized = true;
}
export async function select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await initLocalDb();
  return (await api('/api/db/select', { method:'POST', body:JSON.stringify({sql,params}) })).rows;
}
export async function execute(sql: string, params: any[] = []) {
  await initLocalDb();
  return api('/api/db/execute', { method:'POST', body:JSON.stringify({sql,params}) });
}
export async function getAppDataPath() { await initLocalDb(); return (await api('/api/app/data-path')).path; }
export async function createBackup() { await initLocalDb(); return (await api('/api/backup', {method:'POST'})).path; }
export async function restoreBackup(base64: string) { await initLocalDb(); return api('/api/restore', {method:'POST',body:JSON.stringify({base64})}); }
export async function uploadLocalFile(bucket: string, filePath: string, dataBase64: string) { return api('/api/files',{method:'POST',body:JSON.stringify({bucket,path:filePath,dataBase64})}); }
export async function downloadLocalFile(bucket: string, filePath: string) { const res=await fetch(`/api/files/${encodeURIComponent(bucket)}/${filePath.split('/').map(encodeURIComponent).join('/')}`); if(!res.ok) throw new Error('Download failed'); const b=await res.arrayBuffer(); let s=''; new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x)); return btoa(s); }
export async function deleteLocalFiles(bucket: string, paths: string[]) { return api('/api/files',{method:'DELETE',body:JSON.stringify({bucket,paths})}); }
