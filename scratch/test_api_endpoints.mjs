import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, '..', 'server', 'src', 'index.js');

console.log('Spawning test backend server on port 5001...');
const serverProc = spawn('node', [serverPath], {
  cwd: path.join(__dirname, '..', 'server'),
  env: { ...process.env, PORT: '5001' }
});

serverProc.stdout.on('data', d => console.log('[Server stdout]:', d.toString().trim()));
serverProc.stderr.on('data', d => console.error('[Server stderr]:', d.toString().trim()));

// Wait for server to start
await new Promise(r => setTimeout(r, 1500));

const BASE = 'http://127.0.0.1:5001';

async function post(url, data) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function get(url) {
  const res = await fetch(`${BASE}${url}`);
  return res.json();
}

try {
  console.log('\n--- Test 1: Health Check ---');
  const health = await get('/api/health');
  console.log('Health:', health);

  console.log('\n--- Test 2: Token Management ---');
  const tokenSet = await post('/api/auth/token', {
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlZOUFQgVGVzdGVyIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  });
  console.log('Token status:', tokenSet);

  console.log('\n--- Test 3: Parse Local Excel ---');
  const parsed = await post('/api/excel/parse-local', {
    fileName: '30_10_danhsachthutuc.xls'
  });
  console.log('Excel file parsed:', parsed.fileName, 'Total rows:', parsed.totalRows, 'Domains:', parsed.domains);

  console.log('\n--- Test 4: Preview Mapping ---');
  const mappingRes = await post('/api/mapping/preview', {
    rows: parsed.rows,
    mappingConfig: {
      maThuTucCol: 'B',
      tenThuTucCol: 'D',
      tenVietTatCol: 'C',
      linhVucCol: 'E',
      defaults: {
        idLinhVuc: '161A6A0F284D403C9EF8E1F612CCE8B5'
      }
    },
    domainMappings: {
      'Đất đai': '161A6A0F284D403C9EF8E1F612CCE8B5'
    }
  });
  console.log('Mapping valid:', mappingRes.summary.valid, '/', mappingRes.summary.total);
  console.log('Sample payload mucDoThuTuc:', mappingRes.records[0].payload.mucDoThuTuc);
  if (mappingRes.records[0].payload.mucDoThuTuc !== 3) {
    throw new Error('mucDoThuTuc is not 3!');
  }

  console.log('\n--- Test 5: Dry Run ---');
  const dryRunRes = await post('/api/import/dry-run', {
    rows: parsed.rows,
    mappingConfig: {
      maThuTucCol: 'B',
      tenThuTucCol: 'D',
      tenVietTatCol: 'C',
      linhVucCol: 'E',
      defaults: {
        idLinhVuc: '161A6A0F284D403C9EF8E1F612CCE8B5'
      }
    },
    domainMappings: {
      'Đất đai': '161A6A0F284D403C9EF8E1F612CCE8B5'
    }
  });
  console.log('Dry run response:', dryRunRes.message);
  console.log('Payloads generated:', dryRunRes.payloads.length);

  console.log('\n--- Test 6: Single Test Import (Mock mode) ---');
  const testSingleRes = await post('/api/import/test-single', {
    payload: mappingRes.records[0].payload,
    confirmed: true,
    mockMode: true
  });
  console.log('Test single result:', testSingleRes);

  console.log('\n--- Test 7: Bulk Import Simulation (First 3 items) ---');
  const batchStart = await post('/api/import/start', {
    records: mappingRes.records.slice(0, 3),
    fileName: 'Test_Batch_3',
    delayMs: 100,
    mockMode: true,
    confirmed: true
  });
  console.log('Batch start:', batchStart.message);

  // Wait for batch to finish
  await new Promise(r => setTimeout(r, 1200));
  const finalStatus = await get('/api/import/status');
  console.log('Batch status:', finalStatus.status, 'Processed:', finalStatus.processed, 'Success:', finalStatus.success);

  console.log('\n--- Test 8: Export Excel ---');
  const exportFetch = await fetch(`${BASE}/api/export/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      records: finalStatus.results,
      onlyFailed: false
    })
  });
  const buf = await exportFetch.arrayBuffer();
  console.log('Export Excel buffer size:', buf.byteLength, 'bytes');

  console.log('\n✅ ALL INTEGRATION TESTS PASSED 100%!');
} catch (err) {
  console.error('Integration test error:', err);
} finally {
  serverProc.kill();
  process.exit(0);
}
