import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  DB: D1Database;
  SECRET_KEY: string;
  AI_API_KEY: string;
  AI_BASE_URL: string;
  AI: Ai;
  FEISHU_APP_ID?: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_BITABLE_APP_TOKEN?: string;
  FEISHU_REQUISITION_TABLE_ID?: string;
  FEISHU_POSITION_TABLE_ID?: string;
  FEISHU_TALENT_TABLE_ID?: string;
  RESUMES_KV?: KVNamespace;
}

// 飞书配置（内置 fallback，页面部署时不用再设环境变量）
const FEISHU_CONFIG = {
  appId: 'cli_aace77019aba9cdb',
  appSecret: 'ii2lYil9d5PXViTTjYlzaddB6YKuL25T',
  appToken: 'NVh9bDiNRaF0ZysxjeLc5ID2n9c',
  // 招聘任务表：含招聘岗位、部门、城市、人数、紧急度、JD等具体需求数据
  requisitionTableId: 'tblEiMBFXcvSspQd',
  // 年度招聘需求表：含岗位定义、薪资范围、能力维度等模板数据
  positionTableId: 'tblnT0AHtiLsvMeB',
  // 人才库表：小七系统写入的已入库候选人数据
  talentTableId: 'tblWkwsoTIPhzusI',
  // 审核人 open_id（AI分析后发卡片给谁）
  reviewerOpenId: 'ou_7c59c0b6f4be0717cc9202aa261ae04a',
  // 招聘群 Chat ID（用于「提醒面试官」推送）
  recruitmentGroupChatId: '',
  // 面试官 open_id 映射（姓名 → open_id，用于提醒面试官）
  interviewerOpenIds: {
    "曾颖": "ou_39a7046c231335fd28f0cedc61c30185",
    "杜雁玲": "ou_a6087857e92467972ad2070ca5219dca",
    "王彦强": "ou_66f58c7b6db1e92d637d03ada32dc0d7",
    "徐晟": "ou_54e99e9c884841558c968ee0bfda7c9c",
    "何雨菱": "ou_6ef1ac4432e825acd26c2a3bc7202fea",
    "石磊": "ou_dbc15e29e3d189ac73440e1edb7c6625",
    "韩悦": "ou_4b554b16837fb118405d1b75397729e",
    "李兴": "ou_5f8edce3b1180dda025ffcca2cad5e41",
    "王邺辉": "ou_6f57a77b82a1bd53c845a66e27af3170",
    "严鹏": "ou_ef906466a58b71dc3d6d27d7ce0f68cc",
    "魏冰": "ou_3772f691a70f636db73173f6326f03b",
    "黄雁": "ou_b41ffd621300271ce7241b8e2439f6a",
    "魏秋柠": "ou_35683c77de559475379929138391eac",
    "林烽": "ou_975ee740fe8c2e2ea0ce2f1db999bf5f",
    "丰文杰": "ou_c4589dc9d7d49793d14d93a636f85aa1",
    "胡顺": "ou_1f014a0f2fa5f2889917435e1ec01381",
    "张继鹏": "ou_dc096d1c92efacac5d1cbcf550016e2b",
    "彭创": "ou_00c40dbb8254f9db022c52b1a0868fe8",
    "陈宇佳": "ou_ebeb4c63d55ed4c9ac736dd3941e69f",
    "王嘉伟": "ou_f818646bc1578fcef79e7bdf24fed7b0",
    "宗莎": "ou_0bacd6231d3eda000a86e070cc19674c",
    "谭维": "ou_63b2097647cb67d74446219b69ef5d5",
    "欧阳剑": "ou_2127d082f0c3517ae18989ed17b0fb1d",
    "吴思为": "ou_af4f671ef7f608a1d47035a386db8f7e",
    "李博": "ou_1622b65c8d2af2a302afed7983ba9e51",
    "李双": "ou_38313f315accf8f1b38583242b04db2f",
    "范金荣": "ou_b43dbc4416047f4808ad5655b6e49f09",
    "黄维": "ou_a4289f67a7465b16a97db8d16987d6e3",
    "帕合尔尼沙·阿不里孜": "ou_60410a0f83db41fb936a6b76ee575cc1",
  } as Record<string, string>,
  // 默认 HR open_id（作为面试官提醒的兜底）
  defaultHrOpenId: 'ou_7c59c0b6f4be0717cc9202aa261ae04a',
  // Drive 目标文件夹 Token（上传简历用）
  driveFolderToken: '',
};

// 简单内存缓存，减少飞书 Bitable 重复请求
const BITABLE_CACHE_TTL = 30_000;
const bitableCache = new Map<string, { data: any[]; expiry: number }>();

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

// ==================== Crypto Utilities ====================

async function hmacSha256(key: string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlBuf(buf: ArrayBuffer): string {
  return bufToB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJwt(secretKey: string, email: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const payload = b64url(JSON.stringify({ sub: email, exp }));
  const data = `${header}.${payload}`;
  const sig = await hmacSha256(secretKey, data);
  return `${data}.${b64urlBuf(sig)}`;
}

async function verifyJwt(secretKey: string, token: string): Promise<any | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expectedSig = b64urlBuf(await hmacSha256(secretKey, data));
  if (sig !== expectedSig) return null;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(decoded);
    if (obj.exp && obj.exp < Math.floor(Date.now() / 1000)) return null;
    return obj;
  } catch { return null; }
}

async function hashPassword(secretKey: string, password: string): Promise<string> {
  return bufToB64(await hmacSha256(secretKey, password));
}

async function verifyPassword(secretKey: string, password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(secretKey, password);
  return computed === hash;
}


// ==================== AI Helper ====================

async function callAI(env: Env, systemPrompt: string, userPrompt: string, model?: string): Promise<string> {
  // 优先使用 DeepSeek（或兼容的 OpenAI API）
  if (env.AI_API_KEY) {
    const baseUrl = (env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
    const deepseekModel = model === 'deepseek-v4-flash' ? 'deepseek-chat' : (model || 'deepseek-chat');
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: deepseekModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[AI] DeepSeek API error ${resp.status}: ${errText}`);
      throw new Error(`DeepSeek API error ${resp.status}: ${errText}`);
    }
    const data: any = await resp.json();
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    throw new Error(`DeepSeek API response format unexpected: ${JSON.stringify(data)}`);
  }

  // 降级：Cloudflare Workers AI
  if (!env.AI) throw new Error('AI not configured: set AI_API_KEY env or add Workers AI binding');
  const aiModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  async function runModel(name: string): Promise<string> {
    const result: any = await env.AI!.run(name, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
    });
    // Handle various response formats from Workers AI
    if (typeof result === 'string') return result;
    if (result?.choices?.[0]?.message?.content) return result.choices[0].message.content;
    if (typeof result?.response === 'string') return result.response;
    if (typeof result?.result?.response === 'string') return result.result.response;
    if (result instanceof Response) return await result.text();
    if (result?.response instanceof ReadableStream) {
      return await new Response(result.response).text();
    }
    return JSON.stringify(result);
  }
  try {
    return await runModel(aiModel);
  } catch (primaryErr: any) {
    try {
      return await runModel('@cf/meta/llama-3.1-8b-instruct');
    } catch (fallbackErr: any) {
      throw new Error(`AI inference failed: ${primaryErr.message}; fallback: ${fallbackErr.message}`);
    }
  }
}

function extractJSON(text: string): any {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.search(/[\[\{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.substring(start, end + 1));
  }
  return JSON.parse(cleaned);
}

// ==================== D1 Helpers ====================

const ENUM_FIELDS = new Set([
  'role', 'status', 'urgency', 'position_type', 'screening_result', 'stage',
  'reject_reason_category', 'result', 'interview_type', 'interview_category',
  'test_type', 'channel_type', 'overall_result', 'employment_type',
  'contract_type', 'trigger_type', 'node_type', 'question_generation_status',
  'parse_status', 'recommendation'
]);
function transformRow(row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'number' && (value === 0 || value === 1) && /^is_/.test(key)) {
      result[key] = value === 1;
    } else if (typeof value === 'string' && value.length > 0 && (value[0] === '{' || value[0] === '[')) {
      try { result[key] = JSON.parse(value); } catch { result[key] = value; }
    } else if (ENUM_FIELDS.has(key) && typeof value === 'string') {
      result[key] = value.toLowerCase();
    } else {
      result[key] = value;
    }
  }
  return result;
}

function prepareValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function validCol(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ==================== Auth Middleware ====================

async function getUser(db: D1Database, email: string): Promise<any | null> {
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  return row ? transformRow(row) : null;
}

const authMiddleware = async (c: any, next: any) => {
  const auth = c.req.header('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return c.json({ detail: 'Not authenticated' }, 401);
  const payload = await verifyJwt(c.env.SECRET_KEY, match[1]);
  if (!payload) return c.json({ detail: 'Invalid token' }, 401);
  const user = await getUser(c.env.DB, payload.sub);
  if (!user) return c.json({ detail: 'User not found' }, 401);
  if (!user.is_active) return c.json({ detail: 'Account disabled' }, 403);
  c.set('user', user);
  await next();
};

function serializeUser(user: any) {
  const { hashed_password, ...rest } = user;
  return rest;
}

function requireRole(roles: string[]) {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ detail: 'Operation not permitted' }, 403);
    }
    await next();
  };
}

// ==================== Auth Routes ====================

app.post('/api/auth/token', async (c) => {
  const text = await c.req.text();
  const params = new URLSearchParams(text);
  const username = params.get('username') || '';
  const password = params.get('password') || '';
  if (!username || !password) return c.json({ detail: 'Missing credentials' }, 400);

  const user = await getUser(c.env.DB, username);
  if (!user) return c.json({ detail: 'Invalid credentials' }, 401);

  const ok = await verifyPassword(c.env.SECRET_KEY, password, user.hashed_password);
  if (!ok) return c.json({ detail: 'Invalid credentials' }, 401);

  const token = await createJwt(c.env.SECRET_KEY, username);
  return c.json({ access_token: token, token_type: 'bearer' });
});

app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json(serializeUser(user));
});

app.put('/api/auth/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const updates: Record<string, any> = {};
  for (const k of ['full_name']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) return c.json(serializeUser(user));
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await c.env.DB.prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
    .bind(...Object.values(updates), now(), user.id).run();
  const updated = await getUser(c.env.DB, user.email);
  return c.json(serializeUser(updated));
});

app.put('/api/auth/change-password', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const ok = await verifyPassword(c.env.SECRET_KEY, body.current_password || '', user.hashed_password);
  if (!ok) return c.json({ detail: 'Current password incorrect' }, 400);
  const newHash = await hashPassword(c.env.SECRET_KEY, body.new_password || '');
  await c.env.DB.prepare('UPDATE users SET hashed_password = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, now(), user.id).run();
  return c.json({ detail: 'Password changed' });
});

app.get('/api/auth/users', authMiddleware, requireRole(['admin']), async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return c.json(result.results.map(serializeUser));
});

app.post('/api/auth/users', authMiddleware, requireRole(['admin']), async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const hash = await hashPassword(c.env.SECRET_KEY, body.password || 'demo123');
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(id, body.email, hash, body.full_name || '', (body.role || 'hr').toLowerCase(), now(), now()).run();
  const user = await getUser(c.env.DB, body.email);
  return c.json(serializeUser(user));
});

app.put('/api/auth/users/:id', authMiddleware, requireRole(['admin']), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const updates: Record<string, any> = {};
  for (const k of ['full_name', 'email', 'role']) {
    if (body[k] !== undefined) updates[k] = k === 'role' ? body[k].toLowerCase() : body[k];
  }
  if (body.is_active !== undefined) updates.is_active = body.is_active ? 1 : 0;
  if (body.password) updates.hashed_password = await hashPassword(c.env.SECRET_KEY, body.password);
  if (Object.keys(updates).length === 0) return c.json({ detail: 'No updates' });
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await c.env.DB.prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
    .bind(...Object.values(updates), now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json(serializeUser(transformRow(row)));
});

app.put('/api/auth/users/:id/role', authMiddleware, requireRole(['admin']), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind((body.role || 'hr').toLowerCase(), now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json(serializeUser(transformRow(row)));
});

app.get('/api/auth/users/:id/status', authMiddleware, requireRole(['admin']), async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?').bind(id).first();
  if (!row) return c.json({ detail: 'User not found' }, 404);
  return c.json({ is_active: row.is_active === 1 });
});

app.delete('/api/auth/users/:id', authMiddleware, requireRole(['admin']), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ detail: 'User deleted' });
});

app.get('/api/auth/interviewers', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users WHERE lower(role) = 'interviewer' AND is_active = 1").all();
  return c.json(result.results.map(serializeUser));
});



// ==================== Dashboard Routes ====================

app.get('/api/dashboard/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const activePos = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status IN ('pending_screening','pending_review','pending_dept_review','pending_hr_decision')").first();
  const todayInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE date(interview_time) = date('now')").first();
  return c.json({
    stats: {
      active_positions: activePos?.cnt || 0,
      pending_resumes: pendingResumes?.cnt || 0,
      today_interviews: todayInterviews?.cnt || 0,
      trends: { active_positions: 0, pending_resumes: 0, today_interviews: 0 }
    },
    recent_activities: []
  });
});

app.get('/api/dashboard/funnel', authMiddleware, async (c) => {
  const db = c.env.DB;
  const total = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const totalResumes = total?.cnt || 0;
  const stages = [
    { stage: 'new', stage_name: '新简历', field: "stage = 'new'" },
    { stage: 'screening', stage_name: '筛选中', field: "stage = 'screening'" },
    { stage: 'interview', stage_name: '面试中', field: "stage = 'interview'" },
    { stage: 'offer', stage_name: 'Offer', field: "stage = 'offer'" },
    { stage: 'hired', stage_name: '已入职', field: "stage = 'hired'" },
  ];
  const result = [];
  for (const s of stages) {
    const r = await db.prepare(`SELECT COUNT(*) as cnt FROM resumes WHERE ${s.field}`).first();
    const count = r?.cnt || 0;
    result.push({
      stage: s.stage, stage_name: s.stage_name, count,
      percentage: totalResumes > 0 ? Math.round(count / totalResumes * 100) : 0
    });
  }
  return c.json({ stages: result, total_resumes: totalResumes, conversion_rate: totalResumes > 0 ? Math.round((result[4].count / totalResumes) * 100) : 0 });
});

app.get('/api/dashboard/positions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const positions = await db.prepare("SELECT * FROM positions ORDER BY created_at DESC LIMIT 10").all();
  const result = [];
  for (const pos of positions.results) {
    const r = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ?").bind(pos.id).first();
    const ps = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ? AND stage = 'new'").bind(pos.id).first();
    const pi = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ? AND stage = 'interview'").bind(pos.id).first();
    result.push({
      id: pos.id, title: pos.title, department: pos.department, status: pos.status,
      total_resumes: r?.cnt || 0, pending_screening: ps?.cnt || 0, pending_interview: pi?.cnt || 0
    });
  }
  return c.json(result);
});

app.get('/api/dashboard/interviewers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const interviewers = await db.prepare("SELECT * FROM users WHERE lower(role) = 'interviewer'").all();
  const result = [];
  for (const u of interviewers.results) {
    const total = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ?").bind(u.id).first();
    const completed = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ? AND status = 'completed'").bind(u.id).first();
    const pending = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ? AND status IN ('scheduled','in_progress')").bind(u.id).first();
    const totalCnt = total?.cnt || 0;
    const completedCnt = completed?.cnt || 0;
    result.push({
      id: u.id, name: u.full_name, total_interviews: totalCnt,
      completed_interviews: completedCnt, pending_interviews: pending?.cnt || 0,
      completion_rate: totalCnt > 0 ? Math.round(completedCnt / totalCnt * 100) : 0,
      avg_score: null, score_std: null, consistency_rating: 'N/A'
    });
  }
  return c.json(result);
});

app.get('/api/dashboard/overview', authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalPos = await db.prepare("SELECT COUNT(*) as cnt FROM positions").first();
  const activePos = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const totalResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status LIKE 'pending%'").first();
  const totalInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews").first();
  const completedInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'").first();
  return c.json({
    total_positions: totalPos?.cnt || 0, active_positions: activePos?.cnt || 0,
    total_resumes: totalResumes?.cnt || 0, pending_resumes: pendingResumes?.cnt || 0,
    total_interviews: totalInterviews?.cnt || 0, completed_interviews: completedInterviews?.cnt || 0,
  });
});

app.get('/api/dashboard/hr-stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions").first();
  const pendingReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'pending'").first();
  const approvedReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'approved'").first();
  const tpSize = await db.prepare("SELECT COUNT(*) as cnt FROM talent_pool").first();
  const obCnt = await db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records").first();
  const pbCnt = await db.prepare("SELECT COUNT(*) as cnt FROM probation_records").first();
  return c.json({
    total_requisitions: totalReq?.cnt || 0, pending_requisitions: pendingReq?.cnt || 0,
    approved_requisitions: approvedReq?.cnt || 0, talent_pool_size: tpSize?.cnt || 0,
    onboarding_count: obCnt?.cnt || 0, probation_count: pbCnt?.cnt || 0
  });
});

app.get('/api/dashboard/timeline', authMiddleware, async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    result.push({
      date: d.toISOString().slice(0, 10),
      resumes_received: 0, interviews_scheduled: 0
    });
  }
  return c.json(result);
});

app.get('/api/dashboard/ai-insights', authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status LIKE 'pending%'").first();
  const totalPositions = await db.prepare("SELECT COUNT(*) as cnt FROM positions").first();
  const activePositions = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const totalInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews").first();
  const completedInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'").first();
  const stats = {
    total_resumes: totalResumes?.cnt || 0, pending_resumes: pendingResumes?.cnt || 0,
    total_positions: totalPositions?.cnt || 0, active_positions: activePositions?.cnt || 0,
    total_interviews: totalInterviews?.cnt || 0, completed_interviews: completedInterviews?.cnt || 0,
  };
  const deptResult = await db.prepare("SELECT department, COUNT(*) as cnt FROM positions GROUP BY department ORDER BY cnt DESC LIMIT 10").all();
  const departmentDist = deptResult.results.map((r: any) => ({ department: r.department, count: r.cnt }));
  const stageResult = await db.prepare("SELECT stage, COUNT(*) as cnt FROM resumes GROUP BY stage").all();
  const stageDist = stageResult.results.map((r: any) => ({ stage: r.stage, count: r.cnt }));
  const systemPrompt = `You are an expert HR data analyst AI. Analyze the recruitment data and provide insights in Chinese. Return a JSON object with:
- summary: overall summary in Chinese (2-3 sentences)
- bottlenecks: array of { area, description } in Chinese
- recommendations: array of { priority, action } in Chinese
- predictions: array of { metric, prediction } in Chinese`;
  const userPrompt = `Recruitment Data:\n${JSON.stringify(stats, null, 2)}\n\nDepartment Distribution:\n${JSON.stringify(departmentDist, null, 2)}\n\nResume Stage Distribution:\n${JSON.stringify(stageDist, null, 2)}\n\nPlease analyze and provide insights.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    let insights: any;
    try { insights = extractJSON(result); } catch { insights = { summary: result, bottlenecks: [], recommendations: [], predictions: [] }; }
    return c.json(insights);
  } catch (err: any) {
    return c.json({ detail: 'AI insights failed', error: err.message }, 500);
  }
});

