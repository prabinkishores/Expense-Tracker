import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Calendar, DollarSign, Tag, FileText, Camera, Loader2, FileSpreadsheet } from 'lucide-react';
import { Transaction, TransactionType, CountryCurrency } from '../types';
import { EXPENSE_CATEGORIES, SAVING_CATEGORIES } from '../utils/dataStore';
import { getLocalDateString } from '../utils/dateUtils';
import { DocumentUploadSection } from './DocumentUploadSection';
import { getApiUrl } from '../utils/apiResolver';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  type: TransactionType;
  country: CountryCurrency;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  type,
  country
}) => {
  const [viewMode, setViewMode] = useState<'manual' | 'bulk'>('manual');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(true);
  const [customCategoryText, setCustomCategoryText] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');

  const categories = type === 'saving' ? SAVING_CATEGORIES : EXPENSE_CATEGORIES;

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      setViewMode('manual');
      setAmount('');
      setCategory(categories[0] || '');
      setDate(getLocalDateString());
      setDescription('');
      setIsCustomCategory(true);
      setCustomCategoryText('');
      setIsProcessing(false);
      setScanMessage('');
    }
  }, [isOpen, type, categories]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setScanMessage('Processing image file...');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setScanMessage('Analyzing with Gemini AI...');
        try {
          const response = await fetch(getApiUrl('/api/parse-receipt'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: base64String,
              mimeType: file.type,
              type: type,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Receipt analysis failed');
          }

          const data = await response.json();
          if (data && typeof data.amount === 'number') {
            setAmount(String(data.amount));
            
            if (data.description) {
              setDescription(data.description);
            }
            if (data.date) {
              setDate(data.date);
            }
            if (data.category) {
              setCustomCategoryText(data.category);
              setIsCustomCategory(true);
            }
            setScanMessage('Success! Loaded receipt values.');
            setTimeout(() => setScanMessage(''), 3000);
          } else {
            throw new Error('No numeric amount could be detected');
          }
        } catch (error: any) {
          console.error("Scanning API Error:", error);
          alert(`Analysis Failed: ${error.message || 'Please input manually.'}`);
          setScanMessage('');
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setScanMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const finalCategory = isCustomCategory 
      ? customCategoryText.trim() || 'Custom'
      : category;

    onSubmit({
      type,
      amount: finalAmount,
      category: finalCategory,
      date: date || getLocalDateString(),
      description: description.trim()
    });
    
    onClose();
  };

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            id="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
          />

          {/* Dialog Container */}
          <motion.div
            id="modal-container"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className={`relative w-full overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 ${
              viewMode === 'bulk' ? 'max-w-4xl' : 'max-w-md'
            }`}
          >
            {/* Direct Close Button */}
            <button
              id="close-modal-button"
              onClick={onClose}
              className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors pointer-events-auto"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6 mr-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
                    type === 'saving' 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {viewMode === 'bulk' ? 'AI Bulk Uploader' : `Add Manual ${type === 'saving' ? 'Saving' : 'Expense'}`}
                  </span>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white font-display">
                    {viewMode === 'bulk' ? 'Upload Bulk Item' : 'Create new entry'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {viewMode === 'bulk'
                      ? 'Drop spreadsheets, CSVs, PDFs, text files, or simple lists and segregate items easily.'
                      : 'Log items directly to adjust totals automatically.'
                    }
                  </p>
                </div>
                {viewMode === 'bulk' && (
                  <button
                    id="back-to-manual-header-btn"
                    type="button"
                    onClick={() => setViewMode('manual')}
                    className="shrink-0 self-start sm:self-center inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none"
                  >
                    <span>← Manual Form</span>
                  </button>
                )}
              </div>
            </div>

            {/* Container for Form or Bulk Uploader */}
            {viewMode === 'bulk' ? (
              <div className="mt-4 max-h-[72vh] overflow-y-auto pr-1">
                <DocumentUploadSection
                  onAddTransaction={onSubmit}
                  country={country}
                  isModalLayout={true}
                  onAllAdded={() => {
                    setViewMode('manual');
                  }}
                />
              </div>
            ) : (
              <form id="transaction-form" onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="amount-input" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Amount <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        id="scan-receipt-button"
                        type="button"
                        disabled={isProcessing}
                        onClick={() => fileInputRef.current?.click()}
                        className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-xl transition-all cursor-pointer select-none ${
                          isProcessing 
                            ? 'text-amber-500 dark:text-amber-400 bg-amber-500/10' 
                            : 'text-indigo-600 hover:text-indigo-500 bg-indigo-600/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:hover:text-indigo-300'
                        }`}
                        title="Scan receipt photo to capture amount"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-3 w-3" />
                            <span>Scan Receipt</span>
                          </>
                        )}
                      </button>

                      <button
                        id="bulk-upload-toggle-button"
                        type="button"
                        onClick={() => setViewMode('bulk')}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-xl text-emerald-600 hover:text-emerald-500 bg-emerald-500/10 dark:bg-emerald-400/10 dark:text-emerald-450 dark:hover:text-emerald-355 transition-all cursor-pointer select-none font-sans"
                        title="Upload multiple transactions via Excel, CSV, PDF, or picture"
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        <span>Upload Bulk Item</span>
                      </button>
                    </div>
                  </div>

                {/* Hidden File Input for camera photo capture */}
                <input
                  type="file"
                  id="receipt-camera-capture"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 pr-2.5 border-r border-slate-100 dark:border-slate-850">
                    <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 mr-1">{country.flag}</span>
                    <span className="text-[10px] font-black font-sans tracking-tight text-slate-400 dark:text-slate-500">{country.currency}</span>
                  </div>
                  <input
                    id="amount-input"
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-[82px] pr-4 font-mono text-lg font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-950"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      id="amt-preset-100"
                      type="button"
                      onClick={() => setAmount((prev) => String((parseFloat(prev) || 0) + 100))}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      +100
                    </button>
                    <button
                      id="amt-preset-1000"
                      type="button"
                      onClick={() => setAmount((prev) => String((parseFloat(prev) || 0) + 1000))}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      +1k
                    </button>
                  </div>
                </div>
                {scanMessage && (
                  <div className={`mt-2 text-[11px] font-bold leading-tight flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed text-left ${
                    scanMessage.includes('Success')
                      ? 'text-emerald-650 bg-emerald-500/15 border-emerald-500/25 dark:text-emerald-400 dark:bg-emerald-500/10'
                      : 'text-indigo-650 dark:text-indigo-400 bg-indigo-500/15 border-indigo-500/25 dark:bg-indigo-500/10 animate-pulse'
                  }`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${scanMessage.includes('Success') ? 'bg-emerald-500' : 'bg-indigo-500 animate-ping'}`} />
                    {scanMessage}
                  </div>
                )}
              </div>

              {/* Category Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="category-select" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <button
                    id="toggle-custom-category"
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {isCustomCategory ? 'Select Standard' : 'Create Custom'}
                  </button>
                </div>
                
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Tag className="h-4 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  {isCustomCategory ? (
                    <input
                      id="custom-category-input"
                      type="text"
                      required
                      placeholder="Enter custom category name"
                      value={customCategoryText}
                      onChange={(e) => setCustomCategoryText(e.target.value)}
                      maxLength={30}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-950"
                    />
                  ) : (
                    <select
                      id="category-select"
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="block w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-10 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-950"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isCustomCategory && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                      <Plus className="h-4 w-4 rotate-45" />
                    </div>
                  )}
                </div>
              </div>

              {/* Date Option */}
              <div>
                <label htmlFor="date-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Calendar className="h-4,5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    id="date-input"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-mono text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-950"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Description / Note
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute top-3.5 left-0 flex items-start pl-4">
                    <FileText className="h-4.5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <textarea
                    id="description-input"
                    placeholder="What was this for? (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={100}
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-950 resize-none"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  id="cancel-submit-button"
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-center text-sm font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:active:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="confirm-submit-button"
                  type="submit"
                  className={`flex-1 rounded-2xl py-3.5 text-center text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                    type === 'saving'
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10 hover:shadow-emerald-500/20 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/10 hover:shadow-rose-500/20 dark:bg-rose-600 dark:hover:bg-rose-500'
                  }`}
                >
                  Confirm Entry
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
