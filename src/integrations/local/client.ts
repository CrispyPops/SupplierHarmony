import { execute, initLocalDb, select, uploadLocalFile, downloadLocalFile, deleteLocalFiles } from '@/lib/localDb';

const jsonColumns = new Set(['insurances','certifications','terms_and_conditions']);
function normalizeRow(row: any) {
  const out = { ...row };
  for (const key of jsonColumns) {
    if (typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch { /* leave as string */ }
    }
  }
  for (const key of ['active','is_current']) if (key in out) out[key] = !!out[key];
  return out;
}
function serializeValue(value: any) {
  // Node's built-in SQLite driver accepts null, numbers, strings, bigint and buffers,
  // but not JavaScript booleans or arbitrary objects. Convert booleans to SQLite's
  // INTEGER representation and JSON-encode structured values.
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

class QueryBuilder implements PromiseLike<any> {
  private table: string; private action: 'select'|'insert'|'update'|'delete'|'upsert' = 'select';
  private columns = '*'; private values: any; private filters: string[] = []; private params: any[] = [];
  private orderBy = ''; private limitValue?: number; private returnColumns: string | null = null;
  constructor(table: string) { this.table = table; }
  select(columns = '*') { this.columns = columns; if (this.action === 'select') this.returnColumns = null; else this.returnColumns = columns; return this; }
  insert(values: any) { this.action = 'insert'; this.values = values; return this; }
  update(values: any) { this.action = 'update'; this.values = values; return this; }
  delete() { this.action = 'delete'; return this; }
  upsert(values: any, _options?: any) { this.action = 'upsert'; this.values = values; return this; }
  eq(column: string, value: any) { this.filters.push(`\"${column}\" = ?`); this.params.push(serializeValue(value)); return this; }
  gte(column: string, value: any) { this.filters.push(`\"${column}\" >= ?`); this.params.push(serializeValue(value)); return this; }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = ` ORDER BY \"${column}\" ${(opts?.ascending ?? true) ? 'ASC' : 'DESC'}`; return this; }
  limit(n: number) { this.limitValue = n; return this; }
  async maybeSingle() { const result = this.action === 'select' ? { data: await this.runSelect(), error: null } : await this.run(); return { data: result.data?.[0] ?? null, error: result.error ?? null }; }
  async single() { const result = this.action === 'select' ? { data: await this.runSelect(), error: null } : await this.run(); return result.data?.[0] ? { data: result.data[0], error: result.error ?? null } : { data: null, error: result.error ?? new Error('Row not found') }; }
  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.run().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
  private whereSql() { return this.filters.length ? ` WHERE ${this.filters.join(' AND ')}` : ''; }
  private async runSelect() { const sql = `SELECT ${this.columns} FROM \"${this.table}\"${this.whereSql()}${this.orderBy}${this.limitValue ? ` LIMIT ${this.limitValue}` : ''}`; const data = (await select(sql, this.params)).map(normalizeRow); return data; }
  private rowValues(input: any) { const row = { ...input }; const now = new Date().toISOString(); if (this.table === 'onboarding_tokens') { row.id ??= randomId(); row.token ??= randomId().replaceAll('-',''); row.created_at ??= now; } if (this.table === 'contracts') { row.id ??= randomId(); row.created_at ??= now; row.updated_at ??= now; } if (this.table === 'contract_files') { row.id ??= randomId(); row.uploaded_at ??= now; } if (this.table === 'contract_history') { row.id ??= randomId(); row.created_at ??= now; } if (this.table === 'user_roles') { row.id ??= randomId(); row.created_at ??= now; } const keys = Object.keys(row); return { row, keys, placeholders: keys.map(() => '?').join(','), params: keys.map(k => serializeValue(row[k])) }; }
  private async run(): Promise<any> {
    try {
      if (this.action === 'select') return { data: await this.runSelect(), error: null };
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      if (this.action === 'insert') {
        const inserted: any[] = [];
        for (const row of rows) {
          const { row: fullRow, keys, placeholders, params } = this.rowValues(row);
          await execute(`INSERT INTO \"${this.table}\" (${keys.map(k=>`\"${k}\"`).join(',')}) VALUES (${placeholders})`, params);
          if (this.returnColumns) {
            const key = fullRow.id !== undefined ? 'id' : 'key';
            const out = await select(`SELECT ${this.returnColumns} FROM \"${this.table}\" WHERE \"${key}\" = ? LIMIT 1`, [fullRow[key]]);
            inserted.push(...out.map(normalizeRow));
          }
        }
        return { data: this.returnColumns ? inserted : null, error: null };
      }
      if (this.action === 'upsert') {
        for (const row of rows) { const { keys, placeholders, params } = this.rowValues(row); const updateKeys = keys.filter(k => k !== 'id' && k !== 'key' && k !== 'user_id'); const sql = `INSERT INTO \"${this.table}\" (${keys.map(k=>`\"${k}\"`).join(',')}) VALUES (${placeholders}) ON CONFLICT DO UPDATE SET ${updateKeys.map(k=>`\"${k}\"=excluded.\"${k}\"`).join(',')}`; await execute(sql, params); }
        return { data: null, error: null };
      }
      if (this.action === 'update') {
        const keys = Object.keys(this.values); const set = keys.map(k => `\"${k}\" = ?`).join(', '); const params = keys.map(k => serializeValue(this.values[k])).concat(this.params); await execute(`UPDATE \"${this.table}\" SET ${set}${this.whereSql()}`, params); return { data: null, error: null };
      }
      await execute(`DELETE FROM \"${this.table}\"${this.whereSql()}`, this.params); return { data: null, error: null };
    } catch (e: any) { return { data: null, error: e instanceof Error ? e : new Error(String(e)) }; }
  }
}

const authListeners = new Set<(event: string, session: any) => void>();
const sessionKey = 'supplier-harmony-session';
function randomId() { return crypto.randomUUID(); }
function currentSession() { try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; } }
function emit(event: string, session: any) { authListeners.forEach(fn => fn(event, session)); }

const auth = {
  onAuthStateChange(cb: (event: string, session: any) => void) { authListeners.add(cb); return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }; },
  async getSession() { await initLocalDb(); const res=await fetch('/api/auth/session'); const data=await res.json(); if(data.user){const session={access_token:'local-server',user:data.user}; localStorage.setItem(sessionKey,JSON.stringify(session)); return {data:{session}};} localStorage.removeItem(sessionKey); return {data:{session:null}}; },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await initLocalDb(); const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const data=await res.json(); if(!res.ok)return {error:new Error(data.error||'Invalid credentials')}; const session={access_token:'local-server',user:data.user}; localStorage.setItem(sessionKey,JSON.stringify(session)); emit('SIGNED_IN',session); return {error:null};
  },
  async signOut() { await fetch('/api/auth/logout',{method:'POST'}); localStorage.removeItem(sessionKey); emit('SIGNED_OUT',null); },
  async changePassword(_userId: string, currentPassword: string, newPassword: string) { const res=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})}); const data=await res.json(); if(!res.ok)return {error:new Error(data.error||'Password change failed')}; const session=currentSession(); if(session){session.user=data.user;localStorage.setItem(sessionKey,JSON.stringify(session));emit('PASSWORD_UPDATED',session);} return {error:null}; },
};

