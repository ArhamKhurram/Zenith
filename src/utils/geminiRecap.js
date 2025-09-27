const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let recap = response.text();

        // Replace timestamp placeholder
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // No timestamp replacement needed for new format
        console.log(`✅ Recap generated successfully (${recap.length} characters)`);
        return recap;

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

        const result = await model.generateContent(megaPrompt);
        const response = await result.response;
        
        console.log(`✅ Mega-recap generated successfully`);
        return response.text();

    } catch (error) {
        console.error('❌ Error generating mega-recap:', error);
        return `**🌟 MEGA RECAP - Cross-Server Activity**\n\n📊 Processed activity from **${allServerRecaps.length}** servers\n\n*Mega-recap AI temporarily unavailable*`;
    }
}

module.exports = {
    generateRecap,
    generateMegaRecap
};