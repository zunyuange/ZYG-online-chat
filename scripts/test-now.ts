const BASE_URL = 'https://zyg-online-chat.linzihai.workers.dev';

async function main() {
  // 1. 登录 htcs110
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'htcs110', password: '123456' }),
  });
  const login = await loginRes.json();
  console.log('Login result:', JSON.stringify(login));
  const token = login.token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  console.log('Token payload:', JSON.stringify(payload));

  // 2. POST /api/business/info
  console.log('\n=== POST /api/business/info ===');
  const postRes = await fetch(`${BASE_URL}/api/business/info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ business_name: 'htcs110-NEW-TEST' }),
  });
  const postData = await postRes.json();
  console.log('POST result:', JSON.stringify(postData));

  // 3. 验证
  const verifyRes = await fetch(`${BASE_URL}/api/business/info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const verifyData = await verifyRes.json();
  console.log('Verify:', JSON.stringify(verifyData));
}

main().catch(console.error);
