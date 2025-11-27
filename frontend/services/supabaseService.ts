import { createClient } from '@supabase/supabase-js';
import { Loan, Transaction } from '../types';

// Provision to connect to Supabase
// Users must provide VITE_SUPABASE_URL and VITE_SUPABASE_KEY in environment variables
// Schema expected:
// Table 'loans': jsonb column 'data', uuid 'user_id'
// Table 'transactions': jsonb column 'data', uuid 'user_id'
// For this simple implementation, we might just store the whole JSON blob to avoid complex migrations for the user.

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_KEY || '';

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const saveUserData = async (loans: Loan[], transactions: Transaction[]) => {
  if (!supabase) return; // Fallback to local storage handled in App.tsx

  // Assuming a simple table structure where we store the entire state for the user
  // In a production app, you would have normalized tables (loans, payments, transactions tables)
  // For this demo provision:
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return; // Must be logged in

  const { error } = await supabase
    .from('user_data')
    .upsert({ 
      user_id: user.id, 
      loans_json: loans, 
      transactions_json: transactions,
      updated_at: new Date()
    }, { onConflict: 'user_id' });

  if (error) console.error("Supabase Save Error:", error);
};

export const fetchUserData = async () => {
  if (!supabase) return null;

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_data')
    .select('loans_json, transactions_json')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error("Supabase Fetch Error:", error);
    return null;
  }

  return {
    loans: data?.loans_json as Loan[] || [],
    transactions: data?.transactions_json as Transaction[] || []
  };
};

export const signInWithEmail = async (email: string) => {
    if(!supabase) return { error: "Supabase not configured" };
    // This is just a provision example. In real app, you'd have a full Auth UI.
    return await supabase.auth.signInWithOtp({ email });
};