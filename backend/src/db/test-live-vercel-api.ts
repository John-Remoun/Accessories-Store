async function testEndpoints() {
  const urls = [
    'https://accessories-store-six.vercel.app/api',
    'https://accessories-store-six.vercel.app/api/health',
    'https://accessories-store-six.vercel.app/api/v1/health',
    'https://accessories-store-six.vercel.app/api/index',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`URL: ${url} | Status: ${res.status} | Body: ${text.slice(0, 100)}`);
    } catch (e: any) {
      console.log(`URL: ${url} | Error: ${e.message}`);
    }
  }
}

testEndpoints();
