import * as XLSX from 'xlsx';
import { getApiUrl } from './apiResolver';

// Local storage keys
const KEY_API_MODE = 'et_api_mode'; // 'sandbox' | 'direct' | 'custom'
const KEY_USER_API_KEY = 'et_user_api_key';
const KEY_CUSTOM_BACKEND_URL = 'et_custom_backend_url';

export interface GeminiConfig {
  mode: 'sandbox' | 'direct' | 'custom';
  apiKey: string;
  customBackendUrl: string;
}

/**
 * Fetch current Gemini connection mode settings from local storage
 */
export const getGeminiConfig = (): GeminiConfig => {
  const mode = (localStorage.getItem(KEY_API_MODE) as 'sandbox' | 'direct' | 'custom') || 'sandbox';
  const apiKey = localStorage.getItem(KEY_USER_API_KEY) || '';
  const customBackendUrl = localStorage.getItem(KEY_CUSTOM_BACKEND_URL) || '';
  return { mode, apiKey, customBackendUrl };
};

/**
 * Update Gemini connection mode settings
 */
export const saveGeminiConfig = (config: Partial<GeminiConfig>) => {
  if (config.mode !== undefined) {
    localStorage.setItem(KEY_API_MODE, config.mode);
  }
  if (config.apiKey !== undefined) {
    localStorage.setItem(KEY_USER_API_KEY, config.apiKey.trim());
  }
  if (config.customBackendUrl !== undefined) {
    localStorage.setItem(KEY_CUSTOM_BACKEND_URL, config.customBackendUrl.trim());
  }
};

/**
 * General helper to read a file as a Base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * General helper to read file contents as utf-8 text
 */
export const readAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Dynamic receipt scanner router. Matches API response from server.ts.
 */
export const parseReceipt = async (
  imageBase64: string,
  mimeType: string,
  type: 'saving' | 'expense'
): Promise<{ amount: number; category: string; description: string; date: string }> => {
  const config = getGeminiConfig();

  // Mode: Direct Gemini API (Runs 100% client-side, ideal for standalone Netlify & Mobile apps)
  if (config.mode === 'direct' && config.apiKey) {
    return runDirectGeminiReceipt(imageBase64, mimeType, type, config.apiKey);
  }

  // Get dynamic backend host depending on 'sandbox' (AI Studio base) or 'custom' (user custom backend)
  let endpoint = '/api/parse-receipt';
  let targetUrl = '';
  
  if (config.mode === 'custom' && config.customBackendUrl) {
    const base = config.customBackendUrl.endsWith('/') ? config.customBackendUrl.slice(0, -1) : config.customBackendUrl;
    targetUrl = `${base}${endpoint}`;
  } else {
    // Sandbox or Direct fallback
    targetUrl = getApiUrl(endpoint);
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      type,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server HTTP Error ${response.status}`);
  }

  return response.json();
};

/**
 * Serverless / Standalone Direct connection to standard Google Gemini REST API.
 */
const runDirectGeminiReceipt = async (
  imageBase64: string,
  mimeType: string,
  type: 'saving' | 'expense',
  apiKey: string
): Promise<{ amount: number; category: string; description: string; date: string }> => {
  let base64Part = imageBase64;
  let detectedMimeType = mimeType || 'image/jpeg';
  
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    detectedMimeType = parts[0].replace('data:', '');
    base64Part = parts[1];
  }

  const isPdfFormat = detectedMimeType === 'application/pdf' || detectedMimeType.includes('pdf');
  if (isPdfFormat) {
    detectedMimeType = 'application/pdf';
  } else if (!detectedMimeType || detectedMimeType === 'application/octet-stream' || !detectedMimeType.startsWith('image/')) {
    detectedMimeType = 'image/jpeg';
  }

  const systemInstruction = `You are a financial receipt analysis system. Extract the transaction amount and details from the provided image of a receipt, bill, invoice, UPI payment screenshot, or voucher.
Identify whether the receipt represents a "saving" (reimbursement, income) or "expense" (purchase, payout) based on the context, but default to extracting the final total amount.
For the category, select the best fitting one from these standard lists:
Savings Categories: 'Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'
Expenses Categories: 'Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'

Extract:
1. amount: the total/final numeric amount of the transaction as a floating number (e.g. 125.50 or 1500). Only extract the numeric amount digit.
2. category: the best fitting string category from the standard lists above.
3. description: a clear, brief, user-friendly description of what was purchased or received (e.g. "Starbucks Coffee" or "Amazon Grocery").
4. date: the date on the receipt formatted as 'YYYY-MM-DD'. If no date is visible or readable, default to the current date.`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: base64Part
            }
          },
          {
            text: `Extract financial details from this receipt for a transaction of type: ${type}.`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['amount', 'category', 'description', 'date'],
        properties: {
          amount: {
            type: 'NUMBER',
            description: 'The total invoice sum amount as a floating point number.'
          },
          category: {
            type: 'STRING',
            description: 'Best fit category string from the permitted list.'
          },
          description: {
            type: 'STRING',
            description: 'Brief summary or merchant name.'
          },
          date: {
            type: 'STRING',
            description: 'The transaction date as recorded on receipt in YYYY-MM-DD format.'
          }
        }
      }
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini REST HTTP ${response.status} Failed`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Could not parse response text from private Gemini endpoint.');
  }

  return JSON.parse(rawText.trim());
};

