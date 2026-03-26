/**
 * Local diagnostic test script
 * Run: node scripts/localTest.js
 */
const http = require('http');

const BASE = 'http://localhost:5000';

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: 5000,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(buf); } catch { json = buf; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function extractCookie(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return null;
  const line = Array.isArray(raw) ? raw[0] : raw;
  const m = /session=([^;]+)/.exec(line);
  return m ? m[1] : null;
}

async function run() {
  console.log('\n======== LOCAL BACKEND DIAGNOSTIC ========\n');

  // 1. cpanel login
  console.log('--- TEST 1: cpanel login ---');
  const loginRes = await req('POST', '/api/cpanel/login', { email: 'admin@test.com', password: 'testpass123' });
  console.log('Status:', loginRes.status);
  console.log('Body:', JSON.stringify(loginRes.body));
  const sessionToken = extractCookie(loginRes.headers);
  console.log('Session token:', sessionToken ? sessionToken.slice(0, 16) + '...' : 'NONE');

  if (!sessionToken) {
    console.error('FAIL: No session token - cannot continue');
    process.exit(1);
  }

  const authHeader = { Cookie: `session=${sessionToken}` };

  // 2. List tenants
  console.log('\n--- TEST 2: list tenants ---');
  const listRes = await req('GET', '/api/cpanel/tenants', null, authHeader);
  console.log('Status:', listRes.status);
  console.log('Body:', JSON.stringify(listRes.body).slice(0, 300));

  // 3. Create tenant
  console.log('\n--- TEST 3: create tenant ---');
  const tName = 'TestCollege_' + Date.now();
  const createRes = await req('POST', '/api/cpanel/tenants', { name: tName, subdomain: 'testcol' + Date.now() }, authHeader);
  console.log('Status:', createRes.status);
  console.log('Body:', JSON.stringify(createRes.body));
  const tenantId = createRes.body?.tenant?.id;
  console.log('Created tenant ID:', tenantId);

  if (!tenantId) {
    console.error('FAIL: Tenant creation failed - cannot continue user tests');
    process.exit(1);
  }

  // 4. Invite user to tenant
  console.log('\n--- TEST 4: invite user ---');
  const testEmail = 'testuser_' + Date.now() + '@example.com';
  const inviteRes = await req('POST', '/api/cpanel/users/invite',
    { email: testEmail, role: 'admissions_officer', tenantId },
    authHeader
  );
  console.log('Status:', inviteRes.status);
  console.log('Body:', JSON.stringify(inviteRes.body));
  const initialPassword = inviteRes.body?.initialPassword;
  const retTenant = inviteRes.body?.tenant;
  console.log('Initial password:', initialPassword);
  console.log('Tenant info returned:', JSON.stringify(retTenant));

  if (!initialPassword) {
    console.error('FAIL: No initial password returned');
    process.exit(1);
  }

  // 5. Login with new user credentials using tenant numeric ID
  console.log('\n--- TEST 5: user login (tenant_code = numeric id) ---');
  const loginUserRes = await req('POST', '/api/users/login', {
    tenant_code: String(tenantId),
    email: testEmail,
    password: initialPassword,
  });
  console.log('Status:', loginUserRes.status);
  console.log('Body:', JSON.stringify(loginUserRes.body));

  // 6. Login with subdomain
  if (retTenant?.subdomain) {
    console.log('\n--- TEST 6: user login (tenant_code = subdomain) ---');
    const loginSubRes = await req('POST', '/api/users/login', {
      tenant_code: retTenant.subdomain,
      email: testEmail,
      password: initialPassword,
    });
    console.log('Status:', loginSubRes.status);
    console.log('Body:', JSON.stringify(loginSubRes.body));
  }

  // 7. Login with wrong password
  console.log('\n--- TEST 7: user login (wrong password) ---');
  const loginWrongRes = await req('POST', '/api/users/login', {
    tenant_code: String(tenantId),
    email: testEmail,
    password: 'wrongpassword',
  });
  console.log('Status:', loginWrongRes.status);
  console.log('Body:', JSON.stringify(loginWrongRes.body));

  console.log('\n======== DONE ========');
}

run().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