// ==================== Generic CRUD Factory ====================

type FilterConfig = Record<string, 'like' | 'eq'>;

function makeListHandler(table: string, filters: FilterConfig = {}) {
  return async (c: any) => {
    const db = c.env.DB;
    let sql = `SELECT * FROM ${table}`;
    const conditions: string[] = [];
    const binds: any[] = [];
    for (const [col, mode] of Object.entries(filters)) {
      const val = c.req.query(col);
      if (val !== undefined && val !== '' && validCol(col)) {
        if (mode === 'like') {
          conditions.push(`${col} LIKE ?`);
          binds.push(`%${val}%`);
        } else {
          conditions.push(`${col} = ?`);
          binds.push(val);
        }
      }
    }
    // Also allow ad-hoc query params for known columns
    const search = c.req.query('search');
    if (search) {
      conditions.push(`(candidate_name LIKE ? OR email LIKE ?)`);
      binds.push(`%${search}%`, `%${search}%`);
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const result = await db.prepare(sql).bind(...binds).all();
    return c.json(result.results.map(transformRow));
  };
}

function makeGetHandler(table: string) {
  return async (c: any) => {
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(c.req.param('id')).first();
    if (!row) return c.json({ detail: 'Not found' }, 404);
    return c.json(transformRow(row));
  };
}

function makeCreateHandler(table: string) {
  return async (c: any) => {
    const body = await c.req.json();
    const cols: string[] = [];
    const vals: any[] = [];
    if (!body.id) { cols.push('id'); vals.push(uuid()); }
    cols.push('created_at'); vals.push(now());
    cols.push('updated_at'); vals.push(now());
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !['id', 'created_at', 'updated_at'].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
    await c.env.DB.prepare(sql).bind(...vals).run();
    const id = vals[0];
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    return c.json(transformRow(row));
  };
}

function makeUpdateHandler(table: string) {
  return async (c: any) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const cols: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !['id', 'created_at'].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    cols.push('updated_at'); vals.push(now());
    if (cols.length <= 1) return c.json({ detail: 'No updates' });
    const setClause = cols.map(k => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).bind(...vals, id).run();
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    return c.json(transformRow(row));
  };
}

function makeDeleteHandler(table: string) {
  return async (c: any) => {
    await c.env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(c.req.param('id')).run();
    return c.json({ detail: 'Deleted' });
  };
}

function registerCrud(prefix: string, table: string, filters: FilterConfig = {}) {
  app.get(`/api/${prefix}`, authMiddleware, makeListHandler(table, filters));
  app.post(`/api/${prefix}`, authMiddleware, makeCreateHandler(table));
  app.get(`/api/${prefix}/:id`, authMiddleware, makeGetHandler(table));
  app.put(`/api/${prefix}/:id`, authMiddleware, makeUpdateHandler(table));
  app.delete(`/api/${prefix}/:id`, authMiddleware, makeDeleteHandler(table));
}

// ==================== Bitable-backed CRUD helpers (直接读写飞书多维表格) ====================

// 招聘任务表 → 需求管理 的字段映射
const FEISHU_REQUISITION_FIELDS: Record<string, string> = {
  title: '招聘岗位',
  department: '二级部门',
  department_3rd: '三级部门',
  city: '招聘城市',
  headcount: '招聘人数',
  urgency: '紧急度',
  status: '招聘状态',
  reason: '招聘理由',
  notes: '说明',
  description: '招聘JD',
  requirements: '岗位职责与任职要求',
  capability_requirements: '岗位能力提取',
  capability_dimensions: '岗位能力维度要求',
  city_tier: '城市等级',
  in_budget: '是否在编制内',
  responsible_person: '责任人',
  recruitment_account: '招聘账号',
  start_date: '开始招聘',
  end_date: '结束招聘',
  hr_interviewer: 'HR二面',
  biz_interviewer: '业务一面',
  final_interviewer: '终面',
};

// 人才库表 → 人才库/简历管理的字段映射
const FEISHU_TALENT_FIELDS: Record<string, string> = {
  candidate_name: '姓名',
  position_applied: '面试岗位',
  mapped_position: '招聘岗位匹配',
  gender: '性别',
  city: '城市',
  age: '年龄',
  education: '学历',
  ai_evaluation: 'AI简历评估',
  screening_result: 'AI简历初筛结果',
  advantage: '优势分析',
  risk: '风险点',
  hr_review: 'HR复核结果',
  interview_suggestion: '一面建议',
  interview_questions: '面试问题建议',
  notes: '备注-手动',
  reserve_type: '储备人才类型-手动',
  job_description: '岗位JD',
  capability_dimensions: '岗位能力维度要求',
  source_id: 'SourceID',
  biz_owner: '业务负责人',
  biz_review: '业务复核结果',
  biz_reviewer_2: '二面负责人',
  biz_reviewer_3: '三面负责人',
  hr_pass_date: 'HR初筛通过日期',
  attachment: '简历附件-批量导入',
  create_time: '创建时间',
};

function getBitableTableId(env: Env, type: 'requisition' | 'talent'): string {
  if (type === 'requisition') return env.FEISHU_REQUISITION_TABLE_ID || FEISHU_CONFIG.requisitionTableId;
  return env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;
}

function feishuFieldsToRecord(fields: Record<string, string>, data: any): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [engKey, cnKey] of Object.entries(fields)) {
    if (data[engKey] !== undefined && data[engKey] !== null) {
      result[cnKey] = data[engKey];
    }
  }
  return result;
}

function recordToFeishuFields(fields: Record<string, string>, record: any): Record<string, any> {
  const fb = record.fields || {};
  const result: Record<string, any> = {};
  for (const [engKey, cnKey] of Object.entries(fields)) {
    let val = fb[cnKey];
    if (val !== undefined && val !== null) {
      result[engKey] = val;
    }
  }
  // also include record_id
  result.feishu_record_id = record.record_id;
  return result;
}

function getFirstValue(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : null;
  if (typeof v === 'object' && v.name) return v.name;
  if (typeof v === 'object' && v.text) return v.text;
  return String(v);
}

function getFirstObj(v: any): any {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
  return v;
}

// 从飞书人才库记录转成前端可用的格式
function parseTalentRecord(record: any): any {
  const f = record.fields || {};
  const rawAiEval = f['AI简历评估'];
  const aiEvalStr = typeof rawAiEval === 'object' ? JSON.stringify(rawAiEval) : String(rawAiEval || '');
  const rawAdvantage = f['优势分析'];
  const advantageStr = typeof rawAdvantage === 'object' ? JSON.stringify(rawAdvantage) : String(rawAdvantage || '');
  const rawRisk = f['风险点'];
  const riskStr = typeof rawRisk === 'object' ? JSON.stringify(rawRisk) : String(rawRisk || '');

  return {
    id: record.record_id,
    candidate_name: getFirstValue(f['姓名']) || '',
    position_applied: getFirstValue(f['面试岗位']) || getFirstValue(f['招聘岗位']) || '',
    mapped_position: getFirstValue(f['招聘岗位匹配']) || '',
    gender: getFirstValue(f['性别']) || '',
    city: getFirstValue(f['城市']) || '',
    age: f['年龄'] || null,
    education: getFirstValue(f['学历']) || '',
    ai_evaluation: aiEvalStr,
    screening_result: getFirstValue(f['AI简历初筛结果']) || '',
    advantage: advantageStr,
    risk: riskStr,
    hr_review: getFirstValue(f['HR复核结果']) || '',
    interview_suggestion: getFirstValue(f['一面建议']) || '',
    interview_questions: getFirstValue(f['面试问题建议']) || '',
    notes: getFirstValue(f['备注-手动']) || '',
    reserve_type: getFirstValue(f['储备人才类型-手动']) || '',
    source_id: getFirstValue(f['SourceID']) || '',
    biz_owner: getFirstValue(f['业务负责人']) || '',
    biz_review: getFirstValue(f['业务复核结果']) || '',
    hr_pass_date: f['HR初筛通过日期'] || null,
    create_time: f['创建时间'] || null,
    status: mapHrReviewToStatus(getFirstValue(f['HR复核结果']) || ''),
    match_score: extractScoreFromEval(aiEvalStr),
    feishu_record_id: record.record_id,
    email: getFirstValue(f['SourceID']) || '',
    // 保留原始字段以便扩展
    _raw_fields: f,
    // 简历附件信息（原始 PDF）
    resume_file: extractResumeFile(f['简历附件-批量导入']),
  };
}

// 从 Bitable 附件字段提取简历文件信息
function extractResumeFile(fieldValue: any): { file_token?: string; name?: string; size?: number; download_url?: string } | null {
  if (!fieldValue) return null;
  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
    const first = fieldValue[0];
    return {
      file_token: first.file_token || '',
      name: first.name || '',
      size: first.size || 0,
      download_url: first.tmp_url || '',
    };
  }
  return null;
}

// 从招聘任务记录转成前端可用的格式
function parseRequisitionRecord(record: any): any {
  const f = record.fields || {};
  const headcount = f['招聘人数'] || 1;
  const urgency = mapUrgency(f['紧急度']);
  const status = mapStatus(f['招聘状态']);

  return {
    id: record.record_id,
    title: getFirstValue(f['招聘岗位']) || '(未命名岗位)',
    department: getFirstValue(f['二级部门']) || '',
    department_3rd: getFirstValue(f['三级部门']) || '',
    city: getFirstValue(f['招聘城市']) || '',
    headcount: typeof headcount === 'number' ? headcount : parseInt(String(headcount)) || 1,
    urgency,
    status,
    reason: getFirstValue(f['招聘理由']) || '',
    notes: getFirstValue(f['说明']) || '',
    description: getFirstValue(f['招聘JD']) || '',
    requirements: getFirstValue(f['岗位职责与任职要求']) || '',
    capability_requirements: getFirstValue(f['岗位能力提取']) || '',
    capability_dimensions: getFirstValue(f['岗位能力维度要求']) || '',
    city_tier: getFirstValue(f['城市等级']) || '',
    in_budget: getFirstValue(f['是否在编制内']) || '',
    responsible_person: getFirstValue(f['责任人']) || getFirstValue(f['招聘账号']) || '',
    recruitment_account: getFirstValue(f['招聘账号']) || '',
    hr_interviewer: getUserName(f['HR二面']),
    biz_interviewer: getUserName(f['业务一面']),
    final_interviewer: getUserName(f['终面']),
    start_date: f['开始招聘'] || null,
    end_date: f['结束招聘'] || null,
    employment_type: 'full_time',
    salary_range: '',
    feishu_record_id: record.record_id,
  };
}

function extractScoreFromEval(evalStr: string): number | null {
  if (!evalStr) return null;
  const match = evalStr.match(/匹配[度分][：:]\s*(\d+)/);
  if (match) return parseInt(match[1]);
  const match2 = evalStr.match(/(\d+)\s*分/);
  if (match2) return parseInt(match2[1]);
  return null;
}

function mapHrReviewToStatus(review: string): string {
  const map: Record<string, string> = {
    '通过': 'approved',
    '未通过': 'rejected',
    '可进入面试': 'pending_interview',
    '待定': 'pending_review',
    '储备': 'waitlist',
  };
  return map[review] || 'pending_screening';
}

// 从 Bitable 用户字段提取 Feishu 用户信息（open_id, name）
// Bitable 用户字段格式: { users: [{ id: "ou_xxx", name: "张三", ... }] }
function extractFeishuUsers(fieldValue: any): Array<{ open_id: string; name: string; email?: string }> {
  if (!fieldValue) return [];
  // 可能是 { users: [...] } 格式
  if (fieldValue.users && Array.isArray(fieldValue.users)) {
    return fieldValue.users.map((u: any) => ({
      open_id: u.id || '',
      name: u.name || '',
      email: u.email || '',
    })).filter(u => u.open_id);
  }
  // 也可能是数组格式 [{ id: "ou_xxx", ... }]
  if (Array.isArray(fieldValue)) {
    return fieldValue.map((u: any) => ({
      open_id: u.id || '',
      name: u.name || '',
      email: u.email || '',
    })).filter(u => u.open_id);
  }
  return [];
}

function mapUrgency(v: any): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v) return v.text || v.name || String(v);
  return '普通';
}

function mapStatus(v: any): string {
  const s = typeof v === 'object' && v ? (v.text || v.name || '') : String(v || '');
  const map: Record<string, string> = {
    '招聘中': 'open',
    '暂停': 'paused',
    '已完成': 'closed',
    '已关闭': 'closed',
    '已终止': 'cancelled',
  };
  return map[s] || s;
}

function getUserName(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const first = v[0];
    if (!first) return '';
    if (first.name) return first.name;
    if (first.text) return first.text;
    return String(first);
  }
  if (v.name) return v.name;
  if (v.text) return v.text;
  return String(v);
}

async function bitableListRecords(env: Env, tableId: string, pageSize = 500): Promise<any[]> {
  // 缓存命中
  const cached = bitableCache.get(tableId);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const allRecords: any[] = [];
  let pageToken: string | null = null;

  do {
    let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await resp.json();
    if (!data.data) throw new Error(`Failed to get records: ${JSON.stringify(data)}`);
    allRecords.push(...(data.data.items || []));
    pageToken = data.data.page_token || null;
    if (!data.data.has_more) break;
  } while (pageToken);

  // 写入缓存
  bitableCache.set(tableId, { data: allRecords, expiry: Date.now() + BITABLE_CACHE_TTL });

  return allRecords;
}

async function bitableGetRecord(env: Env, tableId: string, recordId: string): Promise<any | null> {
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data: any = await resp.json();
  return data.data?.record || null;
}

async function bitableCreateRecord(env: Env, tableId: string, fields: Record<string, any>): Promise<string | null> {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    }
  );
  const data: any = await resp.json();
  return data.data?.record?.record_id || null;
}

async function bitableUpdateRecord(env: Env, tableId: string, recordId: string, fields: Record<string, any>): Promise<boolean> {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    }
  );
  const data: any = await resp.json();
  return !!data.data?.record;
}

async function bitableDeleteRecord(env: Env, tableId: string, recordId: string): Promise<boolean> {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data: any = await resp.json();
  return data.code === 0;
}

// ==================== Special GET routes (before CRUD to avoid :id matching) ====================

app.get('/api/resumes/my-reviews', authMiddleware, async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare('SELECT * FROM department_reviews WHERE reviewer_id = ? AND is_completed = 0').bind(user.id).all();
  return c.json(result.results.map(transformRow));
});

