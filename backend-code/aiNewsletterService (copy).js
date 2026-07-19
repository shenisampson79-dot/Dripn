const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const fashionSources = [
  'Vogue', 'Harper\'s Bazaar', 'Elle', 'GQ', 'Esquire',
  'Who What Wear', 'The Cut', 'Fashionista', 'WWD',
  'Business of Fashion', 'Highsnobiety', 'Hypebeast'
];

const newsletterCategories = [
  'Seasonal Fashion Trends',
  'Celebrity Style Analysis',
  'Street Style Inspiration',
  'Sustainable Fashion',
  'Wardrobe Essentials',
  'Colour Trends',
  'Accessory Spotlight',
  'Fashion Week Highlights',
  'Budget-Friendly Style Tips',
  'Office to Evening Transitions'
];

async function generateAINewsletter(options = {}) {
  const {
    category = newsletterCategories[Math.floor(Math.random() * newsletterCategories.length)],
    gender = 'unisex',
    season = getCurrentSeason(),
    region = 'UK'
  } = options;

  const prompt = `You are a professional fashion editor writing for Dripn, a luxury fashion advice app. 
Generate a complete weekly newsletter about "${category}" for the ${season} season.

Target audience: Fashion-conscious ${gender === 'unisex' ? 'individuals' : gender} in the ${region}.

Requirements:
1. Write in British English
2. Be informative, engaging, and actionable
3. Include 5-6 specific styling tips or recommendations
4. Reference current fashion trends from sources like ${fashionSources.slice(0, 4).join(', ')}
5. Include pro tips for each recommendation
6. Avoid mentioning specific prices or retailers (keep it brand-neutral)
7. Use an elegant, sophisticated but approachable tone

Format your response as JSON with this structure:
{
  "subject": "Dripn Weekly: [Catchy headline - max 60 characters]",
  "previewText": "[2-sentence preview - max 150 characters]",
  "headline": "[Main article headline]",
  "introduction": "[2-3 sentences introducing the topic]",
  "tips": [
    {
      "title": "[Tip headline]",
      "content": "[2-3 sentences of advice]",
      "proTip": "[One sentence pro tip]"
    }
  ],
  "closingMessage": "[Encouraging closing message]",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fashion editor. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const newsletterData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      data: {
        ...newsletterData,
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
        gender,
        season,
        region
      }
    };
  } catch (error) {
    console.error('AI Newsletter generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Autumn';
  return 'Winter';
}

function generateNewsletterHTML(data) {
  const tipsHTML = data.tips.map((tip, index) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px; background-color: #f8f6f3; border-radius: 8px; border-left: 4px solid #c9a961;">
          <h3 style="color: #2C1810; margin: 0 0 10px 0; font-size: 18px;">${index + 1}. ${tip.title}</h3>
          <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0;">${tip.content}</p>
          <p style="color: #c9a961; font-size: 13px; margin: 10px 0 0 0; font-weight: 600;">Pro Tip: ${tip.proTip}</p>
        </td>
      </tr>
    </table>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dripn Weekly</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2C1810 0%, #4A3428 100%); padding: 30px; text-align: center;">
              <h1 style="color: #c9a961; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 2px;">DRIPN</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 12px; letter-spacing: 1px;">WEEKLY STYLE TIPS</p>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background-color: #faf9f7;">
              <h2 style="color: #2C1810; font-size: 24px; margin: 0 0 15px 0; font-weight: 600;">${data.headline}</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0;">${data.introduction}</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              ${tipsHTML}
            </td>
          </tr>

          <!-- Closing Message -->
          <tr>
            <td style="padding: 20px 30px 30px 30px;">
              <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic; text-align: center;">${data.closingMessage}</p>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td style="padding: 30px; background-color: #2C1810; text-align: center;">
              <p style="color: #ffffff; font-size: 16px; margin: 0 0 20px 0;">Get personalised recommendations for your style</p>
              <a href="https://dripnapp.com" style="display: inline-block; background-color: #c9a961; color: #2C1810; padding: 14px 35px; text-decoration: none; font-weight: 600; border-radius: 25px; font-size: 14px;">OPEN DRIPN</a>
            </td>
          </tr>

          <!-- Report Issue Link -->
          <tr>
            <td style="padding: 15px 30px; background-color: #faf9f7; text-align: center;">
              <p style="color: #999999; font-size: 11px; margin: 0;">
                Found an issue? <a href="https://dripnapp.com/newsletter/report" style="color: #c9a961; text-decoration: none;">Report a typo or concern</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f6f3; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0 0 10px 0;">You're receiving this because you subscribed to Dripn fashion updates.</p>
              <p style="color: #999999; font-size: 12px; margin: 0;">
                <a href="https://dripnapp.com/unsubscribe" style="color: #c9a961; text-decoration: none;">Unsubscribe</a> | 
                <a href="https://dripnapp.com/preferences" style="color: #c9a961; text-decoration: none;">Update Preferences</a>
              </p>
              <p style="color: #cccccc; font-size: 11px; margin: 20px 0 0 0;">Dripn - Your Personal Fashion Advisor</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateNewsletterPlainText(data) {
  const tipsText = data.tips.map((tip, index) => `
${index + 1}. ${tip.title.toUpperCase()}
${tip.content}
Pro Tip: ${tip.proTip}
`).join('\n');

  return `
DRIPN WEEKLY STYLE TIPS

${data.headline}
${'='.repeat(data.headline.length)}

${data.introduction}

${tipsText}

${data.closingMessage}

---
Get personalised recommendations: https://dripnapp.com

Found an issue? Report it: https://dripnapp.com/newsletter/report

You're receiving this because you subscribed to Dripn fashion updates.
Unsubscribe: https://dripnapp.com/unsubscribe
  `.trim();
}

module.exports = {
  generateAINewsletter,
  generateNewsletterHTML,
  generateNewsletterPlainText,
  newsletterCategories,
  getCurrentSeason
};
