import React, { useMemo, useState, useEffect } from 'react';
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
  ChevronRight,
  Plus,
  Check,
  X,
  Percent,
  Search,
  Trash2,
  Calendar,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';
import { Transaction, CountryCurrency } from '../types';
import { TransactionPane } from './TransactionPane';
import { 
  isDateToday, 
  isDateThisWeek, 
  isDateThisMonth, 
  formatCurrency,
  getMonthName
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

  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState<string>('all');
  const [selectedSavingMonth, setSelectedSavingMonth] = useState<string>('all');

  const lastSixMonthsList = useMemo(() => {
    const list = [];
    const currentDate = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      list.push({
        label,
        value: `${year}-${month}`
      });
    }
    return list;
  }, []);

  // Persistent budget limit for current month expenditures
  const [budgetLimit, setBudgetLimit] = useState<number>(() => {
    return Number(localStorage.getItem('monthly_budget_limit') || '1000');
  });
  const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<boolean>(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState<boolean>(false);
  const [showOverspentToast, setShowOverspentToast] = useState<boolean>(false);
  const [lastOverspentAmount, setLastOverspentAmount] = useState<number>(0);

  // Category budget states
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('monthly_category_budgets');
    return saved ? JSON.parse(saved) : {};
  });
  const [showCategoryBudgetModal, setShowCategoryBudgetModal] = useState<boolean>(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState<string>('');
  const [newBudgetAmount, setNewBudgetAmount] = useState<string>('');

  // Helper to match category names flexibly (case-insensitive and substring)
  const matchCategory = (transactionCat: string, budgetCat: string) => {
    const normTx = transactionCat.trim().toLowerCase();
    const normBg = budgetCat.trim().toLowerCase();
    return normTx === normBg || normTx.includes(normBg) || normBg.includes(normTx);
  };

  const getCategoryMonthSpent = (catName: string) => {
    return transactions
      .filter(t => t.type === 'expense' && isDateThisMonth(t.date) && matchCategory(t.category, catName))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const [selectedDetailInterval, setSelectedDetailInterval] = useState<{ type: 'expense' | 'saving', range: 'today' | 'week' | 'month' } | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState<string>('');

  const getDetailCategoryStyle = (type: 'expense' | 'saving', category: string) => {
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

  const detailTransactions = useMemo(() => {
    if (!selectedDetailInterval) return [];
    const { type, range } = selectedDetailInterval;
    
    let filtered = transactions.filter(t => {
      if (t.type !== type) return false;
      if (range === 'today') return isDateToday(t.date);
      if (range === 'week') return isDateThisWeek(t.date);
      if (range === 'month') return isDateThisMonth(t.date);
      return true;
    });

    if (detailSearchQuery.trim() !== '') {
      const query = detailSearchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.category.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        t.amount.toString().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, selectedDetailInterval, detailSearchQuery]);

  const detailTotalAmount = useMemo(() => {
    return detailTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [detailTransactions]);

  const handleUpdateBudget = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val >= 0) {
      setBudgetLimit(val);
      localStorage.setItem('monthly_budget_limit', String(val));
      setIsAlertDismissed(false);
    }
    setIsEditingBudget(false);
    setBudgetInput('');
  };

  const handleAddBudgetDelta = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      const newBudget = budgetLimit + val;
      setBudgetLimit(newBudget);
      localStorage.setItem('monthly_budget_limit', String(newBudget));
      setIsAlertDismissed(false);
    }
    setIsEditingBudget(false);
    setBudgetInput('');
  };

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

  useEffect(() => {
    const currentMonthExpenses = stats.month.expenses;
    if (budgetLimit > 0 && currentMonthExpenses > budgetLimit) {
      if (currentMonthExpenses !== lastOverspentAmount) {
        setShowOverspentToast(true);
        setLastOverspentAmount(currentMonthExpenses);
        setIsAlertDismissed(false);
      }
    } else {
      setShowOverspentToast(false);
    }
  }, [budgetLimit, stats.month.expenses, lastOverspentAmount]);

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
    let expenses = transactions.filter(t => t.type === 'expense');

    if (selectedExpenseMonth !== 'all') {
      expenses = expenses.filter(t => t.date.startsWith(selectedExpenseMonth));
    }

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
  }, [transactions, selectedExpenseMonth]);

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
    let savings = transactions.filter(t => t.type === 'saving');

    if (selectedSavingMonth !== 'all') {
      savings = savings.filter(t => t.date.startsWith(selectedSavingMonth));
    }

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
  }, [transactions, selectedSavingMonth]);

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

  const getOuterTooltipPosition = (coordinate: any) => {
    if (!coordinate || typeof coordinate.x !== 'number' || typeof coordinate.y !== 'number') {
      return { x: 0, y: 0 };
    }
    
    // Center of the 256px container is (128, 128)
    const cx = 128;
    const cy = 128;
    
    const dx = coordinate.x - cx;
    const dy = coordinate.y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 5) {
      return { x: cx + 130, y: cy - 35 };
    }
    
    // Project outward to 135px (safely outside the 112px outer radius)
    const targetDistance = 135;
    const scale = targetDistance / distance;
    
    const targetX = cx + dx * scale;
    const targetY = cy + dy * scale;
    
    // Shift position depending on quadrant to avoid overlapping with the circle paths
    // Tooltip width is roughly 120-130px, height is roughly 75px
    const shiftX = dx >= 0 ? 10 : -140;
    const shiftY = dy >= 0 ? -30 : -45;
    
    return {
      x: Math.max(5, Math.min(250, targetX + shiftX)),
      y: Math.max(5, Math.min(250, targetY + shiftY))
    };
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
            {/* Screen 1: Expenses Overview and Living Outflows Pane */}
            {activeScreen === 1 && (
              <div className="space-y-6">

                {/* Monthly Expense Budget progress and setters (NOW ON TOP) */}
                <div className={`rounded-3xl border p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all duration-300 text-left ${
                  budgetLimit > 0 && stats.month.expenses > budgetLimit
                    ? 'border-rose-100 bg-rose-50/10 dark:border-rose-950/25 dark:bg-rose-950/10'
                    : 'border-emerald-100/60 bg-emerald-50/20 dark:border-emerald-950/30 dark:bg-emerald-950/10'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Header Left details */}
                    <div>
                      <h4 className="text-md font-bold text-slate-800 dark:text-white font-display flex items-center gap-2">
                        {budgetLimit > 0 && stats.month.expenses > budgetLimit ? (
                          <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 animate-bounce" />
                        ) : (
                          <Activity className="h-4.5 w-4.5 text-emerald-500 shrink-0 animate-pulse" />
                        )}
                        Monthly Budget Limit Setup
                        {budgetLimit > 0 && stats.month.expenses > budgetLimit && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] sm:text-xs font-black text-rose-700 ring-1 ring-inset ring-rose-600/10 dark:bg-rose-950/30 dark:text-rose-400">
                            Exceeded
                          </span>
                        )}
                      </h4>
                    </div>

                    {/* Interactive inline Plus button / Setter Trigger */}
                    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none">
                      {!isEditingBudget ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-row flex-nowrap overflow-x-auto scrollbar-none w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingBudget(true);
                              setBudgetInput('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-xs font-black transition-all duration-200 select-none cursor-pointer bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-850 dark:text-white dark:hover:bg-zinc-800 active:scale-95 text-center shadow-3xs whitespace-nowrap"
                            title="Set or Increase Budget Limit"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Set Budget</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowCategoryBudgetModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-xs font-black transition-all duration-200 select-none cursor-pointer border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50/50 dark:border-indigo-950/40 dark:bg-zinc-950 dark:text-indigo-400 dark:hover:bg-zinc-900/40 active:scale-95 text-center shadow-3xs whitespace-nowrap"
                            title="Set Category Budgets (One-by-One)"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            <span>Category Budgets</span>
                          </button>
                          
                          {budgetLimit > 0 && (
                            <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              {showRemoveConfirm ? (
                                <div className="flex items-center gap-1 border border-rose-250 bg-rose-50/60 p-1 rounded-lg dark:border-rose-950/40 dark:bg-rose-950/25 whitespace-nowrap">
                                  <span className="text-[9px] sm:text-[10px] font-bold text-rose-500 dark:text-rose-400 px-1">Sure?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBudgetLimit(0);
                                      localStorage.setItem('monthly_budget_limit', '0');
                                      setShowRemoveConfirm(false);
                                    }}
                                    className="bg-rose-500 hover:bg-rose-600 text-white rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black cursor-pointer transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowRemoveConfirm(false)}
                                    className="text-slate-500 hover:text-slate-705 bg-white border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black cursor-pointer transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowRemoveConfirm(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] sm:text-xs font-black transition-all duration-200 select-none cursor-pointer border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-955/40 dark:text-rose-450 dark:hover:bg-rose-950/25 active:scale-95 text-center whitespace-nowrap"
                                  title="Delete/Disable Budget Limit"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Remove Budget</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-zinc-500 font-bold font-mono">
                              {country.currency}
                            </span>
                            <input
                              type="number"
                              pattern="[0-9]*"
                              inputMode="numeric"
                              placeholder="e.g. 500"
                              value={budgetInput}
                              onChange={(e) => setBudgetInput(e.target.value)}
                              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 w-full sm:w-28 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Option 1: ADD delta with + icon */}
                            <button
                              type="button"
                              onClick={handleAddBudgetDelta}
                              disabled={!budgetInput || isNaN(parseFloat(budgetInput)) || parseFloat(budgetInput) <= 0}
                              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 select-none cursor-pointer"
                              title="Add this amount to current budget limit"
                            >
                              <Plus className="h-3 w-3" />
                              Add (+Amt)
                            </button>

                            {/* Option 2: SET value absolute */}
                            <button
                              type="button"
                              onClick={handleUpdateBudget}
                              disabled={!budgetInput || isNaN(parseFloat(budgetInput)) || parseFloat(budgetInput) < 0}
                              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 select-none cursor-pointer"
                              title="Overwrite to set a specific new limit"
                            >
                              <Check className="h-3 w-3" />
                              Set
                            </button>

                            {/* Cancel */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingBudget(false);
                                setBudgetInput('');
                              }}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 select-none cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Budget & Spend metrics detail row */}
                  {/* Budget & Spend metrics detail row */}
                  {budgetLimit <= 0 && Object.keys(categoryBudgets).length === 0 ? (
                    <div className="mt-5 p-5 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-100/60 dark:border-zinc-850/50 text-center">
                      <Percent className="h-6 w-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2 stroke-[1.5]" />
                      <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        No budget limit is set for this month.
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        Use the <strong className="font-semibold text-slate-600 dark:text-zinc-300">"Set Budget"</strong> or <strong className="font-semibold text-slate-600 dark:text-zinc-300">"Category Budgets"</strong> actions above to track and visualize your limits.
                      </p>
                    </div>
                  ) : (() => {
                    const monthSpent = stats.month.expenses;
                    const categoryLimitSum = (Object.values(categoryBudgets) as number[]).reduce((sum: number, limit: number) => sum + limit, 0);
                    const effectiveLimit = budgetLimit > 0 ? budgetLimit : categoryLimitSum;
                    const pct = effectiveLimit > 0 ? (monthSpent / effectiveLimit) * 100 : 0;
                    
                    // Style attributes conforming to color mapping specifications
                    let colorBg = "bg-emerald-500";
                    let colorText = "text-emerald-500 dark:text-emerald-400 font-bold";
                    let stateLabel = "On Track";

                    if (monthSpent === 0) {
                      colorBg = "bg-emerald-500";
                      colorText = "text-emerald-600 dark:text-emerald-400 font-bold";
                      stateLabel = "Pristine Status (Zero Spent)";
                    } else if (pct <= 45) {
                      colorBg = "bg-emerald-500 dark:bg-emerald-400";
                      colorText = "text-emerald-600 dark:text-emerald-400 font-bold";
                      stateLabel = "Pristine State";
                    } else if (pct <= 75) {
                      colorBg = "bg-yellow-405 dark:bg-yellow-400";
                      colorText = "text-yellow-500 dark:text-yellow-400 font-bold";
                      stateLabel = "Moderate Speed";
                    } else if (pct <= 95) {
                      colorBg = "bg-orange-500 dark:bg-orange-400";
                      colorText = "text-orange-500 dark:text-orange-400 font-bold";
                      stateLabel = "Warning limit near";
                    } else {
                      colorBg = "bg-rose-500 dark:bg-rose-400 animate-pulse";
                      colorText = "text-rose-600 dark:text-rose-400 font-black";
                      stateLabel = "Deficit Limit Exceeded";
                    }

                    return (
                       <div className="mt-6 space-y-4 animate-in fade-in duration-300">
                         {/* Numbers Row */}
                         <div className="flex items-end justify-between border-b border-slate-50 dark:border-zinc-900/50 pb-2">
                           <div>
                             <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block leading-none font-display">
                               {budgetLimit > 0 ? "Monthly Budget Limit" : "Cumulative Category Budget"} (100%)
                             </span>
                             <span className="font-mono text-xl font-black text-slate-800 dark:text-white mt-1.5 inline-block leading-none">
                               {formatCurrency(effectiveLimit, country.locale, country.currency)}
                             </span>
                           </div>

                           <div className="text-right">
                             <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block leading-none font-display">
                               Spend amount
                             </span>
                             <span className="font-mono text-xl font-black text-slate-800 dark:text-white mt-1.5 inline-block leading-none">
                               {formatCurrency(monthSpent, country.locale, country.currency)}
                             </span>
                           </div>
                         </div>

                         {/* Progress track bar with segmented colors */}
                         <div className="space-y-2">
                           <div className="relative w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-850 overflow-hidden">
                             {/* Segmented bar */}
                             <motion.div
                               initial={{ width: 0 }}
                               animate={{ width: `${Math.min(pct, 100)}%` }}
                               transition={{ duration: 0.5, ease: "easeOut" }}
                               className={`h-full rounded-full transition-all duration-300 ${colorBg}`}
                             />
                           </div>

                           {/* Visual Info Label */}
                           <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                             <div className="flex items-center gap-1.5">
                               <span className={`inline-block h-2 w-2 rounded-full ${colorBg}`} />
                               <span>Status: <strong className={colorText}>{stateLabel}</strong></span>
                             </div>
                             <div className="font-mono font-bold">
                               <span>{pct.toFixed(0)}% Used</span>
                             </div>
                           </div>
                         </div>

                         {/* Individual Category Budgets Row Progress Segment (Show on Mainpage) */}
                         {false && (
                           <div className="mt-5 pt-4.5 border-t border-dashed border-slate-100 dark:border-zinc-850 space-y-3.5">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-display flex items-center gap-1">
                                 <SlidersHorizontal className="h-3 w-3" />
                                 Category Budget Limits & Progress
                               </span>
                               <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-black uppercase">
                                 {Object.keys(categoryBudgets).length} Categories
                               </span>
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                               {Object.entries(categoryBudgets).map(([catName, catLimitUntyped]) => {
                                 const catLimit = catLimitUntyped as number;
                                 const spent = getCategoryMonthSpent(catName);
                                 const catPct = catLimit > 0 ? (spent / catLimit) * 100 : 0;

                                 // Style variables conforming to category colors and spending state
                                 let catBarColor = "bg-indigo-500 dark:bg-indigo-400";
                                 let catTextColor = "text-indigo-600 dark:text-indigo-400";
                                 if (catPct > 100) {
                                   catBarColor = "bg-rose-500 dark:bg-rose-450 animate-pulse";
                                   catTextColor = "text-rose-600 dark:text-rose-400 font-extrabold";
                                 } else if (catPct > 80) {
                                   catBarColor = "bg-orange-500 dark:bg-orange-400";
                                   catTextColor = "text-orange-600 dark:text-orange-400 font-bold";
                                 } else if (catPct > 0) {
                                   catBarColor = "bg-emerald-500 dark:bg-emerald-450";
                                   catTextColor = "text-emerald-600 dark:text-emerald-400 font-bold";
                                 }

                                 return (
                                   <div 
                                     key={catName}
                                     className="p-3.5 rounded-2xl border border-slate-100 bg-white/70 dark:border-zinc-900/60 dark:bg-zinc-950/20 shadow-3xs flex flex-col justify-between hover:border-slate-200 dark:hover:border-zinc-800 transition-all duration-200 relative overflow-hidden group"
                                   >
                                     <div className={`absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-md ${catBarColor}`} />
                                     
                                     <div className="flex items-start justify-between gap-1.5 pl-1.5">
                                       <div className="min-w-0">
                                         <p className="text-xs font-bold truncate capitalize text-slate-705 dark:text-slate-250">
                                           {catName}
                                         </p>
                                         <p className="text-[10px] text-slate-400 dark:text-zinc-550 font-semibold font-mono tracking-tight mt-0.5">
                                           {formatCurrency(spent, country.locale, country.currency)} of {formatCurrency(catLimit, country.locale, country.currency)}
                                         </p>
                                       </div>
                                       <div className="text-right shrink-0">
                                         <p className={`text-xs font-mono font-black ${catTextColor}`}>
                                           {catPct.toFixed(0)}%
                                         </p>
                                         {catPct > 100 && (
                                           <span className="text-[7.5px] font-black tracking-widest text-rose-550 dark:text-rose-400 uppercase inline-block font-display mt-0.5 animate-pulse">
                                             Limit Exceeded!
                                           </span>
                                         )}
                                       </div>
                                     </div>

                                     {/* Simple % bar rendering as requested */}
                                     <div className="mt-2.5 pl-1.5">
                                       <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-900 overflow-hidden">
                                         <motion.div
                                           initial={{ width: 0 }}
                                           animate={{ width: `${Math.min(catPct, 100)}%` }}
                                           transition={{ duration: 0.4 }}
                                           className={`h-full rounded-full ${catBarColor}`}
                                         />
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}

                       </div>
                    );
                  })()}
                </div>

                {/* Expenses Pane Ledger strictly nested in page 1 - NOW BELW */}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {intervals.map((interval) => (
                    <button
                      key={interval.id}
                      type="button"
                      onClick={() => {
                        setSelectedDetailInterval({ type: 'expense', range: interval.id as any });
                        setDetailSearchQuery('');
                      }}
                      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs hover:shadow-md hover:border-indigo-100/80 hover:bg-slate-50/20 dark:hover:border-indigo-950/40 dark:hover:bg-zinc-900/30 transition-all duration-300 text-left cursor-pointer group w-full"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-bold text-slate-800 dark:text-white font-display group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
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
                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-850 flex items-end justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-display">
                            Total Outflow Spent
                          </span>
                          <p className="font-mono text-3xl font-black text-rose-500 dark:text-rose-400 mt-2 leading-none tracking-tight">
                            {formatCurrency(interval.data.expenses, country.locale, country.currency)}
                          </p>
                        </div>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1 font-sans">
                          View details &rarr;
                        </span>
                      </div>
                    </button>
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
                    { id: 'today', title: "Today's Savings", desc: "Capital logged since midnight UTC", val: stats.today.savings },
                    { id: 'week', title: "This Week's Savings", desc: "Current rolling week capital flow", val: stats.week.savings },
                    { id: 'month', title: "This Month's Savings", desc: "Current month billing cycle gains", val: stats.month.savings },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedDetailInterval({ type: 'saving', range: item.id as any });
                        setDetailSearchQuery('');
                      }}
                      className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 dark:border-zinc-900 dark:bg-zinc-950 shadow-2xs hover:shadow-md hover:border-emerald-100/80 hover:bg-slate-50/20 dark:hover:border-emerald-950/40 dark:hover:bg-zinc-900/30 transition-all duration-300 text-left cursor-pointer group w-full"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-bold text-slate-800 dark:text-white font-display group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
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

                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-zinc-850 flex items-end justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block font-display">
                            Sum Received
                          </span>
                          <p className="font-mono text-3xl font-black text-emerald-500 dark:text-emerald-400 mt-2 leading-none tracking-tight">
                            {formatCurrency(item.val, country.locale, country.currency)}
                          </p>
                        </div>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1 font-sans">
                          View details &rarr;
                        </span>
                      </div>
                    </button>
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

                {/* Last 6 Months selection filter */}
                <div className="mb-6 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/30 dark:bg-zinc-900/40 dark:border-zinc-850/30">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-2 px-1 font-display">
                    Filter Spendings by Month (Last 6 Months)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedExpenseMonth('all')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-bold transition-all duration-200 select-none cursor-pointer border whitespace-nowrap ${
                        selectedExpenseMonth === 'all'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-500 dark:border-emerald-500'
                          : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850'
                      }`}
                    >
                      <span>All Time</span>
                    </button>
                    {lastSixMonthsList.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setSelectedExpenseMonth(m.value)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-bold transition-all duration-200 whitespace-nowrap select-none cursor-pointer border ${
                          selectedExpenseMonth === m.value
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-500 dark:border-emerald-500'
                            : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
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
                              <Tooltip content={<CustomPieTooltip />} position={getOuterTooltipPosition as any} />
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

                {/* Last 6 Months selection filter */}
                <div className="mb-6 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/30 dark:bg-zinc-900/40 dark:border-zinc-850/30">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-550 block mb-2 px-1 font-display">
                    Filter Savings by Month (Last 6 Months)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSavingMonth('all')}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-bold transition-all duration-200 select-none cursor-pointer border whitespace-nowrap ${
                        selectedSavingMonth === 'all'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-500 dark:border-emerald-500'
                          : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850'
                      }`}
                    >
                      <span>All Time</span>
                    </button>
                    {lastSixMonthsList.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setSelectedSavingMonth(m.value)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-bold transition-all duration-200 whitespace-nowrap select-none cursor-pointer border ${
                          selectedSavingMonth === m.value
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-500 dark:border-emerald-500'
                            : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
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
                              <Tooltip content={<CustomSavingPieTooltip />} position={getOuterTooltipPosition as any} />
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

      {/* Interactive Interval Detail Popup Modal */}
      <AnimatePresence>
        {selectedDetailInterval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedDetailInterval(null);
                setDetailSearchQuery('');
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md dark:bg-black/60"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg h-[500px] max-h-[85vh] flex flex-col rounded-3xl border border-slate-100 bg-white dark:border-zinc-850 dark:bg-zinc-950 shadow-2xl overflow-hidden text-left"
            >
              {/* Header block with visual indicator gradient */}
              <div className={`p-5 border-b border-slate-50 dark:border-zinc-900 flex items-center justify-between ${
                selectedDetailInterval.type === 'saving'
                  ? 'bg-radial from-transparent to-emerald-50/10 dark:to-emerald-950/5'
                  : 'bg-radial from-transparent to-rose-50/10 dark:to-rose-950/5'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl p-2.5 ${
                    selectedDetailInterval.type === 'saving'
                      ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {selectedDetailInterval.type === 'saving' ? (
                      <TrendingUp className="h-5.5 w-5.5 stroke-[2.25]" />
                    ) : (
                      <TrendingDown className="h-5.5 w-5.5 stroke-[2.25]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-md sm:text-lg font-extrabold text-slate-800 dark:text-white leading-tight font-display capitalize">
                      {selectedDetailInterval.range === 'today' ? 'Today\'s' : selectedDetailInterval.range === 'week' ? 'This Week\'s' : 'This Month\'s'}{' '}
                      {selectedDetailInterval.type === 'saving' ? 'Savings' : 'Expenses'}
                    </h3>
                    <p className="text-[11px] text-slate-405 dark:text-zinc-500 mt-1 font-sans font-medium">
                      Logged ledger items for the selected interval
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailInterval(null);
                    setDetailSearchQuery('');
                  }}
                  className="rounded-xl border border-slate-100 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:border-zinc-850 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-400 transition-all active:scale-95 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Filtering summary count and total dollars */}
              <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-zinc-900/30 border-b border-slate-50 dark:border-zinc-900 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-zinc-450">
                <span className="font-sans">
                  Found {detailTransactions.length} transaction{detailTransactions.length === 1 ? '' : 's'}
                </span>
                <span className={`font-mono text-sm ${
                  selectedDetailInterval.type === 'saving'
                    ? 'text-emerald-600 dark:text-emerald-450'
                    : 'text-rose-600 dark:text-rose-450'
                }`}>
                  Total: {selectedDetailInterval.type === 'saving' ? '+' : '-'}{formatCurrency(detailTotalAmount, country.locale, country.currency)}
                </span>
              </div>

              {/* Search Control */}
              <div className="p-4 bg-white dark:bg-zinc-950 border-b border-slate-50 dark:border-zinc-900/80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search amount, description, tags..."
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-150 bg-white text-slate-700 outline-none transition-all focus:border-indigo-500 placeholder-slate-400 dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Transactions List */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/15 dark:bg-zinc-950/10">
                <AnimatePresence initial={false}>
                  {detailTransactions.length > 0 ? (
                    <div className="space-y-2.5">
                      {detailTransactions.map((transaction) => {
                        const colors = getDetailCategoryStyle(selectedDetailInterval.type, transaction.category);
                        return (
                          <motion.div
                            key={transaction.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.18 }}
                            className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3 dark:border-zinc-900 dark:bg-zinc-900/40 hover:border-slate-205 dark:hover:border-zinc-800 shadow-2xs hover:shadow-xs transition-all duration-200"
                          >
                            {/* Color Side Indicator */}
                            <div className={`absolute left-0 top-[25%] bottom-[25%] w-[3px] rounded-r-full ${colors.banner}`} />

                            <div className="flex items-center gap-3 pl-1">
                              {/* Left initial badge */}
                              <div className={`rounded-xl px-2 py-1 text-[9px] font-black uppercase flex flex-col justify-center items-center ${colors.bg} ${colors.text} ${colors.border} border shrink-0 font-sans tracking-wider`}>
                                {transaction.category.substring(0, 3)}
                              </div>

                              {/* Label details */}
                              <div className="max-w-[140px] sm:max-w-[200px]">
                                <p className="font-bold text-slate-750 dark:text-slate-250 text-xs sm:text-sm truncate leading-tight">
                                  {transaction.category}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-550 truncate mt-0.5 leading-snug">
                                  {transaction.description || 'No notes added'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Amount & Date details */}
                              <div className="text-right">
                                <p className={`font-mono text-xs sm:text-sm font-black tracking-tight ${
                                  selectedDetailInterval.type === 'saving' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-white'
                                }`}>
                                  {selectedDetailInterval.type === 'saving' ? '+' : '-'}{formatCurrency(transaction.amount, country.locale, country.currency)}
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-zinc-550 flex items-center justify-end gap-1 mt-0.5 font-sans font-semibold">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {getMonthName(transaction.date)}
                                </p>
                              </div>

                              {/* Delete button (trash bin) */}
                              <button
                                type="button"
                                title="Delete transaction entry"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this log?")) {
                                    onDeleteTransaction(transaction.id);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-350 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-lg p-1.5 transition-all focus:opacity-100 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="rounded-full bg-slate-50 dark:bg-zinc-900 p-3 mb-3 border border-slate-100 dark:border-zinc-850">
                        <TrendingDown className="h-5 w-5 text-slate-300 dark:text-zinc-650" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 dark:text-zinc-550">
                        No transactions registered in this context.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Budgets Setup Modal */}
      <AnimatePresence>
        {showCategoryBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none">
            <div className="absolute inset-0" onClick={() => setShowCategoryBudgetModal(false)} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-lg w-full bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-slate-100 dark:border-zinc-900/80 overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-50 dark:border-zinc-900/85 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-indigo-50/80 dark:bg-indigo-950/20 p-2 text-indigo-500">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 dark:text-white font-display">
                      Manage Category Budgets
                    </h3>
                    <p className="text-[10px] text-slate-405 dark:text-zinc-500 font-medium font-sans mt-0.5">
                      Configure individual spending caps one-by-one
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowCategoryBudgetModal(false)}
                  className="rounded-xl border border-slate-100 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:border-zinc-850 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-400 transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form to Add New Category Budget */}
              <div className="p-5 border-b border-slate-50 dark:border-zinc-900/80 bg-slate-50/20 dark:bg-zinc-950/20 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-450 block mb-1">
                      Category Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Food, tour..."
                      value={newBudgetCategory}
                      onChange={(e) => setNewBudgetCategory(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 select-all dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-450 block mb-1">
                      Limit ({country.currency})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-450 dark:text-zinc-550 font-bold font-mono">
                        {country.currency}
                      </span>
                      <input
                        type="number"
                        placeholder="1000"
                        value={newBudgetAmount}
                        onChange={(e) => setNewBudgetAmount(e.target.value)}
                        className="w-full pl-7 pr-2 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 select-all dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-indigo-550 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset suggestions chips */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-550 mb-1.5 label text-left">
                    Suggestions (Click to load)
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {['Food & Dining', 'Shopping', 'Rent & Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Bills & Subscriptions', 'Travel', 'Petrol', 'Mobile', 'Water Bill', 'Current Bill', 'Tour', 'Others'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewBudgetCategory(preset)}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-100 bg-white hover:bg-slate-50 dark:border-zinc-900 dark:bg-zinc-900 dark:hover:bg-zinc-850/60 transition-colors text-slate-600 dark:text-zinc-400 cursor-pointer text-center"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const trimmedCat = newBudgetCategory.trim();
                      const parsedAmt = parseFloat(newBudgetAmount);
                      if (!trimmedCat) return;
                      if (isNaN(parsedAmt) || parsedAmt <= 0) return;
                      
                      const updated = { ...categoryBudgets, [trimmedCat]: parsedAmt };
                      setCategoryBudgets(updated);
                      localStorage.setItem('monthly_category_budgets', JSON.stringify(updated));
                      
                      setNewBudgetCategory('');
                      setNewBudgetAmount('');
                    }}
                    disabled={!newBudgetCategory.trim() || !newBudgetAmount || isNaN(parseFloat(newBudgetAmount)) || parseFloat(newBudgetAmount) <= 0}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold select-none cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Category Budget</span>
                  </button>
                </div>
              </div>

              {/* Scrollable listing of configured category budgets */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-3 bg-slate-50/15 dark:bg-zinc-950/20 text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-550 mb-1 block leading-none">
                  Configured Budgets ({Object.keys(categoryBudgets).length})
                </p>

                {Object.keys(categoryBudgets).length > 0 ? (
                  <div className="space-y-2.5">
                    {Object.entries(categoryBudgets).map(([catName, catLimitUntyped]) => {
                      const catLimit = catLimitUntyped as number;
                      const spent = getCategoryMonthSpent(catName);
                      const pct = catLimit > 0 ? (spent / catLimit) * 100 : 0;
                      
                      return (
                        <div 
                          key={catName}
                          className="p-3.5 rounded-2xl border border-slate-100 bg-white dark:border-zinc-900 dark:bg-zinc-950 flex flex-col gap-2.5 shadow-3xs hover:border-slate-205 transition-all text-left"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <span className="text-xs font-bold capitalize text-slate-800 dark:text-slate-100">
                                {catName}
                              </span>
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                                Spent This Month: {formatCurrency(spent, country.locale, country.currency)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Inline budget input editable */}
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold font-mono">
                                  {country.currency}
                                </span>
                                <input
                                  type="number"
                                  className="pl-5.5 pr-2 py-1 bg-slate-50 border border-slate-150 rounded-lg text-xs font-extrabold font-mono text-slate-700 w-20 text-right focus:outline-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                                  value={catLimit || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = { ...categoryBudgets };
                                    if (val === '') {
                                      updated[catName] = 0;
                                    } else {
                                      const numVal = parseFloat(val);
                                      if (!isNaN(numVal) && numVal >= 0) {
                                        updated[catName] = numVal;
                                      }
                                    }
                                    setCategoryBudgets(updated);
                                    localStorage.setItem('monthly_category_budgets', JSON.stringify(updated));
                                  }}
                                  placeholder="0"
                                />
                              </div>

                              {/* Remove item */}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...categoryBudgets };
                                  delete updated[catName];
                                  setCategoryBudgets(updated);
                                  localStorage.setItem('monthly_category_budgets', JSON.stringify(updated));
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer text-center flex items-center justify-center"
                                title="Remove budget"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Progress indicator */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-405">
                              <span>Spend Progress</span>
                              <span className={pct > 100 ? "text-rose-500 animate-pulse font-black" : pct > 80 ? "text-orange-500 font-bold" : "text-emerald-500 font-bold"}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  pct > 100 ? "bg-rose-505 dark:bg-rose-500" : pct > 80 ? "bg-orange-500" : "bg-emerald-500"
                                }`} 
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-slate-200/60 dark:border-zinc-900 rounded-3xl bg-slate-50/50 dark:bg-zinc-950/20">
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      No category budgets set up yet
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-650 mt-1">
                      Add custom names like "tour" or click on the presets above.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification for Budget Alert */}
      <AnimatePresence>
        {showOverspentToast && !isAlertDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-rose-950/20 dark:bg-zinc-950 flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-rose-500/10 p-2 text-rose-500 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-rose-450 font-display">
                    Budget Cap Breach!
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-medium font-sans">
                    Monthly spending exceeds threshold
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAlertDismissed(true)}
                className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-800 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                aria-label="Dismiss Alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="text-xs text-slate-300 font-sans leading-relaxed border-t border-slate-800 pt-2 dark:border-zinc-900/80">
              You spent <strong className="font-bold text-white">{formatCurrency(stats.month.expenses, country.locale, country.currency)}</strong>, exceeding budget limit by <span className="font-bold text-rose-400">{formatCurrency(stats.month.expenses - budgetLimit, country.locale, country.currency)}</span>.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