/**
 * Dynamic bulk document and transaction scanner router.
 */
export const parseDocumentMulti = async (
  file: File
): Promise<{ transactions: Array<{ amount: number; type: 'saving' | 'expense'; category: string; description: string; date: string }> }> => {
  const config = getGeminiConfig();

  // Mode: Direct Gemini API key (Self-contained, works 100% Client-side in Netlify + Mobile)
  if (config.mode === 'direct' && config.apiKey) {
    return runDirectGeminiMulti(file, config.apiKey);
  }

  // Fallback to sandbox or custom backend standard endpoints
  let endpoint = '/api/parse-document-multi';
  let targetUrl = '';
  
  if (config.mode === 'custom' && config.customBackendUrl) {
    const base = config.customBackendUrl.endsWith('/') ? config.customBackendUrl.slice(0, -1) : config.customBackendUrl;
    targetUrl = `${base}${endpoint}`;
  } else {
    targetUrl = getApiUrl(endpoint);
  }

  const fileBase64 = await fileToBase64(file);
  let textPreview = '';
  if (file.type === "text/csv" || file.name.endsWith(".csv") || file.type === "text/plain" || file.name.endsWith(".txt")) {
    textPreview = await readAsText(file);
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileBase64,
      mimeType: file.type,
      fileName: file.name,
      textPreview,
    })
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throw new Error(errPayload.error || `Server HTTP Error ${response.status}`);
  }

  return response.json();
};

/**
 * Fully client-side parsing using XLSX for excel files + raw text decoders + direct Gemini API
 */
