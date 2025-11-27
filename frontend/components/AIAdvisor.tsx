import React, { useState } from 'react';
import { Loan } from '../types';
import { analyzeFinancialHealth } from '../services/geminiService';
import { Sparkles, RefreshCw } from 'lucide-react';

interface AIAdvisorProps {
  loans: Loan[];
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ loans }) => {
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleAnalysis = async () => {
    if (loans.length === 0) {
        setAdvice("Please add some debts first so I can analyze your portfolio!");
        return;
    }
    setLoading(true);
    const result = await analyzeFinancialHealth(loans);
    setAdvice(result);
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-900 dark:to-purple-900 rounded-2xl shadow-lg p-6 text-white mb-8 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Financial Advisor</h2>
            <p className="text-indigo-200 text-sm">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        <button 
          onClick={handleAnalysis}
          disabled={loading}
          className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "Analyzing..." : "Analyze Portfolio"}
        </button>
      </div>

      {advice && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 animate-fade-in">
          <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {advice}
          </div>
        </div>
      )}
      
      {!advice && !loading && (
          <p className="text-indigo-200 text-sm">
              Click the analyze button to get personalized strategies to become debt-free faster, 
              save on interest, and optimize your monthly outflow.
          </p>
      )}
    </div>
  );
};

export default AIAdvisor;