// 面试列表 — 覆盖 CRUD 默认查询，左连接获取候选人姓名和岗位名称
app.get('/api/interviews', authMiddleware, async (c) => {
  const user = c.get('user');
  let sql = `SELECT 
    i.*,
    r.candidate_name AS _candidate_name,
    p.title AS _position_title
  FROM interviews i
  LEFT JOIN resumes r ON i.resume_id = r.id
  LEFT JOIN positions p ON i.position_id = p.id`;
  const binds: any[] = [];
  const conditions: string[] = [];

  // 面试官只能看自己的面试
  if (user?.role === 'interviewer') {
    conditions.push('i.interviewer_id = ?');
    binds.push(user.id);
  }

  const status = c.req.query('status');
  if (status) {
    conditions.push('i.status = ?');
    binds.push(status);
  }

  const name = c.req.query('name');
  if (name) {
    conditions.push('i.interviewer LIKE ?');
    binds.push(`%${name}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY i.created_at DESC';

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  // 把 _candidate_name 和 _position_title 嵌入到嵌套对象，保持前端现有列定义兼容
  return c.json(results.map((row: any) => ({
    ...transformRow(row),
    resume: { candidate_name: row._candidate_name || row.interviewer || '未知' },
    position: { title: row._position_title || row.position_id || '未知岗位' }
  })));
});

// ==================== CRUD Registration ====================

registerCrud('positions', 'positions', { title: 'like', status: 'eq', department: 'like' });
// interviews → 保留 D1（面试记录暂不迁移）
registerCrud('interviews', 'interviews', { position_id: 'eq', status: 'eq' });
registerCrud('background-checks', 'background_checks', { status: 'eq' });
registerCrud('onboarding', 'onboarding_records', { status: 'eq' });
registerCrud('probation', 'probation_records', { status: 'eq', result: 'eq' });
registerCrud('workflows', 'workflows', { status: 'eq' });
registerCrud('workflow-nodes', 'workflow_nodes', { workflow_id: 'eq' });
registerCrud('workflow-edges', 'workflow_edges', { workflow_id: 'eq' });
registerCrud('workflow-executions', 'workflow_executions', { workflow_id: 'eq', status: 'eq' });

// ==================== 飞书多维表格 CRUD（替代 D1 CRUD） ====================

// ---- 需求管理：直读飞书招聘任务表 ----
app.get('/api/requisitions', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'requisition');
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseRequisitionRecord);

    // 支持 status / department 筛选
    const statusFilter = c.req.query('status');
    const deptFilter = c.req.query('department');
    let filtered = items;
    if (statusFilter) filtered = filtered.filter(i => i.status === statusFilter);
    if (deptFilter) filtered = filtered.filter(i => i.department?.includes(deptFilter));

    return c.json(filtered);
  } catch (e: any) {
    console.error(`[Bitable] 需求列表失败: ${e.message}`);
    return c.json({ detail: '读取飞书数据失败: ' + e.message }, 500);
  }
});

app.get('/api/requisitions/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'requisition');
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    if (!record) return c.json({ detail: 'Not found' }, 404);
    return c.json(parseRequisitionRecord(record));
  } catch (e: any) {
    return c.json({ detail: e.message }, 500);
  }
});

app.post('/api/requisitions', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, 'requisition');
    const fields = feishuFieldsToRecord(FEISHU_REQUISITION_FIELDS, body);
    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) return c.json({ detail: 'Create failed' }, 500);
    const record = await bitableGetRecord(c.env, tableId, recordId);
    return c.json(parseRequisitionRecord(record));
  } catch (e: any) {
    return c.json({ detail: '创建需求失败: ' + e.message }, 500);
  }
});

app.put('/api/requisitions/:id', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, 'requisition');
    const fields = feishuFieldsToRecord(FEISHU_REQUISITION_FIELDS, body);
    await bitableUpdateRecord(c.env, tableId, c.req.param('id'), fields);
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    return c.json(parseRequisitionRecord(record));
  } catch (e: any) {
    return c.json({ detail: '更新失败: ' + e.message }, 500);
  }
});

app.delete('/api/requisitions/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'requisition');
    await bitableDeleteRecord(c.env, tableId, c.req.param('id'));
    return c.json({ detail: 'Deleted' });
  } catch (e: any) {
    return c.json({ detail: '删除失败: ' + e.message }, 500);
  }
});

// ---- 人才库：直读飞书人才库表 ----
app.get('/api/talent-pool', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseTalentRecord);

    const statusFilter = c.req.query('status');
    const nameFilter = c.req.query('candidate_name');
    let filtered = items;
    if (statusFilter) {
      filtered = filtered.filter(i => i.status === statusFilter);
    } else {
      // 默认不显示待初筛和已淘汰的，人才库只展示已入库的
      filtered = filtered.filter(i => i.status !== 'pending_screening' && i.status !== 'rejected');
    }
    if (nameFilter) filtered = filtered.filter(i => i.candidate_name?.includes(nameFilter));

    return c.json(filtered);
  } catch (e: any) {
    console.error(`[Bitable] 人才库列表失败: ${e.message}`);
    return c.json({ detail: '读取飞书数据失败: ' + e.message }, 500);
  }
});

app.get('/api/talent-pool/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    if (!record) return c.json({ detail: 'Not found' }, 404);
    return c.json(parseTalentRecord(record));
  } catch (e: any) {
    return c.json({ detail: e.message }, 500);
  }
});

app.post('/api/talent-pool', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, 'talent');
    const fields = feishuFieldsToRecord(FEISHU_TALENT_FIELDS, body);
    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) return c.json({ detail: 'Create failed' }, 500);
    const record = await bitableGetRecord(c.env, tableId, recordId);
    return c.json(parseTalentRecord(record));
  } catch (e: any) {
    return c.json({ detail: '创建失败: ' + e.message }, 500);
  }
});

app.put('/api/talent-pool/:id', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, 'talent');
    const fields = feishuFieldsToRecord(FEISHU_TALENT_FIELDS, body);
    await bitableUpdateRecord(c.env, tableId, c.req.param('id'), fields);
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    return c.json(parseTalentRecord(record));
  } catch (e: any) {
    return c.json({ detail: '更新失败: ' + e.message }, 500);
  }
});

app.delete('/api/talent-pool/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    await bitableDeleteRecord(c.env, tableId, c.req.param('id'));
    return c.json({ detail: 'Deleted' });
  } catch (e: any) {
    return c.json({ detail: '删除失败: ' + e.message }, 500);
  }
});

app.post('/api/talent-pool/:id/notify-interview', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const name = body?.name || '候选人';
    const position = body?.position || '';

    // 查飞书招聘任务表，找到匹配岗位的面试官
    const requisitionTableId = getBitableTableId(c.env, 'requisition');
    const reqs = await bitableListRecords(c.env, requisitionTableId);
    const matched = reqs.find(r => {
      const f = r.fields || {};
      const posName = f['招聘岗位'] ? (Array.isArray(f['招聘岗位']) ? String(f['招聘岗位'][0] || '') : String(f['招聘岗位'])) : '';
      return position && posName.includes(position);
    });

    const interviewers: string[] = [];
    if (matched) {
      const f = matched.fields || {};
      const hrNames = getUserName(f['HR二面']);
      const bizNames = getUserName(f['业务一面']);
      if (hrNames) interviewers.push(hrNames);
      if (bizNames) interviewers.push(bizNames);
    }

    // 发飞书群消息
    const token = await getFeishuToken(c.env);
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId) {
      const msg = {
        msg_type: 'interactive',
        content: JSON.stringify({
          config: { wide_screen_mode: true },
          header: { title: { tag: 'plain_text', content: `🎯 面试安排提醒` }, template: 'blue' },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: `**候选人：** ${name}\n**面试岗位：** ${position || '未指定'}` } },
            { tag: 'hr' },
            { tag: 'div', text: { tag: 'lark_md', content: `请相关面试官尽快安排面试。` } },
            { tag: 'note', elements: [{ tag: 'plain_text', content: `来自 AI 智能面试系统` }] }
          ]
        })
      };
      await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receive_id: chatId, ...msg }),
      });
    }

    return c.json({ ok: true, detail: `已通知面试官安排 ${name} 的面试` });
  } catch (e: any) {
    return c.json({ detail: '通知失败: ' + e.message }, 500);
  }
});

// ---- 面试管理：评价（替换旧评分/AI流程） ----

// 面试官提交评价与结果（支持一面/二面）
app.post('/api/interviews/:id/evaluate', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { evaluation, result, round } = body;  // result: 'passed' | 'failed', round: 1 | 2
    if (!evaluation && !result) {
      return c.json({ detail: '请填写评价或选择结果' }, 400);
    }
    const r = round === 2 ? 2 : 1;

    if (r === 1) {
      const updates: string[] = ['status = ?'];
      const binds: any[] = ['completed'];
      if (evaluation) { updates.push('evaluation = ?'); binds.push(evaluation); }
      if (result) { updates.push('result = ?'); binds.push(result); }
      binds.push(id);
      await c.env.DB.prepare(
        `UPDATE interviews SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...binds).run();
    } else {
      const updates: string[] = ['status2 = ?'];
      const binds: any[] = ['completed'];
      if (evaluation) { updates.push('evaluation2 = ?'); binds.push(evaluation); }
      if (result) { updates.push('result2 = ?'); binds.push(result); }
      binds.push(id);
      await c.env.DB.prepare(
        `UPDATE interviews SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...binds).run();
    }

    return c.json({ ok: true, detail: `第${r}面评价已提交` });
  } catch (e: any) {
    return c.json({ detail: '提交失败: ' + e.message }, 500);
  }
});

// 从人才库创建面试（人才库"面试"按钮调用）
app.post('/api/interviews/create-from-talent', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { candidate_name, position_applied, city, feishu_record_id } = body;
    const currentUser = c.get('user');

    if (!candidate_name) {
      return c.json({ detail: '缺少候选人信息' }, 400);
    }

    // 从招聘任务表查找匹配的「招聘中」任务
    // 匹配逻辑：按"二级部门+三级部门+招聘岗位+城市"找到对应任务
    //          → 只取状态="招聘中"的任务
    //          → 取"业务一面"字段的面试官
    const requisitionTableId = getBitableTableId(c.env, 'requisition');
    let interviewerOpenIds: string[] = [];
    let interviewerNames: string[] = [];
    let matchedReqRecordId: string | null = null;
    let matchedReqTitle: string = '';

    const reqs = await bitableListRecords(c.env, requisitionTableId);
    // 1. 精确匹配：状态=招聘中 + 招聘岗位 + 城市
    const matchedReq = reqs.find((r: any) => {
      const f = r.fields || {};
      const status = getFirstValue(f['招聘状态']) || '';
      if (status !== '招聘中') return false;
      const posName = getFirstValue(f['招聘岗位']) || '';
      const reqCity = getFirstValue(f['招聘城市']) || '';
      return posName === position_applied && (!city || !reqCity || reqCity === city);
    }) || reqs.find((r: any) => {
      // 2. 降级匹配：状态=招聘中 + 岗位包含关系 + 城市
      const f = r.fields || {};
      const status = getFirstValue(f['招聘状态']) || '';
      if (status !== '招聘中') return false;
      const posName = getFirstValue(f['招聘岗位']) || '';
      const reqCity = getFirstValue(f['招聘城市']) || '';
      return posName && position_applied && position_applied.includes(posName) && (!city || !reqCity || reqCity === city);
    });

    if (matchedReq) {
      const mf = matchedReq.fields || {};
      matchedReqRecordId = matchedReq.record_id;
      matchedReqTitle = getFirstValue(mf['招聘岗位']) || '';
      // 业务一面是用户类型字段，尝试提取 open_id 和 name
      const rawBiz = mf['业务一面'];
      const bizUsers = extractFeishuUsers(rawBiz);
      for (const u of bizUsers) {
        if (u.open_id && !interviewerOpenIds.includes(u.open_id)) {
          interviewerOpenIds.push(u.open_id);
          interviewerNames.push(u.name || '面试官');
        }
      }
      // 如果 extractFeishuUsers 没提取到（可能是纯文本格式），用 getUserName 兜底
      if (bizUsers.length === 0) {
        const bizName = getUserName(rawBiz);
        if (bizName) interviewerNames.push(bizName);
        const openId = await getInterviewerOpenId(c.env, bizName);
        if (openId && !interviewerOpenIds.includes(openId)) {
          interviewerOpenIds.push(openId);
        }
      }
    }

    // 查找该任务下"业务复核=通过 + 一面建议为空"的候选人
    let pendingCandidates: string[] = [];
    if (matchedReqRecordId) {
      try {
        // 从人才库找当前候选人所在的同一任务的所有候选人
        // 按"二级部门+三级部门+招聘岗位+城市"匹配
        const talentTableId = getBitableTableId(c.env, 'talent');
        const allTalent = await bitableListRecords(c.env, talentTableId);
        const mf = matchedReq.fields || {};
        const matchDept2 = getFirstValue(mf['二级部门']) || '';
        const matchDept3 = getFirstValue(mf['三级部门']) || '';
        const matchPos = getFirstValue(mf['招聘岗位']) || '';
        const matchCity = getFirstValue(mf['招聘城市']) || '';

        for (const t of allTalent) {
          const tf = t.fields || {};
          const tName = getFirstValue(tf['姓名']) || '';
          if (!tName) continue;
          // 跳过当前候选人自己
          if (tName === candidate_name) continue;
          // 业务复核=通过
          const bizReview = getFirstValue(tf['业务复核结果']) || '';
          if (bizReview !== '通过') continue;
          // 一面建议为空
          const interviewAdvice = getFirstValue(tf['一面建议']) || '';
          if (interviewAdvice && interviewAdvice.trim() !== '') continue;

          // 岗位匹配
          const tPos = getFirstValue(tf['面试岗位']) || getFirstValue(tf['招聘岗位']) || '';
          if (tPos && matchPos && tPos !== matchPos) continue;
          const tCity = getFirstValue(tf['城市']) || '';
          if (tCity && matchCity && tCity !== matchCity) continue;

          pendingCandidates.push(tName);
        }
      } catch (e: any) {
        console.error(`查找待面试候选人失败: ${e.message}`);
      }
    }

    // 创建面试记录
    const interviewId = crypto.randomUUID();
    const interviewerStr = interviewerNames.length > 0 ? interviewerNames.join(', ') : '待分配';
    await c.env.DB.prepare(
      `INSERT INTO interviews (id, resume_id, interviewer, position_id, status, created_at, comments)
       VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), ?)`
    ).bind(interviewId, feishu_record_id || '', candidate_name, position_applied || '', interviewerStr).run();

    // == 给面试官发飞书私信 ==
    const notificationResults: string[] = [];
    if (interviewerOpenIds.length > 0) {
      try {
        const token = await getFeishuToken(c.env);
        const operatorName = currentUser?.name || currentUser?.email || '系统管理员';
        for (const openId of interviewerOpenIds) {
          // 构建卡片内容
          const cardElements: any[] = [
            { tag: 'div', text: { tag: 'lark_md', content: `**候选人：** ${candidate_name}\n**面试岗位：** ${matchedReqTitle || position_applied || '未指定'}` } },
            { tag: 'hr' },
          ];

          // 列出该任务下待面试的其他候选人
          if (pendingCandidates.length > 0) {
            cardElements.push({
              tag: 'div',
              text: { tag: 'lark_md', content: `**同岗位待面试候选人：**\n${pendingCandidates.map((n, i) => `${i + 1}. ${n}`).join('\n')}` }
            });
            cardElements.push({ tag: 'hr' });
          }

          cardElements.push(
            { tag: 'div', text: { tag: 'lark_md', content: `${operatorName} 为你安排了面试，请及时查看候选人简历，面试结束后在系统内填写评价。` } },
            { tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '🔍 查看候选人' }, type: 'primary', url: `https://ai-interview-22u.pages.dev/talent-pool` }] },
            { tag: 'note', elements: [{ tag: 'plain_text', content: `${operatorName} | AI 智能面试系统` }] }
          );

          const cardContent = {
            config: { wide_screen_mode: true },
            header: { title: { tag: 'plain_text', content: `🎯 面试安排通知` }, template: 'blue' },
            elements: cardElements,
          };

          const resp = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              receive_id: openId,
              msg_type: 'interactive',
              content: JSON.stringify(cardContent),
            }),
          });
          const result: any = await resp.json();
          if (result.code === 0) {
            notificationResults.push(`✅ ${openId} 发送成功`);
          } else {
            notificationResults.push(`❌ ${openId} 发送失败: ${result.code} ${JSON.stringify(result.msg || result)}`);
          }
        }
      } catch (e: any) {
        notificationResults.push(`❌ 通知异常: ${e.message}`);
      }
    } else {
      notificationResults.push('⚠️ 未找到匹配面试官，未发送通知');
    }

    // 返回创建的面试记录
    const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(interviewId).first();
    return c.json({
      ...row,
      resume: { candidate_name: candidate_name },
      position: { title: position_applied || '未知岗位' },
      interviewer_list: interviewerNames,
      _notification: notificationResults,
    });
  } catch (e: any) {
    return c.json({ detail: '创建面试失败: ' + e.message }, 500);
  }
});

// ---- 简历上传：上传 PDF → D1 存储 → 存 Bitable ----
app.post('/api/resumes', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const positionId = formData.get('position_id') as string;

    if (!file || !file.name) {
      return c.json({ detail: '请上传简历文件' }, 400);
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return c.json({ detail: '仅支持 PDF 格式' }, 400);
    }

    const fileBuffer = await file.arrayBuffer();
    const fileSize = file.size;
    const fileBase64 = bufToB64(fileBuffer);
    const fileId = 'file_' + crypto.randomUUID();

    // 1. 创建 Bitable 记录 - 使用正确的字段名
    const tableId = getBitableTableId(c.env, 'talent');
    const fields: Record<string, any> = {};

    // 用文件名作为临时姓名
    const fileNameWithoutExt = file.name.replace(/\.pdf$/i, '');
    fields['姓名'] = fileNameWithoutExt;

    // 如果有 position_id，尝试匹配岗位
    if (positionId) {
      try {
        const origin = new URL(c.req.url).origin;
        const posResp = await fetch(
          `${origin}/api/positions/${positionId}`,
          { headers: { Authorization: c.req.header('Authorization') || '' } }
        );
        if (posResp.ok) {
          const posData: any = await posResp.json();
          if (posData?.title) {
            fields['面试岗位'] = posData.title;
          }
        }
      } catch {}
    }

    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) {
      return c.json({ detail: '创建飞书记录失败' }, 500);
    }

    // 2. 在 D1 保存文件内容（base64）
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(recordId, fileId, file.name, fileSize, fileBase64).run();
    } catch (e: any) {
      return c.json({ detail: '保存文件失败: ' + e.message }, 500);
    }

    // 3. AI 解析简历
    let parsedName = fileNameWithoutExt;
    let parsedGender = '';
    let parsedAge: number | null = null;
    let parsedEducation = '';
    let parsedCity = '';
    let parsedAdvantage = '';
    let parsedRisk = '';
    let parsedEval = '';
    try {
      // 将 base64 PDF 发送给 AI 解析
      const systemPrompt = `你是一个专业的简历解析助手。请从PDF简历内容中提取以下信息，并用JSON格式返回（不要加markdown代码块）：
{
  "name": "候选人姓名",
  "gender": "性别",
  "age": 年龄数字或null,
  "education": "最高学历",
  "city": "所在城市",
  "advantage": "候选人核心优势分析（200字以内）",
  "risk": "候选人潜在风险点（200字以内）",
  "evaluation": "综合评估（100字以内）"
}`;
      // 用 base64 数据作为 PDF 内容发送给 AI
      const aiResp = await callAI(c.env, systemPrompt, `请解析以下PDF简历内容（base64编码）：\n\n${fileBase64.substring(0, 32000)}${fileBase64.length > 32000 ? '\n\n[内容截断，仅显示前32000字符]' : ''}`, 'deepseek-chat');
      if (aiResp) {
        const parsed = JSON.parse(extractJSON(aiResp) || '{}');
        parsedName = parsed.name || fileNameWithoutExt;
        parsedGender = parsed.gender || '';
        parsedAge = parsed.age || null;
        parsedEducation = parsed.education || '';
        parsedCity = parsed.city || '';
        parsedAdvantage = parsed.advantage || '';
        parsedRisk = parsed.risk || '';
        parsedEval = parsed.evaluation || '';
      }
    } catch (aiErr: any) {
      console.error(`[Upload] AI parsing failed: ${aiErr.message}`);
    }

    // 4. 更新 Bitable 记录（AI 解析结果）
    try {
      const updateFields: Record<string, any> = {};
      if (parsedName && parsedName !== fileNameWithoutExt) updateFields['姓名'] = parsedName;
      if (parsedGender) updateFields['性别'] = parsedGender;
      if (parsedAge) updateFields['年龄'] = parsedAge;
      if (parsedEducation) updateFields['学历'] = parsedEducation;
      if (parsedCity) updateFields['城市'] = parsedCity;
      if (parsedAdvantage) updateFields['优势分析'] = parsedAdvantage;
      if (parsedRisk) updateFields['风险点'] = parsedRisk;
      if (parsedEval) updateFields['AI简历评估'] = parsedEval;
      await bitableUpdateRecord(c.env, tableId, recordId, updateFields);
    } catch (updateErr: any) {
      console.error(`[Upload] Failed to update bitable with AI data: ${updateErr.message}`);
    }

    // 5. 获取最终记录并返回
    const record = await bitableGetRecord(c.env, tableId, recordId);
    if (!record) {
      return c.json({ detail: '记录已创建但获取详情失败' }, 500);
    }
    return c.json(parseTalentRecord(record));

  } catch (e: any) {
    return c.json({ detail: '上传简历失败: ' + e.message }, 500);
  }
});

app.get('/api/resumes', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseTalentRecord);

    const nameFilter = c.req.query('candidate_name');
    const statusFilter = c.req.query('status');
    let filtered = items;
    if (nameFilter) filtered = filtered.filter(i => i.candidate_name?.includes(nameFilter));
    if (statusFilter) filtered = filtered.filter(i => i.status === statusFilter);

    return c.json(filtered);
  } catch (e: any) {
    console.error(`[Bitable] 简历列表失败: ${e.message}`);
    return c.json({ detail: '读取飞书数据失败: ' + e.message }, 500);
  }
});

