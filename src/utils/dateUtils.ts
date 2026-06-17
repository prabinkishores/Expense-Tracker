import { CountryCurrency } from '../types';

export const COUNTRIES: CountryCurrency[] = [
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', flag: '🇺🇸' },
  { code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', flag: '🇮🇳' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', flag: '🇬🇧' },
  { code: 'EU', name: 'Germany (Euro)', currency: 'EUR', locale: 'de-DE', flag: '🇪🇺' },
  { code: 'JP', name: 'Japan', currency: 'JPY', locale: 'ja-JP', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', flag: '🇨🇦' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', locale: 'en-SG', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', locale: 'ar-AE', flag: '🇦🇪' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', locale: 'de-CH', flag: '🇨🇭' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', locale: 'sv-SE', flag: '🇸🇪' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ', flag: '🇳🇿' }
];

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateToday(dateStr: string): boolean {
  return dateStr === getLocalDateString();
}

/**
 * Checks if a YYYY-MM-DD date string belongs to the current week (Monday to Sunday)
 */
export function isDateThisWeek(dateStr: string): boolean {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const targetDate = new Date(year, month, day);
    targetDate.setHours(0,0,0,0);

    const today = new Date();
    today.setHours(0,0,0,0);

    // Monday is start of week
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);
    monday.setHours(0,0,0,0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return targetDate >= monday && targetDate <= sunday;
  } catch (error) {
    console.error('Error parsing date for week checks', error);
    return false;
  }
}

export function isDateThisMonth(dateStr: string): boolean {
  const currentLocalStr = getLocalDateString();
  return dateStr.substring(0, 7) === currentLocalStr.substring(0, 7);
}

export function formatCurrency(amount: number, locale: string = 'en-IN', currency: string = 'INR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

export function getMonthName(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
