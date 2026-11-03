import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');
const isCheck = process.argv.includes('--check');

if (isCheck) {
  console.log('Kiểm tra cú pháp và build esbuild...');
  try {
    await esbuild.build({
      entryPoints: ['server.ts'],
      outfile: 'dist/server-check.js',
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
      write: false
    });
    console.log('✓ Cú pháp server.ts và các module hợp lệ.');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi kiểm tra cú pháp:', err);
    process.exit(1);
  }
}

async function build() {
  console.log('Đang đóng gói ứng dụng Chùa Online 3D bằng esbuild...');

  // Build Server bundle
  await esbuild.build({
    entryPoints: ['server.ts'],
    outfile: 'server.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: true,
    minify: !isWatch,
    packages: 'external'
  });

  console.log('✓ Đóng gói server.js thành công.');

  if (isWatch) {
    console.log('Chế độ theo dõi (--watch) đã bật...');
    const srv = spawn('node', ['--watch', 'server.js'], { stdio: 'inherit' });
    process.on('SIGINT', () => {
      srv.kill();
      process.exit(0);
    });
  }
}

build().catch((err) => {
  console.error('Lỗi build:', err);
  process.exit(1);
});