app.get('/api/resumes/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    if (!record) return c.json({ detail: 'Not found' }, 404);
    return c.json(parseTalentRecord(record));
  } catch (e: any) {
    return c.json({ detail: e.message }, 500);
  }
});

// 下载简历附件（原始 PDF）- 302 重定向到飞书附件直链
// 支持 Authorization header 或 ?token= 查询参数
app.get('/api/resumes/:id/file', async (c) => {
  try {
    // 鉴权：检查 header 或 query param
    const auth = c.req.header('Authorization') || '';
    const queryToken = c.req.query('token') || '';
    let token = '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1];
    } else if (queryToken) {
      token = queryToken;
    }
    if (!token) return c.json({ detail: 'Not authenticated' }, 401);
    const payload = await verifyJwt(c.env.SECRET_KEY, token);
    if (!payload) return c.json({ detail: 'Invalid token' }, 401);

    const tableId = getBitableTableId(c.env, 'talent');
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    if (!record) return c.json({ detail: 'Not found' }, 404);
    const f = record.fields || {};
    
    const recordId = c.req.param('id');
    const isDownload = c.req.query('download') === 'true';
    
    // 提取候选人姓名和文件名
    let candidateName = f['姓名'] || 'resume';
    let attachmentFileName = candidateName + '.pdf';

    // 第一优先级：从 D1 直接读取简历文件 base64 内容（新上传或已缓存的简历）
    if (recordId) {
      try {
        const fileRow: any = await c.env.DB.prepare('SELECT content, file_name FROM resume_files WHERE id = ?').bind(recordId).first();
        if (fileRow && fileRow.content) {
          const pdfBytes = b64ToBuf(fileRow.content);
          const disposition = isDownload ? 'attachment' : 'inline';
          return new Response(pdfBytes, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `${disposition}; filename="${fileRow.file_name || attachmentFileName}"`,
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch {}
    }

    // 第二优先级：扫描 Bitable 所有字段中可能的附件数据
    let fileToken = '';
    let feishuDownloadUrl = '';

    // 遍历所有字段找 attachment 数据（file_token）
    for (const [fieldName, fieldValue] of Object.entries(f)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        // Bitable 附件字段格式: [{ file_token: "...", name: "...", size: ..., type: "pdf", tmp_url: "..." }]
        const item = fieldValue[0];
        if (item && typeof item === 'object' && item.file_token) {
          fileToken = item.file_token;
          // 也用 tmp_url 作为备选下载地址
          if (item.tmp_url) feishuDownloadUrl = item.tmp_url;
          break;
        }
        // 也可能是 link 格式: [{ text: "...", link: "..." }]
        if (item && typeof item === 'object' && item.link && item.link.includes('/download/all/')) {
          const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
          if (linkMatch) {
            fileToken = linkMatch[1];
            feishuDownloadUrl = item.link;
            break;
          }
        }
      }
    }

    // 如果通过通用扫描找到了 file_token，拼出飞书下载 URL
    if (fileToken && !feishuDownloadUrl) {
      const feishuHost = c.env.FEISHU_HOST || 'ywwlaii6ga7';
      const mountToken = c.env.FEISHU_BASE_TOKEN || 'NVh9bDiNRaF0ZysxjeLc5ID2n9c';
      feishuDownloadUrl = `https://${feishuHost}.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${mountToken}&mount_point=bitable`;
    }

    // 通过 downloadFeishuAttachment 多方法下载 PDF
    if (fileToken) {
      const dlResp = await downloadFeishuAttachment(c.env, fileToken, feishuDownloadUrl);
      if (dlResp) {
        const disposition = isDownload ? 'attachment' : 'inline';
        return new Response(dlResp.body, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="${attachmentFileName}"`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      console.log(`[ResumeFile] downloadFeishuAttachment returned null for ${recordId}`);
    }

    // 最终兜底：返回引导页面（含飞书链接让用户手动打开）
    const fallbackLink = feishuDownloadUrl || (fileToken ? `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_point=bitable` : '#');
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 40px;text-align:center;max-width:400px}
  .icon{font-size:48px;margin-bottom:16px}
  h2{font-size:18px;color:#0f172a;margin-bottom:8px}
  p{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.6}
  a{display:inline-block;padding:10px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;transition:background .2s}
  a:hover{background:#4f46e5}
</style></head>
<body>
<div class="card">
  <div class="icon">📄</div>
  <h2>无法在线预览 [V2]</h2>
  <p>该简历文件托管在飞书平台，需要登录飞书账号后才能查看。</p>
  <a href="${fallbackLink}" target="_blank">在飞书中打开</a>
</div>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return c.json({ detail: '下载简历文件失败: ' + e.message }, 500);
  }
});

// 批量缓存：遍历所有人才库记录，把附件下载到 D1 缓存，便于后续直接预览
app.post('/api/resumes/cache-files', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const records = await bitableListRecords(c.env, tableId);
    let cached = 0;
    let skipped = 0;
    let failed = 0;

    for (const record of records) {
      const rid = record.record_id;
      const f = record.fields || {};

      // 先检查是否已在缓存中
      const existing: any = await c.env.DB.prepare('SELECT id FROM resume_files WHERE id = ?').bind(rid).first().catch(() => null);
      if (existing) { skipped++; continue; }

      // 扫描附件字段
      let fileToken = '';
      let tmpUrl = '';
      for (const [fieldName, fieldValue] of Object.entries(f)) {
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          const item = fieldValue[0];
          if (item && typeof item === 'object') {
            if (item.file_token) {
              fileToken = item.file_token;
              tmpUrl = item.tmp_url || '';
              break;
            }
            if (item.link && item.link.includes('/download/all/')) {
              const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
              if (linkMatch) { fileToken = linkMatch[1]; tmpUrl = item.link; break; }
            }
          }
        }
      }

      if (!fileToken) { failed++; continue; }

      // 尝试下载
      const downloadUrl = tmpUrl || `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${FEISHU_CONFIG.appToken}&mount_point=bitable`;
      const resp = await downloadFeishuAttachment(c.env, fileToken, downloadUrl);
      if (resp) {
        const blob = await resp.clone().arrayBuffer();
        const b64 = bufToB64(blob);
        const candidateName = f['姓名'] || 'resume';
        await c.env.DB.prepare(
          'INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(rid, 'cache_' + fileToken, candidateName + '.pdf', blob.byteLength, b64, new Date().toISOString()).run();
        cached++;
      } else {
        failed++;
      }
    }

    return c.json({ total: records.length, cached, skipped, failed });
  } catch (e: any) {
    return c.json({ detail: '批量缓存失败: ' + e.message }, 500);
  }
});

// 批量清除除指定记录外的人才库数据（用于测试）
// 前端直连飞书 CDN 下载后，上传到 Worker 缓存到 D1
app.post('/api/resumes/:id/cache-file', async (c) => {
  try {
    // 鉴权：支持 JWT token 或 secret 参数（用于脚本批量上传）
    const auth = c.req.header('Authorization') || '';
    const queryToken = c.req.query('token') || '';
    const adminSecret = c.req.query('secret') || '';
    let authorized = false;

    // 方法 1：JWT token
    if (auth || queryToken) {
      const token = auth.match(/^Bearer\s+(.+)$/i)?.[1] || queryToken;
      if (token) {
        const payload = await verifyJwt(c.env.SECRET_KEY, token);
        if (payload) authorized = true;
      }
    }
    // 方法 2：admin secret（与 SECRET_KEY 相同）
    if (!authorized && adminSecret && adminSecret === c.env.SECRET_KEY) {
      authorized = true;
    }
    if (!authorized) return c.json({ detail: 'Not authenticated' }, 401);

    const id = c.req.param('id');
    let ab: ArrayBuffer;
    let candidateName: string;

    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('json')) {
      // JSON 模式：接收 base64 编码的文件内容
      const body = await c.req.json();
      if (!body.file_b64) return c.json({ detail: '请提供 file_b64' }, 400);
      const bin = b64ToBuf(body.file_b64);
      ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
      candidateName = body.name || 'resume';
    } else {
      // FormData 模式：接收 multipart 上传
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return c.json({ detail: '请上传 PDF 文件' }, 400);
      ab = await file.arrayBuffer();
      candidateName = formData.get('name')?.toString() || file.name.replace(/\.pdf$/i, '');
    }

    // 检查内容是否为有效 PDF（以 %PDF 开头）
    const header = new Uint8Array(ab.slice(0, 5));
    const pdfHeader = new TextDecoder().decode(header);
    if (pdfHeader !== '%PDF-') {
      return c.json({ detail: '不是有效的 PDF 文件' }, 400);
    }
    const b64 = bufToB64(ab);
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, 'browser_cache_' + id, candidateName + '.pdf', ab.byteLength, b64, new Date().toISOString()).run();
    return c.json({ success: true, file_size: ab.byteLength });
  } catch (e) {
    return c.json({ detail: '缓存失败: ' + ((e as any).message || e) }, 500);
  }
});

// 获取飞书附件直链（供前端浏览器直接下载）
app.get('/api/resumes/:id/file-info', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const record = await bitableGetRecord(c.env, tableId, c.req.param('id'));
    if (!record) return c.json({ detail: 'Not found' }, 404);
    const f = record.fields || {};

    let fileToken = '';
    let feishuUrl = '';
    let candidateName = f['姓名'] || 'resume';

    for (const [fieldName, fieldValue] of Object.entries(f)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        const item = fieldValue[0];
        if (item && typeof item === 'object') {
          if (item.file_token) {
            fileToken = item.file_token;
            if (item.tmp_url) feishuUrl = item.tmp_url;
            break;
          }
          if (item.link && item.link.includes('/download/all/')) {
            const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
            if (linkMatch) { fileToken = linkMatch[1]; feishuUrl = item.link; break; }
          }
        }
      }
    }

    if (!fileToken) return c.json({ detail: '未找到附件' }, 404);

    if (!feishuUrl) {
      const feishuHost = c.env.FEISHU_HOST || 'ywwlaii6ga7';
      const mountToken = c.env.FEISHU_BASE_TOKEN || 'NVh9bDiNRaF0ZysxjeLc5ID2n9c';
      feishuUrl = `https://${feishuHost}.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${mountToken}&mount_point=bitable`;
    }

    return c.json({ fileToken, feishuUrl, candidateName });
  } catch (e: any) {
    return c.json({ detail: e.message }, 500);
  }
});

app.post('/api/resumes/clear-all-except', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const keepIds: string[] = body.keep_ids || [];
    const tableId = getBitableTableId(c.env, 'talent');
    const records = await bitableListRecords(c.env, tableId);
    const toDelete = records.filter((r: any) => !keepIds.includes(r.record_id));
    let deleted = 0;
    for (const r of toDelete) {
      await bitableDeleteRecord(c.env, tableId, r.record_id);
      deleted++;
    }
    return c.json({ deleted, total_before: records.length, kept: keepIds.length });
  } catch (e: any) {
    return c.json({ detail: '清除失败: ' + e.message }, 500);
  }
});

app.delete('/api/resumes/:id', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    await bitableDeleteRecord(c.env, tableId, c.req.param('id'));
    return c.json({ detail: 'Deleted' });
  } catch (e: any) {
    return c.json({ detail: '删除失败: ' + e.message }, 500);
  }
});

// 批量清除已淘汰（HR复核结果='未通过'）
app.post('/api/resumes/clear-rejected', authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, 'talent');
    const records = await bitableListRecords(c.env, tableId);
    const rejected = records.filter((r: any) => {
      const hrResult = r.fields?.['HR复核结果'];
      return hrResult === '未通过';
    });
    let deleted = 0;
    for (const r of rejected) {
      await bitableDeleteRecord(c.env, tableId, r.record_id);
      deleted++;
    }
    return c.json({ deleted });
  } catch (e: any) {
    return c.json({ detail: '清除失败: ' + e.message }, 500);
  }
});

// ==================== Resume Special Actions ====================

app.post('/api/resumes/batch', authMiddleware, async (c) => {
  const body = await c.req.json();
  const results = [];
  for (const item of (body.items || body || [])) {
    const id = uuid();
    const cols = ['id', 'created_at'];
    const vals: any[] = [id, now()];
    for (const [k, v] of Object.entries(item)) {
      if (validCol(k) && !['id', 'created_at'].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => '?').join(', ');
    await c.env.DB.prepare(`INSERT INTO resumes (${cols.join(', ')}) VALUES (${placeholders})`).bind(...vals).run();
    results.push(id);
  }
  return c.json({ created: results.length, ids: results });
});

app.post('/api/resumes/:id/reparse', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first() as any;
  if (!resume) return c.json({ detail: 'Resume not found' }, 404);
  const rawText = resume.raw_text || resume.resume_markdown || '';
  if (!rawText) return c.json({ detail: 'No text to parse' }, 400);
  const systemPrompt = `You are an expert HR recruiter and resume parser. Parse the resume text and perform AI screening analysis. Return a JSON object with two sections:

Section 1 - Basic Info:
- candidate_name: full name
- email: email address (or null if not found)
- phone: phone number (or null if not found)
- highest_degree: highest education degree
- school: school name
- major: major
- years_of_experience: number
- skills: array of skills
- work_experience: array of { company, title, duration, description }
- education: array of { school, degree, major, duration }

Section 2 - AI Screening:
- position: the position the candidate applied for (extract from filename or text)
- advantage (优势分析): string describing 3-5 key strengths in Chinese
- risk (风险点/劣势分析): string describing 2-4 weaknesses or risks in Chinese
- match_score: integer 0-100 representing how well the candidate matches
- recommendation: one of "strongly_recommend", "recommend", "neutral", "not_recommend", "strongly_not_recommend"
- summary: brief analysis summary in Chinese (2-3 sentences)
- suggested_questions: array of 3-5 interview questions in Chinese`;
  try {
    const result = await callAI(c.env, systemPrompt, 'Resume text:\n' + rawText);
    let parsed: any;
    try { parsed = extractJSON(result); } catch { parsed = { raw_response: result }; }
    // Flatten nested structure (some AI models wrap Basic Info / AI Screening as sub-objects)
    const flattened: any = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        Object.assign(flattened, v);
      } else {
        flattened[k] = v;
      }
    }
    // Ensure we keep anything from the original parsed that wasn't in sub-objects
    const merged = { ...parsed, ...flattened };
    // Build ai_review markdown from screening data
    const advantage = merged.advantage || merged.advantages || '';
    const risk = merged.risk || merged.risks || '';
    const pos = merged.position || '';
    const matchScore = typeof merged.match_score === 'number' ? merged.match_score : null;
    const recommendation = merged.recommendation || '';
    const recLabel: Record<string, string> = {
      'strongly_recommend': '强烈推荐', 'recommend': '推荐',
      'neutral': '待定', 'not_recommend': '不推荐', 'strongly_not_recommend': '强烈不推荐'
    };
    const aiReview = [
      `📌 面试岗位：${pos}`,
      ``,
      `初筛结果: ${recLabel[recommendation] || recommendation}`,
      matchScore !== null ? `匹配分数: ${matchScore}/100` : '',
      ``,
      advantage ? `优势分析:\n${advantage}` : '',
      risk ? `\n风险点:\n${risk}` : '',
      merged.summary ? `\n综合评估:\n${merged.summary}` : '',
    ].filter(Boolean).join('\n');

    await c.env.DB.prepare(
      'UPDATE resumes SET parsed_data = ?, ai_review = ?, match_score = ?, screening_result = ?, parse_status = ? WHERE id = ?'
    ).bind(
      JSON.stringify(merged),
      aiReview || JSON.stringify(merged),
      matchScore,
      merged.recommendation || JSON.stringify(merged),
      'reparsed',
      id
    ).run();

    // 同步写回飞书多维表格（人才库表）
    try {
      const talentTableId = getBitableTableId(c.env, 'talent');
      const advantageStr = advantage;
      const riskStr = risk;
      const recLabelForEval: Record<string, string> = {
        'strongly_recommend': '强烈推荐', 'recommend': '推荐',
        'neutral': '待定', 'not_recommend': '不推荐', 'strongly_not_recommend': '强烈不推荐'
      };
      const evalSummary = [
        merged.summary || '',
        '',
        `匹配分数: ${matchScore !== null ? matchScore + '/100' : '-'}`,
        `推荐意见: ${recLabelForEval[recommendation] || recommendation || '-'}`,
        '',
        advantageStr ? `优势:\n${advantageStr}` : '',
        riskStr ? `\n风险:\n${riskStr}` : '',
      ].filter(Boolean).join('\n');
      await bitableUpdateRecord(c.env, talentTableId, id, {
        'AI简历评估': evalSummary,
        '优势分析': advantageStr,
        '风险点': riskStr,
        'AI简历初筛结果': recommendation || '',
      });
    } catch (e: any) {
      console.error(`[Reparse] 同步到飞书失败: ${e.message}`);
    }

    return c.json({ detail: 'Reparse completed', id, parsed_data: merged, ai_review: aiReview });
  } catch (err: any) {
    return c.json({ detail: 'Reparse failed', error: err.message }, 500);
  }
});

