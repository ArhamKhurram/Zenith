// Quick DeepSeek test using axios (CommonJS) to avoid ESM/import issues
// Usage: set DEEPSEEK_API_KEY in your environment or in .env then run `node test.js`

const axios = require('axios');
require('dotenv').config();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) {
  console.error('Missing DEEPSEEK_API_KEY environment variable. Set it in .env or your shell.');
  process.exit(1);
}

async function main() {
  const prompt = 'Say hello from DeepSeek test.';

  try {
    const res = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = res && res.data ? res.data : {};
    const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.text || JSON.stringify(data, null, 2);
    console.log('DeepSeek response:');
    console.log(reply);
  } catch (err) {
    console.error('DeepSeek request failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
}

main();