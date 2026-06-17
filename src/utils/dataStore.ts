import { Transaction } from '../types';

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Rent & Utilities',
  'Transportation',
  'Entertainment',
  'Healthcare',
  'Education',
  'Bills & Subscriptions',
  'Travel',
  'Others'
];

export const SAVING_CATEGORIES = [
  'Salary',
  'Investments',
  'Side Hustle',
  'Gifts',
  'Interest Income',
  'Refunds & Cashbacks',
  'Allowances',
  'Others'
];

export function getDemoTransactions(): Transaction[] {
  const today = new Date();
  
  // Helper to subtract days relative to real-time execution date
  const subDays = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(d.getDate() - days);
    return res;
  };
  
  const getFormatted = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getFormatted(today);
  const yesterdayStr = getFormatted(subDays(today, 1));
  const threeDaysAgoStr = getFormatted(subDays(today, 3));
  const tenDaysAgoStr = getFormatted(subDays(today, 10));

  return [
    // Savings - staggered
    {
      id: 'demo-s1',
      type: 'saving',
      amount: 60000,
      category: 'Salary',
      description: 'Monthly salary credited',
      date: tenDaysAgoStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-s2',
      type: 'saving',
      amount: 4500,
      category: 'Side Hustle',
      description: 'Consulting freelance project',
      date: threeDaysAgoStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-s3',
      type: 'saving',
      amount: 1200,
      category: 'Investments',
      description: 'Dividend payment receipt',
      date: yesterdayStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-s4',
      type: 'saving',
      amount: 1500,
      category: 'Gifts',
      description: 'Birthday gift cash',
      date: todayStr,
      createdAt: new Date().toISOString()
    },
    
    // Expenses - staggered
    {
      id: 'demo-e1',
      type: 'expense',
      amount: 15000,
      category: 'Rent & Utilities',
      description: 'Appartment rental',
      date: tenDaysAgoStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-e2',
      type: 'expense',
      amount: 1200,
      category: 'Food & Dining',
      description: 'Grocery shopping',
      date: yesterdayStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-e3',
      type: 'expense',
      amount: 450,
      category: 'Transportation',
      description: 'Ride hailing taxi',
      date: yesterdayStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-e4',
      type: 'expense',
      amount: 2500,
      category: 'Shopping',
      description: 'Warm winter jacket',
      date: threeDaysAgoStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-e5',
      type: 'expense',
      amount: 680,
      category: 'Food & Dining',
      description: 'Saji dinner with family',
      date: todayStr,
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-e6',
      type: 'expense',
      amount: 220,
      category: 'Entertainment',
      description: 'Streaming service monthly cost',
      date: todayStr,
      createdAt: new Date().toISOString()
    }
  ];
}

export function getInitialDemoTransactions(): Transaction[] {
  return [];
}