app.post('/api/resumes/:id/ai-screen', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first() as any;
  if (!resume) return c.json({ detail: 'Resume not found' }, 404);
  let position: any = null;
  if (resume.position_id) {
    position = await c.env.DB.prepare('SELECT * FROM positions WHERE id = ?').bind(resume.position_id).first() as any;
  }
  const resumeText = resume.resume_markdown || resume.raw_text || '';
  const posTitle = position?.title || resume.position_id || 'Unknown';
  const posDesc = position?.description || '';
  const posReq = position?.requirements || '';
  const posDept = position?.department || '';
  const posSalary = position?.salary_range || '';
  const systemPrompt = `You are an expert HR recruiter AI. Analyze the candidate resume against the job requirements. Respond in Chinese. Return a JSON object with:
- match_score: integer 0-100
- recommendation: one of "strongly_recommend", "recommend", "neutral", "not_recommend", "strongly_not_recommend"
- summary: brief summary of the candidate (2-3 sentences in Chinese)
- strengths: array of 3-5 key strengths in Chinese
- risks: array of 2-4 potential risks or concerns in Chinese
- skill_match: object with "matched" (array) and "gaps" (array) in Chinese
- suggested_questions: array of 3-5 interview questions in Chinese
- experience_analysis: brief analysis of relevant experience in Chinese (2-3 sentences)`;
  const userPrompt = `Job Position:\nTitle: ${posTitle}\nDepartment: ${posDept}\nSalary: ${posSalary}\nDescription: ${posDesc}\nRequirements: ${posReq}\n\nCandidate Resume:\n${resumeText}\n\nPlease analyze and return the JSON assessment.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt);
    let parsed: any;
    try { parsed = extractJSON(result); } catch { parsed = { raw_response: result, summary: result }; }
    await c.env.DB.prepare(
      'UPDATE resumes SET ai_review = ?, match_score = ?, screening_result = ?, parse_status = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(parsed), parsed.match_score || null, JSON.stringify(parsed), 'ai_screened', now(), id).run();

    // 同步写回飞书多维表格（人才库表）
    try {
      const talentTableId = getBitableTableId(c.env, 'talent');
      const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.join('\n') : (parsed.strengths || '');
      const risks = Array.isArray(parsed.risks) ? parsed.risks.join('\n') : (parsed.risks || '');
      const aiEval = [
        parsed.summary || '',
        '',
        `匹配分数: ${parsed.match_score ?? '-'}/100`,
        `推荐意见: ${parsed.recommendation || '-'}`,
        '',
        strengths ? `优势:\n${strengths}` : '',
        risks ? `\n风险:\n${risks}` : '',
      ].filter(Boolean).join('\n');
      await bitableUpdateRecord(c.env, talentTableId, id, {
        'AI简历评估': aiEval,
        '优势分析': strengths,
        '风险点': risks,
        'AI简历初筛结果': parsed.recommendation || '',
      });
    } catch (e: any) {
      console.error(`[AIScreen] 同步到飞书失败: ${e.message}`);
    }

    // 顺手缓存 PDF 到 D1，便于后续预览
    try {
      const existingFile: any = await c.env.DB.prepare('SELECT id FROM resume_files WHERE id = ?').bind(id).first();
      if (!existingFile) {
        const talentTableId = getBitableTableId(c.env, 'talent');
        const record = await bitableGetRecord(c.env, talentTableId, id);
        if (record) {
          const f = record.fields || {};
          // 扫描附件字段
          for (const [fieldName, fieldValue] of Object.entries(f)) {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              const item = fieldValue[0];
              if (item && typeof item === 'object' && (item.file_token || item.link)) {
                const fileToken = item.file_token || '';
                const tmpUrl = item.tmp_url || '';
                // 优先用 tmp_url，失败再拼内部 URL
                const dlUrl = tmpUrl || (fileToken ? `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${FEISHU_CONFIG.appToken}&mount_point=bitable` : '');
                if (fileToken || tmpUrl) {
                  const dlResp = await downloadFeishuAttachment(c.env, fileToken, dlUrl);
                  if (dlResp) {
                    const blob = await dlResp.arrayBuffer();
                    const b64 = bufToB64(blob);
                    await c.env.DB.prepare(
                      'INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
                    ).bind(id, 'aiscreen_' + (fileToken || 'tmp'), (f['姓名'] || 'resume') + '.pdf', blob.byteLength, b64, new Date().toISOString()).run();
                  }
                }
                break;
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error(`[AIScreen] 缓存PDF失败: ${e.message}`);
    }

    return c.json({ success: true, ai_review: parsed });
  } catch (err: any) {
    return c.json({ detail: 'AI screening failed', error: err.message }, 500);
  }
});

app.post('/api/resumes/:id/confirm-rejection', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE resumes SET status = 'rejected', stage = 'rejected', rejected_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/resumes/:id/override-rejection', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE resumes SET status = 'pending_review', stage = 'screening', rejected_at = NULL WHERE id = ?").bind(id).run();
  const row = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// 简历管理页面：入库 → 创建人才库记录 + 写入飞书多维表格
app.post('/api/resumes/:id/approve-to-talent-pool', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const talentTableId = getBitableTableId(c.env, 'talent');
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: 'Candidate not found in Bitable' }, 404);

  await bitableUpdateRecord(c.env, talentTableId, id, { 'HR复核结果': '通过' });
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});

app.post('/api/resumes/:id/reject-from-screening', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const talentTableId = getBitableTableId(c.env, 'talent');
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: 'Candidate not found in Bitable' }, 404);

  await bitableUpdateRecord(c.env, talentTableId, id, { 'HR复核结果': '未通过' });
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});

// 重置简历到待初筛状态（清除 HR复核结果）
app.post('/api/resumes/:id/reset-to-pending', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const talentTableId = getBitableTableId(c.env, 'talent');
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: 'Candidate not found in Bitable' }, 404);

  await bitableUpdateRecord(c.env, talentTableId, id, { 'HR复核结果': '' });
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});


app.get('/api/resumes/:id/department-reviews', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM department_reviews WHERE resume_id = ?').bind(c.req.param('id')).all();
  return c.json(result.results.map(transformRow));
});

app.post('/api/resumes/:id/department-reviews', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const reviewId = uuid();
  await c.env.DB.prepare(
    'INSERT INTO department_reviews (id, resume_id, reviewer_id, technical_score, experience_score, overall_score, recommendation, comment, is_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(reviewId, id, user.id, body.technical_score, body.experience_score, body.overall_score, body.recommendation, body.comment, now(), now()).run();
  const row = await c.env.DB.prepare('SELECT * FROM department_reviews WHERE id = ?').bind(reviewId).first();
  return c.json(transformRow(row));
});

app.post('/api/resumes/:id/hr-decision', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const decision = body.decision || 'approve';
  let status = 'pending_interview', stage = 'interview';
  if (decision === 'reject') { status = 'rejected'; stage = 'rejected'; }
  await c.env.DB.prepare('UPDATE resumes SET status = ?, stage = ?, hr_review = ? WHERE id = ?').bind(status, stage, body.comment || '', id).run();
  const row = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/resumes/:id/transfer', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE resumes SET position_id = ? WHERE id = ?').bind(body.position_id, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// ==================== Interview Actions ====================

app.get('/api/interviews/:id/questions', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT questions FROM interviews WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ detail: 'Not found' }, 404);
  let qs = [];
  if (row.questions) { try { qs = JSON.parse(row.questions); } catch { qs = []; } }
  return c.json(qs);
});

app.post('/api/interviews/:id/start', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE interviews SET status = 'in_progress', started_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first() as any;

  // 异步通知面试官
  if (row) {
    c.executionCtx.waitUntil((async () => {
      try {
        const token = await getFeishuToken(c.env);
        // 找到对应简历信息
        const resumeId = row.resume_id;
        let candidateName = '未知';
        let positionName = '未知岗位';
        if (resumeId) {
          const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(resumeId).first() as any;
          if (resume) {
            candidateName = resume.candidate_name || '未知';
            const pd = safeJson(resume.parsed_data);
            positionName = pd?.target_position || resume.mapped_position || resume.position_applied || '未知岗位';
          }
        }
        const fakeRecord = { candidate_name: candidateName, mapped_position: positionName, position_applied: positionName };
        await notifyInterviewersForCandidate(c.env, token, fakeRecord);
      } catch (e: any) {
        console.error(`开始面试通知失败: ${e.message}`);
      }
    })());
  }

  return c.json(transformRow(row));
});

// 从人才库一键开始面试 → 创建面试记录 + 通知面试官
app.post('/api/interviews/start-from-talent-pool/:talentId', authMiddleware, async (c) => {
  const talentId = c.req.param('talentId');
  const talent = await c.env.DB.prepare('SELECT * FROM talent_pool WHERE id = ?').bind(talentId).first() as any;
  if (!talent) return c.json({ detail: 'Talent not found' }, 404);

  const candidateName = talent.candidate_name || '未知';
  const posName = talent.position_applied || talent.current_title || '未知岗位';
  const resumeId = talent.resume_id || null;
  const city = talent.city || '';
  const aiEval = talent.ai_evaluation || '';

  // 创建面试记录
  const interviewId = uuid();
  await c.env.DB.prepare(
    `INSERT INTO interviews (id, resume_id, interviewer, status, created_at)
     VALUES (?, ?, ?, 'scheduled', ?)`
  ).bind(interviewId, resumeId, candidateName, now()).run();

  // 异步通知面试官
  c.executionCtx.waitUntil((async () => {
    try {
      const token = await getFeishuToken(c.env);
      const fakeRecord = {
        candidate_name: candidateName,
        mapped_position: posName,
        position_applied: posName,
        city: city,
        ai_analysis: aiEval,
      };
      await notifyInterviewersForCandidate(c.env, token, fakeRecord);
    } catch (e: any) {
      console.error(`通知面试官失败: ${e.message}`);
    }
  })());

  const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(interviewId).first();
  return c.json({ ...transformRow(row), talent_id: talentId });
});

app.post('/api/interviews/:id/cancel', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const interview = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first() as any;
  if (!interview) return c.json({ detail: 'Interview not found' }, 404);

  await c.env.DB.prepare("UPDATE interviews SET status = 'cancelled' WHERE id = ?").bind(id).run();

  // 若面试关联了人才库记录 → 删除人才库记录并同步飞书
  const resumeId = interview.resume_id;
  if (resumeId) {
    const talent = await c.env.DB.prepare('SELECT * FROM talent_pool WHERE resume_id = ?').bind(resumeId).first() as any;
    if (talent) {
      const feishuRecordId = talent.feishu_record_id;
      await c.env.DB.prepare('DELETE FROM talent_pool WHERE id = ?').bind(talent.id).run();

      // 异步删除飞书多维表格记录
      if (feishuRecordId) {
        c.executionCtx.waitUntil((async () => {
          try {
            const token = await getFeishuToken(c.env);
            await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.appToken}/tables/${FEISHU_CONFIG.talentTableId}/records/${feishuRecordId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            console.log(`[Cancel] 已同步删除飞书人才库记录: ${feishuRecordId}`);
          } catch (e: any) {
            console.error(`[Cancel] 同步删除飞书记录失败: ${e.message}`);
          }
        })());
      }
    }
  }

  return c.json({ detail: 'Interview cancelled, talent pool record removed' });
});

app.post('/api/interviews/:id/score', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE interviews SET scores = ?, total_score = ?, comments = ?, evaluation = ?, suggestion = ?, status = ? WHERE id = ?')
    .bind(JSON.stringify(body.scores || {}), body.total_score, JSON.stringify(body.comments || {}), body.evaluation || '', body.suggestion || '', body.status || 'completed', id).run();
  const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/interviews/:id/confirm', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE interviews SET result = ?, status = ? WHERE id = ?').bind(body.result || 'passed', 'completed', id).run();
  const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.get('/api/interviews/export', authMiddleware, async (c) => {
  return c.json([]);
});

app.post('/api/positions/:id/ai-match', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const position = await c.env.DB.prepare('SELECT * FROM positions WHERE id = ?').bind(id).first() as any;
  if (!position) return c.json({ detail: 'Position not found' }, 404);
  const resumes = await c.env.DB.prepare('SELECT id, candidate_name, resume_markdown, raw_text, match_score FROM resumes WHERE position_id = ?').bind(id).all();
  const posInfo = { title: position.title, description: position.description, requirements: position.requirements, department: position.department, salary_range: position.salary_range };
  const systemPrompt = `You are an expert HR matching AI. Given a job position and a list of candidates, rank them by suitability. Respond in Chinese. Return a JSON array of objects with:
- resume_id: the candidate id
- candidate_name: the candidate name
- match_score: integer 0-100
- ranking_reason: brief reason for the ranking in Chinese`;
  const candidateList = resumes.results.map((r: any) => ({ id: r.id, name: r.candidate_name, resume: (r.resume_markdown || r.raw_text || '').substring(0, 500) }));
  const userPrompt = `Position: ${JSON.stringify(posInfo)}\n\nCandidates:\n${JSON.stringify(candidateList, null, 2)}\n\nRank these candidates by suitability for the position. Return a JSON array.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    let ranking: any[];
    try { ranking = extractJSON(result); if (!Array.isArray(ranking)) ranking = [ranking]; } catch { ranking = []; }
    return c.json({ position_id: id, rankings: ranking });
  } catch (err: any) {
    return c.json({ detail: 'AI matching failed', error: err.message }, 500);
  }
});

﻿// ==================== AI Enhancement Routes ====================

// SSE body helper: emit content chunk then a done marker
function sseBody(content: string): string {
  return `data: ${JSON.stringify({ content })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`;
}

// JD generation (streaming SSE, compatible with JDGeneratorModal)
app.post('/api/positions/generate-jd-stream', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, department, location, salary_range } = body;
  if (!title) return c.json({ detail: 'position title required' }, 400);
  const systemPrompt = `你是一名资深招聘专家。根据职位信息生成专业的职位描述(JD)。只用中文回答。返回严格的 JSON,格式为 {"description": "详细职责描述", "requirements": "任职要求,多条用换行分隔"}。不要包含 markdown 代码块标记或额外说明。`;
  const userPrompt = `职位名称: ${title}\n部门: ${department || '未指定'}\n工作地点: ${location || '未指定'}\n薪资范围: ${salary_range || '面议'}\n\n请生成该职位的详细职责描述和任职要求。`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    return new Response(sseBody(result), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  } catch (err: any) {
    return new Response(`data: ${JSON.stringify({ error: err.message })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  }
});

// JD refinement chat (streaming SSE)
app.post('/api/positions/chat-jd-stream', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages: any[] = body.messages || [];
  const currentDesc = body.current_description || '';
  const currentReq = body.current_requirements || '';
  const userMsgs = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n');
  const systemPrompt = `你是一名资深招聘专家,正在帮用户修改职位描述(JD)。根据用户反馈修改当前 JD。只用中文回答。返回严格的 JSON: {"description": "修改后的详细职责描述", "requirements": "修改后的任职要求"}。不要包含 markdown 代码块标记或额外说明。`;
  const userPrompt = `当前职位描述:\n${currentDesc}\n\n当前任职要求:\n${currentReq}\n\n用户修改意见:\n${userMsgs || '请优化完善'}\n\n请据此修改 JD 并返回完整 JSON。`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    return new Response(sseBody(result), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  } catch (err: any) {
    return new Response(`data: ${JSON.stringify({ error: err.message })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  }
});

// Interview comprehensive AI analysis — generates evaluation + suggestion
app.post('/api/interviews/:id/ai-analysis', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const interview = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first() as any;
  if (!interview) return c.json({ detail: 'Interview not found' }, 404);
  let resume: any = null;
  if (interview.resume_id) resume = await c.env.DB.prepare('SELECT id, candidate_name, resume_markdown, raw_text, match_score FROM resumes WHERE id = ?').bind(interview.resume_id).first() as any;
  let position: any = null;
  if (interview.position_id) position = await c.env.DB.prepare('SELECT title, description, requirements, department FROM positions WHERE id = ?').bind(interview.position_id).first() as any;

  let scores: Record<string, number> = {};
  let comments: Record<string, string> = {};
  let questions: any[] = [];
  try { scores = JSON.parse(interview.scores || '{}'); } catch {}
  try { comments = JSON.parse(interview.comments || '{}'); } catch {}
  try { questions = JSON.parse(interview.questions || '[]'); } catch {}

  const scoreList = Object.entries(scores).map(([k, v]) => `第${Number(k) + 1}题: ${v}分`).join('; ');
  const commentList = Object.entries(comments).map(([k, v]) => `第${Number(k) + 1}题评语: ${v}`).join('\n');
  const questionList = questions.map((q: any, i: number) => `${i + 1}. ${q.question || q.title || ''} (类型:${q.type || '未分类'}, 难度:${q.difficulty || '未知'})`).join('\n');
  const scoreValues = Object.values(scores);
  const avg = scoreValues.length > 0 ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1) : 'N/A';

  const systemPrompt = `你是一名资深招聘面试官 AI。根据面试评分、面试官评语、面试题表现和候选人简历,生成一份结构化的候选人面试综合评估报告。用中文回答,使用 Markdown 格式,包含以下部分:## 综合评价、## 候选人优势、## 风险与不足、## 改进建议、## 录用建议。在"## 录用建议"部分给出明确结论(推荐录用/待定/不推荐)和简短理由。`;
  const userPrompt = `候选人: ${resume?.candidate_name || '未知'}\n应聘岗位: ${position?.title || '未知'}\n岗位要求: ${position?.requirements || '无'}\n平均得分: ${avg}/10\n\n面试题:\n${questionList || '无'}\n\n评分明细: ${scoreList || '无'}\n\n面试官评语:\n${commentList || '无'}\n\n候选人简历摘要:\n${(resume?.resume_markdown || resume?.raw_text || '').substring(0, 800)}\n\n请生成综合评估报告。`;

  try {
    const evaluation = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    let suggestion = '';
    const m = evaluation.match(/录用建议[：:]*\s*([^\n]+)/);
    if (m) suggestion = m[1].trim();
    if (!suggestion) suggestion = evaluation.slice(-100).replace(/[#*\n]/g, '').trim();
    await c.env.DB.prepare('UPDATE interviews SET evaluation = ?, suggestion = ?, result = ? WHERE id = ?')
      .bind(evaluation, suggestion, 'pending', id).run();
    const row = await c.env.DB.prepare('SELECT * FROM interviews WHERE id = ?').bind(id).first();
    return c.json(transformRow(row));
  } catch (err: any) {
    return c.json({ detail: 'AI analysis failed', error: err.message }, 500);
  }
});

// AI recommend positions for a talent pool candidate
app.post('/api/talent-pool/:id/ai-recommend', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const talent = await c.env.DB.prepare('SELECT * FROM talent_pool WHERE id = ?').bind(id).first() as any;
  if (!talent) return c.json({ detail: 'Talent not found' }, 404);
  const positions = await c.env.DB.prepare("SELECT id, title, department, requirements, salary_range, status FROM positions WHERE status IN ('open','published') ORDER BY created_at DESC LIMIT 20").all();
  const systemPrompt = `你是一名资深猎头 AI。根据候选人背景和现有在招岗位,推荐最合适的岗位并说明理由。只用中文回答。返回 JSON 数组,每项含 {"position_id": "岗位ID", "position_title": "岗位名称", "match_score": 0-100整数, "reason": "推荐理由"}。不要包含 markdown 代码块标记或额外说明。`;
  const candidateInfo = { name: talent.candidate_name, current_title: talent.current_title, skills: talent.skills, experience_years: talent.experience_years, education: talent.education, expected_salary: talent.expected_salary, tags: talent.tags };
  const userPrompt = `候选人信息:\n${JSON.stringify(candidateInfo, null, 2)}\n\n在招岗位列表:\n${JSON.stringify(positions.results.map((p: any) => ({ id: p.id, title: p.title, department: p.department, requirements: p.requirements, salary_range: p.salary_range })), null, 2)}\n\n请推荐最匹配的岗位(最多5个),按匹配度从高到低排序。`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    let recommendations: any[];
    try { recommendations = extractJSON(result); if (!Array.isArray(recommendations)) recommendations = [recommendations]; } catch { recommendations = []; }
    return c.json({ talent_id: id, recommendations });
  } catch (err: any) {
    return c.json({ detail: 'AI recommend failed', error: err.message }, 500);
  }
});

