/**
 * 批量缓存简历 PDF 到 D1（生成不含 TRANSACTION 的 SQL 文件）
 */
import { execSync } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = join(__dirname, '..', 'worker');
const ROOT_DIR = join(__dirname, '..');

const FEISHU_CONFIG = {
  appId: 'cli_aace77019aba9cdb',
  appSecret: 'ii2lYil9d5PXViTTjYlzaddB6YKuL25T',
  appToken: 'NVh9bDiNRaF0ZysxjeLc5ID2n9c',
  talentTableId: 'tblWkwsoTIPhzusI',
};

async function getFeishuToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_CONFIG.appId, app_secret: FEISHU_CONFIG.appSecret }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取 token 失败: ${JSON.stringify(data)}`);
  return data.tenant_access_token;
}

async function listRecords(token, pageToken = null) {
  const params = new URLSearchParams({ page_size: '100' });
  if (pageToken) params.set('page_token', pageToken);
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.appToken}/tables/${FEISHU_CONFIG.talentTableId}/records?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`查询 Bitable 失败: ${JSON.stringify(data)}`);
  return data.data;
}

function findFileInfo(record) {
  for (const [key, val] of Object.entries(record.fields || {})) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item?.file_token) return { fileToken: item.file_token, tmpUrl: item.tmp_url, fileName: item.name || key };
      }
    }
  }
  return null;
}

async function main() {
  console.log('=== 简历 PDF 批量缓存工具 ===\n');
  
  console.log('[1] 获取飞书 token...');
  const token = await getFeishuToken();
  console.log('  ✅\n');

  console.log('[2] 查询人才库 Bitable...');
  let allRecords = [];
  let pageToken = null;
  do {
    const data = await listRecords(token, pageToken);
    allRecords = allRecords.concat(data.items || []);
    pageToken = data.has_more ? data.page_token : null;
  } while (pageToken);
  console.log(`  ✅ ${allRecords.length} 条\n`);

  console.log('[3] 筛选有附件的记录...');
  const files = [];
  for (const record of allRecords) {
    const info = findFileInfo(record);
    if (info) files.push({ recordId: record.record_id, ...info });
  }
  console.log(`  ✅ ${files.length} 条有附件\n`);
  if (files.length === 0) return;

  console.log('[4] 下载文件...');
  let batchNum = 0;
  let recordsInBatch = 0;
  let totalInserted = 0;
  let totalFailed = 0;

  // 先检查已有缓存
  const existing = execSync('wrangler d1 execute ai-interview-db --remote --command "SELECT id FROM resume_files"', {
    cwd: WORKER_DIR, encoding: 'utf-8', timeout: 30000,
  });
  const existingIds = new Set();
  try {
    const json = JSON.parse(existing.match(/\[[\s\S]*\]/)?.[0] || '[]');
    const results = json[0]?.results || [];
    results.forEach((r) => existingIds.add(r.id));
  } catch {}
  console.log(`  已有 ${existingIds.size} 条缓存\n`);

  for (let i = 0; i < files.length; i++) {
    const r = files[i];
    if (existingIds.has(r.recordId)) {
      process.stdout.write(`  [${i+1}/${files.length}] ${r.fileName.substring(0, 36)}... ⏭️ 已缓存\n`);
      continue;
    }

    process.stdout.write(`  [${i+1}/${files.length}] ${r.fileName.substring(0, 36)}... `);

    const batchUrl = r.tmpUrl + '&file_tokens=' + r.fileToken;
    const resp = await fetch(batchUrl, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    if (json.code !== 0 || !json.data?.tmp_download_urls?.[0]?.tmp_download_url) {
      process.stdout.write('❌\n'); totalFailed++; continue;
    }
    const downloadUrl = json.data.tmp_download_urls[0].tmp_download_url;
    const fileResp = await fetch(downloadUrl, { redirect: 'follow' });
    if (!fileResp.ok) { process.stdout.write(`❌ ${fileResp.status}\n`); totalFailed++; continue; }
    
    const buf = await fileResp.arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
    if (!header.startsWith('%PDF') || buf.byteLength < 100) { process.stdout.write(`❌ 非PDF\n`); totalFailed++; continue; }

    const b64 = Buffer.from(buf).toString('base64');
    const fn = r.fileName.replace(/'/g, "''");
    const rid = r.recordId.replace(/'/g, "''");
    const sql = `INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES ('${rid}', 'script_cache_${rid}', '${fn}', ${buf.byteLength}, '${b64.replace(/'/g, "''")}', datetime('now'));`;
    
    // 每条记录单独一个 SQL 文件（D1 有 SQL 长度限制）
    batchNum++;
    const batchFile = join(WORKER_DIR, `_cache_${batchNum}.sql`);
    writeFileSync(batchFile, sql);
    process.stdout.write(`✅ ${(buf.byteLength / 1024).toFixed(0)}KB\n`);
    totalInserted++;
  }

  console.log(`\n[5] 写入 D1...`);
  let d1Success = 0, d1Fail = 0;
  for (let b = 1; b <= batchNum; b++) {
    const batchFile = join(WORKER_DIR, `_cache_${b}.sql`);
    process.stdout.write(`  Batch ${b}/${batchNum}... `);
    try {
      const out = execSync(`wrangler d1 execute ai-interview-db --remote --file "_cache_${b}.sql"`, {
        cwd: WORKER_DIR, encoding: 'utf-8', timeout: 120000,
      });
      process.stdout.write(`✅\n`);
      d1Success++;
    } catch (e) {
      process.stdout.write(`❌ ${e.stderr?.substring(0, 100) || e.message}\n`);
      d1Fail++;
    }
    // 清理
    try { unlinkSync(batchFile); } catch {}
  }

  console.log(`\n=== 完成 ===`);
  console.log(`✅ D1 写入: ${d1Success} 批次`);
  console.log(`❌ 失败: ${d1Fail} 批次, ${totalFailed} 条下载失败`);
  console.log(`📊 本次新增: ${totalInserted} 条`);
}

main().catch(e => { console.error('异常:', e); process.exit(1); });
