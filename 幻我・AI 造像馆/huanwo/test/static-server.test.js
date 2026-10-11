const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const server = require('../server/server');

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: pathname }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    }).on('error', reject);
  });
}

test('只公开页面资源，服务端配置和隐藏文件不可读取', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;

  for (const pathname of ['/', '/workflow.html', '/css/styles.css', '/js/app.js', '/create']) {
    assert.equal((await request(port, pathname)).status, 200, pathname);
  }
  for (const pathname of [
    '/.env', '/.env.example', '/server/config.js', '/package.json',
    '/%2eenv', '/css/%2e%2e/server/config.js', '/bad%zz',
  ]) {
    assert.equal((await request(port, pathname)).status, 403, pathname);
  }
});