// AI probation assessment from monthly reviews
app.post('/api/probation/:id/ai-assessment', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM probation_records WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Probation record not found' }, 404);
  let reviews: any[] = [];
  try { reviews = JSON.parse(record.monthly_reviews || '[]'); } catch {}
  let position: any = null;
  if (record.position_id) position = await c.env.DB.prepare('SELECT title, requirements FROM positions WHERE id = ?').bind(record.position_id).first() as any;
  const systemPrompt = `你是一名资深 HR 顾问 AI。根据员工试用期月度评审记录,生成试用期综合评估报告。用中文回答,使用 Markdown 格式,包含:## 总体表现、## 优势、## 不足与改进、## 转正建议(明确给出建议转正/延长试用期/不予转正及理由)。`;
  const userPrompt = `员工: ${record.employee_name}\n岗位: ${position?.title || '未知'}\n岗位要求: ${position?.requirements || '无'}\n试用期月数: ${record.probation_months || 3}\n\n月度评审记录:\n${reviews.length > 0 ? JSON.stringify(reviews, null, 2) : '暂无月度评审记录'}\n\n请生成试用期综合评估报告。`;
  try {
    const assessment = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    await c.env.DB.prepare('UPDATE probation_records SET final_assessment = ?, updated_at = ? WHERE id = ?')
      .bind(assessment, now(), id).run();
    const row = await c.env.DB.prepare('SELECT * FROM probation_records WHERE id = ?').bind(id).first();
    return c.json(transformRow(row));
  } catch (err: any) {
    return c.json({ detail: 'AI assessment failed', error: err.message }, 500);
  }
});

// AI generate/refine job description from a requisition
app.post('/api/requisitions/:id/ai-jd', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const req = await c.env.DB.prepare('SELECT * FROM job_requisitions WHERE id = ?').bind(id).first() as any;
  if (!req) return c.json({ detail: 'Requisition not found' }, 404);
  const systemPrompt = `你是一名资深招聘专家。根据招聘需求信息生成专业的职位描述和任职要求。只用中文回答。返回严格的 JSON: {"description": "详细职责描述", "requirements": "任职要求,多条用换行分隔"}。不要包含 markdown 代码块标记或额外说明。`;
  const userPrompt = `职位名称: ${req.title}\n部门: ${req.department}\n招聘人数: ${req.headcount || 1}\n用工类型: ${req.employment_type || 'full_time'}\n薪资范围: ${req.salary_range || '面议'}\n紧急程度: ${req.urgency || 'medium'}\n现有描述: ${req.description || '无'}\n现有要求: ${req.requirements || '无'}\n\n请生成或完善该职位的描述和任职要求。`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, 'deepseek-v4-flash');
    let parsed: any;
    try { parsed = extractJSON(result); } catch { parsed = { description: result, requirements: '' }; }
    await c.env.DB.prepare('UPDATE job_requisitions SET description = ?, requirements = ?, updated_at = ? WHERE id = ?')
      .bind(parsed.description || '', parsed.requirements || '', now(), id).run();
    const row = await c.env.DB.prepare('SELECT * FROM job_requisitions WHERE id = ?').bind(id).first();
    return c.json(transformRow(row));
  } catch (err: any) {
    return c.json({ detail: 'AI generate failed', error: err.message }, 500);
  }
});


// ==================== Requisition Actions ====================

app.post('/api/requisitions/:id/approve', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  await c.env.DB.prepare("UPDATE job_requisitions SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?").bind(user.id, now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM job_requisitions WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/requisitions/:id/reject', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE job_requisitions SET status = 'rejected', rejection_reason = ? WHERE id = ?").bind(body.reason || '', id).run();
  const row = await c.env.DB.prepare('SELECT * FROM job_requisitions WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// ==================== Talent Pool Actions ====================

app.post('/api/talent-pool/:id/contact', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE talent_pool SET status = 'contacted', last_contacted_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM talent_pool WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// ==================== Probation Actions ====================

app.post('/api/probation/:id/confirm', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE probation_records SET result = ?, confirmed_at = ?, confirmed_by = ?, new_title = ?, salary_adjustment = ? WHERE id = ?")
    .bind(body.result || 'confirmed', now(), user.id, body.new_title || null, body.salary_adjustment || null, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM probation_records WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/probation/:id/review', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT monthly_reviews FROM probation_records WHERE id = ?').bind(id).first();
  let reviews = [];
  if (existing?.monthly_reviews) { try { reviews = JSON.parse(existing.monthly_reviews); } catch { reviews = []; } }
  reviews.push(body);
  await c.env.DB.prepare('UPDATE probation_records SET monthly_reviews = ? WHERE id = ?').bind(JSON.stringify(reviews), id).run();
  return c.json({ detail: 'Review added' });
});

// ==================== Workflow Actions ====================

app.post('/api/workflows/:id/publish', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE workflows SET status = 'published', published_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare('SELECT * FROM workflows WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.post('/api/workflows/:id/execute', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const execId = uuid();
  await c.env.DB.prepare(
    'INSERT INTO workflow_executions (id, workflow_id, status, trigger_type, triggered_by, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(execId, id, 'running', 'manual', user.id, now(), now()).run();
  const row = await c.env.DB.prepare('SELECT * FROM workflow_executions WHERE id = ?').bind(execId).first();
  return c.json(transformRow(row));
});

// ==================== Settings Routes ====================

app.get('/api/settings/system', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  if (!row) return c.json({});
  return c.json(transformRow(row));
});

app.put('/api/settings/system', authMiddleware, async (c) => {
  const body = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT id FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  if (existing) {
    const cols: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !['id', 'updated_at'].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    cols.push('updated_at'); vals.push(now());
    const setClause = cols.map(k => `${k} = ?`).join(', ');
    await c.env.DB.prepare(`UPDATE system_configs SET ${setClause} WHERE id = ?`).bind(...vals, existing.id).run();
  } else {
    const id = uuid();
    const cols = ['id', 'updated_at'];
    const vals: any[] = [id, now()];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !['id', 'updated_at'].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => '?').join(', ');
    await c.env.DB.prepare(`INSERT INTO system_configs (${cols.join(', ')}) VALUES (${placeholders})`).bind(...vals).run();
  }
  const row = await c.env.DB.prepare('SELECT * FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  return c.json(transformRow(row));
});

app.get('/api/settings/mail', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT smtp_host, smtp_port, smtp_username, mail_from, mail_from_name, mail_enabled, frontend_url FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  return c.json(transformRow(row) || {});
});

app.put('/api/settings/mail', authMiddleware, async (c) => {
  return c.json({ detail: 'Mail settings updated' });
});

app.get('/api/settings/prompts', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  if (!row?.prompt_configs) return c.json({});
  try { return c.json(JSON.parse(row.prompt_configs)); } catch { return c.json({}); }
});

app.get('/api/settings/prompts/:key', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1').first();
  if (!row?.prompt_configs) return c.json({ detail: 'Not found' }, 404);
  try {
    const configs = JSON.parse(row.prompt_configs);
    return c.json(configs[c.req.param('key')] || { detail: 'Not found' }, 404);
  } catch { return c.json({ detail: 'Not found' }, 404); }
});

app.get('/api/settings/prompts/variables', authMiddleware, async (c) => {
  return c.json([]);
});

app.put('/api/settings/prompts/:key', authMiddleware, async (c) => {
  return c.json({ detail: 'Prompt updated' });
});

app.post('/api/settings/mail/test', authMiddleware, async (c) => {
  return c.json({ detail: 'Mail sending not available in serverless mode' });
});

// ==================== 面试官映射管理 ====================

app.get('/api/settings/interviewers', authMiddleware, async (c) => {
  try {
    const rows = await c.env.DB.prepare('SELECT * FROM interviewer_mappings ORDER BY name').all();
    return c.json(rows.results || []);
  } catch (e: any) {
    // 表可能还不存在，返回空
    return c.json([]);
  }
});

app.put('/api/settings/interviewers', authMiddleware, async (c) => {
  const body = await c.req.json();
  const items: Array<{ name: string; open_id: string }> = body.items || body || [];

  try {
    // 全量替换：先删后插
    await c.env.DB.prepare('DELETE FROM interviewer_mappings').run();
    for (const item of items) {
      if (item.name && item.open_id) {
        await c.env.DB.prepare(
          'INSERT INTO interviewer_mappings (id, name, open_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(uuid(), item.name, item.open_id, now(), now()).run();
      }
    }
    const rows = await c.env.DB.prepare('SELECT * FROM interviewer_mappings ORDER BY name').all();
    return c.json({ ok: true, count: rows.results?.length || 0, items: rows.results || [] });
  } catch (e: any) {
    return c.json({ detail: '保存失败: ' + e.message }, 500);
  }
});

// 通知全部面试官（发飞书卡片）
app.post('/api/settings/interviewers/notify-all', authMiddleware, async (c) => {
  try {
    const { title, content } = await c.req.json();
    const rows = await c.env.DB.prepare('SELECT * FROM interviewer_mappings ORDER BY name').all();
    if (!rows.results || rows.results.length === 0) {
      return c.json({ detail: '没有配置面试官映射' }, 400);
    }

    const token = await getFeishuToken(c.env);
    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: title || '📢 面试官通知' },
        template: 'blue',
      },
      elements: [
        { tag: 'markdown', content: content || '请及时查看系统安排。' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '打开系统' },
              type: 'primary',
              multi_url: {
                url: 'https://ai-interview-22u.pages.dev',
                pc_url: 'https://ai-interview-22u.pages.dev',
                ios_url: '',
                android_url: '',
              },
            },
          ],
        },
      ],
    };

    const results: string[] = [];
    for (const row of rows.results) {
      try {
        await sendFeishuMessageToUser(token, row.open_id, card);
        results.push(`${row.name}: ✅`);
      } catch (e: any) {
        results.push(`${row.name}: ❌ ${e.message}`);
      }
    }
    return c.json({ ok: true, total: results.length, details: results });
  } catch (e: any) {
    return c.json({ detail: '通知失败: ' + e.message }, 500);
  }
});

// ==================== Public Routes ====================

app.get('/api/positions/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM positions WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ detail: 'Not found' }, 404);
  return c.json(transformRow(row));
});

app.get('/api/public/review/:resumeId', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(c.req.param('resumeId')).first();
  if (!row) return c.json({ detail: 'Not found' }, 404);
  return c.json(transformRow(row));
});

// ==================== Initialization ====================

app.post('/api/init/reset', authMiddleware, requireRole(['admin']), async (c) => {
  const transactionalTables = [
    'workflow_node_executions',
    'workflow_executions',
    'probation_records',
    'onboarding_records',
    'background_checks',
    'talent_pool',
    'interview_panels',
    'interviews',
    'department_reviews',
    'resumes',
  ];
  const results: Record<string, number> = {};
  for (const table of transactionalTables) {
    const r = await c.env.DB.prepare(`DELETE FROM ${table}`).run();
    results[table] = r.meta?.changes ?? 0;
  }
  return c.json({ success: true, deleted: results });
});

app.get('/api/init/status', authMiddleware, requireRole(['admin']), async (c) => {
  const counts: Record<string, number> = {};
  const tables = ['positions', 'resumes', 'interviews', 'users', 'job_requisitions'];
  for (const table of tables) {
    const r = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
    counts[table] = r?.cnt ?? 0;
  }
  return c.json(counts);
});

// ==================== Resume Screening (小七 integration) ====================

// CRUD for position mappings
registerCrud('position-mappings', 'position_mappings', { raw_name: 'like', mapped_name: 'like' });

// CRUD for capability dimensions
registerCrud('capability-dimensions', 'capability_dimensions', { position_name: 'like' });

// CRUD for recruitment tasks
registerCrud('recruitment-tasks', 'recruitment_tasks', { status: 'eq', position_name: 'like' });

// List screening queue with filters
app.get('/api/resume-screening', authMiddleware, async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status') || '';
  const search = c.req.query('search') || '';
  let sql = 'SELECT * FROM resume_screening_queue';
  const conditions: string[] = [];
  const binds: any[] = [];
  if (status) { conditions.push('status = ?'); binds.push(status); }
  if (search) { conditions.push('(candidate_name LIKE ? OR position_applied LIKE ?)'); binds.push(`%${search}%`, `%${search}%`); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const result = await db.prepare(sql).bind(...binds).all();
  return c.json(result.results.map(transformRow));
});

// Get single screening record
app.get('/api/resume-screening/:id', authMiddleware, async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ detail: 'Not found' }, 404);
  return c.json(transformRow(row));
});

// Create screening record (from email scan or manual upload)
app.post('/api/resume-screening', authMiddleware, async (c) => {
  const body = await c.req.json();
  const id = body.id || uuid();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, city, ai_analysis, ai_result, match_score, risk_points, match_reasons, interview_questions, strengths, age, gender, education, file_name, email_subject, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, body.resume_id || null, body.candidate_name || '未知', body.position_applied || '',
    body.mapped_position || '', body.city || '', body.ai_analysis || '', body.ai_result || 'pending',
    body.match_score || 0, body.risk_points || '', body.match_reasons || '', body.interview_questions || '',
    body.strengths || '', body.age || '', body.gender || '', body.education || '',
    body.file_name || '', body.email_subject || '', body.status || 'pending', body.batch_num || 1,
    ts, ts
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// AI analyze a resume for screening (core 小七 analysis engine)
app.post('/api/resume-screening/:id/ai-analyze', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);

  // Get resume text
  let resumeText = '';
  if (record.resume_id) {
    const resume = await c.env.DB.prepare('SELECT raw_text FROM resumes WHERE id = ?').bind(record.resume_id).first() as any;
    if (resume?.raw_text) resumeText = resume.raw_text;
  }
  if (!resumeText) resumeText = record.ai_analysis || '无简历文本';

  // Map position
  let mappedPosition = record.mapped_position || '';
  if (!mappedPosition && record.position_applied) {
    const pmRow = await c.env.DB.prepare('SELECT mapped_name FROM position_mappings WHERE raw_name LIKE ? LIMIT 1').bind(`%${record.position_applied.split('_')[0]}%`).first() as any;
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }
  if (!mappedPosition) mappedPosition = record.position_applied?.split('_')[0] || '未知岗位';

  // Get capability dimensions for this position
  const dimsResult = await c.env.DB.prepare('SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3').bind(mappedPosition).all();
  let dimensionsText = '';
  if (dimsResult.results && dimsResult.results.length > 0) {
    dimensionsText = dimsResult.results.map((r: any) => r.full_text || '').filter(Boolean).join('\n');
  }

  // Get JD from job_requisitions if available
  const reqRow = await c.env.DB.prepare('SELECT requirements FROM job_requisitions WHERE title LIKE ? LIMIT 1').bind(`%${mappedPosition}%`).first() as any;
  const jdText = reqRow?.requirements || '(无JD)';

  const systemPrompt = `你是一个专业的人力资源简历初筛专家（AI简历分析引擎）。你的任务是分析候选人简历，评估其与目标岗位的匹配度。

分析要求：
1. 初筛结果：通过/不通过/待定
2. 优势分析：候选人的核心优势（2-3条）
3. 风险点：潜在风险或不足（1-2条）
4. 能力维度匹配：按岗位能力维度逐项评分（0-5分），并给出匹配依据
5. 建议追问的面试问题（3-5个）
6. 互动引导语：给面试官的一段简短引导

请用以下格式输出（中文）：

初筛结果：[通过/不通过/待定]
匹配分数：[0-5的数字]

优势分析：
• ...
• ...

风险点：
• ...

能力维度匹配：
能力：[维度名] [X]/5分。依据：...
能力：[维度名] [X]/5分。依据：...

建议追问的面试问题：
1. ...
2. ...
3. ...

互动引导语：
[一段简短的话]`;

  const userPrompt = `岗位名称：${mappedPosition}
岗位JD：
${jdText}

岗位能力维度要求：
${dimensionsText || '(无具体维度要求，请根据岗位常识评估)'}

候选人信息：
姓名：${record.candidate_name}
年龄：${record.age || '未知'}
性别：${record.gender || '未知'}
学历：${record.education || '未知'}
申请岗位：${record.position_applied || '未知'}

简历内容：
${resumeText.substring(0, 6000)}`;

  let aiAnalysis = '';
  try {
    aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
  } catch (e: any) {
    return c.json({ detail: `AI分析失败: ${e.message}` }, 500);
  }

  // Parse match score from AI response
  const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
  const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
  const aiResult = resultMatch ? resultMatch[1] : 'pending';

  // Update the screening record
  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?'
  ).bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), id).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// Approve a screening record (入库 -> creates talent_pool entry)
