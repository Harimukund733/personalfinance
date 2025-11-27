import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { formatCurrency, generateUUID } from '../utils';
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet, Trash2 } from 'lucide-react';

interface BudgetManagerProps {
  transactions: Transaction[];
  onAddTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ transactions, onAddTransaction, onDeleteTransaction }) => {
  const [newTrans, setNewTrans] = useState<Partial<Transaction>>({
    type: 'expense',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrans.amount || !newTrans.category) return;

    onAddTransaction({
      id: generateUUID(),
      date: newTrans.date!,
      amount: Number(newTrans.amount),
      type: newTrans.type as TransactionType,
      category: newTrans.category,
      description: newTrans.description || ''
    });

    setNewTrans({
      type: newTrans.type, 
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      description: ''
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if(window.confirm("Delete this transaction?")) {
        onDeleteTransaction(id);
    }
  }

  const metrics = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
               <ArrowDownLeft size={20} />
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total Income</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(metrics.income)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
           <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
               <ArrowUpRight size={20} />
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total Expenses</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(metrics.expense)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
           <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
               <Wallet size={20} />
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Net Balance</span>
          </div>
          <h3 className={`text-2xl font-bold ${metrics.balance >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(metrics.balance)}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-4 transition-colors">
             <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Add Transaction</h3>
             
             <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setNewTrans({...newTrans, type: 'income'})}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newTrans.type === 'income' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Income
                </button>
                <button 
                  type="button"
                  onClick={() => setNewTrans({...newTrans, type: 'expense'})}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newTrans.type === 'expense' ? 'bg-white dark:bg-slate-600 shadow text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Expense
                </button>
             </div>

             <input 
               type="date" 
               required
               className="w-full border dark:border-slate-600 p-2 rounded-lg text-slate-700 dark:text-white bg-white dark:bg-slate-700"
               value={newTrans.date}
               onChange={e => setNewTrans({...newTrans, date: e.target.value})}
             />
             
             <input 
               type="text" 
               required
               placeholder="Category"
               className="w-full border dark:border-slate-600 p-2 rounded-lg text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400"
               value={newTrans.category || ''}
               onChange={e => setNewTrans({...newTrans, category: e.target.value})}
             />

             <input 
               type="number" 
               required
               placeholder="Amount"
               className="w-full border dark:border-slate-600 p-2 rounded-lg text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400"
               value={newTrans.amount || ''}
               onChange={e => setNewTrans({...newTrans, amount: parseFloat(e.target.value)})}
             />
             
             <input 
               type="text" 
               placeholder="Description (Optional)"
               className="w-full border dark:border-slate-600 p-2 rounded-lg text-slate-900 dark:text-white bg-white dark:bg-slate-700 placeholder-slate-400"
               value={newTrans.description || ''}
               onChange={e => setNewTrans({...newTrans, description: e.target.value})}
             />

             <button type="submit" className="w-full bg-slate-800 dark:bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center justify-center gap-2 transition-colors">
                <Plus size={18} /> Add Record
             </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors">
           <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Recent Transactions</h3>
           <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
             {sortedTransactions.length === 0 && <p className="text-slate-400 text-center py-8">No transactions yet.</p>}
             {sortedTransactions.map(t => (
               <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700 group transition-colors">
                  <div className="flex items-center gap-4">
                     <div className={`p-2 rounded-full ${t.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {t.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                     </div>
                     <div>
                        <p className="font-medium text-slate-800 dark:text-white">{t.category}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.date} {t.description && `• ${t.description}`}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-300'}`}>
                      {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </span>
                    <button 
                      type="button"
                      onClick={(e) => handleDelete(e, t.id)} 
                      className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all cursor-pointer"
                      title="Delete Transaction"
                    >
                      <Trash2 size={16} className="pointer-events-none" />
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetManager;