export enum LoanType {
  EMI = 'EMI',
  NON_EMI = 'NON_EMI',
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
}

export interface Payment {
  id: string;
  date: string; // ISO String
  amount: number;
  note?: string;
}

export interface Loan {
  id: string;
  name: string;
  lender: string;
  principal: number;
  interestRate: number;
  startDate: string; // ISO String
  emiAmount: number; // For Non-EMI, this might be 0 or intended monthly payment
  tenureMonths: number;
  initialPaidMonths: number; // New: Number of EMIs paid before tracking started
  dueDateDay: number; // 1-31
  type: LoanType;
  payments: Payment[];
  isForeclosed: boolean;
  status: 'active' | 'completed';
}

export interface DashboardMetrics {
  totalOutstanding: number;
  totalMonthlyLiability: number;
  totalUnpaidEmisCount: number;
  totalUnpaidEmisValue: number;
  nextPaymentDate: string | null;
  debtFreeDate: string | null;
}