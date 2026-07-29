const fs = require('fs');
const s = fs.readFileSync(0, 'utf8');
const m = s.match(/"url":"([^"]+)"/);
console.log('URL:', m ? m[1] : '?');
const has404 = s.includes('404');
console.log('是否404:', has404 ? '❌ YES' : '✅ NO');
const hasUsers = s.includes('何雨菱') || s.includes('魏魏') || s.includes('杜雁玲');
console.log('有用户数据:', hasUsers ? '✅ YES' : '❌ NO');
console.log('页面长度:', s.length, 'chars');
