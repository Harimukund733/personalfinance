import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Loan, LoanType, Transaction } from '../types';
import { calculateRemainingPrincipal, formatCurrency, getDaysRemaining, getNextDueDate } from '../utils';
import { TrendingUp, AlertCircle, Calendar, CheckCircle, Wallet, ArrowDownLeft, ArrowUpRight, Check, Activity } from 'lucide-react';

interface DashboardProps {
  loans: Loan[];
  transactions: Transaction[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Dashboard: React.FC<DashboardProps> = ({ loans, transactions }) => {
  
  const metrics = useMemo(() => {
    let totalOutstanding = 0;
    let totalMonthlyLiability = 0;
    let remainingMonthlyLiability = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const activeLoans = loans.filter(l => l.status === 'active');
    
    activeLoans.forEach(loan => {
      totalOutstanding += calculateRemainingPrincipal(loan);
      
      let amount = 0;
      if (loan.type === LoanType.EMI) {
        amount = loan.emiAmount;
      } else if (loan.type === LoanType.NON_EMI && loan.emiAmount > 0) {
        amount = loan.emiAmount;
      }

      totalMonthlyLiability += amount;

      // Check if paid this month
      const isPaidThisMonth = loan.payments.some(p => {
        const d = new Date(p.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      if (!isPaidThisMonth) {
        remainingMonthlyLiability += amount;
      }
    });

    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      totalOutstanding,
      totalMonthlyLiability,
      remainingMonthlyLiability,
      loanCount: activeLoans.length,
      income,
      expense
    };
  }, [loans, transactions]);

  const nextPayments = useMemo(() => {
    return loans
      .filter(l => l.status === 'active')
      .map(l => {
        const nextDue = getNextDueDate(l);
        const daysRemaining = getDaysRemaining(nextDue);
        
        // Determine if currently paid for the current month
        // We use the same logic as utils: if nextDue is next month, it means we paid current month
        const today = new Date();
        const nextDueMonth = nextDue.getMonth();
        const currentMonth = today.getMonth();
        
        // This is a heuristic: if the calculated next due date is next month, we are good for now.
        // We want to sort by urgency.
        return {
          ...l,
          nextDue,
          daysRemaining
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3);
  }, [loans]);

  const pieData = useMemo(() => {
    return loans
      .filter(l => l.status === 'active')
      .map(l => ({
        name: l.name,
        value: calculateRemainingPrincipal(l)
      }));
  }, [loans]);

  const barData = useMemo(() => {
    const activeEmiTotal = loans.filter(l => l.type === LoanType.EMI && l.status === 'active').reduce((sum, l) => sum + l.emiAmount, 0);
    
    return [
      { name: 'Income', amount: metrics.income },
      { name: 'Expense', amount: metrics.expense },
      { name: 'Liability', amount: metrics.totalMonthlyLiability },
    ];
  }, [loans, metrics]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Income Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Income</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.income)}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Recorded this period</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft size={24} />
            </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Expenses</p>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(metrics.expense)}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Recorded this period</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                <ArrowUpRight size={24} />
            </div>
        </div>

        {/* Monthly Liability Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Monthly Liability</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(metrics.remainingMonthlyLiability)}</h3>
                  <span className="text-xs text-slate-400">/ {formatCurrency(metrics.totalMonthlyLiability)}</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Remaining to Pay</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
                <Calendar size={24} />
            </div>
        </div>

        {/* Total Outstanding Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Outstanding</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(metrics.totalOutstanding)}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Principal Balance</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                <Wallet size={24} />
            </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Payments Widget */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" /> Upcoming Payments
            </h3>
            <div className="space-y-4">
                {nextPayments.length === 0 && <p className="text-slate-500 dark:text-slate-400">No active loans.</p>}
                {nextPayments.map(payment => {
                  // Heuristic: If due date is next month, we assume current month is handled/paid
                  const isPaidForCurrentCycle = payment.nextDue.getMonth() !== new Date().getMonth();
                  const statusColor = payment.daysRemaining < 0 
                     ? 'bg-red-500' 
                     : isPaidForCurrentCycle 
                        ? 'bg-emerald-400' 
                        : payment.daysRemaining <= 7 
                            ? 'bg-amber-500' 
                            : 'bg-blue-500';

                  return (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center text-white shadow-sm ${statusColor}`}>
                                {isPaidForCurrentCycle ? (
                                   <Check size={20} />
                                ) : (
                                  <>
                                    <span className="font-bold">{Math.abs(payment.daysRemaining)}</span>
                                    <span className="text-[9px] uppercase">{payment.daysRemaining < 0 ? 'Late' : 'Days'}</span>
                                  </>
                                )}
                           </div>
                           <div>
                               <h4 className="font-semibold text-slate-800 dark:text-white">{payment.name}</h4>
                               <p className="text-sm text-slate-500 dark:text-slate-400">{payment.lender}</p>
                           </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(payment.emiAmount)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Next Due: {payment.nextDue.toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                  );
                })}
            </div>
        </div>

        {/* Debt Distribution Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors">
             <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Debt Composition</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => formatCurrency(value)} 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                 {pieData.map((entry, index) => (
                     <div key={index} className="flex items-center justify-between text-sm">
                         <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                             <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
                         </div>
                         <span className="font-medium text-slate-800 dark:text-white">{formatCurrency(entry.value)}</span>
                     </div>
                 ))}
             </div>
        </div>
      </div>
      
      {/* Financial Overview Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 transition-colors">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Monthly Overview</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <Tooltip 
                        formatter={(value: number) => formatCurrency(value)} 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={32}>
                         <Cell fill="#10b981" /> {/* Income */}
                         <Cell fill="#ef4444" /> {/* Expense */}
                         <Cell fill="#3b82f6" /> {/* Liability */}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

    </div>
  );
};

export default Dashboard;