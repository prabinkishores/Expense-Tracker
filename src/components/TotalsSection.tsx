import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Activity, 
  TrendingDown, 
  TrendingUp, 
  PieChart, 
  Layers, 
  BarChart3, 
  PiggyBank,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Transaction, CountryCurrency } from '../types';
import { TransactionPane } from './TransactionPane';
import { 
  isDateToday, 
  isDateThisWeek, 
  isDateThisMonth, 
  formatCurrency 
} from '../utils/dateUtils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

interface TotalsSectionProps {
  transactions: Transaction[];
  country: CountryCurrency;
  onAddClick: (type: 'saving' | 'expense') => void;
  onDeleteTransaction: (id: string) => void;
}

export const TotalsSection: React.FC<TotalsSectionProps> = ({ 
  transactions, 
  country,
  onAddClick,
  onDeleteTransaction
}) => {
  const [activeScreen, setActiveScreen] = useState<number>(1);
  const [direction, setDirection] = useState<number>(0);

  const paginate = (newScreen: number) => {
    setDirection(newScreen > activeScreen ? 1 : -1);
    setActiveScreen(newScreen);
  };

  // Pre-calculate intervals using standard performance helpers
  const stats = useMemo(() => {
    // Savings arrays
    const sTodayArr = transactions.filter(t => t.type === 'saving' && isDateToday(t.date));
    const sWeekArr = transactions.filter(t => t.type === 'saving' && isDateThisWeek(t.date));
    const sMonthArr = transactions.filter(t => t.type === 'saving' && isDateThisMonth(t.date));
    const sTotalArr = transactions.filter(t => t.type === 'saving');

    // Expenses arrays
    const eTodayArr = transactions.filter(t => t.type === 'expense' && isDateToday(t.date));
    const eWeekArr = transactions.filter(t => t.type === 'expense' && isDateThisWeek(t.date));
    const eMonthArr = transactions.filter(t => t.type === 'expense' && isDateThisMonth(t.date));
    const eTotalArr = transactions.filter(t => t.type === 'expense');

    // Totals calculations
    const sToday = sTodayArr.reduce((sum, t) => sum + t.amount, 0);
    const sWeek = sWeekArr.reduce((sum, t) => sum + t.amount, 0);
    const sMonth = sMonthArr.reduce((sum, t) => sum + t.amount, 0);
    const sTotal = sTotalArr.reduce((sum, t) => sum + t.amount, 0);

    const eToday = eTodayArr.reduce((sum, t) => sum + t.amount, 0);
    const eWeek = eWeekArr.reduce((sum, t) => sum + t.amount, 0);
    const eMonth = eMonthArr.reduce((sum, t) => sum + t.amount, 0);
    const eTotal = eTotalArr.reduce((sum, t) => sum + t.amount, 0);

    return {
      today: { savings: sToday, expenses: eToday },
      week: { savings: sWeek, expenses: eWeek },
      month: { savings: sMonth, expenses: eMonth },
      lifetimeSavings: sTotal,
      lifetimeExpenses: eTotal,
      netLifeTime: sTotal - eTotal
    };
  }, [transactions]);

  // Dynamically compute historical data for the last 6 calendar months (Chronological)
  const last6MonthsData = useMemo(() => {
    const data = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Use local time context
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11

    // Build the list of last 6 months starting from 5 months ago up to today
    for (let i = 5; i >= 0; i--) {
      // Find correctly shifted date boundary 
      const d = new Date(currentYear, currentMonth - i, 1);
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth(); // 0-based index

      // Filter transactions ledger matching year/month
      const monthlyTxs = transactions.filter(t => {
        if (!t.date) return false;
        const parts = t.date.split('-');
        if (parts.length < 2) return false;
        const txYear = parseInt(parts[0], 10);
        const txMonth = parseInt(parts[1], 10) - 1; // Convert 1-based string to 0-based
        return txYear === targetYear && txMonth === targetMonth;
      });

      const savingsSum = monthlyTxs
        .filter(t => t.type === 'saving')
        .reduce((sum, t) => sum + t.amount, 0);

      const expensesSum = monthlyTxs
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const yearShort = String(targetYear).slice(-2);
      data.push({
        name: `${monthNames[targetMonth]} '${yearShort}`,
        Savings: savingsSum,
        Expenses: expensesSum,
      });
    }

    return data;
  }, [transactions]);

  // Category colors for Expense breakdown
  const CATEGORY_COLORS: Record<string, string> = {
    'Food & Dining': '#e11d48', // rose-600
    'Shopping': '#be185d', // pink-700
    'Rent & Utilities': '#0284c7', // sky-600
    'Transportation': '#d97706', // amber-600
    'Entertainment': '#7c3aed', // violet-600
    'Healthcare': '#ea580c', // orange-600
    'Education': '#2563eb', // blue-600
    'Bills & Subscriptions': '#4f46e5', // indigo-600
    'Travel': '#0d9488', // teal-600
    'Others': '#4b5563', // gray-600
  };

  const getCategoryColor = (category: string, index: number) => {
    return CATEGORY_COLORS[category] || Object.values(CATEGORY_COLORS)[index % Object.keys(CATEGORY_COLORS).length];
  };

  const expenseBreakdown = useMemo(() => {
    const categoriesMap: Record<string, number> = {};
    const expenses = transactions.filter(t => t.type === 'expense');

    expenses.forEach(t => {
      const cat = t.category || 'Others';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + t.amount;
    });

    const list = Object.entries(categoriesMap).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    const total = list.reduce((sum, item) => sum + item.value, 0);

    return {
      list,
      total
    };
  }, [transactions]);

  // Category colors for Savings breakdown (Inflows)
  const SAVING_CATEGORY_COLORS: Record<string, string> = {
    'Salary': '#10b981', // emerald-500
    'Investments': '#3b82f6', // blue-500
    'Side Hustle': '#0ea5e9', // sky-500
    'Gifts': '#eab308', // yellow-500
    'Interest Income': '#8b5cf6', // violet-550
    'Refunds & Cashbacks': '#ec4899', // pink-500
    'Allowances': '#14b8a6', // teal-500
    'Others': '#64748b', // slate-500
  };

  const getSavingCategoryColor = (category: string, index: number) => {
    return SAVING_CATEGORY_COLORS[category] || Object.values(SAVING_CATEGORY_COLORS)[index % Object.keys(SAVING_CATEGORY_COLORS).length];
  };

  const savingBreakdown = useMemo(() => {
    const categoriesMap: Record<string, number> = {};
    const savings = transactions.filter(t => t.type === 'saving');

    savings.forEach(t => {
      const cat = t.category || 'Others';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + t.amount;
    });

    const list = Object.entries(categoriesMap).map(([name, value]) => ({
      name,
      value,
    })).sort((a, b) => b.value - a.value);

    const total = list.reduce((sum, item) => sum + item.value, 0);

    return {
      list,
      total
    };
  }, [transactions]);

  const intervals = [
    {
      id: 'today',
      title: 'Today',
      data: stats.today,
      desc: "Today's expenditures logged"
    },
    {
      id: 'week',
      title: 'This Week',
      data: stats.week,
      desc: 'Current week rolling expenditures'
    },
    {
      id: 'month',
      title: 'This Month',
      data: stats.month,
      desc: 'Current calendar billing cycle'
    }
  ];

  // Custom tooltips component for cleaner typography in standard Recharts output
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataObj = payload[0].payload || {};
      const savingsVal = typeof dataObj.Savings === 'number' ? dataObj.Savings : 0;
      const expensesVal = typeof dataObj.Expenses === 'number' ? dataObj.Expenses : 0;

      return (
        <div className="bg-slate-900 border border-slate-800 dark:bg-zinc-950 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xl space-y-1.5 transition-colors text-left">
          <p className="font-extrabold text-xs text-slate-300 dark:text-zinc-450 font-display">
            {label}
          </p>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-emerald-400 dark:text-emerald-500 flex items-center gap-1.5 font-sans">
              Savings: <span className="font-mono">{formatCurrency(savingsVal, country.locale, country.currency)}</span>
            </p>
            <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5 font-sans">
              Expenses: <span className="font-mono">{formatCurrency(expensesVal, country.locale, country.currency)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const percent = expenseBreakdown.total > 0 ? ((payload[0].value / expenseBreakdown.total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-slate-900 border border-slate-800 dark:bg-zinc-950 dark:border-zinc-800 p-3 rounded-2xl shadow-xl space-y-1 text-left">
          <p className="font-extrabold text-xs text-slate-300 dark:text-zinc-400 font-display">
            {entry.name}
          </p>
          <p className="text-xs font-semibold text-rose-500 flex items-center gap-1.5 font-sans">
            Amount: <span className="font-mono text-xs font-bold">{formatCurrency(payload[0].value, country.locale, country.currency)}</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium font-mono">
            Share: {percent}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomSavingPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const percent = savingBreakdown.total > 0 ? ((payload[0].value / savingBreakdown.total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-slate-900 border border-slate-800 dark:bg-zinc-950 dark:border-zinc-800 p-3 rounded-2xl shadow-xl space-y-1 text-left">
          <p className="font-extrabold text-xs text-slate-300 dark:text-zinc-400 font-display">
            {entry.name}
          </p>
          <p className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5 font-sans">
            Amount: <span className="font-mono text-xs font-bold">{formatCurrency(payload[0].value, country.locale, country.currency)}</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium font-mono">
            Share: {percent}%
          </p>
        </div>
      );
    }
    return null;
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 120 : -120,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 120 : -120,
      opacity: 0,
      scale: 0.98,
    }),
  };

  return (
    <div id="totals-dashboard-section" className="space-y-6">

      {/* Interactive Carousel Layout with Swapping indicators */}
      <div className="relative group px-1 sm:px-2">
        
        {/* Navigation Arrow Overlays with standard accessibility */}
        <div className="absolute -left-2 md:-left-4 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => {
              const prev = activeScreen === 1 ? 5 : activeScreen - 1;
              paginate(prev);
            }}
            className="p-1.5 sm:p-2.5 rounded-full border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 shadow-md text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            aria-label="Previous Page"
          >
            <ChevronLeft className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="absolute -right-2 md:-right-4 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={() => {
              const next = activeScreen === 5 ? 1 : activeScreen + 1;
              paginate(next);
            }}
            className="p-1.5 sm:p-2.5 rounded-full border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 shadow-md text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            aria-label="Next Page"
          >
            <ChevronRight className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Carousel slide frame preventing overflow */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeScreen}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.18 },
                scale: { duration: 0.2 }
              }}
            >
            {/* Screen 1: Expenses Overview with Financial Run-Rate Overview and Living Outflows Pane */}
            {activeScreen === 1 && (
              <div className="space-y-6">
                
                {/* Financial Run-Rate Overview (Strictly Page 1) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 font-display">
                      <Activity className="h-5 w-5 text-rose-500 animate-pulse" />
                      Financial Run-Rate Overview
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-sans">
                      Interactive analytical ledger representing cash flows
                    </p>
                  </div>

                  {/* Net Lifetime Balance block inside Run-Rate Header */}
                  <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100/40 dark:border-zinc-850 p-4 rounded-2xl text-left sm:text-right min-w-[200px] shadow-3xs">
                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none font-display">
                      Net Lifetime Balance
                    </span>
                    <p className={`font-mono text-xl font-black mt-1.5 leading-none tracking-tight ${
                      stats.netLifeTime >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {stats.netLifeTime >= 0 ? '+' : ''}{formatCurrency(stats.netLifeTime, country.locale, country.currency)}
                    </p>
                  </div>
                </div>

                {/* Expenses Pane Ledger strictly nested in page 1 - NOW ON TOP */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1" id="expenses-pane-block">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Living Outflows Ledger
                  </div>
                  <TransactionPane
                    type="expense"
                    transactions={transactions.filter(t => t.type === 'expense')}
                    onAddClick={() => onAddClick('expense')}
                    onDeleteTransaction={onDeleteTransaction}
                    country={country}
                  />
                </div>

                {/* Expenses Living Outflows Header - NOW BELOW */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-rose-500/5 border border-rose-500/10 p-5 rounded-3xl text-left">
                  <div>
                    <h3 className="text-md font-bold text-slate-800 dark:text-white font-display flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      Expenses Living Outflows
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-sans">
                      Detailed summaries tracking active cash spent timelines
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-505 uppercase tracking-widest block leading-none font-display">
                      Lifetime Outgoing
                    </span>
                    <p className="font-mono text-2xl font-black text-rose-500 dark:text-rose-455 mt-1.5 leading-none tracking-tight">
                      {formatCurrency(stats.lifetimeExpenses, country.locale, country.currency)}
                    </p>
                  </div>
                </div>

                {/* Grid containing Today, Week, Month cards - EXPENSES ONLY - NOW BELOW */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {intervals.map((interval) => (
                    <div
                      key={interval.id}
                      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs hover:shadow-sm hover:border-slate-200/80 dark:hover:border-zinc-800 transition-all duration-305 text-left"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-bold text-slate-800 dark:text-white font-display">
                            {interval.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 font-medium font-sans">
                            {interval.desc}
                          </p>
                        </div>
                        
                        <span className="inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 uppercase">
                          OUTFLOW
                        </span>
                      </div>

                      {/* Cash Numbers */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-850">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-display">
                          Total Outflow Spent
                        </span>
                        <p className="font-mono text-3xl font-black text-rose-500 dark:text-rose-400 mt-2 leading-none tracking-tight">
                          {formatCurrency(interval.data.expenses, country.locale, country.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screen 2: Savings Overview with savings statistics portal and Savings Ledger Pane */}
            {activeScreen === 2 && (
              <div className="space-y-6">
                
                {/* Savings Pane strictly nested in page 2 - NOW ON TOP */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1" id="savings-pane-block">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Asset Inflows Ledger
                  </div>
                  <TransactionPane
                    type="saving"
                    transactions={transactions.filter(t => t.type === 'saving')}
                    onAddClick={() => onAddClick('saving')}
                    onDeleteTransaction={onDeleteTransaction}
                    country={country}
                  />
                </div>

                {/* Asset Income & Savings statistics - NOW BELOW */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl text-left">
                  <div>
                    <h3 className="text-md font-bold text-slate-800 dark:text-white font-display flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Asset Income & Savings statistics
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-sans">
                      Consolidated income reserves and active asset generation sums
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest block leading-none font-display">
                      Total Inflow Saved
                    </span>
                    <p className="font-mono text-2xl font-black text-emerald-500 dark:text-emerald-455 mt-1.5 leading-none tracking-tight">
                      {formatCurrency(stats.lifetimeSavings, country.locale, country.currency)}
                    </p>
                  </div>
                </div>

                {/* Savings statistics intervals - NOW BELOW */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { title: "Today's Savings", desc: "Capital logged since midnight UTC", val: stats.today.savings },
                    { title: "This Week's Savings", desc: "Current rolling week capital flow", val: stats.week.savings },
                    { title: "This Month's Savings", desc: "Current month billing cycle gains", val: stats.month.savings },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs hover:shadow-sm hover:border-slate-200/80 dark:hover:border-zinc-800 transition-all duration-300 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-bold text-slate-800 dark:text-white font-display">
                            {item.title}
                          </h3>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 font-medium font-sans">
                            {item.desc}
                          </p>
                        </div>
                        
                        <span className="inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 uppercase">
                          INFLOW
                        </span>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-850">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block font-display">
                          Sum Received
                        </span>
                        <p className="font-mono text-3xl font-black text-emerald-500 dark:text-emerald-400 mt-2 leading-none tracking-tight">
                          {formatCurrency(item.val, country.locale, country.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screen 3: Expense Category Breakdown */}
            {activeScreen === 3 && (
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs transition-all duration-300 text-left">
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-50 dark:border-zinc-900 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                      Expense Outflow Breakdown
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1 font-sans">
                      Analyzed allocation of total expenditures across spending domains
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block leading-none font-display">
                      Managed Outflows
                    </span>
                    <p className="font-mono text-xl font-black text-slate-800 dark:text-white mt-1">
                      {formatCurrency(expenseBreakdown.total, country.locale, country.currency)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 min-h-[300px]">
                  {/* Left Side: Pie Chart */}
                  <div className="lg:col-span-6 relative flex items-center justify-center h-64">
                    {expenseBreakdown.list.length > 0 ? (
                      <>
                        <div className="absolute inset-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Tooltip content={<CustomPieTooltip />} />
                              <Pie
                                data={expenseBreakdown.list}
                                cx="50%"
                                cy="50%"
                                innerRadius="65%"
                                outerRadius="88%"
                                paddingAngle={2.5}
                                dataKey="value"
                              >
                                {expenseBreakdown.list.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={getCategoryColor(entry.name, index)} 
                                  />
                                ))}
                              </Pie>
                            </RePieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Centered label */}
                        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-550 font-display">
                            Total Spent
                          </span>
                          <span className="font-mono text-lg font-black text-slate-800 dark:text-white mt-1">
                            {formatCurrency(expenseBreakdown.total, country.locale, country.currency)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <div className="inline-flex items-center justify-center p-4 bg-rose-50/55 dark:bg-rose-950/10 rounded-2xl text-rose-500 mb-3">
                          <Activity className="h-6 w-6 stroke-[1.5]" />
                        </div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No Expenses Logged</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-sans">Add an outflow in the ledger layout to view results.</p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Detailed Percentages & Colored Badges */}
                  <div className="lg:col-span-6 max-h-[320px] overflow-y-auto scrollbar-thin space-y-2 pr-2 pt-1">
                    {expenseBreakdown.list.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {expenseBreakdown.list.map((entry, idx) => {
                          const color = getCategoryColor(entry.name, idx);
                          const percentage = ((entry.value / expenseBreakdown.total) * 100).toFixed(0);
                          return (
                            <div 
                              key={entry.name}
                              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-100/40 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors duration-300 font-sans"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span 
                                  className="h-3 w-3 rounded-full shrink-0 animate-pulse animate-duration-3000" 
                                  style={{ backgroundColor: color }} 
                                />
                                <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 truncate font-display">
                                  {entry.name}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-white block">
                                  {formatCurrency(entry.value, country.locale, country.currency)}
                                </span>
                                <span className="text-[9px] font-black text-rose-550 dark:text-rose-400 block uppercase tracking-wider leading-none mt-0.5">
                                  {percentage}% share
                                Orange </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 dark:text-zinc-550 text-xs font-sans">
                        A detailed list of spend distributions will appear here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Screen 4: Saving Category Breakdown (Newly added dynamically) */}
            {activeScreen === 4 && (
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs transition-all duration-300 text-left">
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-50 dark:border-zinc-900 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                      Savings Inflow Breakdown
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1 font-sans">
                      Analyzed allocation of total income additions across asset categories
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest block leading-none font-display">
                      Managed Inflows
                    </span>
                    <p className="font-mono text-xl font-black text-slate-800 dark:text-white mt-1">
                      {formatCurrency(savingBreakdown.total, country.locale, country.currency)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 min-h-[300px]">
                  {/* Left Side: Pie Chart */}
                  <div className="lg:col-span-6 relative flex items-center justify-center h-64">
                    {savingBreakdown.list.length > 0 ? (
                      <>
                        <div className="absolute inset-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Tooltip content={<CustomSavingPieTooltip />} />
                              <Pie
                                data={savingBreakdown.list}
                                cx="50%"
                                cy="50%"
                                innerRadius="65%"
                                outerRadius="88%"
                                paddingAngle={2.5}
                                dataKey="value"
                              >
                                {savingBreakdown.list.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={getSavingCategoryColor(entry.name, index)} 
                                  />
                                ))}
                              </Pie>
                            </RePieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Centered label */}
                        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-zinc-555 font-display">
                            Total Saved
                          </span>
                          <span className="font-mono text-lg font-black text-slate-800 dark:text-white mt-1">
                            {formatCurrency(savingBreakdown.total, country.locale, country.currency)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <div className="inline-flex items-center justify-center p-4 bg-emerald-50/55 dark:bg-emerald-950/10 rounded-2xl text-emerald-500 mb-3">
                          <Wallet className="h-6 w-6 stroke-[1.5]" />
                        </div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No Savings Logged</p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-sans">Add a saving asset in the ledger layout to view results.</p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Detailed Percentages & Colored Badges */}
                  <div className="lg:col-span-6 max-h-[320px] overflow-y-auto scrollbar-thin space-y-2 pr-2 pt-1">
                    {savingBreakdown.list.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {savingBreakdown.list.map((entry, idx) => {
                          const color = getSavingCategoryColor(entry.name, idx);
                          const percentage = ((entry.value / savingBreakdown.total) * 100).toFixed(0);
                          return (
                            <div 
                              key={entry.name}
                              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-100/40 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors duration-300 font-sans"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span 
                                  className="h-3 w-3 rounded-full shrink-0 animate-pulse animate-duration-3000" 
                                  style={{ backgroundColor: color }} 
                                />
                                <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 truncate font-display">
                                  {entry.name}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-white block">
                                  {formatCurrency(entry.value, country.locale, country.currency)}
                                </span>
                                <span className="text-[9px] font-black text-emerald-550 dark:text-emerald-400 block uppercase tracking-wider leading-none mt-0.5 font-sans">
                                  {percentage}% share
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 dark:text-zinc-550 text-xs font-sans">
                        A detailed list of saving categories will appear here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Screen 5: 6 Month Ledger Velocity */}
            {activeScreen === 5 && (
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs transition-all duration-300 text-left">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-55 dark:border-zinc-900 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                      6-Month Ledger Velocity comparison
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1 font-sans">
                      Side-by-side comparative representation of rolling monthly credit metrics
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-bold font-display uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 text-emerald-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Savings
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      Expenses
                    </span>
                  </div>
                </div>

                <div className="h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last6MonthsData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => {
                          return new Intl.NumberFormat(country.locale, { 
                            style: 'currency', 
                            currency: country.currency, 
                            maximumFractionDigits: 0 
                          }).format(val >= 1000 ? val / 1000 : val) + (val >= 1000 ? 'k' : '');
                        }}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      />
                      <Tooltip shared={true} content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.04)' }} />
                      <Bar 
                        dataKey="Savings" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={28}
                      />
                      <Bar 
                        dataKey="Expenses" 
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Extra Velocity Metrics under layout */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-850/80 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-900 border border-slate-105 dark:border-zinc-850">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest block leading-none font-display">
                      Average Mo. Savings Inflow
                    </span>
                    <p className="font-mono text-lg font-black text-emerald-500 dark:text-emerald-400 mt-2">
                      {formatCurrency(
                        last6MonthsData.reduce((sum, m) => sum + m.Savings, 0) / 6,
                        country.locale,
                        country.currency
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/10 border border-slate-105 dark:border-zinc-850">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest block leading-none font-display">
                      Average Mo. Expense Outflow
                    </span>
                    <p className="font-mono text-lg font-black text-rose-500 dark:text-rose-400 mt-2">
                      {formatCurrency(
                        last6MonthsData.reduce((sum, m) => sum + m.Expenses, 0) / 6,
                        country.locale,
                        country.currency
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-900 border border-slate-105 dark:border-zinc-850">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-555 uppercase tracking-widest block leading-none font-display">
                      Net Monthly Margin Delta
                    </span>
                    {(() => {
                      const avgSavings = last6MonthsData.reduce((sum, m) => sum + m.Savings, 0) / 6;
                      const avgExpenses = last6MonthsData.reduce((sum, m) => sum + m.Expenses, 0) / 6;
                      const delta = avgSavings - avgExpenses;
                      return (
                        <p className={`font-mono text-lg font-black mt-2 ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {delta >= 0 ? '+' : ''}{formatCurrency(delta, country.locale, country.currency)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom icon indicators - matching the 5 icons of the 5 tabs */}
        <div className="flex flex-col gap-4 pt-6 border-t border-slate-100 dark:border-zinc-850/60 mt-4 w-full">
          <div className="w-full bg-slate-50/70 dark:bg-zinc-900/55 border border-slate-100/50 dark:border-zinc-800/80 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-3xs grid grid-cols-5 gap-1 sm:gap-2">
            {[
              { id: 1, title: 'Expenses Tab', shortLabel: 'Expenses', icon: TrendingDown, color: 'text-rose-500 bg-rose-500/10' },
              { id: 2, title: 'Savings Tab', shortLabel: 'Savings', icon: PiggyBank, color: 'text-emerald-500 bg-emerald-500/10' },
              { id: 3, title: 'Expense Breakdown', shortLabel: 'Spend %', icon: PieChart, color: 'text-rose-500 bg-rose-500/10' },
              { id: 4, title: 'Saving Breakdown', shortLabel: 'Save %', icon: Layers, color: 'text-emerald-500 bg-emerald-500/10' },
              { id: 5, title: '6-Mo. Velocity', shortLabel: 'Trends', icon: BarChart3, color: 'text-indigo-500 bg-indigo-500/10' },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeScreen === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => paginate(tab.id)}
                  title={tab.title}
                  className={`py-3.5 px-1 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] select-none text-center relative ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-102'
                      : 'text-slate-400 dark:text-zinc-400 hover:bg-slate-100/70 dark:hover:bg-zinc-850/50'
                  }`}
                >
                  <TabIcon className="h-5.5 w-5.5 sm:h-6.5 sm:w-6.5 md:h-7 md:w-7 transition-transform duration-200 stroke-[2] shrink-0" />
                  <span className="text-[8px] min-[390px]:text-[9px] sm:text-[10px] font-black uppercase tracking-wider font-display truncate max-w-full leading-none">
                    {tab.shortLabel}
                  </span>
                  {isActive && (
                    <motion.span 
                      layoutId="activeIndicatorDot"
                      className="absolute bottom-1.5 h-1 w-1 rounded-full bg-rose-500 dark:bg-emerald-400"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-display flex items-center gap-1.5">
              Page {activeScreen} of 5 &middot; {
                activeScreen === 1 ? 'Expenses Outflow' :
                activeScreen === 2 ? 'Savings statistics' :
                activeScreen === 3 ? 'Expense Breakdown' :
                activeScreen === 4 ? 'Saving Breakdown' :
                'Ledger Velocity trends'
              }
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
