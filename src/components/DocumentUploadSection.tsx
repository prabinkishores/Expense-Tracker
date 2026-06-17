import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  Check, 
  Plus, 
  Trash2, 
  AlertCircle,
  HelpCircle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';
import { Transaction, CountryCurrency, TransactionType } from '../types';

interface DocumentUploadSectionProps {
  onAddTransaction: (newTx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  country: CountryCurrency;
  onAllAdded?: () => void;
  isModalLayout?: boolean;
}

interface ParsedItem {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  added: boolean;
}

export const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({ 
  onAddTransaction,
  country,
  onAllAdded,
  isModalLayout
}) => {
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lists of categories for select box in inline edit
  const savingsCategories = ['Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'];
  const expensesCategories = ['Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'];

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  // Process the dropped file
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Process file selector file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Reset uploader state
  const handleReset = () => {
    setSelectedFile(null);
    setParsedItems([]);
    setErrorMessage(null);
    setLoading(false);
    setLoadingStage('');
  };

  // Convert files to base64 and extract csv text if applicable
  const processFile = async (file: File) => {
    setSelectedFile(file);
    setLoading(true);
    setErrorMessage(null);
    setParsedItems([]);

    try {
      setLoadingStage('Preparing document file fields...');
      const fileBase64 = await fileToBase64(file);
      
      let textPreview = '';
      // If it's a CSV or TXT file, read text directly to send as a helpful fallback textPreview
      if (file.type === "text/csv" || file.name.endsWith(".csv") || file.type === "text/plain" || file.name.endsWith(".txt")) {
        setLoadingStage('Extracting spreadsheet strings...');
        textPreview = await readAsText(file);
      }

      setLoadingStage('Connecting with server and Gemini AI...');
      const response = await fetch('/api/parse-document-multi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type,
          fileName: file.name,
          textPreview
        })
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `HTTP Status ${response.status} failed`);
      }

      setLoadingStage('Formatting and segregating extracted financial records...');
      const data = await response.json();
      
      if (data && Array.isArray(data.transactions)) {
        const list: ParsedItem[] = data.transactions.map((t: any, index: number) => ({
          id: `parsed-${index}-${Date.now()}`,
          amount: parseFloat(t.amount) || 0,
          type: t.type === 'saving' ? 'saving' : 'expense',
          category: t.category || 'Others',
          description: t.description || 'Raw Extract Item',
          date: t.date || new Date().toISOString().substring(0, 10),
          added: false
        }));

        setParsedItems(list);
        if (list.length === 0) {
          setErrorMessage("Gemini could not find any recognizable transaction in the uploaded file. Please make sure the document lists prices and item descriptions (e.g., 'rent 100, shop 600').");
        }
      } else {
        throw new Error("Invalid response format received from extraction server");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred while parsing the file.");
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // Convert File object to Base64 String
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Read clean plain text
  const readAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Save specific item to active ledger (Expense or Saving section)
  const addSingleItem = (item: ParsedItem) => {
    if (item.added) return;
    
    onAddTransaction({
      amount: item.amount,
      type: item.type,
      category: item.category,
      description: item.description,
      date: item.date
    });

    setParsedItems(prev => {
      const nextList = prev.map(p => p.id === item.id ? { ...p, added: true } : p);
      if (nextList.length > 0 && nextList.every(p => p.added)) {
        setTimeout(() => {
          if (onAllAdded) {
            onAllAdded();
          } else {
            handleReset();
          }
        }, 1200);
      }
      return nextList;
    });
  };

  // Save all un-added items
  const addAllItems = () => {
    let count = 0;
    parsedItems.forEach(item => {
      if (!item.added) {
        onAddTransaction({
          amount: item.amount,
          type: item.type,
          category: item.category,
          description: item.description,
          date: item.date
        });
        count++;
      }
    });

    if (count > 0) {
      setParsedItems(prev => prev.map(p => ({ ...p, added: true })));
      setTimeout(() => {
        if (onAllAdded) {
          onAllAdded();
        } else {
          handleReset();
        }
      }, 1200);
    }
  };

  // Update a field inside our draft list
  const updateItemField = (id: string, field: keyof ParsedItem, value: any) => {
    setParsedItems(prev => prev.map(p => {
      if (p.id === id) {
        let updated = { ...p, [field]: value };
        // Ensure category defaults is chosen safely when type changes
        if (field === 'type') {
          updated.category = value === 'saving' ? 'Salary' : 'Others';
        }
        return updated;
      }
      return p;
    }));
  };

  // Delete a parsed transaction draft item
  const removeDraftItem = (id: string) => {
    setParsedItems(prev => prev.filter(p => p.id !== id));
  };

  // Format currency helpers
  const formatCurrencyLocal = (val: number) => {
    return new Intl.NumberFormat(country.locale, {
      style: 'currency',
      currency: country.currency,
      maximumFractionDigits: 2
    }).format(val);
  };

  const getFileIcon = () => {
    if (!selectedFile) return <UploadCloud className="h-10 w-10 text-indigo-500" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      return <FileSpreadsheet className="h-10 w-10 text-emerald-500" />;
    }
    if (ext === 'pdf') {
      return <FileText className="h-10 w-10 text-rose-500" />;
    }
    return <ImageIcon className="h-10 w-10 text-indigo-500" />;
  };

