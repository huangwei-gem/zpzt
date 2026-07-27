/**
 * 批量缓存简历 PDF 到 D1（纯 HTTP 方案，不依赖 wrangler CLI）
 * 1. 直接用飞书 API 下载所有简历 PDF
 * 2. 通过 Worker API 逐个写入 D1
 * 
 * 使用前需要先登录系统获取 JWT token
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '_pdf_cache');

const FEISHU_CONFIG = {
  appId: 'cli_aace77019aba9cdb',
  appSecret: 'ii2lYil9d5PXViTTjYlzaddB6YKuL25T',
  appToken: 'NVh9bDiNRaF0ZysxjeLc5ID2n9c',
  talentTableId: 'tblWkwsoTIPhzusI',
};

// Worker API 地址（生产环境）
const API_BASE = 'https://ai-interview-22u.pages.dev';

async function getFeishuToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_CONFIG.appId, app_secret: FEISHU_CONFIG.appSecret }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取 token 失败: ${JSON.stringify(data)}`);
  return data.tenant_access_token;
}

async function listAllRecords(token) {
  let allRecords = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (pageToken) params.set('page_token', pageToken);
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.appToken}/tables/${FEISHU_CONFIG.talentTableId}/records?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json();
    if (data.code !== 0) throw new Error(`查询 Bitable 失败: ${JSON.stringify(data)}`);
    allRecords = allRecords.concat(data.data?.items || []);
    pageToken = data.data?.has_more ? data.data?.page_token : null;
  } while (pageToken);
  return allRecords;
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

async function downloadFile(token, fileToken, tmpUrl) {
  // 优先用 tmp_url（预签名链接）
  if (tmpUrl && !tmpUrl.includes('box/stream/download/all')) {
    const resp = await fetch(tmpUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
      if (header.startsWith('%PDF') && buf.byteLength > 100) return buf;
    }
  }

  // 方法2：Drive API POST 获取临时下载链接
  const postResp = await fetch(
    `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'manual',
    }
  );
  if (postResp.ok) {
    const postData = await postResp.json();
    if (postData.code === 0 && postData.data?.tmp_download_urls?.[0]?.tmp_download_url) {
      const dlUrl = postData.data.tmp_download_urls[0].tmp_download_url;
      const fileResp = await fetch(dlUrl, { redirect: 'follow' });
      if (fileResp.ok) {
        const buf = await fileResp.arrayBuffer();
        const header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
        if (header.startsWith('%PDF') && buf.byteLength > 100) return buf;
      }
    }
  }

  // 方法3：box API（带 mount_point）
  const boxUrl = `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${FEISHU_CONFIG.appToken}&mount_point=bitable`;
  const boxResp = await fetch(boxUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0',
      'Referer': `https://ywwlaii6ga7.feishu.cn/`,
    },
    redirect: 'follow',
  });
  if (boxResp.ok) {
    const buf = await boxResp.arrayBuffer();
    const header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));
    if (header.startsWith('%PDF') && buf.byteLength > 100) return buf;
  }

  return null;
}

async function writeToD1ViaAPI(recordId, candidateName, fileToken, buf) {
  const b64 = Buffer.from(buf).toString('base64');
  const now = new Date().toISOString();
  
  // 通过 Worker 的 cache-file API 写入（无认证版本，使用 secret token）
  // 直接用 D1 SQL API 不现实，我们直接把数据存为 SQL 文件，让用户手动执行
  // 或者等部署完成后，通过登录态调用 /api/resumes/cache-files
  
  // 生成 SQL
  const safeName = (candidateName || 'resume').replace(/'/g, "''");
  const safeB64 = b64.replace(/'/g, "''");
  return `INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES ('${recordId.replace(/'/g, "''")}', 'http_cache_${fileToken}', '${safeName}.pdf', ${buf.byteLength}, '${safeB64}', '${now}');\n`;
}

async function main() {
  console.log('=== 批量缓存简历 PDF（纯 HTTP 方案）===\n');
  
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  console.log('[1] 获取飞书 token...');
  const token = await getFeishuToken();
  console.log('  ✅\n');

  console.log('[2] 查询人才库 Bitable...');
  const allRecords = await listAllRecords(token);
  console.log(`  ✅ ${allRecords.length} 条\n`);

  console.log('[3] 筛选有附件的记录...');
  const files = [];
  for (const record of allRecords) {
    const info = findFileInfo(record);
    if (info) {
      files.push({ recordId: record.record_id, candidateName: record.fields?.['姓名'] || 'resume', ...info });
    }
  }
  console.log(`  ✅ ${files.length} 条有附件\n`);

  if (files.length === 0) { console.log('没有需要缓存的附件'); return; }

  console.log('[4] 下载并生成 SQL...');
  let sqlContent = '-- 简历 PDF 缓存 SQL（由 cache-resumes-http.mjs 生成）\n';
  sqlContent += `-- 生成时间: ${new Date().toISOString()}\n`;
  sqlContent += `-- 共 ${files.length} 个文件\n\n`;
  
  // 先删旧数据再插入（避免重复）
  sqlContent += "DELETE FROM resume_files WHERE kv_key LIKE 'http_cache_%';\n\n";

  let success = 0, fail = 0;
  for (let i = 0; i < files.length; i++) {
    const r = files[i];
    process.stdout.write(`  [${i + 1}/${files.length}] ${r.fileName?.substring(0, 36) || 'unknown'}... `);
    
    const buf = await downloadFile(token, r.fileToken, r.tmpUrl);
    if (buf) {
      const line = await writeToD1ViaAPI(r.recordId, r.candidateName, r.fileToken, buf);
      sqlContent += line;
      process.stdout.write(`✅ ${(buf.byteLength / 1024).toFixed(0)}KB\n`);
      success++;
    } else {
      process.stdout.write('❌ 下载失败\n');
      fail++;
    }
  }

  // 写入 SQL 文件
  const sqlFile = join(CACHE_DIR, 'cache_resumes.sql');
  writeFileSync(sqlFile, sqlContent);
  console.log(`\n✅ SQL 文件已保存: ${sqlFile}`);
  console.log(`   ${success} 条成功, ${fail} 条失败`);

  console.log('\n[5] 下一步操作：');
  console.log('   方式A：登录系统后访问页面，触发自动缓存');
  console.log('   方式B：在 Cloudflare Dashboard → D1 → ai-interview-db → 执行 SQL');
  console.log(`          导入 ${sqlFile} 中的 SQL`);
  console.log('   方式C：等待 CI/CD 部署完成后，在浏览器中：');
  console.log('          1. 登录 https://ai-interview-22u.pages.dev');
  console.log('          2. 打开控制台，执行：');
  console.log('             fetch("/api/resumes/cache-files", { method: "POST", headers: { Authorization: "Bearer " + localStorage.getItem("token") } }).then(r => r.json()).then(console.log)');
}

main().catch(e => { console.error('异常:', e); process.exit(1); });