const storage = { from(bucket: string) { return {
  async upload(path: string, file: File) { try { let s=''; new Uint8Array(await file.arrayBuffer()).forEach(b=>s+=String.fromCharCode(b)); await uploadLocalFile(bucket,path,btoa(s)); return { data: { path }, error: null }; } catch (e:any) { return { data:null,error:e instanceof Error?e:new Error(String(e)) }; } },
  async uploadToSignedUrl(path: string, _token: string, file: File) { return this.upload(path,file); },
  async download(path: string) { try { const b64=await downloadLocalFile(bucket,path); const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); return {data:new Blob([bytes],{type:'application/octet-stream'}),error:null}; } catch(e:any){return {data:null,error:e instanceof Error?e:new Error(String(e))};} },
  async remove(paths: string[]) { try { await deleteLocalFiles(bucket,paths); return {data:null,error:null}; } catch(e:any){return {data:null,error:e instanceof Error?e:new Error(String(e))};} },
}; } };

function strongPassword() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'; const a=['A','a','2','!']; for(let i=0;i<12;i++) a.push(chars[Math.floor(Math.random()*chars.length)]); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a.join(''); }

async function functionInvoke(name:string, body:any) {
  const endpoint=name==='admin-users'?'/api/admin-users':'/api/onboarding';
  try { const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await res.json(); return {data,error:res.ok?null:new Error(data?.error||'Request failed')}; } catch(e:any){return {data:null,error:e instanceof Error?e:new Error(String(e))};}
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage,
  functions: { invoke: async (name: string, { body }: { body: any }) => functionInvoke(name, body) },
};
