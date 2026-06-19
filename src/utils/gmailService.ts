import { getGeminiConfig } from './geminiClient';
import { getApiUrl } from './apiResolver';

export interface GmailMessage {
  id: string;
  snippet: string;
  date: string;
  subject: string;
  body: string;
  parsed?: {
    amount: number;
    type: 'saving' | 'expense';
    category: string;
    description: string;
    date: string;
  } | null;
  loading?: boolean;
}

/**
 * Decodes base64url strings from Gmail payloads
 */
function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      return '';
    }
    base64 += new Array(5 - pad).join('=');
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(base64);
    } catch {
      return '';
    }
  }
}

/**
 * Recursive extractor of email text from nested Gmail parts
 */
function extractBodyText(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const txt = extractBodyText(part);
      if (txt) return txt;
    }
  }
  return '';
}

/**
 * Fetch messages matching query from the Gmail API
 */
export async function fetchDbsAlertsFromGmail(
  accessToken: string, 
  limit = 15, 
  queryStr = 'from:ibanking.alert@dbs.com OR label:banking-alerts'
): Promise<GmailMessage[]> {
  const config = getGeminiConfig();
  try {
    // Determine the proxy endpoint list URL
    let listUrl = '';
    const endpoint = '/api/gmail/messages';
    
    if (config.mode === 'custom' && config.customBackendUrl) {
      const base = config.customBackendUrl.endsWith('/') ? config.customBackendUrl.slice(0, -1) : config.customBackendUrl;
      listUrl = `${base}${endpoint}?q=${encodeURIComponent(queryStr)}&limit=${limit}`;
    } else {
      listUrl = getApiUrl(`${endpoint}?q=${encodeURIComponent(queryStr)}&limit=${limit}`);
    }

    const response = await fetch(
      listUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail fetch failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.messages || data.messages.length === 0) {
      return [];
    }

    const messageDetails: GmailMessage[] = [];

    // Fetch individual details for each message
    for (const msg of data.messages) {
      try {
        // Determine the details URL
        let detailUrl = '';
        const detailEndpoint = `/api/gmail/messages/${msg.id}`;
        
        if (config.mode === 'custom' && config.customBackendUrl) {
          const base = config.customBackendUrl.endsWith('/') ? config.customBackendUrl.slice(0, -1) : config.customBackendUrl;
          detailUrl = `${base}${detailEndpoint}`;
        } else {
          detailUrl = getApiUrl(detailEndpoint);
        }

        const detailRes = await fetch(
          detailUrl,
          {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
          }
        );

        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const headers: any = detail.payload?.headers || [];
        
        const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

        const subject = subjectHeader ? subjectHeader.value : 'No Subject';
        const rawDate = dateHeader ? dateHeader.value : new Date().toISOString();
        const bodyText = extractBodyText(detail.payload) || detail.snippet || '';

        messageDetails.push({
          id: msg.id,
          snippet: detail.snippet || '',
          date: new Date(rawDate).toLocaleDateString(),
          subject,
          body: bodyText,
        });
      } catch (err) {
        console.error(`Error fetching message detail for id ${msg.id}:`, err);
      }
    }

    return messageDetails;
  } catch (error) {
    console.error('fetchDbsAlertsFromGmail error:', error);
    throw error;
  }
}

/**
 * Clientside local regex parser for DBS alerts as high-speed standalone backup
 */
