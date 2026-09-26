import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'supplier-harmony.db');
const DOCS_DIR = path.join(DATA_DIR, 'documents');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DIST_DIR = path.join(ROOT, 'dist');
const SCHEMA_PATH = path.join(ROOT, 'server', 'schema.sql');

for (const dir of [DATA_DIR, DOCS_DIR, BACKUPS_DIR]) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

function randomId() { return crypto.randomUUID(); }
function hashPassword(password, saltB64) {
  return crypto.pbkdf2Sync(password, Buffer.from(saltB64, 'base64'), 120000, 32, 'sha256').toString('base64');
}
function makePassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  return { salt, hash: hashPassword(password, salt) };
}
function ensureAdmin() {
  const row = db.prepare('SELECT id FROM user_accounts LIMIT 1').get();
  if (row) return;
  const { salt, hash } = makePassword('root');
  const id = randomId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO user_accounts(id,email,password_hash,password_salt,created_at,must_change_password) VALUES (?,?,?,?,?,1)').run(id, 'admin', hash, salt, now);
  db.prepare('INSERT INTO user_roles(id,user_id,role,created_at) VALUES (?,?,?,?)').run(randomId(), id, 'admin', now);
}
ensureAdmin();

const sessions = new Map();
function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('='); if (k) out[k] = decodeURIComponent(v.join('='));
  }
  return out;
}
function getUser(req) {
  const token = parseCookies(req).session;
  return token ? sessions.get(token) || null : null;
}
function requireUser(req, res) {
  const user = getUser(req); if (!user) { json(res, 401, { error: 'Unauthorized' }); return null; } return user;
}
function requireAdmin(req, res) {
  const user = requireUser(req, res); if (!user) return null;
  if (user.role !== 'admin') { json(res, 403, { error: 'Forbidden: admin only' }); return null; }
  return user;
}
async function body(req) {
  const chunks=[]; for await (const c of req) chunks.push(c);
  const raw=Buffer.concat(chunks).toString('utf8'); return raw ? JSON.parse(raw) : {};
}
function normalize(row) {
  if (!row) return row;
  const out = { ...row };
  for (const k of ['insurances','certifications','terms_and_conditions']) if (typeof out[k] === 'string') { try { out[k] = JSON.parse(out[k]); } catch {} }
  for (const k of ['active','is_current']) if (k in out) out[k] = !!out[k];
  return out;
}
function safeRelative(rel) {
  const cleaned = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleaned.includes('..') || cleaned.includes('\0')) throw new Error('Invalid path');
  return cleaned;
}
function bucketDir(bucket) { return bucket === 'contract-files' ? path.join(DOCS_DIR, 'contracts') : path.join(DOCS_DIR, 'suppliers'); }
function filePath(bucket, rel) { return path.join(bucketDir(bucket), safeRelative(rel)); }
function ensureParent(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

function backupNow() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUPS_DIR, `SupplierHarmony-${stamp}.zip`);
  const staging = fs.mkdtempSync(path.join(DATA_DIR, '.backup-'));
  try {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
    fs.copyFileSync(DB_PATH, path.join(staging, 'supplier-harmony.db'));
    if (fs.existsSync(DOCS_DIR)) fs.cpSync(DOCS_DIR, path.join(staging, 'documents'), { recursive:true });
    if (process.platform === 'win32') {
      const ps = `Compress-Archive -Path '${staging.replace(/'/g, "''")}\\*' -DestinationPath '${target.replace(/'/g, "''")}' -Force`;
      const r = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', ps], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr || 'PowerShell backup failed');
    } else {
      const r = spawnSync('tar', ['-a','-c','-f',target,'-C',staging,'.'], { encoding:'utf8' });
      if (r.status !== 0) throw new Error(r.stderr || 'Backup command failed');
    }
    return target;
  } finally { fs.rmSync(staging,{recursive:true,force:true}); }
}
function restoreBackup(base64) {
  const tmp = path.join(BACKUPS_DIR, `restore-${Date.now()}.zip`);
  fs.writeFileSync(tmp, Buffer.from(base64, 'base64'));
  db.close();
  if (process.platform === 'win32') {
    const ps = `Expand-Archive -Path '${tmp.replace(/'/g, "''")}' -DestinationPath '${DATA_DIR.replace(/'/g, "''")}' -Force`;
    const r = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', ps], { encoding:'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'Restore failed');
  } else {
    const r = spawnSync('tar', ['-xf',tmp,'-C',DATA_DIR], { encoding:'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'Restore failed');
  }
  fs.rmSync(tmp, { force:true });
  process.exit(0);
}

async function handle(req, res) {
  try {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (u.pathname === '/api/health') return json(res,200,{ok:true});
    if (u.pathname === '/api/auth/login' && req.method === 'POST') {
      const { email, password } = await body(req);
      const user = db.prepare('SELECT * FROM user_accounts WHERE email=? LIMIT 1').get(String(email || '').trim());
      if (!user) return json(res,401,{error:'Invalid credentials'});
      const hash = hashPassword(password || '', user.password_salt);
      if (hash !== user.password_hash) return json(res,401,{error:'Invalid credentials'});
      const role = db.prepare('SELECT role FROM user_roles WHERE user_id=? LIMIT 1').get(user.id)?.role || 'viewer';
      const token = randomId();
      const sessionUser = { id:user.id, email:user.email, must_change_password:!!user.must_change_password, role };
      sessions.set(token, sessionUser);
      res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`);
      return json(res,200,{user:sessionUser});
    }
    if (u.pathname === '/api/auth/session' && req.method === 'GET') return json(res,200,{user:getUser(req)});
    if (u.pathname === '/api/auth/logout' && req.method === 'POST') { const token=parseCookies(req).session; if(token) sessions.delete(token); res.setHeader('Set-Cookie','session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/'); return json(res,200,{ok:true}); }
    if (u.pathname === '/api/auth/change-password' && req.method === 'POST') {
      const user=requireUser(req,res); if(!user)return;
      const {currentPassword,newPassword}=await body(req); const row=db.prepare('SELECT * FROM user_accounts WHERE id=?').get(user.id);
      if(hashPassword(currentPassword||'',row.password_salt)!==row.password_hash)return json(res,400,{error:'Current password is incorrect'});
      const p=makePassword(newPassword||''); db.prepare('UPDATE user_accounts SET password_hash=?,password_salt=?,must_change_password=0 WHERE id=?').run(p.hash,p.salt,user.id);
      user.must_change_password=false; return json(res,200,{ok:true,user});
    }
    if (u.pathname === '/api/db/select' && req.method === 'POST') {
      if (!requireUser(req,res)) return; const {sql,params=[]}=await body(req); const safeParams = Array.isArray(params) ? params.map((v) => typeof v === 'boolean' ? (v ? 1 : 0) : (v === undefined ? null : v)) : []; const rows=db.prepare(sql).all(...safeParams).map(normalize); return json(res,200,{rows});
    }
    if (u.pathname === '/api/db/execute' && req.method === 'POST') {
      if (!requireUser(req,res)) return; const {sql,params=[]}=await body(req); const safeParams = Array.isArray(params) ? params.map((v) => typeof v === 'boolean' ? (v ? 1 : 0) : (v === undefined ? null : v)) : []; const r=db.prepare(sql).run(...safeParams); return json(res,200,{rows_affected:Number(r.changes||0),last_insert_id:Number(r.lastInsertRowid||0)});
    }
    if (u.pathname === '/api/admin-users' && req.method === 'POST') {
      const user=requireAdmin(req,res); if(!user)return;
      const b=await body(req);
      if(b.action==='list') return json(res,200,db.prepare('SELECT u.id,u.email,u.created_at,r.role FROM user_accounts u LEFT JOIN user_roles r ON r.user_id=u.id ORDER BY u.email').all());
      if(b.action==='invite') { const tempPassword=b.password || crypto.randomBytes(9).toString('base64url'); const p=makePassword(tempPassword), id=randomId(), now=new Date().toISOString(); db.prepare('INSERT INTO user_accounts(id,email,password_hash,password_salt,created_at,must_change_password) VALUES (?,?,?,?,?,1)').run(id,b.email,p.hash,p.salt,now); db.prepare('INSERT INTO user_roles(id,user_id,role,created_at) VALUES (?,?,?,?)').run(randomId(),id,b.role,now); return json(res,200,{user:{id,email:b.email,role:b.role,tempPassword},tempPassword}); }
      if(b.action==='update_role') { if(b.user_id===user.id)return json(res,400,{error:'Cannot change your own role'}); db.prepare('UPDATE user_roles SET role=? WHERE user_id=?').run(b.role,b.user_id); return json(res,200,{success:true}); }
      if(b.action==='delete') { if(b.user_id===user.id)return json(res,400,{error:'Cannot delete your own account'}); db.prepare('DELETE FROM user_accounts WHERE id=?').run(b.user_id); return json(res,200,{success:true}); }
      if(b.action==='reset_password') { const tempPassword=crypto.randomBytes(9).toString('base64url'); const p=makePassword(tempPassword); db.prepare('UPDATE user_accounts SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=?').run(p.hash,p.salt,b.user_id); return json(res,200,{success:true,tempPassword}); }
      return json(res,400,{error:'Invalid action'});
    }
    if (u.pathname === '/api/onboarding' && req.method === 'POST') {
      const b=await body(req);
      if(b.action==='validate') { const r=db.prepare('SELECT t.*,s.name,s.insurances,s.certifications,s.terms_and_conditions FROM onboarding_tokens t JOIN suppliers s ON s.id=t.supplier_id WHERE t.token=? LIMIT 1').get(b.token); if(!r)return json(res,400,{error:'Invalid link'}); if(r.used_at)return json(res,400,{error:'This link has already been used'}); if(new Date(r.expires_at)<new Date())return json(res,400,{error:'This link has expired'}); return json(res,200,{supplier:{id:r.supplier_id,name:r.name,insurances:JSON.parse(r.insurances||'{}'),certifications:JSON.parse(r.certifications||'{}'),terms_and_conditions:JSON.parse(r.terms_and_conditions||'{}')}}); }
      if(b.action==='upload_url') { const r=db.prepare('SELECT * FROM onboarding_tokens WHERE token=? LIMIT 1').get(b.token); if(!r||r.used_at||new Date(r.expires_at)<new Date())return json(res,400,{error:'Invalid or expired link'}); const category=String(b.data?.category||'').replace(/[^a-zA-Z0-9_-]/g,''); const key=String(b.data?.key||'').replace(/[^a-zA-Z0-9_-]/g,''); const ext=String(b.data?.ext||'bin').replace(/[^a-zA-Z0-9]/g,'').slice(0,10); return json(res,200,{path:`${r.supplier_id}/${category}/${key}_${Date.now()}.${ext}`,token:randomId()}); }
      if(b.action==='submit') { const r=db.prepare('SELECT * FROM onboarding_tokens WHERE token=? LIMIT 1').get(b.token); if(!r||r.used_at||new Date(r.expires_at)<new Date())return json(res,400,{error:'Invalid or expired link'}); db.prepare('UPDATE suppliers SET insurances=?,certifications=?,terms_and_conditions=? WHERE id=?').run(JSON.stringify(b.data?.insurances||{}),JSON.stringify(b.data?.certifications||{}),JSON.stringify(b.data?.termsAndConditions||{}),r.supplier_id); db.prepare('UPDATE onboarding_tokens SET used_at=? WHERE id=?').run(new Date().toISOString(),r.id); return json(res,200,{success:true}); }
      return json(res,400,{error:'Invalid action'});
    }
    if (u.pathname === '/api/app/data-path' && req.method === 'GET') { if(!requireUser(req,res))return; return json(res,200,{path:DATA_DIR}); }
    if (u.pathname === '/api/backup' && req.method === 'POST') { if(!requireAdmin(req,res))return; return json(res,200,{path:backupNow()}); }
    if (u.pathname === '/api/restore' && req.method === 'POST') { if(!requireAdmin(req,res))return; const {base64}=await body(req); restoreBackup(base64); return; }
    if (u.pathname.startsWith('/api/files/') && req.method === 'GET') {
      if(!requireUser(req,res))return; const [, , , bucket, ...parts]=u.pathname.split('/'); const p=filePath(bucket,parts.join('/')); if(!fs.existsSync(p))return json(res,404,{error:'Not found'}); res.writeHead(200,{'Content-Type':'application/octet-stream'}); return fs.createReadStream(p).pipe(res);
    }
    if (u.pathname === '/api/files' && req.method === 'POST') {
      if(!requireUser(req,res))return; const {bucket,path:dataPath,dataBase64}=await body(req); const p=filePath(bucket,dataPath); ensureParent(p); fs.writeFileSync(p,Buffer.from(dataBase64,'base64')); return json(res,200,{path:dataPath});
    }
    if (u.pathname === '/api/files' && req.method === 'DELETE') {
      if(!requireUser(req,res))return; const {bucket,paths}=await body(req); for(const rel of paths||[]) fs.rmSync(filePath(bucket,rel),{force:true}); return json(res,200,{ok:true});
    }

    if (u.pathname.startsWith('/api/')) return json(res,404,{error:'Not found'});
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Method not allowed'});
    let file = path.join(DIST_DIR, u.pathname === '/' ? 'index.html' : safeRelative(u.pathname));
    if (!file.startsWith(DIST_DIR)) return json(res,400,{error:'Invalid path'});
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(DIST_DIR,'index.html');
    if (!fs.existsSync(file)) return json(res,503,{error:'Frontend not built. Run npm run build first.'});
    const ext=path.extname(file); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}); if(req.method==='HEAD')return res.end(); fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); if(!res.headersSent) json(res,500,{error:e instanceof Error?e.message:String(e)}); }
}

const server=http.createServer(handle);
server.listen(PORT,'127.0.0.1',()=>{ console.log(`Supplier Harmony running at http://127.0.0.1:${PORT}`); if(process.platform==='win32') spawnSync('cmd.exe',['/c','start','',`http://127.0.0.1:${PORT}`],{stdio:'ignore'}); });
process.on('SIGINT',()=>{try{db.close()}finally{process.exit(0)}});
process.on('SIGTERM',()=>{try{db.close()}finally{process.exit(0)}});
