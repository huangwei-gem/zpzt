/**
 * 构建 _worker.js（Pages Advanced Mode）
 * 在 `npm run build` 后自动执行，确保 _worker.js 不被清空
 *
 * 用法：node scripts/build-worker.cjs
 */
const { execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const WORKER_SRC = path.resolve(PROJECT_ROOT, 'worker', 'src', 'index.ts');
const OUT_FILE = path.resolve(PROJECT_ROOT, 'frontend', 'dist', '_worker.js');
const ESBUILD = path.resolve(PROJECT_ROOT, 'worker', 'node_modules', '.bin', 'esbuild');

console.log('[build-worker] 开始编译 _worker.js...');
console.log(`  源文件: ${WORKER_SRC}`);
console.log(`  输出:   ${OUT_FILE}`);

try {
  execSync(
    `"${ESBUILD}" "${WORKER_SRC}" --bundle --outfile="${OUT_FILE}" --format=esm --platform=browser --external:__STATIC_CONTENT_MANIFEST --target=es2021 --minify`,
    {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      timeout: 60000,
    }
  );
  console.log('[build-worker] ✅ _worker.js 编译成功');
} catch (err) {
  console.error('[build-worker] ❌ 编译失败:', err.message);
  process.exit(1);
}
