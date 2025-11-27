import { Loan, LoanType } from './types';

// Robust ID Generator (Fallback for environments without crypto)
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Helper to calculate the next due date based on payment history
export const getNextDueDate = (loan: Loan): Date => {
  if (!loan.startDate) return new Date();

  const start = new Date(loan.startDate);
  start.setHours(0,0,0,0);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const dueDay = loan.dueDateDay || start.getDate(); 

  // Determine the very first due date of the loan
  let firstDueDate = new Date(start.getFullYear(), start.getMonth(), dueDay);
  if (firstDueDate < start) {
      // If due day is earlier in the month than start day, first due date is next month
      firstDueDate.setMonth(firstDueDate.getMonth() + 1);
  }

  // We iterate month by month from first due date
  // For each month, we check if there is a payment covering it
  let currentDue = new Date(firstDueDate);
  
  // Sort payments to be safe
  const sortedPayments = [...loan.payments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // For standard EMI, each payment counts as one month cleared (simplification)
  // Or match payment date to month?
  // Robust approach: For every payment made, we advance the due date by 1 month.
  // This handles advance payments correctly.
  
  const paidCount = sortedPayments.length + (loan.initialPaidMonths || 0);
  
  for(let i=0; i<paidCount; i++) {
      currentDue.setMonth(currentDue.getMonth() + 1);
  }
  
  // Handle Date Rollovers (e.g. Jan 31 + 1 month -> Feb 28/29)
  // If original due day was 31, and we are in Feb, set to last day of Feb.
  if (currentDue.getDate() !== dueDay) {
      currentDue = new Date(currentDue.getFullYear(), currentDue.getMonth(), 0);
  }

  return currentDue;
};

export const getDaysRemaining = (targetDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateEndDate = (startDateStr: string | Date, tenureMonths: number): Date => {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return new Date(); // fallback
  const end = new Date(start);
  end.setMonth(start.getMonth() + tenureMonths);
  return end;
};

export const calculateRemainingPrincipal = (loan: Loan): number => {
  if (loan.status === 'completed') return 0;
  
  const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
  
  // Calculate value of pre-paid EMIs (approximation for initial setup)
  const prePaidValue = loan.type === LoanType.EMI 
    ? (loan.initialPaidMonths || 0) * loan.emiAmount 
    : 0;

  const totalPaidCombined = totalPaid + prePaidValue;

  // Visual Approximation:
  const totalCost = loan.type === LoanType.EMI 
    ? loan.emiAmount * loan.tenureMonths 
    : loan.principal; 
    
  const remaining = Math.max(0, totalCost - totalPaidCombined);
  
  // Treat effectively zero as zero to handle floating point errors
  return remaining < 1 ? 0 : remaining;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string | Date) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const calculateInterestFromEMI = (principal: number, tenureMonths: number, emi: number): number => {
  if (principal <= 0 || tenureMonths <= 0 || emi <= 0) return 0;
  
  if (emi * tenureMonths < principal) return 0;

  let low = 0.0001; 
  let high = 5.0;   
  let monthlyRate = 0;
  
  for (let i = 0; i < 50; i++) { 
    const mid = (low + high) / 2;
    const r = mid / 100; 
    
    const calculatedEMI = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
    
    if (Math.abs(calculatedEMI - emi) < 0.01) {
      monthlyRate = mid;
      break;
    }
    
    if (calculatedEMI > emi) {
      high = mid;
    } else {
      low = mid;
    }
    monthlyRate = mid;
  }
  
  return Number((monthlyRate * 12).toFixed(2));
};

// Sound Alarm Utility
export class AudioAlarm {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  play() {
    if (!this.ctx || this.isPlaying) return;
    
    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private scheduler() {
    while (this.nextNoteTime < (this.ctx?.currentTime || 0) + 0.1) {
      this.playNote(this.nextNoteTime);
      this.nextNoteTime += 1.0; // Loop every 1 second
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), 25);
    }
  }

  private playNote(time: number) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Beep sound
    osc.frequency.value = 880; 
    osc.type = 'square';

    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }
}