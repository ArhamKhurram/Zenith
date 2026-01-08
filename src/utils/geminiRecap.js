const axios = require('axios');
const https = require('https');
require('dotenv').config();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) {
    console.warn('Missing DEEPSEEK_API_KEY environment variable. DeepSeek calls will be skipped and fallback summaries used.');
}

// Build a safe fallback recap when AI fails
function buildFallback(messages) {
    const channelCounts = {};
    const userCounts = {};
    messages.forEach(msg => {
        channelCounts[msg.channelName] = (channelCounts[msg.channelName] || 0) + 1;
        userCounts[msg.username] = (userCounts[msg.username] || 0) + 1;
    });

    const topChannel = Object.keys(channelCounts).length ? Object.keys(channelCounts).reduce((a, b) => 
        channelCounts[a] > channelCounts[b] ? a : b
    ) : 'general';

    const topUser = Object.keys(userCounts).length ? Object.keys(userCounts).reduce((a, b) => 
        userCounts[a] > userCounts[b] ? a : b
    ) : 'unknown';

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `**Trading Recap • ${timeString}**\n\n` +
        `• **${messages.length}** messages across **${Object.keys(channelCounts).length}** channels\n` +
        `• Most active: **#${topChannel}** (${channelCounts[topChannel] || 0} messages)\n` +
        `• Top trader: **${topUser}** (${userCounts[topUser] || 0} messages)\n\n` +
        `*AI recap temporarily unavailable - showing basic activity*`;
}

