import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Loader2, 
  Check, 
  CheckCircle,
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
  LogOut,
  Settings,
  Calendar
} from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../utils/firebaseAuth';
import { fetchDbsAlertsFromGmail, parseEmailAlert, GmailMessage } from '../utils/gmailService';
import { Transaction, CountryCurrency } from '../types';
import { prettifyGeminiError } from '../utils/geminiClient';

interface GmailSyncSectionProps {
  onAddTransaction: (newTx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  transactions?: Transaction[];
  country: CountryCurrency;
}

export const GmailSyncSection: React.FC<GmailSyncSectionProps> = ({ 
  onAddTransaction,
  transactions,
  country
}) => {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isParsingAll, setIsParsingAll] = useState<boolean>(false);
  const [parseAllProgress, setParseAllProgress] = useState<string>('');

  // Search filter query string state (supports emails from DBS and custom label:banking-alerts fallback)
  const [searchQuery, setSearchQuery] = useState<string>('from:ibanking.alert@dbs.com OR label:banking-alerts');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [syncLimit, setSyncLimit] = useState<number>(20);

  // Synced Gmail Message IDs state tracked in localStorage to prevent duplicate syncs
  const [syncedMsgIds, setSyncedMsgIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('saji_synced_gmail_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const markMsgIdSynced = (msgId: string) => {
    setSyncedMsgIds(prev => {
      const next = prev.includes(msgId) ? prev : [...prev, msgId];
      localStorage.setItem('saji_synced_gmail_ids', JSON.stringify(next));
      return next;
    });
  };

  const getDuplicationStatus = (item: GmailMessage) => {
    // 1. Check exact msg.id history
    if (syncedMsgIds.includes(item.id)) {
      return { isDuplicate: true, reason: 'Already Synced (Email ID)' };
    }

    // 2. Check if parsed details match any existing transaction inside the ledger (amount, date & type)
    if (item.parsed && transactions) {
      const isMatch = transactions.some(tx => 
        tx.amount === item.parsed?.amount &&
        tx.date === item.parsed?.date &&
        tx.type === item.parsed?.type
      );
      if (isMatch) {
        return { isDuplicate: true, reason: `Matches Ledger ID/Amount of $${item.parsed.amount.toFixed(2)} on ${item.parsed.date}` };
      }
    }

    return { isDuplicate: false, reason: '' };
  };

  // For inline manual review of a single message before importing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Others');
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<'saving' | 'expense'>('expense');

  // Load lists of categories from standard presets
  const savingsCategories = ['Salary', 'Investments', 'Side Hustle', 'Gifts', 'Interest Income', 'Refunds & Cashbacks', 'Allowances', 'Others'];
  const expensesCategories = ['Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Others'];

  useEffect(() => {
    // Initial Auth Listener
    const unsubscribe = initAuth(
      (user, cachedToken) => {
        setCurrentUser(user);
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => {
        setCurrentUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setCurrentUser(result.user);
        setNeedsAuth(false);
        // Automatically fetch mails on successful login
        fetchEmails(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Gmail Authentication cancelled or failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Disconnect Google account and clear search keys?')) {
      await logout();
      setCurrentUser(null);
      setToken(null);
      setNeedsAuth(true);
      setMessages([]);
    }
  };

  const fetchEmails = async (accessTokenToUse?: string) => {
    const activeToken = accessTokenToUse || token;
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      let finalQuery = searchQuery;
      if (startDate) {
        finalQuery += ` after:${startDate.replace(/-/g, '/')}`;
      }
      if (endDate) {
        try {
          const endD = new Date(endDate);
          // Standard offset addition to make endDate inclusive under Gmail API before: search
          endD.setDate(endD.getDate() + 1);
          const nextDayISO = endD.toISOString().substring(0, 10);
          finalQuery += ` before:${nextDayISO.replace(/-/g, '/')}`;
        } catch {
          finalQuery += ` before:${endDate.replace(/-/g, '/')}`;
        }
      }

      const fetched = await fetchDbsAlertsFromGmail(activeToken, syncLimit, finalQuery);
      setMessages(fetched);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || 
        'Could not list messages. Your session may have expired. Please try logging in again.'
      );
      // If unauthorized, re-trigger auth
      if (err.message && err.message.includes('401')) {
        setNeedsAuth(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleParseMessage = async (msg: GmailMessage) => {
    // Set loader on message
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: true } : m));
    setErrorMsg(null);

    try {
      const result = await parseEmailAlert(msg.body || msg.snippet, msg.date);
      
      // Update message structure with parse details
      setMessages(prev => prev.map(m => m.id === msg.id ? { 
        ...m, 
        loading: false,
        parsed: {
          amount: parseFloat(result.amount) || 0,
          type: result.type === 'saving' ? 'saving' : 'expense',
          category: result.category || 'Others',
          description: result.description || 'DBS Alert Entry',
          date: result.date || new Date().toISOString().substring(0, 10)
        }
      } : m));

      // Automatically open editing drawer for this item
      openEdit(
        msg.id, 
        parseFloat(result.amount) || 0, 
        result.description || 'DBS Alert Entry',
        result.category || 'Others',
        result.date || new Date().toISOString().substring(0, 10),
        result.type === 'saving' ? 'saving' : 'expense'
      );

    } catch (err: any) {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: false } : m));
      setErrorMsg(`AI Parsing failed: ${prettifyGeminiError(err)}`);
    }
  };

  const handleAIParseAllAlerts = async () => {
    if (messages.length === 0) return;
    
    const unparsedMessages = messages.filter(m => !m.parsed && !m.loading);
    if (unparsedMessages.length === 0) {
      alert("All loaded alerts have already been parsed or are currently parsing!");
      return;
    }

    setIsParsingAll(true);
    setErrorMsg(null);

    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < unparsedMessages.length; index++) {
      const msg = unparsedMessages[index];
      setParseAllProgress(`Analyzing ${index + 1} of ${unparsedMessages.length}...`);
      
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: true } : m));

      try {
        const result = await parseEmailAlert(msg.body || msg.snippet, msg.date);
        
        setMessages(prev => prev.map(m => m.id === msg.id ? { 
          ...m, 
          loading: false,
          parsed: {
            amount: parseFloat(result.amount) || 0,
            type: result.type === 'saving' ? 'saving' : 'expense',
            category: result.category || 'Others',
            description: result.description || 'DBS Alert Entry',
            date: result.date || new Date().toISOString().substring(0, 10)
          }
        } : m));
        successCount++;
      } catch (err: any) {
        console.error(`Alert analysis failed for msg [${msg.id}]:`, err);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: false } : m));
        failCount++;
      }

      // 1.5 seconds respectful pacing to stay well under any Gemini rate limits (RPM or concurrency)
      if (index < unparsedMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsParsingAll(false);
    setParseAllProgress('');
    if (failCount > 0) {
      setErrorMsg(`Successfully analyzed ${successCount} alerts. ${failCount} alerts failed or could not be parsed due to rate limits. You can try parsing failed ones individually!`);
    } else {
      alert(`AI completed! Successfully analyzed all ${successCount} transactions!`);
    }
  };

  const handleVerifyAndImportAll = () => {
    const parsedMessages = messages.filter(m => m.parsed);
    if (parsedMessages.length === 0) {
      alert("No parsed notifications are ready for import yet. Click 'AI Parse All Alerts' first!");
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    // Add each parsed transaction to ledger
    parsedMessages.forEach(msg => {
      if (msg.parsed) {
        // Run duplication check
        const dupStatus = getDuplicationStatus(msg);
        if (dupStatus.isDuplicate) {
          skippedCount++;
          // Mark as synced so we don't present it for parsing again
          markMsgIdSynced(msg.id);
          return;
        }

        onAddTransaction({
          amount: msg.parsed.amount,
          type: msg.parsed.type,
          category: msg.parsed.category,
          description: msg.parsed.description,
          date: msg.parsed.date
        });
        markMsgIdSynced(msg.id);
        addedCount++;
      }
    });

    // Remove imported/skipped messages from feed list
    const processedIds = new Set(parsedMessages.map(m => m.id));
    setMessages(prev => prev.filter(m => !processedIds.has(m.id)));
    setEditingMsgId(null);

    if (skippedCount > 0) {
      alert(`Import completed! Added ${addedCount} transactions. Skipped ${skippedCount} duplicate entries to prevent doubled records.`);
    } else {
      alert(`Successfully verified and imported ${addedCount} bank alert transactions to the ledger!`);
    }
  };

  const handleParseAndImportAll = async () => {
    if (messages.length === 0) return;
    
    const unparsedMessages = messages.filter(m => !m.loading);
    if (unparsedMessages.length === 0) {
      alert("All alerts are currently running, parsed, or being processed!");
      return;
    }

    setIsParsingAll(true);
    setErrorMsg(null);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let index = 0; index < unparsedMessages.length; index++) {
      const msg = unparsedMessages[index];

      // Pre-check: if exact message.id is already registered in synced history, skip right away
      if (syncedMsgIds.includes(msg.id)) {
        skippedCount++;
        setMessages(prev => prev.filter(m => m.id !== msg.id));
        continue;
      }

      setParseAllProgress(`Parsing & importing ${index + 1} of ${unparsedMessages.length}...`);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: true } : m));

      try {
        const result = await parseEmailAlert(msg.body || msg.snippet, msg.date);
        const amount = parseFloat(result.amount) || 0;
        
        if (amount > 0) {
          const type = result.type === 'saving' ? 'saving' : 'expense';
          const dateStr = result.date || new Date().toISOString().substring(0, 10);

          // Post-parse check: check ledger duplication
          const isMatch = transactions?.some(tx => 
            tx.amount === amount &&
            tx.date === dateStr &&
            tx.type === type
          );

          if (isMatch) {
            skippedCount++;
            markMsgIdSynced(msg.id);
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            continue;
          }

          // Add transaction directly to ledger
          onAddTransaction({
            amount: amount,
            type: type,
            category: result.category || 'Others',
            description: result.description || 'DBS Alert Entry',
            date: dateStr
          });
          markMsgIdSynced(msg.id);
          successCount++;
          // Filter out the imported alert
          setMessages(prev => prev.filter(m => m.id !== msg.id));
        } else {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: false } : m));
          failCount++;
        }
      } catch (err: any) {
        console.error(`Bulk item failed:`, err);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, loading: false } : m));
        failCount++;
      }

      // 1.5 seconds respectful pacing to stay well under any Gemini rate limits (RPM or concurrency)
      if (index < unparsedMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsParsingAll(false);
    setParseAllProgress('');
    
    let outcomeMessage = `Success! Parsed and imported ${successCount} transaction alerts.`;
    if (skippedCount > 0) {
      outcomeMessage += ` ${skippedCount} duplicate alerts were automatically skipped.`;
    }
    if (failCount > 0) {
      setErrorMsg(`Successfully parsed and auto-imported ${successCount} alerts (skipped ${skippedCount} duplicates). ${failCount} alerts could not be analyzed due to temporary rate limits. Try parsing them individually!`);
    } else {
      alert(outcomeMessage);
    }
  };

  const openEdit = (
    id: string, 
    amount: number, 
    desc: string, 
    cat: string, 
    dateStr: string, 
    type: 'saving' | 'expense'
  ) => {
    setEditingMsgId(id);
    setEditAmount(String(amount));
    setEditDescription(desc);
    setEditCategory(cat);
    setEditDate(dateStr);
    setEditType(type);
  };

  const handleSaveImport = (msgId: string) => {
    const doubleAmount = parseFloat(editAmount);
    if (isNaN(doubleAmount) || doubleAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const dateStr = editDate || new Date().toISOString().substring(0, 10);

    // Dynamic duplication check on current state
    const isMatch = transactions?.some(tx => 
      tx.amount === doubleAmount &&
      tx.date === dateStr &&
      tx.type === editType
    );

    if (isMatch) {
      if (!confirm(`Duplicate warning! There is already a transaction matching $${doubleAmount.toFixed(2)} on ${dateStr} in your records. Would you like to skip importing this, or add it anyway? Click 'OK' to add it anyway, or 'Cancel' to skip.`)) {
        // Discard it cleanly
        markMsgIdSynced(msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setEditingMsgId(null);
        return;
      }
    }

    // Call top-level action to enter into main records list!
    onAddTransaction({
      amount: doubleAmount,
      type: editType,
      category: editCategory,
      description: editDescription || 'DBS Bank Alert Transaction',
      date: dateStr
    });

    // Mark email item as parsed and added so we don't import repeatedly
    markMsgIdSynced(msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setEditingMsgId(null);
  };

  const categories = editType === 'saving' ? savingsCategories : expensesCategories;

  return (
    <div className="space-y-6" id="gmail-sync-workspace">
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl border border-rose-100 bg-rose-50/20 text-rose-600 dark:border-rose-950/20 dark:bg-rose-950/10 dark:text-rose-400 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <p className="font-medium leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {needsAuth ? (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl bg-slate-50/30 dark:bg-zinc-950/10 space-y-4 text-center px-4">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
            <Mail className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Connect with Google Gmail</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Authorize read-only credentials to let the application fetch DBS alerts and save yourself manual typing.
            </p>
          </div>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button text-xs font-bold font-sans cursor-pointer flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white hover:shadow-md transition-all select-none"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-indigo-505" />
                <span>Opening Sign In Window...</span>
              </>
            ) : (
              <>
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4 shrink-0 block">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Authorize Gmail Scanner</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active Logged In Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center dark:text-indigo-400 shrink-0">
                <UserIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Connected account</p>
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{currentUser?.email || 'Authenticated User'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleParseAndImportAll}
                  disabled={isParsingAll || loading}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-900/40 dark:text-indigo-400 transition-all cursor-pointer select-none disabled:opacity-55"
                  title="Decrypt and auto-parse all current alerts without manual review"
                >
                  {isParsingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span>{isParsingAll ? 'AI Parsing...' : 'Parse All'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchEmails()}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-all cursor-pointer select-none"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Scan Mail'}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="Disconnect from Google"
                className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900 transition-all cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Date range selection filter */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 shadow-sm text-left animate-fade-in" id="gmail-date-filter-panel">
            <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-200 mb-3.5 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Select Date Range to Synchronize Alerts Only</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider dark:text-zinc-500 flex items-center gap-1">
                  <span>Start Date (Inclusive)</span>
                </label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/30 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider dark:text-zinc-500 flex items-center gap-1">
                  <span>End Date (Inclusive)</span>
                </label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/30 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider dark:text-zinc-500 flex items-center gap-1">
                  <span>Max Sync Alerts</span>
                </label>
                <select 
                  value={syncLimit}
                  onChange={(e) => setSyncLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/30 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                  <option value={10}>10 Alerts</option>
                  <option value={20}>20 Alerts</option>
                  <option value={50}>50 Alerts</option>
                  <option value={100}>100 Alerts</option>
                  <option value={200}>200 Alerts</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchEmails()}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50 disabled:pointer-events-none transition-all select-none min-h-[38px]"
                  title="Synchronize DBS accounts triggers filtered by start and end target dates"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Syncing...' : 'Sync Selected Dates'}</span>
                </button>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      // Fetch again without date constraint
                      setTimeout(() => {
                        fetchEmails();
                      }, 0);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors cursor-pointer select-none text-xs font-bold"
                    title="Clear selected target date ranges and re-fetch standard feeds"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-[10.5px] text-slate-400 dark:text-zinc-500 mt-2.5 leading-relaxed">
              💡 Leaving date inputs empty downloads the latest alerts without boundary queries. All conversions use safe offline Gmail parameters.
            </p>
          </div>

          {/* Adjustable search query settings */}
          <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/60 dark:border-zinc-850 text-xs text-left">
            <button 
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full font-bold text-slate-755 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer outline-none"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5 text-indigo-505 shrink-0" />
                <span>Adjust Gmail Search Criteria</span>
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-slate-500 dark:text-zinc-400 font-sans font-normal">
                {showAdvanced ? 'Hide options' : 'View options'}
              </span>
            </button>

            {showAdvanced ? (
              <div className="mt-3.5 space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-850">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                  By default, the scanner checks both your customized <strong>label:banking-alerts</strong> folder and standard DBS bank transfers to ensure no messages are missed. Choose a target mode or write a custom Gmail filters query below:
                </p>

                {/* Preset selectors */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('from:ibanking.alert@dbs.com OR label:banking-alerts');
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                      searchQuery === 'from:ibanking.alert@dbs.com OR label:banking-alerts'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 font-bold'
                        : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
                    }`}
                  >
                    🏷️ Combined Search (DBS OR label:banking-alerts)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('label:banking-alerts');
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                      searchQuery === 'label:banking-alerts'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 font-bold'
                        : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
                    }`}
                  >
                    📂 Label Only (label:banking-alerts)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('from:ibanking.alert@dbs.com');
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                      searchQuery === 'from:ibanking.alert@dbs.com'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400 font-bold'
                        : 'border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100'
                    }`}
                  >
                    ✉️ Sender Only (from:ibanking.alert@dbs.com)
                  </button>
                </div>

                {/* Custom code edit box */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-zinc-500">Raw Gmail API Query String</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. from:ibanking.alert@dbs.com label:banking-alerts"
                      className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-800 dark:text-white focus:border-indigo-500 outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => fetchEmails()}
                      disabled={loading}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      Apply & Scan
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Messages Feed View */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-505" />
              <p className="text-xs text-slate-500 dark:text-zinc-500">Searching inbox for DBS alerts...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
              <div className="p-3.5 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 mb-2">
                <Mail className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">No DBS Alerts Found</p>
              <p className="text-[11px] text-slate-450 dark:text-zinc-500 max-w-xs mt-1 leading-normal">
                Could not find messages from <code className="font-mono">ibanking.alert@dbs.com</code> in this inbox folder. Check your spam file or confirm sender address.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 text-left animate-fade-in">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-zinc-350">
                    Latest bank notifications ({messages.length})
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-zinc-500 mt-0.5">Bulk-parse everything with AI, verify, and import in a single click</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAIParseAllAlerts}
                    disabled={isParsingAll || loading}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50 transition-all font-sans select-none"
                    title="Run AI extraction models on all notifications"
                  >
                    {isParsingAll ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{parseAllProgress || 'AI Parsing...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-200" />
                        <span>AI Parse Alert to All</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyAndImportAll}
                    disabled={messages.filter(m => m.parsed).length === 0 || isParsingAll || loading}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-all font-sans select-none"
                    title="Add all successfully parsed notifications straight to ledger logs"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-100" />
                    <span>Verify &amp; Import All ({messages.filter(m => m.parsed).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleParseAndImportAll}
                    disabled={isParsingAll || loading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl border border-dashed border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-100/50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-50 select-none"
                    title="Directly add parsed data straight to records"
                  >
                    <span>Auto-Import (Direct)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 max-h-[50vh] overflow-y-auto pr-1">
                {messages.map((item) => {
                  const isEditingThis = editingMsgId === item.id;
                  const dupStatus = getDuplicationStatus(item);

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-4 bg-white dark:bg-zinc-950 ${
                        isEditingThis 
                          ? 'border-indigo-500 ring-2 ring-indigo-500/10' 
                          : dupStatus.isDuplicate
                            ? 'border-amber-200/60 bg-amber-50/5 dark:border-amber-950/20 dark:bg-amber-950/5 opacity-80 hover:opacity-100'
                            : 'border-slate-150 dark:border-zinc-855 hover:border-slate-200 dark:hover:border-zinc-750'
                      }`}
                    >
                      {/* Top Message Information Row */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-50 dark:border-zinc-900 pb-2">
                        <div className="space-y-1 min-w-0 flex-1 text-left">
                          {dupStatus.isDuplicate && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/35 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-600/15 dark:ring-amber-900/40 mb-1">
                              ⚠️ Potential Duplicate: {dupStatus.reason}
                            </span>
                          )}
                          <p className={`text-[10.5px] font-bold font-mono ${
                            dupStatus.isDuplicate ? 'text-amber-600 dark:text-amber-500' : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            Subject: {item.subject}
                          </p>
                          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
                            {item.snippet}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0 font-sans">
                          {item.date}
                        </span>
                      </div>

                      {/* Display parsing Form for review inside item */}
                      {isEditingThis ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50/50 dark:bg-zinc-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-850">
                          {/* Amount editing */}
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Amount</label>
                            <input 
                              type="number"
                              step="any"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* Description editing */}
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Merchant / Details</label>
                            <input 
                              type="text"
                              value={editDescription}
                              onChange={e => setEditDescription(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* Category select */}
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Category</label>
                            <select 
                              value={editCategory}
                              onChange={e => setEditCategory(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-800 dark:text-white cursor-pointer"
                            >
                              {categories.map((catOpt) => (
                                <option key={catOpt} value={catOpt}>{catOpt}</option>
                              ))}
                            </select>
                          </div>

                          {/* Date inputs */}
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Date</label>
                            <input 
                              type="date"
                              value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* Type Select */}
                          <div className="space-y-1 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Transaction Type</label>
                            <div className="flex gap-1.5 h-[34px] items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditType('expense');
                                  setEditCategory('Others');
                                }}
                                className={`flex-1 text-[10px] font-black py-1.5 rounded-lg border-2 text-center transition-colors cursor-pointer ${
                                  editType === 'expense'
                                    ? 'bg-white border-white text-red-500 dark:bg-zinc-900 dark:border-white dark:text-red-400 shadow-sm'
                                    : 'border-slate-200 dark:border-zinc-800 text-slate-405'
                                  }`}
                              >
                                Outflow
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditType('saving');
                                  setEditCategory('Others');
                                }}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                                  editType === 'saving'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                                    : 'border-slate-200 dark:border-zinc-800 text-slate-405'
                                  }`}
                              >
                                Inflow
                              </button>
                            </div>
                          </div>

                          {/* Save & Cancel Row */}
                          <div className="sm:col-span-2 md:col-span-5 flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-850">
                            <button
                              type="button"
                              onClick={() => setEditingMsgId(null)}
                              className="px-3 py-1.5 text-[10.5px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveImport(item.id)}
                              className="px-3 py-1.5 text-[10.5px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              <span>Verify & Import</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* If the item has already been successfully analyzed by AI */}
                          {item.parsed ? (
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-3.5 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-150/45 dark:border-indigo-900/25 text-left animate-fade-in animate-duration-300">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
                                <span className="inline-flex items-center gap-1.5 font-bold">
                                  <span className={`h-2.5 w-2.5 rounded-full ${item.parsed.type === 'saving' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                                  <span className="text-slate-400 dark:text-zinc-500 font-medium font-sans">Extracted:</span>
                                  <span className={`font-mono text-[13.5px] font-black ${item.parsed.type === 'saving' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    ${item.parsed.amount.toFixed(2)}
                                  </span>
                                </span>

                                <span className="text-slate-600 dark:text-zinc-300">
                                  Merchant: <strong className="text-slate-800 dark:text-white font-bold">{item.parsed.description}</strong>
                                </span>

                                <span className="px-2.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-md font-bold text-[10px] text-indigo-505 dark:text-indigo-400">
                                  {item.parsed.category}
                                </span>

                                <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">
                                  {item.parsed.date}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 self-end md:self-auto shrink-0 pt-0.5 md:pt-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.parsed) {
                                      openEdit(
                                        item.id,
                                        item.parsed.amount,
                                        item.parsed.description,
                                        item.parsed.category,
                                        item.parsed.date,
                                        item.parsed.type
                                      );
                                    }
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-655 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors cursor-pointer select-none"
                                >
                                  Modify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.parsed) {
                                      const dupStatus = getDuplicationStatus(item);
                                      if (dupStatus.isDuplicate) {
                                        if (!confirm(`Duplicate warning! ${dupStatus.reason}. Are you sure you want to import this potential duplicate transaction anyway?`)) {
                                          // Discard cleanly
                                          markMsgIdSynced(item.id);
                                          setMessages(prev => prev.filter(m => m.id !== item.id));
                                          return;
                                        }
                                      }
                                      onAddTransaction({
                                        amount: item.parsed.amount,
                                        type: item.parsed.type,
                                        category: item.parsed.category,
                                        description: item.parsed.description,
                                        date: item.parsed.date
                                      });
                                      markMsgIdSynced(item.id);
                                      setMessages(prev => prev.filter(m => m.id !== item.id));
                                    }
                                  }}
                                  className="px-3.5 py-1 text-[11px] font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/10 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Verify &amp; Import</span>
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="flex items-center justify-end gap-2 pt-0.5">
                            {item.loading ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>AI Extracting notification details...</span>
                              </div>
                            ) : !item.parsed ? (
                              <button
                                type="button"
                                onClick={() => handleParseMessage(item)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 cursor-pointer select-none transition-all"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>AI Parse Alert</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
