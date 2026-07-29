const BASE = 'https://39a6a9df.ai-interview-22u.pages.dev';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkBleGFtcGxlLmNvbSIsImV4cCI6MTc4Nzg0MjAzOX0.bv7zJ69qwwnZblxPzNGOuXNbmdypH6wKyBL6A-JByDQ';
const H = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function test(name, url, opts = {}) {
  try {
    const res = await fetch(BASE + url, { headers: H, ...opts });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    const count = Array.isArray(data) ? data.length : data?.data?.length ?? data?.total ?? data?.overview ? 'ok' : '?';
    console.log(`${res.status === 200 ? '✅' : '❌'} ${name}: ${res.status} ${typeof count === 'number' ? count + '条' : count}`);
    if (res.status !== 200) console.log(`   ${text.slice(0, 100)}`);
    return data;
  } catch(e) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

(async () => {
  console.log('========== API 全面测试 ==========\n');
  await test('1. 用户管理', '/api/auth/users');
  await test('2. 仪表盘', '/api/dashboard/overview');
  await test('3. 简历管理', '/api/resumes?page=1&page_size=3');
  await test('4. 面试管理', '/api/interviews?page=1&page_size=3');
  await test('5. 候选人流水线(修复)', '/api/interviews/pipeline-candidates');
  await test('6. 岗位管理', '/api/positions?page=1&page_size=3');
  await test('7. 需求管理', '/api/requisitions');
  await test('8. 邮件设置', '/api/settings/mail');
  await test('9. 岗位映射', '/api/position-mappings');
  await test('10. 招聘日报', '/api/daily-reports/generate', { method: 'POST', body: '{}' });
  await test('11. 入职管理', '/api/onboarding');
  await test('12. 试用期管理', '/api/probation');
  console.log('\n========== 测试完成 ==========');
})();
