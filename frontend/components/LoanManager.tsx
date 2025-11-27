import React, { useState } from 'react';
import { Loan, LoanType, Payment, Transaction, TransactionType } from '../types';
import { formatCurrency, calculateRemainingPrincipal, getNextDueDate, calculateInterestFromEMI, calculateEndDate, formatDate, generateUUID } from '../utils';
import { Plus, Trash2, Check, Calculator, Edit2, X, Calendar, Archive, CreditCard, Eye, EyeOff } from 'lucide-react';

interface LoanManagerProps {
  loans: Loan[];
  onAddLoan: (loan: Loan) => void;
  onUpdateLoan: (loan: Loan) => void;
  onDeleteLoan: (id: string) => void;
  onAddPayment: (loanId: string, payment: Payment) => void;
  onAddTransaction: (transaction: Transaction) => void;
}

const LoanManager: React.FC<LoanManagerProps> = ({ loans, onAddLoan, onUpdateLoan, onDeleteLoan, onAddPayment, onAddTransaction }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState<Partial<Loan>>({
    type: LoanType.EMI,
    startDate: new Date().toISOString().split('T')[0],
  });

  const endDate = (formData.startDate && formData.tenureMonths && formData.type === LoanType.EMI) 
    ? calculateEndDate(formData.startDate, Number(formData.tenureMonths))
    : null;

  const handleEditClick = (e: React.MouseEvent, loan: Loan) => {
    e.stopPropagation();
    setFormData({ ...loan });
    setEditId(loan.id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({ type: LoanType.EMI, startDate: new Date().toISOString().split('T')[0] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.principal) return;

    const loanPayload: Loan = {
      id: editId || generateUUID(),
      name: formData.name!,
      lender: formData.lender || 'Unknown',
      principal: Number(formData.principal),
      interestRate: Number(formData.interestRate || 0),
      startDate: formData.startDate || new Date().toISOString(),
      emiAmount: Number(formData.emiAmount || 0),
      tenureMonths: Number(formData.tenureMonths || 12),
      initialPaidMonths: Number(formData.initialPaidMonths || 0),
      dueDateDay: Number(formData.dueDateDay || 1),
      type: formData.type as LoanType,
      payments: formData.payments || [],
      isForeclosed: formData.isForeclosed || false,
      status: formData.status || 'active'
    };
    
    if (editId) {
      onUpdateLoan(loanPayload);
    } else {
      onAddLoan(loanPayload);
    }
    
    handleCancelEdit();
  };

  const openPaymentModal = (loan: Loan) => {
    setSelectedLoan(loan);
    const remaining = calculateRemainingPrincipal(loan);
    const suggested = Math.min(loan.emiAmount, remaining);
    setPaymentAmount(suggested > 0 ? suggested : loan.emiAmount);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedLoan(null);
  };

  const confirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || paymentAmount <= 0) return;

    const newPayment: Payment = {
        id: generateUUID(),
        date: paymentDate,
        amount: paymentAmount,
        note: 'Manual Payment'
    };

    const remaining = calculateRemainingPrincipal(selectedLoan);
    // Use a small epsilon for float comparison logic
    if (paymentAmount >= remaining - 1) {
        const updatedLoan: Loan = {
            ...selectedLoan,
            payments: [...selectedLoan.payments, newPayment],
            status: 'completed',
            isForeclosed: false
        };
        onUpdateLoan(updatedLoan);
        alert(`Congratulations! ${selectedLoan.name} is now fully paid off.`);
    } else {
        onAddPayment(selectedLoan.id, newPayment);
    }

    onAddTransaction({
        id: generateUUID(),
        date: paymentDate,
        amount: paymentAmount,
        type: 'expense',
        category: 'Debt Repayment',
        description: `EMI for ${selectedLoan.name}`
    });

    closePaymentModal();
  };

  const handleCloseLoan = (e: React.MouseEvent, loan: Loan) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm(`Are you sure you want to manually close "${loan.name}"?`)) return;

    const remaining = calculateRemainingPrincipal(loan);
    let shouldRecordPayment = false;

    if (remaining > 1) {
        shouldRecordPayment = confirm(`There is an outstanding balance of ${formatCurrency(remaining)}.\n\nDo you want to record this as a final payment?`);
    }

    let updatedLoan = {
      ...loan,
      status: 'completed' as const,
      isForeclosed: true
    };

    if (shouldRecordPayment) {
        const dateStr = new Date().toISOString().split('T')[0];
        
        const finalPayment: Payment = {
            id: generateUUID(),
            date: dateStr,
            amount: remaining,
            note: 'Foreclosure Payment'
        };
        updatedLoan.payments = [...updatedLoan.payments, finalPayment];

        onAddTransaction({
            id: generateUUID(),
            date: dateStr,
            amount: remaining,
            type: 'expense',
            category: 'Debt Repayment',
            description: `Foreclosure of ${loan.name}`
        });
    }

    onUpdateLoan(updatedLoan);
  };
  
  const handleDeleteLoan = (e: React.MouseEvent, loanId: string) => {
      e.stopPropagation();
      // Do not use e.preventDefault() on generic buttons to avoid side effects
      
      const cleanId = String(loanId).trim();
      console.log("LM: Delete clicked for ID:", cleanId);
      
      if(window.confirm("Are you sure you want to permanently delete this loan? This action cannot be undone.")) {
          console.log("LM: User confirmed delete. Calling prop.");
          onDeleteLoan(cleanId);
      } else {
          console.log("LM: Delete cancelled by user.");
      }
  }

  const handleAutoCalculateInterest = () => {
    if (formData.principal && formData.tenureMonths && formData.emiAmount) {
      const rate = calculateInterestFromEMI(
        Number(formData.principal), 
        Number(formData.tenureMonths), 
        Number(formData.emiAmount)
      );
      setFormData({...formData, interestRate: rate});
    } else {
      alert("Please fill Principal, Tenure, and EMI Amount first.");
    }
  };

  const displayedLoans = loans.filter(l => showClosed ? true : l.status === 'active');

  return (
    <div className="space-y-6 relative">
      {paymentModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <CreditCard className="text-emerald-500" /> Record Payment
                    </h3>
                    <button type="button" onClick={closePaymentModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={confirmPayment} className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Paying for</p>
                        <p className="font-semibold text-slate-800 dark:text-white">{selectedLoan.name}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <input 
                            type="date" 
                            required
                            className="w-full border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            value={paymentDate}
                            onChange={e => setPaymentDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount</label>
                        <input 
                            type="number" 
                            required
                            min="1"
                            className="w-full border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(parseFloat(e.target.value))}
                        />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                            <Check size={20} /> Confirm Payment
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Your Debts</h2>
        <div className="flex items-center gap-2">
            <button
               type="button"
               onClick={() => setShowClosed(!showClosed)}
               className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
                {showClosed ? <Eye size={16} /> : <EyeOff size={16} />}
                {showClosed ? 'Hide Closed' : 'Show Closed'}
            </button>

            {!isEditing && (
                <button 
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                    <Plus size={20} /> Add New
                </button>
            )}
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-down transition-colors">
            {/* Form Inputs ... keeping same as before */}
            <h3 className="col-span-full font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                {editId ? 'Edit Debt Detail' : 'Add New Debt Detail'}
                {endDate && (
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md flex items-center gap-1">
                     <Calendar size={12} /> Expected End: {endDate.toLocaleDateString()}
                  </span>
                )}
            </h3>
            
            <input required placeholder="Loan Name" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input required placeholder="Lender" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.lender || ''} onChange={e => setFormData({...formData, lender: e.target.value})} />
            <select className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as LoanType})}>
                <option value={LoanType.EMI}>EMI Loan</option>
                <option value={LoanType.NON_EMI}>Non-EMI / Personal Debt</option>
            </select>
            <input required type="number" placeholder="Principal" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.principal || ''} onChange={e => setFormData({...formData, principal: parseFloat(e.target.value)})} />
            
            {formData.type === LoanType.EMI && (
                 <input required type="number" placeholder="Tenure (Months)" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.tenureMonths || ''} onChange={e => setFormData({...formData, tenureMonths: parseFloat(e.target.value)})} />
            )}

            <input required type="number" placeholder="Monthly Payment" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.emiAmount || ''} onChange={e => setFormData({...formData, emiAmount: parseFloat(e.target.value)})} />

            <div className="flex gap-2">
              <input required type="number" step="0.01" placeholder="Interest Rate %" className="border dark:border-slate-600 p-2 rounded-lg flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.interestRate || ''} onChange={e => setFormData({...formData, interestRate: parseFloat(e.target.value)})} />
              <button type="button" onClick={handleAutoCalculateInterest} className="bg-slate-100 dark:bg-slate-600 p-2 rounded-lg"><Calculator size={20} /></button>
            </div>
            
            <div className="flex flex-col">
                 <label className="text-xs text-slate-500">Start Date</label>
                 <input type="date" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.startDate ? formData.startDate.split('T')[0] : ''} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            </div>

            {formData.type === LoanType.EMI && (
              <div className="flex flex-col">
                <label className="text-xs text-slate-500">Already Paid EMIs</label>
                <input type="number" placeholder="0" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.initialPaidMonths || ''} onChange={e => setFormData({...formData, initialPaidMonths: parseInt(e.target.value)})} />
              </div>
            )}

            <div className="flex flex-col">
                <label className="text-xs text-slate-500">Due Day</label>
                <input required type="number" min="1" max="31" className="border dark:border-slate-600 p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={formData.dueDateDay || ''} onChange={e => setFormData({...formData, dueDateDay: parseInt(e.target.value)})} />
            </div>

            <div className="col-span-full flex gap-3 mt-4">
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">Save</button>
                <button type="button" onClick={handleCancelEdit} className="text-slate-500 px-4">Cancel</button>
            </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedLoans.map(loan => {
            const remaining = calculateRemainingPrincipal(loan);
            const isFullyPaid = remaining <= 0;
            const isCompleted = loan.status === 'completed' || isFullyPaid;
            const progress = isCompleted ? 100 : ((loan.principal - remaining) / loan.principal) * 100;
            const nextDue = getNextDueDate(loan);
            const calculatedEnd = calculateEndDate(loan.startDate, loan.tenureMonths);

            return (
                <div key={loan.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col transition-colors ${isCompleted ? 'opacity-80' : ''}`}>
                    <div className="p-5 flex-1 relative group">
                        <button 
                            type="button"
                            onClick={(e) => handleEditClick(e, loan)}
                            className="absolute top-4 right-4 bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm text-slate-400 hover:text-blue-500 hover:bg-slate-50 z-10 cursor-pointer"
                        >
                            <Edit2 size={16} className="pointer-events-none" />
                        </button>

                        <div className="mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">{loan.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isCompleted ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'}`}>
                                {isCompleted ? 'Closed' : loan.type}
                            </span>
                        </div>
                        <div className="text-left mb-4">
                                <p className="font-bold text-slate-800 dark:text-white text-xl">{formatCurrency(loan.emiAmount)}</p>
                                <p className="text-xs text-slate-500">per month</p>
                        </div>
                        
                        <div className="my-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between"><span>Lender:</span><span className="font-medium">{loan.lender}</span></div>
                            <div className="flex justify-between">
                                <span>Outstanding:</span>
                                <span className={`font-medium ${remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>{formatCurrency(Math.max(0, remaining))}</span>
                            </div>
                            <div className="flex justify-between"><span>Start:</span><span className="font-medium">{formatDate(loan.startDate)}</span></div>
                            {!isCompleted && loan.type === LoanType.EMI && (
                                <div className="flex justify-between"><span>End:</span><span className="font-medium">{formatDate(calculatedEnd)}</span></div>
                            )}
                            {!isCompleted && (
                                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
                                  <span>Next Due:</span><span className="font-medium text-emerald-600">{nextDue.toLocaleDateString()}</span>
                                </div>
                             )}
                        </div>

                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 mb-2">
                            <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                        </div>
                        
                        {isCompleted && (
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                               <div className="border-4 border-red-500 text-red-500 font-black text-4xl p-4 transform -rotate-12 rounded-lg">CLOSED</div>
                           </div>
                        )}
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={(e) => handleDeleteLoan(e, loan.id)} 
                            className="relative z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all cursor-pointer shadow-sm" 
                            title="Delete Record"
                          >
                              <Trash2 size={18} className="pointer-events-none" />
                          </button>
                          
                          {!isCompleted && (
                            <button 
                                type="button"
                                onClick={(e) => handleCloseLoan(e, loan)} 
                                className="relative z-40 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all cursor-pointer" 
                                title="Close Loan"
                            >
                                <Archive size={18} className="pointer-events-none" />
                            </button>
                          )}
                        </div>
                        
                        {!isCompleted && (
                            <button 
                                type="button"
                                onClick={() => openPaymentModal(loan)}
                                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer z-30"
                            >
                                <Check size={16} className="pointer-events-none" /> Pay EMI
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
      {displayedLoans.length === 0 && !isEditing && (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
              <p className="text-slate-400 mb-2">No debts to display.</p>
              <button type="button" onClick={() => setIsEditing(true)} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Add a new loan</button>
          </div>
      )}
    </div>
  );
};

export default LoanManager;