  return (
    <div 
      id="ai-document-uploader-section" 
      className={isModalLayout
        ? "transition-all duration-300 w-full"
        : "rounded-3xl border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-sm transition-all duration-300 w-full"
      }
    >
      
      {/* Header Info */}
      {!isModalLayout && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-900 pb-5 mb-6">
          <div>
            <h3 className="text-md font-bold text-slate-800 dark:text-white flex items-center gap-2 font-display">
              <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
              AI Bulk Transaction Scanner & Segregator
            </h3>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-sans">
              Upload any text file, spreadsheet table, PDF ledger, or simple receipt picture containing multiple items
            </p>
          </div>

          <button
            onClick={() => setShowHelper(!showHelper)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 hover:text-indigo-500 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span>See How It Works</span>
          </button>
        </div>
      )}

      {/* Helper Box */}
      {showHelper && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-500/10 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed space-y-2">
          <p className="font-bold text-indigo-600 dark:text-indigo-400">🤖 Supported Scenarios:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1.5">
            <li><strong>Multiple Lines:</strong> Copy-paste/screenshot multiple items (e.g., <i>"water 500, grocery 1000, salary 15000"</i>).</li>
            <li><strong>Form Spreadsheets:</strong> Upload detailed CSV or Excel statement lists listing several entries.</li>
            <li><strong>Physical Invoices/Receipts:</strong> Take a photo of an invoice or list of expenses.</li>
            <li><strong>Perfect Routing:</strong> You review the parsed transactions below and choose exactly which category or section (either <strong>Living Outflows</strong> or <strong>Asset Saving Inflows</strong>) they should be added to.</li>
          </ul>
        </div>
      )}

