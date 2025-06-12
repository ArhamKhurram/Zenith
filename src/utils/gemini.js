const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const askGemini = async (prompt) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    return result;
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    return 'Zenith couldn’t think of a response.';
  }
};

module.exports = askGemini;
