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
  const [resetHomeToggle, setResetHomeToggle] = useState<boolean>(false);

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
  };  return (
    <div className="min-h-screen transition-colors duration-300 bg-white text-slate-800 dark:bg-black dark:text-slate-100 flex flex-col font-sans">
      {/* Upper Brand Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-100 dark:bg-black/80 dark:border-zinc-900 transition-colors">
        
        {/* Row 1: Logo Title + Shifted controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-3">
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-85 active:scale-95 transition-all select-none group"
            onClick={() => setResetHomeToggle(prev => !prev)}
            title="Go to Home Dashboard"
          >
            <div className="relative flex items-center justify-center rounded-2xl bg-indigo-600 p-2 sm:p-2.5 text-white shadow-md shadow-indigo-600/15 group-hover:scale-105 transition-transform shrink-0">
              <PiggyBank className="h-5.5 w-5.5 stroke-[2]" />
              <div className="absolute -bottom-1 -right-1 rounded-md bg-emerald-500 p-0.5 text-white border border-white dark:border-black scale-90">
                <CreditCard className="h-2.5 w-2.5" />
              </div>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white font-display flex items-center whitespace-nowrap">
                Expense Tracker
              </h1>
            </div>
          </div>

          {/* Shifted Action Tools - Made larger, nicely styled on the right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Country Selector Dropdown */}
            <div className="relative" id="country-dropdown-wrapper">
              <select
                id="app-country-selector"
                value={activeCountry.code}
                onChange={(e) => {
                  const targetMatch = COUNTRIES.find(c => c.code === e.target.value);
                  if (targetMatch) setActiveCountry(targetMatch);
                }}
                className="appearance-none cursor-pointer pl-3 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm font-extrabold rounded-xl border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-indigo-500 transition-all shadow-xs"
                title="Select currency country"
              >
                {COUNTRIES.map((countryItem) => (
                  <option key={countryItem.code} value={countryItem.code}>
                    {`${countryItem.flag} ${countryItem.currency}`}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400 dark:text-zinc-500">
                <span className="text-[10px]">▼</span>
              </div>
            </div>

            {/* API Settings Trigger */}
            <button
              id="header-settings-toggle"
              onClick={() => setIsSettingsOpen(true)}
              title="Mobile & AI Integration Settings"
              className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2 sm:p-2.5 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all cursor-pointer shadow-xs"
            >
              <Settings className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
            </button>

            {/* Theme switcher */}
            <button
              id="header-theme-toggle"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to light mode (white)' : 'Switch to dark mode (black)'}
              className="rounded-xl border border-slate-200 dark:border-zinc-800 p-2 sm:p-2.5 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all cursor-pointer shadow-xs"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-amber-500 fill-amber-500/10" />
              ) : (
                <Moon className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-indigo-500 fill-indigo-500/10" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-4">
        
        {/* Combined Totals Dash (The integrated 5-page bento layout) */}
        <section id="totals-section-block" className="py-0">
          <TotalsSection 
            transactions={transactions} 
            country={activeCountry} 
            onAddClick={triggerOpenModal}
            onDeleteTransaction={handleDeleteTransaction}
            resetHomeToggle={resetHomeToggle}
          />
        </section>



      </main>

      {/* Dynamic Creation Dialog */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTransaction}
        type={modalType}
        country={activeCountry}
        transactions={transactions}
      />

      {/* Integration & Mobile Routing Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