async function generateRecap(messages) {
        try {
                console.log(`🤖 Generating recap for ${messages.length} messages...`);

                if (messages.length === 0) {
                        return '📭 **Server Recap** - No activity in the last few minutes.';
                }

        // Format messages for AI processing
        const messageText = messages.map(msg => 
            `[${msg.channelName}] ${msg.username}: ${msg.content}`
        ).join('\n');

        const prompt = `
You are creating ultra-concise crypto trading recaps. Analyze these messages and create SHORT, actionable summaries with proper context.

Guidelines:
- Keep each point under 30 words but include enough context to be useful
- Focus on: token moves, prices, news, catalysts, contract addresses
- No fancy formatting - just raw facts
- Use crypto slang: "pump", "dump", "ATH", "2x", "3x", "rug", "moon", "degen"
- Include token symbols like $TOKEN and contract addresses (CA: 0x...)
- Be direct and actionable for traders
- No fluff or narrative storytelling
- Ignore non-trading discussions
- Focus on what traders need to know NOW
- ALWAYS include actual usernames from messages - use "rev", "Owari", "trinity" etc. instead of "trader" or "multiple traders"
- When multiple people are involved, list their names: "rev, Owari, trinity agreed on $TOKEN long"
- CONNECT related messages - if someone mentions a token and others respond, group them together
- Provide CONTEXT for contract addresses - don't just say "watching CA", explain what token/play it is
- If someone mentions top holders, whales, or specific details, include that context

IMPORTANT - Contract Address Recognition:
- Real contract addresses: 0x followed by 40 hex characters (0x1234abcd...)
- NOT contract addresses: Long decimal numbers (these are Discord message IDs, ignore them)
- Only mention CA if it's actual hex format starting with 0x

IMPORTANT - These are NOT tokens, they are trading terms:
- "spot" = spot trading (not a token)
- "long" = long position (not a token)  
- "short" = short position (not a token)
- "bag" = holding/position (not a token)
- "fat" = large size (not a token)
- "futures" = futures trading (not a token)
- "perp" = perpetual contract (not a token)

Only treat something as a token if it has $ prefix ($TOKEN) or is explicitly mentioned with contract address.

Messages to analyze:
${messageText}

Create 3-6 concise bullet points with proper context covering key trading opportunities, token moves, or market events. Each point should be actionable intel for traders with enough detail to understand the situation.

Format:
• $TOKEN (CA: 0x123...) - [username] [action/context], [additional relevant details from related messages]
• [username] mentioned [token/context] - [what it is, why it matters, any responses]
• [Key market event with full context and usernames involved]
`;

        // If no API key is configured, immediately return the safe fallback
        if (!DEEPSEEK_KEY) {
            console.warn('DEEPSEEK_API_KEY not set - returning fallback recap.');
            throw new Error('DEEPSEEK_API_KEY not set');
        }

        // Prepare DeepSeek request
        const endpoint = 'https://api.deepseek.com/chat/completions';
        const payload = {
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
                { role: 'system', content: 'Respond ONLY with final bullet points. Never include your reasoning, thinking process, or self-checks. Format strictly as:\n• Point 1\n• Point 2\n• Point 3' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 1200,
            reasoning_effort: 'low'
        };

            const MAX_ATTEMPTS = 4;
            const TIMEOUT = 60000; // 60s - increase to tolerate slower network
            const MAX_PROMPT_CHARS = 16000; // safety truncation for very large message sets
            const httpsAgent = new https.Agent({ keepAlive: false });

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                // Truncate prompt if it's extremely large to avoid connection issues
                if (typeof payload.messages?.[1]?.content === 'string' && payload.messages[1].content.length > MAX_PROMPT_CHARS) {
                    const original = payload.messages[1].content;
                    payload.messages[1].content = original.slice(-MAX_PROMPT_CHARS);
                    console.warn('DeepSeek prompt was truncated to', MAX_PROMPT_CHARS, 'chars to avoid oversized requests');
                }

                const resp = await axios.post(endpoint, payload, {
                    headers: {
                        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: TIMEOUT,
                    httpsAgent,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                const data = resp.data || {};

                // Flexible extraction: prefer content, if empty use truncated reasoning_content (last 1000 chars)
                let recap = '';
                const choice = data?.choices?.[0];
                if (choice?.message?.content && choice.message.content.trim()) {
                    recap = choice.message.content.trim();
                } else if (choice?.message?.reasoning_content) {
                    // Truncate reasoning_content to last 1000 chars, assuming final answer is at the end
                    const reasoning = choice.message.reasoning_content;
                    recap = reasoning.length > 1000 ? reasoning.slice(-1000) : reasoning;
                } else if (choice?.message?.reasoning) {
                    recap = typeof choice.message.reasoning === 'string' ? choice.message.reasoning : JSON.stringify(choice.message.reasoning);
                } else if (choice?.text) {
                    recap = choice.text;
                } else if (data?.output?.[0]?.content) {
                    recap = data.output[0].content;
                } else if (typeof data?.text === 'string') {
                    recap = data.text;
                } else {
                    recap = JSON.stringify(data);
                }

                console.log(`✅ Recap generated successfully (${recap.length} characters)`);
                return recap;

            } catch (err) {
                const status = err?.response?.status;
                const retriable = !status || (status >= 500);
                console.warn(`Attempt ${attempt} failed for DeepSeek: ${err.message}`);

                // If client error (4xx), log concise info and return fallback immediately
                if (status && status >= 400 && status < 500) {
                    console.warn('DeepSeek client error:', status, err.response?.data || err.response?.statusText);

                    // Specific handling: if the model doesn't exist, try again without specifying a model
                    const serverMessage = err.response?.data?.error?.message || '';
                    if (serverMessage.toLowerCase().includes('model not exist')) {
                        try {
                            console.log('DeepSeek model not found - retrying request without model field...');
                            const fallbackPayload = Object.assign({}, payload);
                            delete fallbackPayload.model;

                                            const resp2 = await axios.post(endpoint, fallbackPayload, {
                                headers: {
                                    'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: TIMEOUT
                            });
                            const data2 = resp2.data || {};
                            const ch2 = data2?.choices?.[0];
                            let recap2 = '';
                            if (ch2?.message?.content && ch2.message.content.trim()) recap2 = ch2.message.content.trim();
                            else if (ch2?.message?.reasoning_content) {
                                const reasoning = ch2.message.reasoning_content;
                                recap2 = reasoning.length > 1000 ? reasoning.slice(-1000) : reasoning;
                            }
                            else if (ch2?.text) recap2 = ch2.text;
                            else if (typeof data2?.text === 'string') recap2 = data2.text;
                            else recap2 = JSON.stringify(data2);                                            console.log('✅ DeepSeek succeeded on fallback (no model).');
                                            return recap2;
                        } catch (err2) {
                            console.warn('DeepSeek fallback (no model) failed:', err2.message, err2.response?.data || 'no body');
                            return buildFallback(messages);
                        }
                    }

                    return buildFallback(messages);
                }

                if (attempt < MAX_ATTEMPTS && retriable) {
                    const backoff = 1000 * Math.pow(2, attempt - 1);
                    console.log(`⏳ Retrying DeepSeek in ${backoff}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }

                // Non-retriable or exhausted attempts: log and return fallback
                console.error('DeepSeek failed after attempts:', err.message, err.response?.data || 'no response body');
                return buildFallback(messages);
            }
        }

    } catch (error) {
        console.error('❌ Error generating recap with Gemini:', error);
        
        // Fallback recap if AI fails
        const channelCounts = {};
        const userCounts = {};
        
        messages.forEach(msg => {
            channelCounts[msg.channelName] = (channelCounts[msg.channelName] || 0) + 1;
            userCounts[msg.username] = (userCounts[msg.username] || 0) + 1;
        });

        const topChannel = Object.keys(channelCounts).reduce((a, b) => 
            channelCounts[a] > channelCounts[b] ? a : b
        );
        
        const topUser = Object.keys(userCounts).reduce((a, b) => 
            userCounts[a] > userCounts[b] ? a : b
        );

        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        return `**Trading Recap • ${timeString}**

• **${messages.length}** messages across **${Object.keys(channelCounts).length}** channels
• Most active: **#${topChannel}** (${channelCounts[topChannel]} messages)
• Top trader: **${topUser}** (${userCounts[topUser]} messages)

*AI recap temporarily unavailable - showing basic activity*`;
    }
}

// Function for future mega-recap processing
async function generateMegaRecap(allServerRecaps) {
    try {
        console.log(`🌟 Generating MEGA-RECAP for ${allServerRecaps.length} servers...`);
        
        const serverSummaries = allServerRecaps.map(recap => 
            `**${recap.serverName}:** ${recap.summary}`
        ).join('\n\n');

        const megaPrompt = `
You are creating a MEGA RECAP across multiple Discord servers. This is a summary of summaries.

Create an engaging overview of activity across all servers:
- Keep under 500 words  
- Use bold formatting and emojis
- Identify cross-server trends
- Highlight interesting patterns
- Make it entertaining

Server recaps to analyze:
${serverSummaries}

Format as:
**🌟 MEGA RECAP - Cross-Server Activity**
[Your analysis here]
`;

        // If no API key, return fallback
        if (!DEEPSEEK_KEY) {
            console.warn('DEEPSEEK_API_KEY not set - returning fallback mega-recap.');
            return `**🌟 MEGA RECAP - Cross-Server Activity**\n\n📊 Processed activity from **${allServerRecaps.length}** servers\n\n*Mega-recap AI temporarily unavailable*`;
        }

        // Send to DeepSeek
        try {
            const endpoint = 'https://api.deepseek.com/chat/completions';
            const payload = {
                model: process.env.DEEPSEEK_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a friendly summarizer for multi-server recaps.' },
                    { role: 'user', content: megaPrompt }
                ],
                max_tokens: 1500
            };

            const resp = await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });

            const data = resp.data || {};
            if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
            if (data?.choices?.[0]?.text) return data.choices[0].text;
            if (typeof data?.text === 'string') return data.text;

            return JSON.stringify(data).slice(0, 4000);

        } catch (err) {
            console.error('❌ Error generating mega-recap:', err);
            return `**🌟 MEGA RECAP - Cross-Server Activity**\n\n📊 Processed activity from **${allServerRecaps.length}** servers\n\n*Mega-recap AI temporarily unavailable*`;
        }

    } catch (error) {
        console.error('❌ Error generating mega-recap:', error);
        return `**🌟 MEGA RECAP - Cross-Server Activity**\n\n📊 Processed activity from **${allServerRecaps.length}** servers\n\n*Mega-recap AI temporarily unavailable*`;
    }
}

module.exports = {
    generateRecap,
    generateMegaRecap
};