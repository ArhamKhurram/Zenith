const axios = require('axios');

async function generateRecap(messages) {
    try {
        console.log(`🤖 Generating recap for ${messages.length} messages...`);

        if (messages.length === 0) {
            return '📭 **Server Recap** - No activity in the last few minutes.';
        }

        // Limit number of messages and total prompt size to avoid huge requests
        const MAX_MESSAGES = 2000;
        const MAX_PROMPT_CHARS = 15000;
        const recent = messages.slice(-MAX_MESSAGES);
        let messageText = recent.map(msg => `[${msg.channelName}] ${msg.username}: ${msg.content}`).join('\n');
        if (messageText.length > MAX_PROMPT_CHARS) messageText = messageText.slice(-MAX_PROMPT_CHARS);

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

        // 🔹 DeepSeek API call
        const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
        if (!DEEPSEEK_KEY) {
            throw new Error('DEEPSEEK_API_KEY is not set');
        }

        const response = await axios.post(
            'https://api.deepseek.com/chat/completions',
            {
                model: 'deepseek-reasoner',
                messages: [
                    { role: 'system', content: 'You are a crypto trading recap generator.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 800,
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );

        // Try multiple response shapes for robustness
        const data = response && response.data ? response.data : {};
        let recap =
            data?.choices?.[0]?.message?.content ||
            data?.choices?.[0]?.text ||
            data?.text ||
            (Array.isArray(data?.output) && data.output[0]?.content) ||
            '';

        if (!recap && typeof data === 'string') recap = data;
        if (!recap) throw new Error('No recap text returned from DeepSeek');

        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        recap = String(recap).trim();
        console.log(`✅ Recap generated successfully (${recap.length} characters)`);
        return recap;

    } catch (error) {
        console.error('❌ Error generating recap with DeepSeek:', error?.response?.data || error);

        // fallback logic
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

module.exports = { generateRecap };