export function parseDbsAlertLocalRegex(text: string, dateContext: string): any {
  // Amount patterns: SGD, S$, USD, etc
  const amountRegex = /(?:SGD|S\$|USD|EUR|GBP|Rs|₹|\$)\s*([\d,]+(?:\.\d{2})?)/i;
  const amountMatch = text.match(amountRegex);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // Type: default expense, saving if credited/deposit/salary
  let type: 'saving' | 'expense' = 'expense';
  if (/credited|received|deposit|deposited|salary|refund/i.test(text)) {
    type = 'saving';
  }

  // Merchant extractor options
  let description = 'DBS bank transfer alert';
  const merchantAtMatch = text.match(/at\s+([^,.\s]+(?:\s+[^,.\s]+){0,2})\s+on/i);
  const merchantToMatch = text.match(/to\s+([^,.\s]+(?:\s+[^,.\s]+){0,2})\s+on/i);
  const merchantFromMatch = text.match(/from\s+([^,.\s]+(?:\s+[^,.\s]+){0,2})\s+on/i);
  const merchantCreditMatch = text.match(/from\s+([^,.\s]+(?:\s+[^,.\s]+){0,3})/i);

  if (merchantAtMatch) {
    description = merchantAtMatch[1].trim();
  } else if (merchantToMatch) {
    description = `Transfer to ${merchantToMatch[1].trim()}`;
  } else if (merchantFromMatch) {
    description = `Transfer from ${merchantFromMatch[1].trim()}`;
  } else if (merchantCreditMatch) {
    description = merchantCreditMatch[1].trim();
  }

  // Category classifier options
  let category = 'Others';
  const lowerText = text.toLowerCase();
  if (/grab|uber|taxi|comfort|transit|mrt|rail|train|bus|transport/i.test(lowerText)) {
    category = 'Transportation';
  } else if (/food|dining|restaurant|mcdonald|starbucks|deliveroo|foodpanda|bistro|eats|pub|cafe|coffee/i.test(lowerText)) {
    category = 'Food & Dining';
  } else if (/shopping|lazada|shopee|amazon|qoo10|boutique|fashion|zara|hm|uniqlo|supermarket|mall|groceries/i.test(lowerText)) {
    category = 'Shopping';
  } else if (/netflix|spotify|disney|theatre|cinema|game|steam|arcade|movie/i.test(lowerText)) {
    category = 'Entertainment';
  } else if (/utilities|power|singtel|starhub|m1|telecom|bill|water|current|phone/i.test(lowerText)) {
    category = 'Rent & Utilities';
  } else if (/hospital|medical|clinic|dentist|watson|guardian|doctor|wellness|health/i.test(lowerText)) {
    category = 'Healthcare';
  } else if (/school|course|book|udemy|tuition|exam|learning/i.test(lowerText)) {
    category = 'Education';
  } else if (/salary|income|dividend|bonus/i.test(lowerText)) {
    category = 'Salary';
  }

  // Parse Date
  let standardDate = new Date().toISOString().substring(0, 10);
  const dateStrMatch = text.match(/on\s+(\d{1,2}\s*[A-Za-z]{3}(?:\s*\d{4})?)/i);
  if (dateStrMatch) {
    try {
      const d = new Date(dateStrMatch[1]);
      if (!isNaN(d.getTime())) {
        standardDate = d.toISOString().substring(0, 10);
      }
    } catch {}
  } else {
    try {
      const d = new Date(dateContext);
      if (!isNaN(d.getTime())) {
        standardDate = d.toISOString().substring(0, 10);
      }
    } catch {}
  }

  return {
    amount,
    type,
    category,
    description: description.substring(0, 40),
    date: standardDate,
  };
}

/**
 * Hits backend parser API (/api/parse-email) or falls back to direct model call or local regex
 */
export async function parseEmailAlert(bodyText: string, dateContext: string): Promise<any> {
  const config = getGeminiConfig();

  // If in direct client side Gemini mode, we can hit Gemini directly from here
  if (config.mode === 'direct' && config.apiKey) {
    try {
      const systemInstruction = `You are an expert financial ledger parsing AI. Analyze the DBS bank notification content to determine if it is a "saving" (credited, salary, refund) or an "expense" (debited, paid, charged).
DBS Categories must belong strictly to these options:
Savings Categories: 'Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'
Expenses Categories: 'Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'
Extract: amount, type, category, description (merchant or action), date (YYYY-MM-DD).`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this content and return transaction:
Text: ${bodyText}
Date context: ${dateContext}`,
                  },
                ],
              },
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                required: ['type', 'amount', 'category', 'description', 'date'],
                properties: {
                  type: { type: 'STRING', enum: ['saving', 'expense'] },
                  amount: { type: 'NUMBER' },
                  category: { type: 'STRING' },
                  description: { type: 'STRING' },
                  date: { type: 'STRING' },
                },
              },
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return JSON.parse(rawText.trim());
        }
      }
    } catch (err) {
      console.warn('Direct Gemini email parsing failed, falling back to local extractor:', err);
    }
  }

  // Default: hit Express backend /api/parse-email
  try {
    let endpoint = '/api/parse-email';
    let targetUrl = '';
    
    if (config.mode === 'custom' && config.customBackendUrl) {
      const base = config.customBackendUrl.endsWith('/') ? config.customBackendUrl.slice(0, -1) : config.customBackendUrl;
      targetUrl = `${base}${endpoint}`;
    } else {
      targetUrl = getApiUrl(endpoint);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailContent: bodyText, date: dateContext }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`Backend response status ${response.status}`);
    }
  } catch (err) {
    console.warn('Backend email parsing failed, running clean regex fallback parser:', err);
    return parseDbsAlertLocalRegex(bodyText, dateContext);
  }
}
