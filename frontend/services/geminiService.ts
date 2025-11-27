import { GoogleGenAI } from "@google/genai";
import { Loan, LoanType } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeFinancialHealth = async (loans: Loan[]) => {
  const ai = getClient();
  if (!ai) return "Unable to connect to AI service. Please check API Key configuration.";

  const financialSummary = loans.map(l => ({
    name: l.name,
    type: l.type,
    amount: l.principal,
    interest: l.interestRate,
    monthlyPayment: l.emiAmount,
    remaining: l.tenureMonths * l.emiAmount - l.payments.reduce((sum, p) => sum + p.amount, 0),
    nextDueDay: l.dueDateDay
  }));

  const prompt = `
    You are a strictly financial advisor AI. Analyze the following debt portfolio for a user in India.
    
    Data: ${JSON.stringify(financialSummary)}
    
    Please provide:
    1. A brief assessment of the financial health (Debt-to-income hints if implied, otherwise just debt structure).
    2. A strictly prioritized repayment strategy (e.g., Avalanche vs Snowball) suitable for this mix.
    3. Three specific, actionable tips to save money or clear debt faster based on these interest rates.
    4. An estimated "Debt Free Date" calculation if they stick to the current schedule.

    Format the output in clean Markdown. Be encouraging but realistic. Keep it under 300 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster response on simple queries
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating financial advice:", error);
    return "Sorry, I couldn't analyze your data right now. Please try again later.";
  }
};
