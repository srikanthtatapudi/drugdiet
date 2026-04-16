import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { DietPlan, RecommendationResponse } from '../api/types';
import { Utensils, AlertOctagon, CheckCircle2, Flame, RefreshCw, Settings, Sparkles, Droplet, Apple, Beaker, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const Diet: React.FC = () => {
  const navigate = useNavigate();
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refreshFromSymptoms = async (symptoms: string) => {
    setLoading(true);
    setMessage('');
    try {
      const paramCache = localStorage.getItem('latestParameters');
      const parameters = paramCache && paramCache !== "{}" ? JSON.parse(paramCache) : null;
      const payload: any = { symptoms };
      if (parameters) payload.parameters = parameters;

      const response = await apiClient.post<RecommendationResponse>('/recommendations', payload);
      setDietPlan(response.data.diet_plan);
      localStorage.setItem('latestSymptoms', symptoms);
      localStorage.setItem('latestRecommendation', JSON.stringify(response.data));
      setMessage('Diet plan regenerated from latest symptoms.');
    } catch {
      setMessage('Unable to regenerate diet plan right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('latestRecommendation');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as RecommendationResponse;
        if (parsed?.diet_plan) setDietPlan(parsed.diet_plan);
      } catch {}
    }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="glass-panel p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 group">
        <div className="absolute -left-20 -top-20 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <Utensils className="text-emerald-400" size={28} />
            <h2 className="text-3xl font-black text-white tracking-tight">AI Nutrition & Diet</h2>
          </div>
          <p className="text-slate-400 text-lg">Hyper-personalized meal guidance generated from your symptom analysis.</p>
          {dietPlan?.based_on_symptoms.length ? (
            <div className="mt-3 flex items-center justify-center md:justify-start gap-2 text-sm">
              <span className="text-slate-500 uppercase tracking-widest font-bold text-xs">Condition context:</span>
              <span className="text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {dietPlan.based_on_symptoms.join(', ')}
              </span>
            </div>
          ) : null}
        </div>
        
        <div className="flex gap-3 relative z-10">
          <button onClick={() => navigate('/profile')} className="px-5 py-2.5 rounded-xl font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition-all flex items-center gap-2">
            <Settings size={16} /> Preferences
          </button>
          <button
            onClick={() => {
              const latest = localStorage.getItem('latestSymptoms');
              if (latest) { refreshFromSymptoms(latest); return; }
              setMessage('No previous symptoms found. Go to AI Diagnostics first.');
            }}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Regenerate
          </button>
        </div>
      </div>

      {message && (
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-panel p-4 bg-blue-500/10 border-blue-500/30 text-blue-400 text-center rounded-xl font-medium">
          {message}
        </motion.div>
      )}

      {!dietPlan ? (
        <div className="border-2 border-dashed border-slate-700/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Beaker className="text-slate-500" size={32} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Awaiting Diagnostic Data</h3>
          <p className="text-slate-400 max-w-sm mb-8">Run an AI symptom analysis first to generate a customized diet protocol.</p>
          <button onClick={() => navigate('/medicines')} className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all">
            Go to Diagnostics
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Calories & Macros */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass-panel p-6 flex flex-col md:flex-row gap-8 items-center justify-between">
              <div>
                <span className="text-orange-400 font-bold tracking-widest uppercase text-xs mb-1 block">Daily Caloric Goal</span>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-white">{dietPlan.calories_remaining}</span>
                  <span className="text-slate-400 text-lg mb-1">kcal</span>
                </div>
              </div>
              
              <div className="flex gap-4 sm:gap-8 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 min-w-[100px] flex-shrink-0 text-center">
                  <span className="text-blue-400 text-xs font-bold uppercase block mb-2 font-bold tracking-wider">Carbs</span>
                  <strong className="text-xl text-white block">{dietPlan.carbs}</strong>
                </div>
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 min-w-[100px] flex-shrink-0 text-center">
                  <span className="text-emerald-400 text-xs font-bold uppercase block mb-2 font-bold tracking-wider">Protein</span>
                  <strong className="text-xl text-white block">{dietPlan.protein}</strong>
                </div>
                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 min-w-[100px] flex-shrink-0 text-center">
                  <span className="text-yellow-400 text-xs font-bold uppercase block mb-2 font-bold tracking-wider">Fat</span>
                  <strong className="text-xl text-white block">{dietPlan.fat}</strong>
                </div>
              </div>
            </motion.div>

            {/* Meals */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 px-2">
                <Flame className="text-orange-500" /> Prescribed Meals
              </h3>
              {dietPlan.meals.map((meal, idx) => (
                <motion.article 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + (idx * 0.1) }}
                  key={`${meal.meal}-${meal.time}`} 
                  className="glass-panel p-5 hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center gap-4 justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center text-slate-400 font-bold shadow-inner group-hover:text-emerald-400 transition-colors">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">{meal.meal}</span>
                        <span className="text-slate-500 text-xs flex items-center gap-1"><Clock size={12}/> {meal.time}</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{meal.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        {meal.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-[10px] uppercase tracking-wider text-slate-300 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right mt-4 sm:mt-0 bg-slate-900/50 px-4 py-2 rounded-xl self-start sm:self-auto border border-slate-700/50">
                    <strong className="text-orange-400 block">{meal.calories}</strong>
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Kcal</span>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-6">
            <article className="glass-panel p-6 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-500/10 to-transparent">
              <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} /> Restorative Superfoods
              </h3>
              <div className="space-y-3">
                {dietPlan.superfoods.map((item) => (
                  <div key={item} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 group hover:border-emerald-500/30 transition-colors">
                    <Apple className="text-emerald-500" size={16} />
                    <span className="text-white font-medium group-hover:text-emerald-300 transition-colors">{item}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="glass-panel p-6 border-t-4 border-t-red-500 bg-gradient-to-b from-red-500/5 to-transparent">
              <h3 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                <AlertOctagon size={18} /> Foods to Avoid
              </h3>
              <div className="space-y-3">
                {dietPlan.foods_to_avoid.map((item) => (
                  <div key={item} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 group hover:border-red-500/30 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-slate-300 font-medium group-hover:text-red-300 transition-colors">{item}</span>
                  </div>
                ))}
              </div>
            </article>
            
            <div className="glass-panel p-6 rounded-3xl bg-slate-800/50 border border-slate-700/50 overflow-hidden relative">
               <Droplet className="absolute -right-6 -bottom-6 text-blue-500/10" size={100} />
               <h3 className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-2 relative z-10">Hydration Warning</h3>
               <p className="text-slate-300 text-sm leading-relaxed relative z-10">Based on your condition, maintaining optimal hydration is critical for recovery and easing symptoms.</p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Diet;