app.post('/api/resume-screening/:id/approve', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);
  if (record.status !== 'pending') return c.json({ detail: 'Already processed' }, 400);

  // Create talent_pool entry
  const tpId = uuid();
  await c.env.DB.prepare(
    `INSERT INTO talent_pool (id, resume_id, candidate_name, email, phone, current_title, skills, experience_years, education, expected_salary, source, tags, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    tpId, record.resume_id || null, record.candidate_name, '', '', record.position_applied || '',
    '[]', 0, record.education || '', '', '邮箱初筛',
    JSON.stringify(['AI初筛']), 'available',
    record.ai_analysis || '', now(), now()
  ).run();

  // Update screening record
  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
  ).bind('approved', 'shortlisted', user.id, now(), now(), id).run();

  // 写入飞书多维表格 + 推群（异步）
  c.executionCtx.waitUntil((async () => {
    try {
      const token = await getFeishuToken(c.env);
      const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
      const talentTableId = c.env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;
      const posName = record.mapped_position || record.position_applied?.split('_')[0] || '未知岗位';

      // 写飞书人才库多维表格
      await createFeishuBitableRecord(token, appToken, talentTableId, {
        '姓名': record.candidate_name || '未知',
        '年龄': record.age || null,
        '性别': record.gender || null,
        '学历': record.education || null,
        '面试岗位': record.position_applied || null,
        '招聘岗位': posName,
        '城市': record.city || null,
        'AI简历评估': record.ai_analysis || '',
        'AI简历初筛结果': '已入库',
      });

      // 推送到招聘群
      const updated = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
      await pushCandidateToGroup(c.env, updated);

      // 提醒对应的面试官
      await notifyInterviewersForCandidate(c.env, token, updated);
    } catch (e: any) {
      console.error(`入库后处理失败: ${e.message}`);
    }
  })());

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json({ ...transformRow(row), talent_pool_id: tpId });
});

// Reject a screening record (淘汰)
app.post('/api/resume-screening/:id/reject', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: 'Not found' }, 404);
  if (record.status !== 'pending') return c.json({ detail: 'Already processed' }, 400);

  await c.env.DB.prepare(
    'UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
  ).bind('rejected', 'rejected', user.id, now(), now(), id).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// Batch AI analyze all pending records
app.post('/api/resume-screening/batch-analyze', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT id FROM resume_screening_queue WHERE status = 'pending' AND (ai_analysis IS NULL OR ai_analysis = '')").all();
  const ids = result.results.map((r: any) => r.id);
  let processed = 0;
  for (const rid of ids) {
    try {
      const rec = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(rid).first() as any;
      if (!rec) continue;
      let resumeText = '';
      if (rec.resume_id) {
        const resume = await c.env.DB.prepare('SELECT raw_text FROM resumes WHERE id = ?').bind(rec.resume_id).first() as any;
        if (resume?.raw_text) resumeText = resume.raw_text;
      }
      if (!resumeText) continue;
      let mappedPosition = rec.mapped_position || rec.position_applied?.split('_')[0] || '未知岗位';
      const dimsResult = await c.env.DB.prepare('SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3').bind(mappedPosition).all();
      const dimensionsText = dimsResult.results?.map((r: any) => r.full_text || '').filter(Boolean).join('\n') || '';
      const systemPrompt = `你是简历初筛专家。分析简历并输出：初筛结果（通过/不通过/待定）、匹配分数（0-5）、优势分析、风险点、能力维度匹配（每项0-5分）、面试问题建议（3个）、互动引导语。用中文输出。`;
      const userPrompt = `岗位：${mappedPosition}\n能力维度要求：${dimensionsText || '(无)'}\n候选人：${rec.candidate_name} ${rec.age || ''}岁 ${rec.gender || ''} ${rec.education || ''}\n简历：${resumeText.substring(0, 5000)}`;
      const aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
      const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
      const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
      const aiResult = resultMatch ? resultMatch[1] : 'pending';
      await c.env.DB.prepare('UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?').bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), rid).run();
      processed++;
    } catch (e) { /* skip on error */ }
  }
  return c.json({ processed, total: ids.length });
});

// Create screening record from resume (link existing resume to screening queue)
app.post('/api/resume-screening/from-resume/:resumeId', authMiddleware, async (c) => {
  const resumeId = c.req.param('resumeId');
  const resume = await c.env.DB.prepare('SELECT * FROM resumes WHERE id = ?').bind(resumeId).first() as any;
  if (!resume) return c.json({ detail: 'Resume not found' }, 404);

  const id = uuid();
  const ts = now();
  const positionApplied = resume.position_title || resume.target_position || '';
  // Map position
  let mappedPosition = '';
  if (positionApplied) {
    const pmRow = await c.env.DB.prepare('SELECT mapped_name FROM position_mappings WHERE ? LIKE "%" || raw_name || "%" LIMIT 1').bind(positionApplied).first() as any;
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }

  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, age, gender, education, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, resumeId, resume.candidate_name || '未知', positionApplied, mappedPosition, resume.age || '', resume.gender || '', resume.education || '', 'pending', 1, ts, ts).run();

  const row = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

// ==================== Daily Reports ====================

app.get('/api/daily-reports', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT 100').all();
  return c.json(result.results.map(transformRow));
});

app.post('/api/daily-reports/generate', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({})) || {};
  const reportType = body.report_type || 'progress';
  const reportDate = body.report_date || new Date().toISOString().split('T')[0];

  // Gather stats
  const totalResumes = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM resumes').first();
  const totalScreening = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'pending'").first();
  const totalApproved = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'approved'").first();
  const totalRejected = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'rejected'").first();
  const totalInterviews = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status IN ('scheduled','completed')").first();
  const totalOnboarding = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE status = 'in_progress'").first();
  const openRequisitions = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'open'").first();

  const stats = {
    report_date: reportDate,
    open_requisitions: openRequisitions?.cnt || 0,
    total_resumes: totalResumes?.cnt || 0,
    pending_screening: totalScreening?.cnt || 0,
    approved_candidates: totalApproved?.cnt || 0,
    rejected_candidates: totalRejected?.cnt || 0,
    active_interviews: totalInterviews?.cnt || 0,
    onboarding_count: totalOnboarding?.cnt || 0,
  };

  // Generate AI summary
  let aiSummary = '';
  try {
    aiSummary = await callAI(c.env,
      '你是招聘数据分析专家。根据招聘统计数据生成一份简洁的日报摘要（中文），包含：整体进展概述、关键指标分析、风险提示、明日建议。控制在300字以内。',
      `日期：${reportDate}\n统计数据：${JSON.stringify(stats, null, 2)}`
    );
  } catch (e: any) {
    aiSummary = '(AI摘要生成失败)';
  }

  const content = JSON.stringify(stats);
  const title = `招聘日报 - ${reportDate}`;
  const id = uuid();

  await c.env.DB.prepare(
    'INSERT INTO daily_reports (id, report_date, report_type, title, content, stats, status, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(id, reportDate, reportType, title, content, aiSummary, 'generated', now()).run();

  const row = await c.env.DB.prepare('SELECT * FROM daily_reports WHERE id = ?').bind(id).first();
  return c.json(transformRow(row));
});

app.delete('/api/daily-reports/:id', authMiddleware, async (c) => {
  await c.env.DB.prepare('DELETE FROM daily_reports WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ detail: 'Report deleted' });
});


// ==================== Feishu Sync ====================

/**
 * 从飞书多维表格同步需求管理数据
 * 表1(tblEiMBFXcvSspQd): 年度招聘需求 → job_requisitions
 * 
 * 字段映射（JSON数组顺序）:
 *   [0]序号 [1]招聘账号 [2]招聘理由 [3]说明 [4]三级部门 [5]招聘岗位
 *   [6]HR二面 [7]招聘JD [8]业务一面 [9]结束招聘 [10]开始招聘 [11]终面
 *   [12]紧急度 [13]城市等级 [14]岗位职责与任职要求 [15]岗位能力维度要求
 *   [16]是否在编制内 [17]二级部门 [18]责任人 [19]招聘进度
 *   [20]岗位能力提取 [21]招聘城市 [22]招聘人数 [23]招聘状态
 */

// ---- 面试官映射：DB 优先，兜底硬编码 ----
async function getInterviewerOpenIds(env: Env): Promise<Record<string, string>> {
  try {
    const rows = await env.DB.prepare('SELECT name, open_id FROM interviewer_mappings ORDER BY name').all();
    if (rows.results && rows.results.length > 0) {
      const map: Record<string, string> = {};
      for (const r of rows.results) {
        if (r.name && r.open_id) map[r.name] = r.open_id;
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch (e: any) {
    // 表可能还不存在，忽略
    console.warn(`[Interviewer] DB read failed, using hardcoded: ${e.message}`);
  }
  return (env.FEISHU_CONFIG as any)?.interviewerOpenIds || FEISHU_CONFIG.interviewerOpenIds || {};
}

async function getInterviewerOpenId(env: Env, name: string): Promise<string> {
  const map = await getInterviewerOpenIds(env);
  return map[name] || FEISHU_CONFIG.defaultHrOpenId || '';
}

async function getFeishuToken(env: Env): Promise<string> {
  const appId = env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
  const appSecret = env.FEISHU_APP_SECRET || FEISHU_CONFIG.appSecret;
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data: any = await resp.json();
  if (!data.tenant_access_token) {
    throw new Error(`Feishu auth failed: ${JSON.stringify(data)}`);
  }
  return data.tenant_access_token;
}

// 通过飞书 API 下载 Bitable 附件
async function downloadFeishuAttachment(env: Env, fileToken: string, feishuDownloadUrl?: string): Promise<Response | null> {
  try {
    const token = await getFeishuToken(env);

    // 方法0：如果有 tmp_url（预签名临时URL），直接尝试不鉴权下载
    if (feishuDownloadUrl && !feishuDownloadUrl.includes('box/stream/download/all')) {
      const tmpResp = await fetch(feishuDownloadUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
      });
      if (tmpResp.ok) {
        const ct = tmpResp.headers.get('Content-Type') || '';
        if (ct && !ct.includes('pdf') && !ct.includes('octet-stream') && !ct.includes('binary')) {
          console.error(`[FeishuAPI] 方法0返回非PDF内容: ${ct}，跳过`);
        } else {
          const headers = new Headers({
            'Content-Type': ct || 'application/pdf',
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return new Response(tmpResp.body, { status: 200, headers });
        }
      }
    }

    // 方法1：用飞书 Open API 的 Drive 下载接口（POST）
    // 设置 Accept: application/json 让 API 返回 JSON 而不是 302 重定向
    const postResp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'manual',  // 不自动跟随重定向，先看 JSON
      }
    );
    const postBody = await postResp.text();
    try {
      const bodyJson = JSON.parse(postBody);
      if (bodyJson.code === 0 && bodyJson.data?.tmp_download_urls?.[0]?.tmp_download_url) {
        const tmpUrl = bodyJson.data.tmp_download_urls[0].tmp_download_url;
        // 用临时 URL 下载实际的 PDF 文件
        const fileResp = await fetch(tmpUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        });
        if (fileResp.ok) {
          const fct = fileResp.headers.get('Content-Type') || 'application/pdf';
          // 缓存到 D1（如果外层调用需要）
          const headers = new Headers({
            'Content-Type': fct,
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return new Response(fileResp.body, { status: 200, headers });
        }
      }
    } catch {}  // JSON 解析失败就继续下一个方法

    // 方法2：Open API GET 方式（同样加 Accept: application/json 防止重定向）
    const getResp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'manual',
      }
    );
    const getBody = await getResp.text();
    try {
      const bodyJson = JSON.parse(getBody);
      if (bodyJson.code === 0 && bodyJson.data?.tmp_download_urls?.[0]?.tmp_download_url) {
        const tmpUrl = bodyJson.data.tmp_download_urls[0].tmp_download_url;
        const fileResp = await fetch(tmpUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        });
        if (fileResp.ok) {
          const fct = fileResp.headers.get('Content-Type') || 'application/pdf';
          const headers = new Headers({
            'Content-Type': fct,
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return new Response(fileResp.body, { status: 200, headers });
        }
      }
    } catch {}

    // 方法3：用 tenant_access_token 调飞书内部下载 URL
    if (feishuDownloadUrl) {
      const internalResp = await fetch(feishuDownloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Referer': `https://ywwlaii6ga7.feishu.cn/`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });
      if (internalResp.ok) {
        const ct = internalResp.headers.get('Content-Type') || '';
        if (ct && !ct.includes('pdf') && !ct.includes('octet-stream') && !ct.includes('binary')) {
          console.error(`[FeishuAPI] 方法3返回非PDF内容: ${ct}，跳过`);
        } else {
          const headers = new Headers({
            'Content-Type': ct || 'application/pdf',
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return new Response(internalResp.body, { status: 200, headers });
        }
      }
      const errText = await internalResp.text().catch(() => '');
      console.error(`[FeishuAPI] internal download status=${internalResp.status} body=${errText.substring(0, 500)}`);

      // 方法3b：仅当 401 时，尝试带 extra 参数的完整 URL
      if (internalResp.status === 401 && feishuDownloadUrl.includes('/download/all/')) {
        // 有些飞书环境需要 extra 参数和 mount_node_token 才能通过 box API 鉴权
        const extraEncoded = encodeURIComponent(JSON.stringify({
          bitablePerm: { tableId: '', attachments: {} }
        }));
        const altUrl = feishuDownloadUrl.includes('?')
          ? feishuDownloadUrl + '&extra=' + extraEncoded
          : feishuDownloadUrl + '?extra=' + extraEncoded;
        const altResp = await fetch(altUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Referer': 'https://ywwlaii6ga7.feishu.cn/',
          },
          redirect: 'follow',
        });
        if (altResp.ok) {
          const ct = altResp.headers.get('Content-Type') || '';
          // 只返回 PDF / 二进制内容，跳过 JSON / HTML
          if (ct && !ct.includes('pdf') && !ct.includes('octet-stream') && !ct.includes('binary')) {
            console.error(`[FeishuAPI] 方法3b返回非PDF内容: ${ct}，跳过`);
          } else {
            const headers = new Headers({
              'Content-Type': ct || 'application/pdf',
              'Content-Disposition': 'inline; filename="resume.pdf"',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600',
            });
            return new Response(altResp.body, { status: 200, headers });
          }
        }
      }
    }

    // 方法4：完整拷贝 Feishu 下载 URL 并代理（不带 Cookie，透传）
    if (feishuDownloadUrl) {
      const rawResp = await fetch(feishuDownloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*',
        },
        redirect: 'follow',
      });
      if (rawResp.ok) {
        const ct = rawResp.headers.get('Content-Type') || '';
        // 只返回 PDF / 二进制内容，跳过 JSON / HTML
        if (ct && !ct.includes('pdf') && !ct.includes('octet-stream') && !ct.includes('binary')) {
          console.error(`[FeishuAPI] 方法4返回非PDF内容: ${ct}，跳过`);
        } else {
          const headers = new Headers({
            'Content-Type': ct || 'application/pdf',
            'Content-Disposition': 'inline; filename="resume.pdf"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return new Response(rawResp.body, { status: 200, headers });
        }
      }
    }

    console.error(`[FeishuAPI] all download methods failed for token=${fileToken}`);
    return null;
  } catch (e: any) {
    console.error(`[FeishuAPI] download attachment error: ${e.message}`);
    return null;
  }
}

async function getFieldMeta(env: Env, token: string, tableId: string): Promise<any[]> {
  try {
    const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await resp.json();
    if (data.data && data.data.items) {
      return data.data.items;
    }
    // 如果获取 fields 失败（如权限不够），从记录中推断字段名
    console.warn(`getFieldMeta fallback: ${JSON.stringify(data)}`);
    const records = await getBitableRecords(env, token, tableId);
    if (records.length > 0) {
      return Object.keys(records[0].fields || {}).map(name => ({ field_name: name }));
    }
    return [];
  } catch (err) {
    console.warn(`getFieldMeta error: ${err}`);
    return [];
  }
}

async function getBitableRecords(env: Env, token: string, tableId: string): Promise<any[]> {
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const allRecords: any[] = [];
  let pageToken: string | null = null;

  do {
    let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await resp.json();
    if (!data.data) {
      throw new Error(`Failed to get records: ${JSON.stringify(data)}`);
    }
    allRecords.push(...(data.data.items || []));
    pageToken = data.data.page_token || null;
    if (!data.data.has_more) break;
  } while (pageToken);

  return allRecords;
}

// ==================== Feishu Card Helpers ====================

/** 构建审核卡片内容（含 ✅入库 / ❌淘汰 按钮） */
function buildScreeningCardContent(record: any, analysis: string, matchScore: number): any {
  const name = record.candidate_name || '未知';
  const posName = record.mapped_position || record.position_applied?.split('_')[0] || '未知岗位';
  const age = record.age || '未知';
  const gender = record.gender || '未知';
  const edu = record.education || '未知';
  const city = record.city || '未知';
  const displayAnalysis = (analysis || 'AI 分析进行中...').substring(0, 3500);

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🤖 候选人 ${name}` },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**以下为候选人的 ${posName} 岗位能力评估，AI 生成，仅供参考。**` }
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `📌 **面试岗位：** ${record.position_applied || '未知'}`,
            `🏢 **招聘岗位：** ${posName}`,
            `👤 **年龄：** ${age} | **性别：** ${gender} | **学历：** ${edu} | **城市：** ${city}`,
            `⭐ **匹配分数：** ${matchScore}/5`
          ].join('\n')
        }
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: displayAnalysis }
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '✅ 入库' },
            type: 'primary',
            value: { action: 'store', record_id: record.id, name: name }
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '❌ 淘汰' },
            type: 'danger',
            value: { action: 'discard', record_id: record.id, name: name }
          }
        ]
      }
    ]
  };
}

/** 已入库绿色卡片 */
function buildApprovedCardContent(name: string, posName: string): any {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `✅ 已入库: ${name} (${posName})` },
      template: 'green'
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: `候选人 **${name}** 经过 AI 评估后已被 HR 确认入库。` } },
      { tag: 'hr' },
      { tag: 'note', elements: [{ tag: 'plain_text', content: '此候选人已进入人才库，面试官可查看详情安排面试。' }] }
    ]
  };
}

/** 已淘汰红色卡片 */
function buildRejectedCardContent(name: string, posName: string): any {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `❌ 已淘汰: ${name} (${posName})` },
      template: 'red'
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: `候选人 **${name}** 经过 AI 评估后已被 HR 淘汰。` } },
      { tag: 'hr' },
      { tag: 'note', elements: [{ tag: 'plain_text', content: '此候选人不建议进入后续流程。' }] }
    ]
  };
}

/** 发送审核卡片给指定审核人，返回 message_id */
async function sendFeishuCard(env: Env, record: any, analysis: string, matchScore: number): Promise<string | null> {
  const openId = FEISHU_CONFIG.reviewerOpenId;
  if (!openId) return null;

  const token = await getFeishuToken(env);
  const cardContent = buildScreeningCardContent(record, analysis, matchScore);

  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify(cardContent)
    })
  });
  const data: any = await resp.json();
  if (data.code !== 0) {
    console.error(`[FeishuCard] 发送失败: ${JSON.stringify(data)}`);
    return null;
  }
  return data.data?.message_id || null;
}

/** 更新审核卡片颜色 */
async function updateFeishuCard(env: Env, messageId: string, status: string, name: string): Promise<void> {
  const token = await getFeishuToken(env);
  const cardContent = status === 'approved'
    ? buildApprovedCardContent(name, '')
    : buildRejectedCardContent(name, '');

  const resp = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'interactive',
      content: JSON.stringify(cardContent)
    })
  });
  const data: any = await resp.json();
  if (data.code !== 0) console.error(`[FeishuCard] 更新失败: ${JSON.stringify(data)}`);
}

/** 上传文件到飞书云盘 */
async function uploadToFeishuDrive(token: string, fileName: string, fileBytes: ArrayBuffer, parentNode: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'explorer');
    formData.append('parent_node', parentNode);
    formData.append('size', String(fileBytes.byteLength));
    const blob = new Blob([fileBytes]);
    formData.append('file', blob, fileName);

    const resp = await fetch('https://open.feishu.cn/open-apis/drive/v1/files/upload_all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data: any = await resp.json();
    if (data.code !== 0) throw new Error(JSON.stringify(data));
    return data.data.file_token;
  } catch (e: any) {
    console.error(`[Drive] 上传失败: ${e.message}`);
    return null;
  }
}

/** 在飞书多维表格创建记录 */
async function createFeishuBitableRecord(token: string, appToken: string, tableId: string, fields: any): Promise<string | null> {
  try {
    const resp = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    const data: any = await resp.json();
    if (data.code !== 0) throw new Error(JSON.stringify(data));
    return data.data.record.record_id;
  } catch (e: any) {
    console.error(`[Bitable] 创建记录失败: ${e.message}`);
    return null;
  }
}

