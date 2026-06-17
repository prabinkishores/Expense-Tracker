import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

dotenv.config();

// Create the Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});


// Helper function to call Gemini with automatic fallback models and exponential retry on high-demand errors (503s)
async function generateContentWithFallback(options: {
  contents: any;
  config: any;
  fallbackModels?: string[];
}) {
  const models = options.fallbackModels || [
    "gemini-3.5-flash",
    "gemini-2.5-flash"
  ];
  let lastError: any = null;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Attempting ${modelName} (Attempt ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: options.config,
        });
        if (response && response.text) {
          console.log(`[Gemini] Success using model ${modelName}`);
          return response;
        }
        throw new Error(`Empty response from ${modelName}`);
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || err.status || "").toLowerCase();
        console.warn(`[Gemini] ${modelName} attempt ${attempt} failed:`, errMsg);

        // Fail-fast if it's not a temporary overload or rate limit
        const isTemporary = errMsg.includes("503") || 
                            errMsg.includes("busy") || 
                            errMsg.includes("high demand") || 
                            errMsg.includes("limit") || 
                            errMsg.includes("unavailable") ||
                            errMsg.includes("overloaded");

        if (!isTemporary) {
          // Break the attempt loop to move to the next fallback model instantly
          break;
        }

        // Wait briefly (500ms) before retry
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }

  throw lastError || new Error("All fallback models failed");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Server-side parsing API
  app.post("/api/parse-email", async (req, res) => {
    try {
      const { emailContent, date } = req.body;
      if (!emailContent) {
        return res.status(400).json({ error: "Missing emailContent" });
      }

      const response = await generateContentWithFallback({
        contents: `Parse the following email payload representing a transaction payment confirmation (receipt, debit card charge, alert, bank message, UPI, SMS confirmation, subscription, invoice). Extract the details of the transaction.
Email Date Context: ${date || 'recent'}
Email Content:
"""
${emailContent}
"""`,
        config: {
          systemInstruction: `You are an expert financial ledger parsing AI. Analyze the email content to determine if it is a "saving" (income, salary, refund, transfer-in) or an "expense" (spent, payment, charged, purchase, bills, transfer-out).
Determine a fitting standard category from these standard lists:
Savings Categories: 'Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'
Expenses Categories: 'Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'
Extract:
1. type: 'saving' or 'expense'
2. amount: numeric value (e.g. 450.50). Estimate using exchange rates to INR/standard format if in foreign currency.
3. category: select the best fitting category from the lists above.
4. description: A clear short summary of the transaction (e.g., 'Ola ride to mall').
5. date: string formatted as 'YYYY-MM-DD'. Estimate the transaction date based on email date context.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["type", "amount", "category", "description", "date"],
            properties: {
              type: {
                type: Type.STRING,
                enum: ["saving", "expense"]
              },
              amount: {
                type: Type.NUMBER
              },
              category: {
                type: Type.STRING
              },
              description: {
                type: Type.STRING
              },
              date: {
                type: Type.STRING
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No output text from Gemini model");
      }

      const parsedData = JSON.parse(resultText.trim());
      return res.json(parsedData);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ error: error.message || "Failed to parse email with Gemini" });
    }
  });

  // Server-side receipt analysis OCR API
  app.post("/api/parse-receipt", async (req, res) => {
    try {
      const { imageBase64, mimeType, type } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing receipt image content (imageBase64)" });
      }

      // Extract the raw base64 data if it contains a standard Data URL prefix
      let base64Part = imageBase64;
      let detectedMimeType = mimeType || "image/jpeg";
      if (imageBase64.includes(";base64,")) {
        const parts = imageBase64.split(";base64,");
        detectedMimeType = parts[0].replace("data:", "");
        base64Part = parts[1];
      }

      // Safe fallback: Gemini API requires standard supported image formats (jpeg, png, webp) or PDF.
      const isPdfFormat = detectedMimeType === "application/pdf" || detectedMimeType.includes("pdf");
      if (isPdfFormat) {
        detectedMimeType = "application/pdf";
      } else if (!detectedMimeType || detectedMimeType === "application/octet-stream" || !detectedMimeType.startsWith("image/")) {
        detectedMimeType = "image/jpeg";
      }

      const imagePart = {
        inlineData: {
          mimeType: detectedMimeType,
          data: base64Part,
        },
      };

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

      const response = await generateContentWithFallback({
        contents: {
          parts: [
            imagePart,
            { text: `Extract financial details from this receipt for a transaction of type: ${type || 'expense'}.` }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["amount", "category", "description", "date"],
            properties: {
              amount: {
                type: Type.NUMBER,
                description: "The total invoice sum amount as a floating point number."
              },
              category: {
                type: Type.STRING,
                description: "Best fit category string from the permitted list."
              },
              description: {
                type: Type.STRING,
                description: "Brief summary or merchant name."
              },
              date: {
                type: Type.STRING,
                description: "The transaction date as recorded on receipt in YYYY-MM-DD format."
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No output text from Gemini model");
      }

      const parsedData = JSON.parse(resultText.trim());
      return res.json(parsedData);
    } catch (error: any) {
      console.error("Receipt Parse Error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze receipt" });
    }
  });

  // Server-side multi-document parse (Excel, PDF, or Picture with multiple entries)
  app.post("/api/parse-document-multi", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, textPreview } = req.body;
      if (!fileBase64 && !textPreview) {
        return res.status(400).json({ error: "No file content or text provided" });
      }

      let detectedMimeType = mimeType || "application/octet-stream";
      let base64Part = fileBase64;

      // Extract raw base64 data if it has Data URL prefix
      if (fileBase64 && fileBase64.includes(";base64,")) {
        const parts = fileBase64.split(";base64,");
        detectedMimeType = parts[0].replace("data:", "");
        base64Part = parts[1];
      }

      const lowerName = (fileName || '').toLowerCase();
      let extractedText = textPreview || '';
      let isSheet = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || detectedMimeType.includes("sheet") || detectedMimeType.includes("excel");
      let isCsv = lowerName.endsWith(".csv") || detectedMimeType === "text/csv";
      let isText = lowerName.endsWith(".txt") || detectedMimeType === "text/plain";

      // 1. If it's a Spreadsheet (Excel), use XLSX library to parse base64 to clean CSV text
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
          extractedText += `\n\nExtracted Excel CSV content:\n${sheetCsvs.join("\n\n")}`;
          isText = true; // Mark as text to allow direct prompt embed instead of binary
        } catch (excelErr: any) {
          console.error("Failed to parse excel via XLSX:", excelErr);
          extractedText += `\n[Failed to extract spreadsheet automatically: ${excelErr.message}]`;
        }
      }

      // 2. If it's a raw CSV or TXT, convert the base64 binary to a UTF-8 string
      if ((isCsv || isText) && base64Part && !extractedText.includes("Excel CSV content")) {
        try {
          const textContent = Buffer.from(base64Part, 'base64').toString('utf-8');
          extractedText += `\n\nExtracted File Raw Text:\n"""\n${textContent}\n"""`;
        } catch (textErr: any) {
          console.error("Failed to parse plain text/csv:", textErr);
        }
      }

      // 3. Prepare Gemini Contents:
      let contents: any[] = [];

      // We only append inlineData if it is natively supported by Gemini's multimodal parser
      // Supported multimodal formats: pdf, jpeg, png, webp, gif, heic, heif
      const isMultiModalSupported = 
        detectedMimeType === "application/pdf" || 
        detectedMimeType.startsWith("image/jpeg") || 
        detectedMimeType.startsWith("image/png") || 
        detectedMimeType.startsWith("image/webp") || 
        detectedMimeType.startsWith("image/gif") || 
        detectedMimeType.startsWith("image/heic") || 
        detectedMimeType.startsWith("image/heif");

      if (base64Part && isMultiModalSupported && !isSheet && !isCsv && !isText) {
        contents.push({
          inlineData: {
            mimeType: detectedMimeType,
            data: base64Part
          }
        });
      }

      // Add text instructions
      let promptText = `Analyze this uploaded document/file ("${fileName || 'Document'}") and extract multiple financial transactions (spent or saved) that are listed in it.
Find all individual transactions or records of spend/saving (e.g. bills, receipts, water, shop, power, transfers, rents, salary).
Extract them as a list of distinct transactions.`;
      
      if (extractedText.trim()) {
        promptText += `\n\nExtracted text/data content:\n"""\n${extractedText}\n"""`;
      }

      contents.push({ text: promptText });

      const response = await generateContentWithFallback({
        contents,
        fallbackModels: ["gemini-3.5-flash", "gemini-2.5-flash"],
        config: {
          systemInstruction: `You are an advanced financial audit agent that parses document contents (PDFs, images, CSVs, Excel files, receipts, bank statements) to extract multiple cash-flow items.
Extract every individual transaction found in the document content. Each item MUST be categorized and labeled as either an "expense" (spend, payment, utility, outflow) or "saving" (income, incoming, salary, transfer-in).

Categorize according to these standard categories only:
Savings Categories: 'Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'
Expenses Categories: 'Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'

For each extracted transaction, populate:
- amount: the numeric value of the transaction.
- type: either exactly "saving" or exactly "expense".
- category: the best matching category from the permitted lists above.
- description: a descriptive narrative (e.g., "Water Bill" or "Amazon Shopping"). Do not use generic numbers, try to name the specific service, shop or item (e.g., "Water Bill 500" -> "Water Bill").
- date: the transaction date in YYYY-MM-DD format if readable, otherwise default to the current date.

Respond with a JSON object containing a "transactions" key, which is a list/array of these parsed items.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["transactions"],
            properties: {
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["amount", "type", "category", "description", "date"],
                  properties: {
                    amount: { type: Type.NUMBER },
                    type: { type: Type.STRING, enum: ["saving", "expense"] },
                    category: { type: Type.STRING },
                    description: { type: Type.STRING },
                    date: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No output text from Gemini model");
      }

      const parsedData = JSON.parse(resultText.trim());
      return res.json(parsedData);
    } catch (error: any) {
      console.error("Multi-document Parse Error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze multi-transaction document" });
    }
  });

  // Vite middleware for development or Static Asset Serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Boot the full-stack server
startServer().catch((err) => {
  console.error("Failed to start express server:", err);
});
