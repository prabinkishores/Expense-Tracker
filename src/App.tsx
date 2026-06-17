import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  PiggyBank, 
  CreditCard, 
  Sun, 
  Moon, 
  RotateCcw, 
  Trash2, 
  FileJson,
  Info,
  Settings
} from 'lucide-react';
import { Transaction, TransactionType, CountryCurrency } from './types';
import { getDemoTransactions } from './utils/dataStore';
import { COUNTRIES } from './utils/dateUtils';
import { TransactionPane } from './components/TransactionPane';
import { TotalsSection } from './components/TotalsSection';
import { TransactionModal } from './components/TransactionModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('saji_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Country Selection state (Defaults to India since previous default was INR, or first index if not matching)
  const [activeCountry, setActiveCountry] = useState<CountryCurrency>(() => {
    const saved = localStorage.getItem('et_selected_country');
    if (saved) {
      const found = COUNTRIES.find(c => c.code === saved);
      if (found) return found;
    }
    // Default to India (INR, ₹)
    return COUNTRIES.find(c => c.code === 'IN') || COUNTRIES[0];
  });

  // Transactions list state
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('saji_transactions');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalType, setModalType] = useState<TransactionType>('saving');

  // Sync dark class on body/html
  useEffect(() => {
    localStorage.setItem('saji_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Sync transactions to localStorage
  useEffect(() => {
    localStorage.setItem('saji_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Sync selected country to localStorage
  useEffect(() => {
    localStorage.setItem('et_selected_country', activeCountry.code);
  }, [activeCountry]);

  // Handlers
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const item: Transaction = {
      ...newTx,
      id: 'tx-' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString()
    };
    setTransactions(prev => [item, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all transaction entries? This action is permanent.')) {
      setTransactions([]);
    }
  };

  const handleLoadDemo = () => {
    if (confirm('Load pre-populated demo records? This will merge with your active logs.')) {
      setTransactions(prev => [...getDemoTransactions(), ...prev]);
    }
  };

  const handleExportJSON = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transactions, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'expense_tracker_backup.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Failed to construct backup file: ' + String(e));
    }
  };

  const triggerOpenModal = (type: TransactionType) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-white text-slate-800 dark:bg-black dark:text-slate-100 flex flex-col font-sans">
      {/* Upper Brand Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-100 dark:bg-black/80 dark:border-zinc-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center rounded-2xl bg-indigo-600 p-2.5 text-white shadow-md shadow-indigo-600/10">
              <PiggyBank className="h-6 w-6 stroke-[2]" />
              <div className="absolute -bottom-1 -right-1 rounded-md bg-emerald-500 p-0.5 text-white border border-white dark:border-black scale-90">
                <CreditCard className="h-2.5 w-2.5" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display flex items-center gap-2">
                Expense Tracker
              </h1>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2.5">
            {/* Country Selector Dropdown */}
            <div className="relative" id="country-dropdown-wrapper">
              <select
                id="app-country-selector"
                value={activeCountry.code}
                onChange={(e) => {
                  const targetMatch = COUNTRIES.find(c => c.code === e.target.value);
                  if (targetMatch) setActiveCountry(targetMatch);
                }}
                className="appearance-none cursor-pointer pl-3 pr-8 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-indigo-500 transition-shadow transition-colors"
                title="Select currency country"
              >
                {COUNTRIES.map((countryItem) => (
                  <option key={countryItem.code} value={countryItem.code}>
                    {countryItem.flag} {countryItem.currency}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400 dark:text-zinc-500">
                <span className="text-[9px]">▼</span>
              </div>
            </div>

            {/* Vertical separator */}
            <span className="hidden sm:inline-block h-6 w-[1px] bg-slate-200 dark:bg-zinc-850" />

            {/* Demo Trigger */}
            <button
              id="header-load-demo-button"
              onClick={handleLoadDemo}
              title="Add dummy logs"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-805 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850/60 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Load Demo Data</span>
            </button>

            {/* Export Trigger */}
            <button
              id="header-export-backup"
              onClick={handleExportJSON}
              title="Download JSON backup"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-805 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-850/60 transition-colors cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            {/* Wipe trigger */}
            <button
              id="header-wipe-data"
              onClick={handleClearAll}
              title="Wipe data"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2 text-slate-500 dark:text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* API Settings Trigger */}
            <button
              id="header-settings-toggle"
              onClick={() => setIsSettingsOpen(true)}
              title="Mobile & AI Integration Settings"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>

            {/* Vertical separator */}
            <span className="h-6 w-[1px] bg-slate-200 dark:bg-zinc-850" />

            {/* Theme switcher */}
            <button
              id="header-theme-toggle"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to light mode (white)' : 'Switch to dark mode (black)'}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-55 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              {isDarkMode ? (
                <Sun className="h-4.5 w-4.5 text-amber-500 fill-amber-500/10" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-indigo-500 fill-indigo-500/10" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Combined Totals Dash (The integrated 5-page bento layout) */}
        <section id="totals-section-block" className="py-2">
          <TotalsSection 
            transactions={transactions} 
            country={activeCountry} 
            onAddClick={triggerOpenModal}
            onDeleteTransaction={handleDeleteTransaction}
          />
        </section>



      </main>

      {/* Footer Branding Credit */}
      <footer className="border-t border-slate-100 dark:border-zinc-900 bg-white dark:bg-black py-6 transition-colors mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400 dark:text-zinc-500">
          <p className="font-display">
            Expense Tracker © {new Date().getFullYear()}
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleLoadDemo}
              className="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              Populate Demo Data
            </button>
            <span>•</span>
            <button
              onClick={handleClearAll}
              className="hover:text-rose-500 transition-colors"
            >
              Purge Database
            </button>
          </div>
        </div>
      </footer>

      {/* Dynamic Creation Dialog */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTransaction}
        type={modalType}
        country={activeCountry}
      />

      {/* Integration & Mobile Routing Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
