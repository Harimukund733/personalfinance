import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './components/Dashboard';
import LoanManager from './components/LoanManager';
import BudgetManager from './components/BudgetManager';
import AIAdvisor from './components/AIAdvisor';
import { Loan, Payment, Transaction } from './types';
import { supabase, fetchUserData, saveUserData } from './services/supabaseService';
import { LayoutDashboard, List, PieChart, Wallet, Sun, Moon, User, Bell, Volume2, XCircle } from 'lucide-react';
import { getNextDueDate, AudioAlarm, generateUUID } from './utils';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'debts' | 'budget'>('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  
  // Audio Alarm instance
  const [alarm] = useState(() => new AudioAlarm());
  
  // Initial Load with Immediate Sanitization
  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_loans');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      // Ensure all loans have valid string IDs immediately
      return Array.isArray(parsed) ? parsed.map((l: any) => ({
          ...l,
          id: l.id ? String(l.id).trim() : generateUUID()
      })) : [];
    } catch (e) {
      console.error("Failed to parse loans", e);
      return [];
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('finance_app_transactions');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map((t: any) => ({
          ...t,
          id: t.id ? String(t.id).trim() : generateUUID()
      })) : [];
    } catch (e) {
      console.error("Failed to parse transactions", e);
      return [];
    }
  });

  // Apply Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Sync with Local Storage
  useEffect(() => {
    localStorage.setItem('finance_app_loans', JSON.stringify(loans));
    localStorage.setItem('finance_app_transactions', JSON.stringify(transactions));
    
    // Attempt cloud sync if connected
    if (supabase) {
      saveUserData(loans, transactions);
    }
  }, [loans, transactions]);

  // Check for Notifications & Overdue Loans
  useEffect(() => {
    if (loans.length === 0) return;

    const checkOverdue = () => {
       const today = new Date();
       const hasOverdue = loans.some(l => {
         if (l.status !== 'active') return false;
         
         const isPaidThisMonth = l.payments.some(p => {
            const pd = new Date(p.date);
            return pd.getMonth() === today.getMonth() && pd.getFullYear() === today.getFullYear();
         });
         
         return (today.getDate() > l.dueDateDay && !isPaidThisMonth);
       });

       if (hasOverdue) {
         if (Notification.permission === 'granted') {
             new Notification("EMI Alert!", { body: "You have overdue EMI payments!" });
         }
         if(!alarmPlaying) {
             setAlarmPlaying(true);
             alarm.play();
         }
       }
    };

    checkOverdue();
    const interval = setInterval(checkOverdue, 1000 * 60 * 60); 
    return () => {
        clearInterval(interval);
        alarm.stop();
    };
  }, [loans]);

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            alert("Notifications enabled!");
        }
    });
  };

  const stopAlarm = () => {
    alarm.stop();
    setAlarmPlaying(false);
  };

  // Auth Check
  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUserEmail(data.user.email || "User");
          fetchUserData().then(d => {
            if (d) {
              // Merge or set? Setting for now, could be improved.
              // Ensure we sanitize incoming cloud data too
              if(d.loans.length > 0) {
                  setLoans(d.loans.map(l => ({...l, id: String(l.id).trim()})));
              }
              if(d.transactions.length > 0) {
                  setTransactions(d.transactions.map(t => ({...t, id: String(t.id).trim()})));
              }
            }
          });
        }
      });
    }
  }, []);

  const addLoan = (loan: Loan) => {
    const newLoan = { ...loan, id: String(loan.id).trim() };
    setLoans(prev => [...prev, newLoan]);
  };

  const updateLoan = (updatedLoan: Loan) => {
    const safeId = String(updatedLoan.id).trim();
    setLoans(prev => prev.map(l => String(l.id).trim() === safeId ? updatedLoan : l));
  };

  const deleteLoan = (id: string) => {
    if (!id) {
        console.error("APP: Delete failed: No ID provided");
        return;
    }
    const targetId = String(id).trim();
    console.log("APP: Requesting delete for ID:", targetId);
    
    setLoans(prev => {
        const initialCount = prev.length;
        // Robust filtering: convert both to string and trim to be safe
        const filtered = prev.filter(l => String(l.id).trim() !== targetId);
        
        if (filtered.length === initialCount) {
            console.warn(`APP: Delete operation did not remove any items. Target ID: ${targetId}. Available IDs:`, prev.map(p => p.id));
        } else {
            console.log(`APP: Deleted successfully. Count ${initialCount} -> ${filtered.length}`);
        }
        
        return filtered;
    });
  };

  const addPayment = (loanId: string, payment: Payment) => {
      const targetId = String(loanId).trim();
      setLoans(prev => prev.map(l => {
          if (String(l.id).trim() === targetId) {
              return { ...l, payments: [...l.payments, payment] };
          }
          return l;
      }));
  };

  const addTransaction = (transaction: Transaction) => {
    const newTx = { ...transaction, id: String(transaction.id).trim() };
    setTransactions(prev => [...prev, newTx]);
  };

  const deleteTransaction = (id: string) => {
    if (!id) return;
    const targetId = String(id).trim();
    setTransactions(prev => prev.filter(t => String(t.id).trim() !== targetId));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-200 font-sans">
      
      {alarmPlaying && (
        <div className="fixed inset-0 z-[100] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white animate-pulse">
            <Volume2 size={64} className="mb-4 animate-bounce" />
            <h1 className="text-4xl font-bold mb-2">PAYMENT OVERDUE</h1>
            <p className="text-xl mb-8">Please check your debts immediately.</p>
            <button 
                onClick={stopAlarm}
                className="bg-white text-red-600 px-8 py-4 rounded-full font-bold text-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
            >
                <XCircle /> STOP ALARM
            </button>
        </div>
      )}

      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
               <PieChart className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              FinanceTracker
            </h1>
          </div>
          <div className="flex items-center gap-3">
             {supabase && <span className="hidden md:inline text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">Cloud Sync Active</span>}
            
            <button
                onClick={requestNotificationPermission}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors relative group"
            >
                <Bell size={20} />
            </button>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full">
               <User size={16} />
               <span>{userEmail || "Guest"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        <AIAdvisor loans={loans.filter(l => l.status === 'active')} />

        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'dashboard' 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button 
             onClick={() => setActiveTab('debts')}
             className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap ${
               activeTab === 'debts' 
                 ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                 : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
             }`}
          >
            <List size={18} /> Manage Debts
          </button>
          <button 
             onClick={() => setActiveTab('budget')}
             className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap ${
               activeTab === 'budget' 
                 ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                 : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
             }`}
          >
            <Wallet size={18} /> Income & Expenses
          </button>
        </div>

        <div className="animate-fade-in">
          {activeTab === 'dashboard' && (
            <Dashboard loans={loans} transactions={transactions} />
          )}
          {activeTab === 'debts' && (
            <LoanManager 
                loans={loans} 
                onAddLoan={addLoan} 
                onUpdateLoan={updateLoan}
                onDeleteLoan={deleteLoan}
                onAddPayment={addPayment}
                onAddTransaction={addTransaction}
            />
          )}
          {activeTab === 'budget' && (
            <BudgetManager 
              transactions={transactions}
              onAddTransaction={addTransaction}
              onDeleteTransaction={deleteTransaction}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;