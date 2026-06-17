export type TransactionType = 'saving' | 'expense';

export interface CountryCurrency {
  code: string;
  name: string;
  currency: string;
  locale: string;
  flag: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD local format
  createdAt: string; // ISO format Timestamp
}

export interface SummaryStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
}