/** 推送候选人到招聘群 */
async function pushCandidateToGroup(env: Env, record: any): Promise<void> {
  const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
  if (!chatId || !record) return;

  try {
    const token = await getFeishuToken(env);
    const posName = record.mapped_position || record.position_applied?.split('_')[0] || '未知岗位';
    const analysis = (record.ai_analysis || '').substring(0, 800);
    const posNameShort = posName.length > 20 ? posName.substring(0, 20) + '…' : posName;

    const cardContent = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `🆕 新候选人: ${record.candidate_name}` },
        template: 'indigo'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**姓名：** ${record.candidate_name}\n**岗位：** ${posName}\n**年龄：** ${record.age || '未知'} | **学历：** ${record.education || '未知'}\n**城市：** ${record.city || '未知'}\n**匹配度：** ${record.match_score || '-'}/5`
          }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `**AI 评估摘要：**\n${analysis || '（无分析内容）'}` }
        },
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `系统自动推送 | ${new Date().toLocaleString('zh-CN')}` }]
        }
      ]
    };

    await sendFeishuMessageToChat(token, chatId, cardContent);
    console.log(`[GroupPush] ✅ 已推送 ${record.candidate_name} 到招聘群`);
  } catch (e: any) {
    console.error(`[GroupPush] 推送失败: ${e.message}`);
  }
}

// ==================== 卡片回调 Endpoint ====================

/**
 * 飞书卡片按钮回调 Webhook
 * POST /api/feishu/card-action
 * 配置：飞书开发者后台 → 应用 → 卡片 → 卡片回调配置
 */
app.post('/api/feishu/card-action', async (c) => {
  try {
    const body: any = await c.req.json();
    const action = body?.action;
    if (!action?.value) {
      return c.json({ code: 0, msg: 'success', data: { toast: { type: 'error', content: '无效数据' } } });
    }

    const v = action.value;
    const actionType = v.action; // 'store' | 'discard'
    const recordId = v.record_id;
    const candidateName = v.name || '未知';

    console.log(`[CardCallback] ${actionType} - ${candidateName} (${recordId})`);

    const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(recordId).first() as any;
    if (!record) {
      return c.json({ code: 0, msg: 'success', data: { toast: { type: 'error', content: '记录不存在' } } });
    }
    if (record.status !== 'pending') {
      return c.json({ code: 0, msg: 'success', data: { toast: { type: 'warning', content: '已处理过' } } });
    }

    await c.env.DB.prepare(
      "UPDATE resume_screening_queue SET status = 'processing', feishu_processed_at = ? WHERE id = ?"
    ).bind(now(), recordId).run();

    const posName = record.mapped_position || record.position_applied?.split('_')[0] || '未知岗位';

    if (actionType === 'store') {
      // ✅ 入库
      c.executionCtx.waitUntil((async () => {
        try {
          const token = await getFeishuToken(c.env);
          const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
          const talentTableId = c.env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;

          // 上传简历到 Drive（如果有 resume_id 且有文件路径）
          let fileToken: string | null = null;
          if (record.resume_id && FEISHU_CONFIG.driveFolderToken) {
            const resume = await c.env.DB.prepare('SELECT file_path, raw_text FROM resumes WHERE id = ?').bind(record.resume_id).first() as any;
            // 简单场景：仅记录 file info，实际上传需文件 URL
          }

          // 写飞书多维表格（人才库表）
          const bitableFields: any = {
            '姓名': record.candidate_name || '未知',
            '年龄': record.age || null,
            '性别': record.gender || null,
            '学历': record.education || null,
            '面试岗位': record.position_applied || null,
            '招聘岗位': posName,
            '城市': record.city || null,
            'AI简历评估': record.ai_analysis || '',
            'AI简历初筛结果': '已入库',
          };
          await createFeishuBitableRecord(token, appToken, talentTableId, bitableFields);

          // 更新 D1 状态
          await c.env.DB.prepare(
            "UPDATE resume_screening_queue SET status = 'approved', ai_result = 'shortlisted', updated_at = ? WHERE id = ?"
          ).bind(now(), recordId).run();

          // 更新卡片为绿色
          if (record.feishu_card_msg_id) {
            await updateFeishuCard(c.env, record.feishu_card_msg_id, 'approved', candidateName);
          }

          // 推送候选人到招聘群
          const updated = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(recordId).first() as any;
          await pushCandidateToGroup(c.env, updated);

          console.log(`[CardCallback] ✅ ${candidateName} 已入库`);
        } catch (e: any) {
          console.error(`[CardCallback] 入库异常: ${e.message}`);
          await c.env.DB.prepare("UPDATE resume_screening_queue SET status = 'pending' WHERE id = ?").bind(recordId).run();
        }
      })());

      return c.json({
        code: 0, msg: 'success',
        data: { toast: { type: 'success', content: `${candidateName} 正在入库...` } }
      });

    } else {
      // ❌ 淘汰
      c.executionCtx.waitUntil((async () => {
        try {
          const token = await getFeishuToken(c.env);
          await c.env.DB.prepare(
            "UPDATE resume_screening_queue SET status = 'rejected', ai_result = 'rejected', updated_at = ? WHERE id = ?"
          ).bind(now(), recordId).run();

          if (record.feishu_card_msg_id) {
            await updateFeishuCard(c.env, record.feishu_card_msg_id, 'rejected', candidateName);
          }
        } catch (e: any) {
          console.error(`[CardCallback] 淘汰异常: ${e.message}`);
          await c.env.DB.prepare("UPDATE resume_screening_queue SET status = 'pending' WHERE id = ?").bind(recordId).run();
        }
      })());

      return c.json({
        code: 0, msg: 'success',
        data: { toast: { type: 'success', content: `${candidateName} 已淘汰` } }
      });
    }
  } catch (err: any) {
    console.error(`[CardCallback] 错误: ${err.message}`);
    return c.json({ code: 0, msg: 'success', data: { toast: { type: 'error', content: '服务器错误' } } });
  }
});

// ==================== 事件回调 Endpoint ====================

/**
 * 飞书事件回调（URL 验证 + 群消息/菜单事件）
 * POST /api/feishu/event-callback
 */
app.post('/api/feishu/event-callback', async (c) => {
  try {
    const body: any = await c.req.json();
    if (body.type === 'url_verification') {
      return c.json({ challenge: body.challenge });
    }

    const header = body.header;
    const eventType = header?.event_type;
    const event = body.event || {};

    if (eventType === 'im.message.receive_v1') {
      const message = event.message || {};
      const sender = event.sender || {};
      const chatType = message.chat_type;
      const msgType = message.msg_type;
      const msgId = message.message_id;
      const chatId = message.chat_id;
      const textContent = message.content ? (() => {
        try { return JSON.parse(message.content); } catch { return { text: message.content }; }
      })() : {};

      const replyText = async (text: string) => {
        try {
          const token = await getFeishuToken(c.env);
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msgId}/reply`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: JSON.stringify({ text }), msg_type: 'text' })
          });
        } catch {}
      };

      if (chatType === 'group' && msgType === 'text') {
        const msgText = textContent.text || '';

        // 解析群内面试评价: "评价张三 沟通4 专业3"
        const evalMatch = msgText.match(/评价(.+?)\s*(?:沟通|协调|专业|技术|管理|团队|表达|学习)(?:能力)?(\d+)/);
        if (evalMatch) {
          const name = evalMatch[1].trim();
          const score = parseInt(evalMatch[2]);
          await c.env.DB.prepare(
            `INSERT INTO department_reviews (id, candidate_name, reviewer_id, reviewer_name, score, comment, is_completed, created_at)
             VALUES (?,?,?,?,?,?,?,?)`
          ).bind(uuid(), name, sender.sender_id?.open_id || 'unknown', sender.sender_id?.open_id || 'unknown', score, msgText, 1, now()).run();
          await replyText(`✅ 已记录对 ${name} 的评价`);
        }

        // 统计指令
        if (msgText.includes('统计') || msgText.includes('进度')) {
          const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first() as any;
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first() as any;
          const approved = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first() as any;
          await replyText(
            `📊 招聘统计\n人才库: ${total?.c || 0} 人\n待审核: ${pending?.c || 0} 人\n今日入库: ${approved?.c || 0} 人`
          );
        }

        // 帮助
        if (msgText.includes('帮助') || msgText.includes('help') || msgText.includes('功能')) {
          await replyText(
            `🤖 招聘助手可用功能：\n` +
            `• 评价[姓名] [能力][分数] — 面试评价\n` +
            `• 统计/进度 — 查看招聘数据\n` +
            `• 帮助/help — 显示此帮助`
          );
        }
      } else if (chatType === 'p2p' && msgType === 'text') {
        const msgText = textContent.text || '';
        if (msgText.includes('统计') || msgText.includes('进度')) {
          const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first() as any;
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first() as any;
          await replyText(`📊 招聘统计\n人才库: ${total?.c || 0} 人\n待审核: ${pending?.c || 0} 人`);
        } else {
          await replyText(`🤖 你好！我是招聘助手。\n在群中 @我 可进行面试评价或查看统计数据。`);
        }
      }
      return c.json({ code: 0, msg: 'success' });
    }

    if (eventType === 'im.menu.action') {
      const menuValue = event?.action?.value;
      const chatId = event?.chat_id;
      const openId = event?.operator?.operator_id?.open_id;
      console.log(`[Bot] 菜单点击: ${menuValue}`);

      // 回复菜单操作结果
      if (menuValue && chatId) {
        const reply = async (text: string) => {
          try {
            const token = await getFeishuToken(c.env);
            const cardContent = {
              config: { wide_screen_mode: true },
              header: { title: { tag: 'plain_text', content: '🤖 招聘助手' }, template: 'blue' },
              elements: [{ tag: 'div', text: { tag: 'lark_md', content: text } }]
            };
            await sendFeishuMessageToChat(token, chatId, cardContent);
          } catch {}
        };

        switch (menuValue) {
          case 'pending_list':
            const pending = await c.env.DB.prepare("SELECT candidate_name, position_applied FROM resume_screening_queue WHERE status='pending' LIMIT 10").all() as any;
            const names = (pending.results || []).map((r: any) => `• ${r.candidate_name} - ${r.position_applied || '未知'}`).join('\n') || '暂无';
            await reply(`📋 **待审核列表**\n${names}`);
            break;
          case 'stats_progress':
            const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first() as any;
            const pend = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first() as any;
            const appr = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first() as any;
            await reply(`📊 **招聘进度**\n人才库: ${total?.c || 0} 人\n待审核: ${pend?.c || 0} 人\n已入库: ${appr?.c || 0} 人`);
            break;
          case 'help':
            await reply(`🤖 **招聘助手功能**\n• 评价[姓名] [能力][分数]\n• 统计查看数据\n• @我使用`);
            break;
          default:
            await reply(`收到指令: ${menuValue}`);
        }
      }
      return c.json({ code: 0, msg: 'success' });
    }

    return c.json({ code: 0, msg: 'success' });
  } catch {
    return c.json({ code: 0, msg: 'success' });
  }
});

// ==================== Cron 定时任务 Endpoints ====================

/**
 * 日报生成与推送
 * POST /api/cron/daily-report
 * （可由 wrangler cron 或外部定时服务触发）
 */
app.post('/api/cron/daily-report', async (c) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // 统计今日数据
    const todayStart = `${dateStr} 00:00:00`;
    const todayEnd = `${dateStr} 23:59:59`;

    const newCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE created_at >= ? AND created_at <= ?"
    ).bind(todayStart, todayEnd).first() as any;

    const approvedCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'approved' AND updated_at >= ? AND updated_at <= ?"
    ).bind(todayStart, todayEnd).first() as any;

    const rejectedCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'rejected' AND updated_at >= ? AND updated_at <= ?"
    ).bind(todayStart, todayEnd).first() as any;

    const pendingCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'pending'"
    ).first() as any;

    const talentCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM talent_pool"
    ).first() as any;

    // 推送到招聘群
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId) {
      const token = await getFeishuToken(c.env);
      const cardContent = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: `📊 招聘日报 ${dateStr}` },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: [
                `📅 **日期：** ${dateStr}`,
                '',
                `**📋 今日数据**`,
                `新进初筛：**${newCount?.c || 0}** 人`,
                `已入库：**${approvedCount?.c || 0}** 人`,
                `已淘汰：**${rejectedCount?.c || 0}** 人`,
                '',
                `**📦 累计数据**`,
                `待审核：**${pendingCount?.c || 0}** 人`,
                `人才库总数：**${talentCount?.c || 0}** 人`,
              ].join('\n')
            }
          },
          { tag: 'hr' },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: `系统自动生成 | ${today.toLocaleString('zh-CN')}` }]
          }
        ]
      };
      await sendFeishuMessageToChat(token, chatId, cardContent);
    }

    return c.json({
      ok: true,
      data: {
        date: dateStr,
        new: newCount?.c || 0,
        approved: approvedCount?.c || 0,
        rejected: rejectedCount?.c || 0,
        pending: pendingCount?.c || 0,
        talentPool: talentCount?.c || 0,
      }
    });
  } catch (err: any) {
    return c.json({ ok: false, detail: `生成日报失败: ${err.message}` }, 500);
  }
});

/**
 * 面试提醒
 * POST /api/cron/interview-reminder
 */
app.post('/api/cron/interview-reminder', async (c) => {
  try {
    const pending = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'pending'"
    ).first() as any;

    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId && (pending?.c || 0) > 0) {
      const token = await getFeishuToken(c.env);
      const cardContent = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: `⏰ 面试提醒` },
          template: 'orange'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `当前还有 **${pending.c}** 位候选人待审核处理，请及时安排面试。`
            }
          },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: `系统自动提醒 | ${new Date().toLocaleString('zh-CN')}` }]
          }
        ]
      };
      await sendFeishuMessageToChat(token, chatId, cardContent);
    }

    return c.json({ ok: true, pending: pending?.c || 0 });
  } catch (err: any) {
    return c.json({ ok: false, detail: `发送提醒失败: ${err.message}` }, 500);
  }
});

/**
 * 构建面试官通知卡片 — 提醒面试官审阅新候选人
 */
function buildInterviewerCard(name: string, position: string, city: string, analysis: string): any {
  const summary = (analysis || '').substring(0, 500);
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `🆕 新候选人待审阅: ${name}` },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**候选人：** ${name}\n**岗位：** ${position}\n**城市：** ${city || '未知'}` }
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: summary || '（无 AI 分析内容）' }
      },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: '请在系统中查看完整评估并进行面试安排。' }]
      }
    ]
  };
}

/** 发送消息到飞书群 */
async function sendFeishuMessageToChat(token: string, chatId: string, cardContent: any): Promise<any> {
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(cardContent)
    })
  });
  const data: any = await resp.json();
  if (data.code !== 0) throw new Error(`发送群消息失败: ${JSON.stringify(data)}`);
  return data.data;
}

/** 发送消息给指定用户（通过 open_id） */
async function sendFeishuMessageToUser(token: string, openId: string, cardContent: any): Promise<any> {
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify(cardContent)
    })
  });
  const data: any = await resp.json();
  if (data.code !== 0) throw new Error(`发送用户消息失败: ${JSON.stringify(data)}`);
  return data.data;
}

/** 通知候选人对应的面试官 */
async function notifyInterviewersForCandidate(env: Env, token: string, record: any): Promise<void> {
  const posName = record.mapped_position || record.position_applied?.split('_')[0] || '未知岗位';
  try {
    // 查找匹配的招聘任务
    const tasks = await env.DB.prepare(
      "SELECT * FROM recruitment_tasks WHERE position_name LIKE ? LIMIT 5"
    ).bind(`%${posName}%`).all() as any;
    const taskList = (tasks.results || []);

    if (taskList.length === 0) {
      console.log(`[NotifyInterviewers] 未找到 ${posName} 的招聘任务，通知默认 HR`);
      // 兜底：通知默认 HR
      const defaultOpenId = FEISHU_CONFIG.defaultHrOpenId;
      if (defaultOpenId) {
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis);
        await sendFeishuMessageToUser(token, defaultOpenId, cardContent);
        console.log(`[NotifyInterviewers] ✅ 已通知默认 HR (${defaultOpenId})`);
      }
      return;
    }

    // 收集需要通知的面试官
    const notifiedNames = new Set<string>();

    for (const task of taskList) {
      // 提取面试官列表
      let interviewers: string[] = [];
      try {
        if (typeof task.interviewers === 'string') {
          interviewers = JSON.parse(task.interviewers);
        } else if (Array.isArray(task.interviewers)) {
          interviewers = task.interviewers;
        }
      } catch {}

      // 加上责任人
      if (task.responsible_person && !interviewers.includes(task.responsible_person)) {
        interviewers.push(task.responsible_person);
      }

      for (const name of interviewers) {
        if (notifiedNames.has(name) || !name) continue;
        notifiedNames.add(name);

        // 查 open_id 映射（DB 优先），未找到则用兜底 HR open_id
        const openId = await getInterviewerOpenId(env, name);

        // 发送卡片
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis);
        await sendFeishuMessageToUser(token, openId, cardContent);
        console.log(`[NotifyInterviewers] ✅ 已通知 ${name} (${openId}) - ${record.candidate_name}`);
      }
    }
  } catch (e: any) {
    console.error(`[NotifyInterviewers] 通知失败: ${e.message}`);
  }
}

// ==================== 通知面试官 Endpoint ====================

/**
 * 提醒面试官：查找招聘任务中的对应面试官并发送通知
 * POST /api/resume-screening/:id/notify-interviewers
 */
app.post('/api/resume-screening/:id/notify-interviewers', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const record = await c.env.DB.prepare('SELECT * FROM resume_screening_queue WHERE id = ?').bind(id).first() as any;
  if (!record) return c.json({ detail: '记录不存在' }, 404);

  try {
    const token = await getFeishuToken(c.env);
    await notifyInterviewersForCandidate(c.env, token, record);
    return c.json({ ok: true, message: `已通知对应面试官: ${record.candidate_name}` });
  } catch (err: any) {
    return c.json({ detail: `通知失败: ${err.message}` }, 500);
  }
});

// ==================== 飞书事件回调（仅用于 URL 验证）====================

// ==================== Root ====================

// Root path serves static index.html via ASSETS fallback
app.get('/api', (c) => c.json({ status: 'ok', service: 'ai-interview-api' }));

// ==================== Static Asset Fallback (for Pages _worker.js mode) ====================

app.notFound((c) => {
  // API 路由返回 JSON
  if (c.req.path.startsWith('/api/')) {
    return c.json({ detail: 'Not found' }, 404);
  }
  // 非 API 路由 → 委托 ASSETS 处理（SPA 路由由 index.html 兜底）
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export default app;
