import { createClient } from '@supabase/supabase-js';
import { Loan, Transaction, LoanType, Payment } from '../types';

// Safe environment variable access
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return process.env[key];
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_KEY');

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// --- Data Fetching (Normalized Tables) ---

export const fetchUserData = async () => {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch Loans
  const { data: loansData, error: loansError } = await supabase
    .from('loans')
    .select(`
      *,
      payments (*)
    `)
    .eq('user_id', user.id);

  if (loansError) console.error("Error fetching loans:", loansError);

  // Fetch Transactions
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id);

  if (txError) console.error("Error fetching transactions:", txError);

  // Map DB structure to Frontend Types
  const loans: Loan[] = (loansData || []).map((l: any) => ({
    id: l.id,
    name: l.name,
    lender: l.lender,
    principal: Number(l.principal),
    interestRate: Number(l.interest_rate),
    startDate: l.start_date,
    emiAmount: Number(l.emi_amount),
    tenureMonths: Number(l.tenure_months),
    initialPaidMonths: Number(l.initial_paid_months),
    dueDateDay: Number(l.due_date_day),
    type: l.type as LoanType,
    status: l.status,
    isForeclosed: l.is_foreclosed,
    payments: (l.payments || []).map((p: any) => ({
      id: p.id,
      date: p.date,
      amount: Number(p.amount),
      note: p.note
    }))
  }));

  const transactions: Transaction[] = (txData || []).map((t: any) => ({
    id: t.id,
    date: t.date,
    amount: Number(t.amount),
    type: t.type,
    category: t.category,
    description: t.description
  }));

  return { loans, transactions };
};

// --- Sync Functions (Write to DB) ---

export const saveLoanToDb = async (loan: Loan) => {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Convert CamelCase to Snake_Case for DB
  const payload = {
    id: loan.id,
    user_id: user.id,
    name: loan.name,
    lender: loan.lender,
    principal: loan.principal,
    interest_rate: loan.interestRate,
    start_date: loan.startDate,
    emi_amount: loan.emiAmount,
    tenure_months: loan.tenureMonths,
    initial_paid_months: loan.initialPaidMonths,
    due_date_day: loan.dueDateDay,
    type: loan.type,
    status: loan.status,
    is_foreclosed: loan.isForeclosed
  };

  const { error } = await supabase.from('loans').upsert(payload);
  if (error) console.error("Error saving loan:", error);
};

export const savePaymentToDb = async (loanId: string, payment: Payment) => {
  if (!supabase) return;
  
  const payload = {
    id: payment.id,
    loan_id: loanId,
    date: payment.date,
    amount: payment.amount,
    note: payment.note
  };

  const { error } = await supabase.from('payments').upsert(payload);
  if (error) console.error("Error saving payment:", error);
};

export const deleteLoanFromDb = async (loanId: string) => {
  if (!supabase) return;
  const { error } = await supabase.from('loans').delete().eq('id', loanId);
  if (error) console.error("Error deleting loan:", error);
};

export const saveTransactionToDb = async (tx: Transaction) => {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload = {
    id: tx.id,
    user_id: user.id,
    date: tx.date,
    amount: tx.amount,
    type: tx.type,
    category: tx.category,
    description: tx.description
  };

  const { error } = await supabase.from('transactions').upsert(payload);
  if (error) console.error("Error saving transaction:", error);
};

export const deleteTransactionFromDb = async (txId: string) => {
  if (!supabase) return;
  const { error } = await supabase.from('transactions').delete().eq('id', txId);
  if (error) console.error("Error deleting transaction:", error);
};

// --- Realtime Subscription ---

export const subscribeToRealtime = (
  table: 'loans' | 'transactions' | 'payments',
  callback: (eventType: string, payload: any) => void
) => {
  if (!supabase) return null;

  return supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => {
      callback(payload.eventType, payload.new || payload.old);
    })
    .subscribe();
};