const runDirectGeminiMulti = async (
  file: File,
  apiKey: string
): Promise<{ transactions: Array<{ amount: number; type: 'saving' | 'expense'; category: string; description: string; date: string }> }> => {
  const fileBase64 = await fileToBase64(file);
  let base64Part = fileBase64;
  let detectedMimeType = file.type || 'application/octet-stream';

  if (fileBase64.includes(';base64,')) {
    const parts = fileBase64.split(';base64,');
    detectedMimeType = parts[0].replace('data:', '');
    base64Part = parts[1];
  }

  const lowerName = file.name.toLowerCase();
  let extractedText = '';
  let isSheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || detectedMimeType.includes('sheet') || detectedMimeType.includes('excel');
  let isCsv = lowerName.endsWith('.csv') || detectedMimeType === 'text/csv';
  let isText = lowerName.endsWith('.txt') || detectedMimeType === 'text/plain';

  // Extract Spreadsheet binary (Direct browser XLSX reader)
  if (isSheet && base64Part) {
    try {
      const workbook = XLSX.read(base64Part, { type: 'base64' });
      let sheetCsvs: string[] = [];
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        if (csv.trim()) {
          sheetCsvs.push(`Sheet: ${sheetName}\n${csv}`);
        }
      });
      extractedText += `\n\nExtracted Excel CSV content:\n${sheetCsvs.join('\n\n')}`;
      isText = true;
    } catch (excelErr: any) {
      console.error('Client Excel parse error:', excelErr);
      extractedText += `\n[Failed to extract spreadsheet automatically: ${excelErr.message}]`;
    }
  }

  // Extract file strings if raw text or csv
  if ((isCsv || isText) && base64Part && !extractedText.includes('Excel CSV content')) {
    try {
      extractedText += `\n\nExtracted File Raw Text:\n"""\n${await readAsText(file)}\n"""`;
    } catch (textErr: any) {
      console.error('Client CSV/Text parse error:', textErr);
    }
  }

  const contents: any[] = [];

  const isMultiModalSupported = 
    detectedMimeType === 'application/pdf' || 
    detectedMimeType.startsWith('image/jpeg') || 
    detectedMimeType.startsWith('image/png') || 
    detectedMimeType.startsWith('image/webp') || 
    detectedMimeType.startsWith('image/gif') || 
    detectedMimeType.startsWith('image/heic') || 
    detectedMimeType.startsWith('image/heif');

  if (base64Part && isMultiModalSupported && !isSheet && !isCsv && !isText) {
    contents.push({
      inlineData: {
        mimeType: detectedMimeType,
        data: base64Part
      }
    });
  }

  let promptText = `Analyze this uploaded document/file ("${file.name || 'Document'}") and extract multiple financial transactions (spent or saved) that are listed in it.
Find all individual transactions or records of spend/saving (e.g. bills, receipts, water, shop, power, transfers, rents, salary).
Extract them as a list of distinct transactions.`;

  if (extractedText.trim()) {
    promptText += `\n\nExtracted text/data content:\n"""\n${extractedText}\n"""`;
  }

  contents.push({ text: promptText });

  const systemInstruction = `You are an advanced financial audit agent that parses document contents (PDFs, images, CSVs, Excel files, receipts, bank statements) to extract multiple cash-flow items.
Extract every individual transaction found in the document content. Each item MUST be categorized and labeled as either an "expense" (spend, payment, utility, outflow) or "saving" (income, incoming, salary, transfer-in).

Categorize according to these standard categories only:
Savings Categories: 'Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'
Expenses Categories: 'Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'

For each extracted transaction, populate:
- amount: the numeric value of the transaction.
- type: either exactly "saving" or exactly "expense".
- category: the best matching category from the permitted lists above.
- description: a descriptive narrative (e.g., "Water Bill" or "Amazon Shopping"). Do not use generic numbers, try to name the specific service, shop or item.
- date: the transaction date in YYYY-MM-DD format if readable, otherwise default to the current date.

Respond with a JSON object containing a "transactions" key, which is a list/array of these parsed items.`;

  const requestBody = {
    contents: [
      {
        parts: contents
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['transactions'],
        properties: {
          transactions: {
            type: 'ARRAY',
            description: 'Lists of parsed receipts and statements transactions.',
            items: {
              type: 'OBJECT',
              required: ['amount', 'type', 'category', 'description', 'date'],
              properties: {
                amount: { type: 'NUMBER' },
                type: { type: 'STRING', enum: ['saving', 'expense'] },
                category: { type: 'STRING' },
                description: { type: 'STRING' },
                date: { type: 'STRING' }
              }
            }
          }
        }
      }
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini REST HTTP ${response.status} Failed`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Could not parse response text from private Gemini endpoint.');
  }

  return JSON.parse(rawText.trim());
};