      {/* File Upload Stage Drop Zone */}
      {parsedItems.length === 0 && !loading && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragActive 
              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/5' 
              : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp,.heic,text/plain"
            className="hidden"
          />

          <div className="mb-4 p-3.5 bg-slate-100 dark:bg-zinc-900 rounded-2xl transition-all">
            {getFileIcon()}
          </div>

          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            {isDragActive ? "Drop your file right here" : "Click to browse or drop document here"}
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2 font-mono">
            PDF, PNG, JPEG, Excel XLSX, CSV or Text Logs up to 10MB
          </p>
        </div>
      )}

      {/* Loading Screen and Extraction state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
            <div className="absolute h-10 w-10 rounded-full border-4 border-indigo-500/20 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white">Analyzing and OCR scanning transaction values...</p>
            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1.5 font-mono animate-pulse">{loadingStage}</p>
          </div>
        </div>
      )}

      {/* Error Output */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5 mb-6">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-bold">Extraction could not complete successfully</p>
            <p className="leading-relaxed font-sans">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="text-xs font-bold text-rose-700 dark:text-rose-300 underline cursor-pointer hover:opacity-85 block"
            >
              Reset and upload another file
            </button>
          </div>
        </div>
      )}

      {/* Segregated Items Review List */}
      {parsedItems.length > 0 && !loading && (
        <div className="space-y-6">
          
          {/* File summary and global control bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 dark:bg-zinc-900/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-900">
            <div className="text-left">
              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block font-display">
                Uploaded document source
              </span>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 mt-1 truncate max-w-sm">
                📄 {selectedFile?.name || 'Local Ledger Document'} ({(selectedFile ? selectedFile.size / 1024 : 0).toFixed(1)} KB)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-600 dark:text-zinc-400 transition-colors cursor-pointer"
              >
                Clear / Upload New
              </button>
              
              <button
                onClick={addAllItems}
                disabled={parsedItems.every(p => p.added)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Add All to Respective Sections</span>
              </button>
            </div>
          </div>

          <div className="text-left border-b border-slate-100 dark:border-zinc-900 pb-2.5">
            <h4 className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1 font-display">
              Segregated Cash-Flow drafts ({parsedItems.length})
            </h4>
            <p className="text-[11px] text-slate-400/80 dark:text-zinc-500/85 pl-1 font-sans mt-0.5">
              Review items below. You can toggle each between **Saving** and **Expense** to routes them into separate sections!
            </p>
          </div>

          {/* Table list of parsed items */}
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {parsedItems.map((item) => (
              <div 
                key={item.id}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 text-left ${
                  item.added 
                    ? 'border-emerald-500/20 bg-emerald-500/[0.01] dark:bg-emerald-500/[0.015]' 
                    : item.type === 'saving'
                      ? 'border-emerald-500/10 hover:border-emerald-500/30 dark:border-zinc-900'
                      : 'border-rose-500/10 hover:border-rose-500/30 dark:border-zinc-900'
                }`}
              >
                {/* Visual strip colored indicator */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                  item.added 
                    ? 'bg-emerald-500' 
                    : item.type === 'saving' ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  
                  {/* First column: Type Switcher (Expense / Saving) */}
                  <div className="lg:col-span-2 flex flex-col gap-1.5 pl-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-display">
                      Destination Section
                    </span>
                    <div className="flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-50 dark:bg-zinc-950 w-fit">
                      <button
                        type="button"
                        disabled={item.added}
                        onClick={() => updateItemField(item.id, 'type', 'expense')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          item.type === 'expense'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500'
                        }`}
                        title="Route to Expenses"
                      >
                        <TrendingDown className="h-3 w-3" />
                        <span>Expense</span>
                      </button>
                      <button
                        type="button"
                        disabled={item.added}
                        onClick={() => updateItemField(item.id, 'type', 'saving')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          item.type === 'saving'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-600 dark:text-zinc-500'
                        }`}
                        title="Route to Savings"
                      >
                        <TrendingUp className="h-3 w-3" />
                        <span>Saving</span>
                      </button>
                    </div>
                  </div>

                  {/* Second column: Description and Date */}
                  <div className="lg:col-span-3 flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-display">
                      Details / Note
                    </span>
                    <input
                      type="text"
                      disabled={item.added}
                      value={item.description}
                      onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border text-slate-700 bg-white border-slate-200 focus:border-indigo-500 dark:text-zinc-200 dark:bg-zinc-950 dark:border-zinc-850"
                      placeholder="Description"
                    />
                  </div>

                  {/* Third column: Value Amount in Active Currency */}
                  <div className="lg:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-display">
                      Amount ({country.currency})
                    </span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {country.flag}
                      </span>
                      <input
                        type="number"
                        disabled={item.added}
                        value={item.amount || ''}
                        onChange={(e) => updateItemField(item.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs font-mono font-bold pl-8 pr-2 py-1.5 rounded-lg border text-slate-700 bg-white border-slate-200 focus:border-indigo-500 dark:text-zinc-200 dark:bg-zinc-950 dark:border-zinc-850"
                        placeholder="0.00"
                        step="any"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Fourth column: Category Dropdown */}
                  <div className="lg:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-display">
                      Category Selection
                    </span>
                    <select
                      disabled={item.added}
                      value={item.category}
                      onChange={(e) => updateItemField(item.id, 'category', e.target.value)}
                      className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border text-slate-700 bg-white border-slate-200 focus:border-indigo-500 dark:text-zinc-200 dark:bg-zinc-950 dark:border-zinc-850"
                    >
                      {item.type === 'saving' 
                        ? savingsCategories.map(c => <option key={c} value={c}>{c}</option>)
                        : expensesCategories.map(c => <option key={c} value={c}>{c}</option>)
                      }
                    </select>
                  </div>

                  {/* Fifth column: Date fields */}
                  <div className="lg:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-display">
                      Transaction Date
                    </span>
                    <input
                      type="date"
                      disabled={item.added}
                      value={item.date}
                      onChange={(e) => updateItemField(item.id, 'date', e.target.value)}
                      className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border text-slate-700 bg-white border-slate-200 focus:border-indigo-500 dark:text-zinc-200 dark:bg-zinc-950 dark:border-zinc-850"
                    />
                  </div>

                  {/* Last columns: Actions */}
                  <div className="lg:col-span-1 flex items-center justify-end gap-2 pt-2 lg:pt-4">
                    {item.added ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full dark:bg-emerald-500/15">
                        <Check className="h-3 w-3 stroke-[3]" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => removeDraftItem(item.id)}
                          type="button"
                          className="p-2 text-slate-400 hover:text-rose-500 dark:text-zinc-650 transition-colors cursor-pointer"
                          title="Remove item draft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => addSingleItem(item)}
                          type="button"
                          className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 dark:bg-zinc-900 dark:text-zinc-400 transition-all cursor-pointer shadow-3xs"
                          title={`Add to ${item.type === 'saving' ? 'Savings' : 'Expenses'}`}
                        >
                          <Plus className="h-4 w-4 stroke-[2.5]" />
                        </button>
                      </>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};
