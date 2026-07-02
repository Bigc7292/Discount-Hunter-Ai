async function test() {
  const url = 'https://markers-looking-hosted-destiny.trycloudflare.com/health';
  console.log(`Pinging tunnel health route: ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body: ${text}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
