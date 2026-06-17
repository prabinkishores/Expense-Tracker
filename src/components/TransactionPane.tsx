import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Hash, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Transaction, TransactionType, CountryCurrency } from '../types';
import { formatCurrency, getMonthName } from '../utils/dateUtils';
import { EXPENSE_CATEGORIES, SAVING_CATEGORIES } from '../utils/dataStore';

interface TransactionPaneProps {
  type: TransactionType;
  transactions: Transaction[];
  onAddClick: () => void;
  onDeleteTransaction: (id: string) => void;
  country: CountryCurrency;
}

export const TransactionPane: React.FC<TransactionPaneProps> = ({
  type,
  transactions,
  onAddClick,
  onDeleteTransaction,
  country
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = type === 'saving' ? SAVING_CATEGORIES : EXPENSE_CATEGORIES;

  // Filter & Search logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = 
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.amount.toString().includes(searchQuery);
      
      const matchCategory = selectedCategory === 'All' || t.category === selectedCategory;

      return matchSearch && matchCategory;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, searchQuery, selectedCategory]);

  // Total calculation for the current visible set
  const visibleTotal = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.amount, 0);
  }, [filteredTransactions]);

  // Style helpers based on Category
  const getCategoryTheme = (category: string) => {
    if (type === 'saving') {
      switch (category) {
        case 'Salary':
          return { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/50', text: 'text-emerald-600 dark:text-emerald-400', banner: 'bg-emerald-500' };
        case 'Investments':
          return { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-100 dark:border-cyan-900/50', text: 'text-cyan-600 dark:text-cyan-400', banner: 'bg-cyan-500' };
        case 'Side Hustle':
          return { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-100 dark:border-violet-900/50', text: 'text-violet-600 dark:text-violet-400', banner: 'bg-violet-500' };
        case 'Gifts':
          return { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-100 dark:border-rose-900/50', text: 'text-rose-600 dark:text-rose-400', banner: 'bg-rose-500' };
        case 'Interest Income':
          return { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-100 dark:border-amber-900/50', text: 'text-amber-600 dark:text-amber-400', banner: 'bg-amber-500' };
        default:
          return { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-100 dark:border-teal-900/50', text: 'text-teal-600 dark:text-teal-400', banner: 'bg-teal-500' };
      }
    } else {
      switch (category) {
        case 'Food & Dining':
          return { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-100 dark:border-orange-900/50', text: 'text-orange-600 dark:text-orange-400', banner: 'bg-orange-500' };
        case 'Shopping':
          return { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', border: 'border-fuchsia-100 dark:border-fuchsia-900/50', text: 'text-fuchsia-600 dark:text-fuchsia-400', banner: 'bg-fuchsia-500' };
        case 'Rent & Utilities':
          return { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900/50', text: 'text-blue-600 dark:text-blue-400', banner: 'bg-blue-500' };
        case 'Transportation':
          return { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-100 dark:border-sky-900/50', text: 'text-sky-600 dark:text-sky-400', banner: 'bg-sky-500' };
        case 'Entertainment':
          return { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-100 dark:border-rose-900/50', text: 'text-rose-600 dark:text-rose-400', banner: 'bg-rose-500' };
        case 'Healthcare':
          return { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-100 dark:border-red-900/50', text: 'text-red-600 dark:text-red-400', banner: 'bg-red-500' };
        case 'Education':
          return { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-100 dark:border-indigo-900/50', text: 'text-indigo-600 dark:text-indigo-400', banner: 'bg-indigo-500' };
        case 'Bills & Subscriptions':
          return { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-100 dark:border-purple-900/50', text: 'text-purple-600 dark:text-purple-400', banner: 'bg-purple-500' };
        default:
          return { bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-100 dark:border-slate-900/50', text: 'text-slate-600 dark:text-slate-400', banner: 'bg-slate-500' };
      }
    }
  };

  return (
    <div 
      id={`${type}-pane`}
      className="flex flex-col h-[520px] rounded-3xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      {/* Pane Heading Action */}
      <div className={`p-5 border-b border-slate-50 dark:border-slate-800/60 pb-4 flex items-center justify-between bg-radial from-transparent to-slate-50/20 dark:to-slate-900/10`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl p-2.5 ${
            type === 'saving' 
              ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400' 
              : 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400'
          }`}>
            {type === 'saving' ? (
              <TrendingUp className="h-6 w-6 stroke-[2.25]" />
            ) : (
              <TrendingDown className="h-6 w-6 stroke-[2.25]" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight font-display">
              {type === 'saving' ? 'Savings Pane' : 'Expenses Pane'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {type === 'saving' ? 'Manage your capital inflows' : 'Log and audit your spending'}
            </p>
          </div>
        </div>

        {/* Plus Circular Add Manual Button */}
        <button
          id={`add-${type}-button`}
          onClick={onAddClick}
          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] hover:shadow-lg ${
            type === 'saving' 
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10 hover:shadow-emerald-500/20 dark:bg-emerald-600 dark:hover:bg-emerald-500' 
              : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/10 hover:shadow-rose-500/20 dark:bg-rose-600 dark:hover:bg-rose-500'
          }`}
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add</span>
        </button>
      </div>

      {/* Filter / Search Controls */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-50 dark:border-slate-800/60 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            id={`${type}-search-input`}
            type="text"
            placeholder="Search amount, description, tags"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 outline-none transition-all focus:border-indigo-500 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-indigo-500"
          />
        </div>

        {/* Category Pick Filter */}
        <div className="relative min-w-[120px]">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <select
            id={`${type}-category-filter`}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-8 pr-6 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 appearance-none outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:border-indigo-500"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center pr-1 text-slate-400 dark:text-slate-500">
            <Plus className="h-3 w-3 rotate-45" />
          </div>
        </div>
      </div>

      {/* Transaction Records List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-slate-900">
        <AnimatePresence initial={false}>
          {filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => {
                const colors = getCategoryTheme(transaction.category);
                return (
                  <motion.div
                    key={transaction.id}
                    layoutId={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.2 }}
                    className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800/80 dark:bg-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs transition-all duration-200"
                  >
                    {/* Color Banner Indicator */}
                    <div className={`absolute left-0 top-1/3 bottom-1/3 w-[3.5px] rounded-r-full ${colors.banner}`} />

                    <div className="flex items-center gap-3 pl-1">
                      {/* Badge representation */}
                      <div className={`rounded-xl px-2.5 py-1.5 text-xs font-bold flex flex-col justify-center items-center ${colors.bg} ${colors.text} ${colors.border} border`}>
                        <span className="font-display font-bold font-sans tracking-wide text-[10px] uppercase">
                          {transaction.category.substring(0, 3)}
                        </span>
                      </div>

                      {/* Content block */}
                      <div className="max-w-[140px] sm:max-w-[200px]">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate leading-snug">
                          {transaction.category}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-snug mt-0.5">
                          {transaction.description || 'No notes added'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Value and Date */}
                      <div className="text-right">
                        <p className={`font-mono text-sm font-bold tracking-tight ${
                          type === 'saving' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-white'
                        }`}>
                          {type === 'saving' ? '+' : '-'}{formatCurrency(transaction.amount, country.locale, country.currency)}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1 mt-0.5 font-sans font-medium">
                          <Calendar className="h-2.5 w-2.5" />
                          {getMonthName(transaction.date)}
                        </p>
                      </div>

                      {/* Delete Trigger */}
                      <button
                        id={`delete-btn-${transaction.id}`}
                        onClick={() => onDeleteTransaction(transaction.id)}
                        className="rounded-xl p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:text-slate-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        title="Delete log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center py-10 px-4 text-center"
            >
              <div className={`rounded-2xl p-4 mb-4 ${
                type === 'saving' ? 'bg-emerald-50/50 dark:bg-emerald-950/15' : 'bg-rose-50/50 dark:bg-rose-950/15'
              }`}>
                <Layers className={`h-8 w-8 stroke-[1.5] ${
                  type === 'saving' ? 'text-emerald-400' : 'text-rose-400'
                }`} />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 font-display">
                No matching {type === 'saving' ? 'savings' : 'expenses'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                {searchQuery || selectedCategory !== 'All' 
                  ? 'Try relaxing your filter keywords' 
                  : `Tap '+ Add' to log your first client transaction!`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pane Footer total sum */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-50 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Pane Filtered Total:
        </span>
        <span className={`font-mono text-md font-extrabold tracking-tight ${
          type === 'saving' ? 'text-emerald-500' : 'text-rose-500'
        }`}>
          {formatCurrency(visibleTotal, country.locale, country.currency)}
        </span>
      </div>
    </div>
  );
};
