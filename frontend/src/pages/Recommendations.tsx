import { Search, ShieldAlert, Sparkles, AlertTriangle, Activity, Beaker, Leaf, ArrowRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RecommendationResponse } from '../api/types';
import { motion, AnimatePresence } from 'framer-motion';

type HistoryItem = { symptoms: string; };

const DEFAULT_SEARCH_CHIPS = ['fever', 'migraine', 'cold', 'back pain', 'nausea'];

// Normalize functions...
const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((i): i is string => typeof i === 'string').map(i => i.trim()).filter(Boolean) : [];
const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') { const p = Number(value); if (Number.isFinite(p)) return p; }
  return fallback;
};

const normalizeRecommendationResponse = (payload: unknown): RecommendationResponse | null => {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, any>;
  const diseaseRaw = raw.disease_analysis && typeof raw.disease_analysis === 'object' ? raw.disease_analysis : {};
  const dietRaw = raw.diet_plan && typeof raw.diet_plan === 'object' ? raw.diet_plan : {};

  return {
    symptoms: toStringArray(raw.symptoms),
    disease_analysis: {
      condition: typeof diseaseRaw.condition === 'string' ? diseaseRaw.condition : 'General Pattern',
      reason: typeof diseaseRaw.reason === 'string' ? diseaseRaw.reason : 'Analyzed based on profile.',
      matched_symptoms: toStringArray(diseaseRaw.matched_symptoms),
      possible_causes: toStringArray(diseaseRaw.possible_causes),
      confidence: Math.max(0, Math.min(1, toNumber(diseaseRaw.confidence, 0.8))),
      detected_disease: typeof diseaseRaw.detected_disease === 'string' ? diseaseRaw.detected_disease : undefined,
      precautions: toStringArray(diseaseRaw.precautions),
    },
    drug_recommendations: Array.isArray(raw.drug_recommendations) ? raw.drug_recommendations.map(item => ({
      drug_id: toNumber(item.drug_id, 0),
      name: item.name || 'Unknown Drug',
      description: item.description || '',
      category: item.category || 'General',
      confidence: toNumber(item.confidence, 0.8),
      interaction_risk: item.interaction_risk || 'low',
      rating: toNumber(item.rating, 0),
      dosage: item.dosage || 'As prescribed',
      duration: item.duration || 'As prescribed',
      side_effects: item.side_effects || 'Consult doctor',
      reason: item.reason || 'Recommended',
    })) : [],
    natural_alternative: raw.natural_alternative ? {
      name: raw.natural_alternative.name || 'Hydration',
      category: raw.natural_alternative.category || 'Holistic',
      description: raw.natural_alternative.description || 'Rest and hydrate.',
    } : undefined,
    previous_drug_records: Array.isArray(raw.previous_drug_records) ? raw.previous_drug_records.map(i => ({
      name: i.name || 'Unknown', times_recommended: toNumber(i.times_recommended, 1), avg_confidence: toNumber(i.avg_confidence, 0.8), last_recommended_at: i.last_recommended_at || ''
    })) : [],
    diet_plan: {
      goal: dietRaw.goal || 'Recovery', calories_remaining: toNumber(dietRaw.calories_remaining, 2000), carbs: dietRaw.carbs || '0g', protein: dietRaw.protein || '0g', fat: dietRaw.fat || '0g',
      meals: Array.isArray(dietRaw.meals) ? dietRaw.meals.map((m: any) => ({ meal: m.meal || '', time: m.time || '', name: m.name || '', calories: toNumber(m.calories, 0), tags: toStringArray(m.tags) })) : [],
      foods_to_avoid: toStringArray(dietRaw.foods_to_avoid), superfoods: toStringArray(dietRaw.superfoods), based_on_symptoms: toStringArray(dietRaw.based_on_symptoms),
    },
    common_searches: toStringArray(raw.common_searches),
    disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : 'Informational only.',
  };
};

const Recommendations: React.FC = () => {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [searchChips, setSearchChips] = useState<string[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [requiredParameters, setRequiredParameters] = useState<string[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, number | string>>({});

  useEffect(() => {
    const cached = localStorage.getItem('latestRecommendation');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const normalized = normalizeRecommendationResponse(parsed);
        if (normalized) {
          setResult(normalized);
          if (normalized.common_searches?.length) {
            setSearchChips(normalized.common_searches.slice(0, 5));
          }
        }
      } catch {}
    }

    const loadSearchChips = async () => {
      try {
        const response = await apiClient.get<HistoryItem[]>('/history');
        const tokens = response.data.flatMap((item) => item.symptoms.split(',')).map((token) => token.trim()).filter(Boolean);
        const freq: Record<string, number> = {};
        tokens.forEach((token) => { freq[token.toLowerCase()] = (freq[token.toLowerCase()] || 0) + 1; });
        const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 5);
        const merged = Array.from(new Set([...top, ...DEFAULT_SEARCH_CHIPS])).slice(0, 5);
        setSearchChips(merged);
      } catch {
        setSearchChips(DEFAULT_SEARCH_CHIPS);
      }
    };
    void loadSearchChips();
  }, []);

  const runAnalysis = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true); setError('');
    try {
      const payloadText = followUpQuestion && requiredParameters.length === 0 ? `${symptoms}. ${followUpAnswer}` : text;
      const requestPayload: any = { symptoms: payloadText };
      if (requiredParameters.length > 0) {
        requestPayload.parameters = Object.fromEntries(Object.entries(parameterValues).map(([k, v]) => [k, Number(v) || 0]));
      }

      const response = await apiClient.post<RecommendationResponse>('/recommendations', requestPayload);

      if (response.data.requires_followup) {
        setFollowUpQuestion(response.data.question || 'Please provide details.');
        setSymptoms(payloadText);
        if (response.data.requires_parameters && response.data.parameters) {
          setRequiredParameters(response.data.parameters);
          const initialVals: Record<string, string> = {};
          response.data.parameters.forEach(p => initialVals[p] = '');
          setParameterValues(initialVals);
        } else {
          setRequiredParameters([]);
        }
        setFollowUpAnswer(''); setLoading(false); return;
      }

      const cachedParams = { ...parameterValues };
      setFollowUpQuestion(null); setRequiredParameters([]); setParameterValues({}); setFollowUpAnswer('');
      const normalized = normalizeRecommendationResponse(response.data);
      if (!normalized) { setError('Invalid analysis response.'); return; }
      setResult(normalized);
      if (normalized.common_searches?.length) setSearchChips(normalized.common_searches.slice(0, 5));
      localStorage.setItem('latestSymptoms', payloadText);
      localStorage.setItem('latestParameters', JSON.stringify(cachedParams));
      localStorage.setItem('latestRecommendation', JSON.stringify(normalized));
    } catch (reqErr: any) {
      setError(reqErr?.response?.data?.detail || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const primaryDrug = result?.drug_recommendations?.[0] ?? null;
  const secondaryDrugs = result?.drug_recommendations?.slice(1, 4) ?? [];

  const safetyWarning = React.useMemo(() => {
    if (!result?.drug_recommendations.length) return '';
    const highRisk = result.drug_recommendations.find(item => item.interaction_risk === 'high');
    if (!highRisk) return '';
    return `Safety warning: ${highRisk.name} may have a high interaction risk based on your profile. Consult a doctor before use.`;
  }, [result]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 mb-10 mt-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] transform rotate-12">
          <Sparkles className="text-white transform -rotate-12" size={32} />
        </motion.div>
        <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">AI Diagnostic Engine</h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Describe your symptoms in natural language. Our neural engine will analyze patterns to suggest conditions and treatments instantly.</p>
      </div>

      {/* Warning */}
      <div className="glass-panel bg-yellow-500/10 border-yellow-500/30 p-4 flex gap-4 items-start rounded-2xl group">
        <ShieldAlert className="text-yellow-500 flex-shrink-0 mt-1" size={24} />
        <div>
          <h4 className="text-yellow-500 font-bold mb-1 group-hover:text-yellow-400 transition-colors">Medical Disclaimer</h4>
          <p className="text-yellow-500/80 text-sm leading-relaxed">This AI-generated analysis is for informational purposes only. It does not replace professional medical diagnosis, advice, or treatment. Always consult a certified physician.</p>
        </div>
      </div>

      {/* Input Section */}
      <motion.div className="glass-panel p-2 rounded-full flex items-center bg-slate-900/60 shadow-2xl relative z-20 border border-slate-700/50">
        <div className="pl-4 pr-2 text-blue-500">
          <Activity size={24} />
        </div>
        <input 
          value={followUpQuestion ? followUpAnswer : symptoms}
          onChange={(e) => followUpQuestion ? setFollowUpAnswer(e.target.value) : setSymptoms(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runAnalysis(followUpQuestion ? followUpAnswer : symptoms); }}
          disabled={loading || requiredParameters.length > 0}
          placeholder={followUpQuestion || "E.g., I have a throbbing headache and slight nausea..."}
          className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-500 py-4 px-2"
        />
        <button 
          onClick={() => runAnalysis(followUpQuestion ? followUpAnswer : symptoms)}
          disabled={loading || (followUpQuestion ? !followUpAnswer.trim() : !symptoms.trim()) || (requiredParameters.length > 0 && requiredParameters.some(p => !parameterValues[p]))}
          className={`h-12 px-6 rounded-full font-bold flex items-center gap-2 transition-all ${
            loading 
              ? 'bg-blue-600/50 text-blue-200 cursor-wait' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]'
          }`}
        >
          {loading ? (
             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <><Search size={18} /> Analyze</>
          )}
        </button>
      </motion.div>

      {/* Need params */}
      {requiredParameters.length > 0 && (
         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-3xl mt-4">
           <h4 className="text-blue-400 font-bold mb-4">{followUpQuestion}</h4>
           <div className="grid grid-cols-2 gap-4 mb-4">
             {requiredParameters.map(p => (
               <div key={p}>
                 <label className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2 block">{p}</label>
                 <input type="number" value={parameterValues[p] || ''} onChange={e => setParameterValues(prev => ({...prev, [p]: e.target.value}))} className="w-full glass-input" placeholder={`Enter ${p}`} />
               </div>
             ))}
           </div>
           <button onClick={() => runAnalysis(symptoms)} disabled={loading || requiredParameters.some(p => !parameterValues[p])} className="glass-button w-full py-3 font-bold text-white">Submit Parameters</button>
         </motion.div>
      )}

      {/* Chips */}
      {!result && !followUpQuestion && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-2 justify-center pt-4">
          <span className="text-slate-500 text-sm py-1.5 px-2">Common:</span>
          {searchChips.map(chip => (
            <button key={chip} onClick={() => { setSymptoms(chip); runAnalysis(chip); }} className="px-4 py-1.5 rounded-full text-sm font-medium bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white transition-all border border-slate-700 hover:border-blue-500">
              {chip}
            </button>
          ))}
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-4 bg-red-500/10 border-red-500/30 text-red-400 text-center rounded-2xl">
          {error}
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
      {result && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 mt-12">
          {/* Diagnostic Result */}
          <section className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 glass-panel p-6 bg-gradient-to-b from-slate-800/80 to-slate-900/80 border-t border-t-blue-500/50 flex flex-col items-center text-center">
              <div className="relative mb-6">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="rgba(30,41,59,0.8)" strokeWidth="12" fill="transparent" />
                  <motion.circle 
                    cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" 
                    strokeDasharray="364" initial={{ strokeDashoffset: 364 }} animate={{ strokeDashoffset: 364 - (364 * result.disease_analysis.confidence) }} transition={{ duration: 1.5, delay: 0.5 }}
                    className="text-emerald-500" strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-emerald-400">{Math.round(result.disease_analysis.confidence * 100)}%</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Match</span>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{result.disease_analysis.condition}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{result.disease_analysis.reason}</p>
            </div>
            
            <div className="md:col-span-2 glass-panel p-6 flex flex-col justify-center">
              <h4 className="text-blue-400 font-bold tracking-widest uppercase text-xs mb-4 flex items-center gap-2"><Activity size={14}/> Possible Causes</h4>
              <div className="flex flex-wrap gap-2 mb-8">
                {result.disease_analysis.possible_causes.map(cause => (
                  <span key={cause} className="px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-300 font-medium">
                    {cause}
                  </span>
                ))}
              </div>
              
              <h4 className="text-yellow-400 font-bold tracking-widest uppercase text-xs mb-4 flex items-center gap-2"><AlertTriangle size={14}/> Precautions & Care</h4>
              <ul className="space-y-2">
                {(result.disease_analysis.precautions || []).map(prec => (
                  <li key={prec} className="flex gap-3 items-start text-slate-300 text-sm">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0" />
                    {prec}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="flex items-center gap-4 py-4">
            <div className="h-px bg-slate-700 flex-1"></div>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 px-4">Recommended Protocol</h3>
            <div className="h-px bg-slate-700 flex-1"></div>
          </div>

          {/* Primary Treatment */}
          {primaryDrug && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} className="glass-panel p-1 rounded-3xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
              <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[22px] h-full flex flex-col md:flex-row gap-8 relative z-10">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.5)]">Primary AI Pick</span>
                        <span className="text-slate-400 text-sm font-medium">{primaryDrug.category}</span>
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tight">{primaryDrug.name}</h3>
                    </div>
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                      <Beaker className="text-white" size={28} />
                    </div>
                  </div>
                  
                  <p className="text-slate-300 text-lg leading-relaxed mb-8">{primaryDrug.reason}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Dosage</span>
                      <strong className="text-blue-400 text-lg">{primaryDrug.dosage}</strong>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block mb-1">Duration</span>
                      <strong className="text-purple-400 text-lg">{primaryDrug.duration}</strong>
                    </div>
                  </div>
                </div>
                
                <div className="w-full md:w-1/3 flex flex-col justify-end">
                  <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl min-h-[140px]">
                    <h4 className="text-red-400 font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2"><AlertTriangle size={16}/> Warning / Side Effects</h4>
                    <p className="text-red-200/80 text-sm">{primaryDrug.side_effects}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Alternatives Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Natural / Holistic */}
            {result.natural_alternative && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="glass-panel p-6 border-l-4 border-l-emerald-500 hover:-translate-y-1 transition-transform">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-400">
                    <Leaf size={24} />
                  </div>
                  <div>
                    <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-1">Holistic Alternative</h4>
                    <h3 className="text-xl font-bold text-white mb-2">{result.natural_alternative.name}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{result.natural_alternative.description}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Secondary Option */}
            {secondaryDrugs[0] && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="glass-panel p-6 border-l-4 border-l-slate-600 hover:-translate-y-1 transition-transform">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-700 text-slate-400">
                    <Beaker size={24} />
                  </div>
                  <div>
                    <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Secondary Option</h4>
                    <h3 className="text-xl font-bold text-white mb-2">{secondaryDrugs[0].name} <span className="text-xs font-normal text-slate-500 ml-2">{Math.round(secondaryDrugs[0].confidence * 100)}% match</span></h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{secondaryDrugs[0].reason}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {safetyWarning && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5 bg-red-500/10 border-l-4 border-l-red-500 flex gap-4 my-6 items-start rounded-r-2xl">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
              <div>
                <h4 className="text-red-400 font-bold mb-1 uppercase tracking-widest text-xs">High Risk Interaction Alert</h4>
                <p className="text-red-300/90 text-sm leading-relaxed">{safetyWarning}</p>
              </div>
            </motion.div>
          )}

          <div className="glass-panel p-6 bg-slate-800/30">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Based on Previous Records</h3>
            {!result.previous_drug_records.length && <p className="text-slate-400 text-sm">No previous drug records found for this account yet.</p>}
            <div className="grid md:grid-cols-3 gap-4">
              {result.previous_drug_records.map((record) => (
                <div key={record.name} className="glass-panel p-4 bg-slate-900/50 hover:bg-slate-800/80 transition-colors">
                  <strong className="block text-white mb-1">{record.name}</strong>
                  <p className="text-slate-400 text-sm">Recommended {record.times_recommended} times</p>
                  <small className="text-blue-400 font-medium">Avg confidence: {Math.round(record.avg_confidence * 100)}%</small>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-8 pb-4">
            <button onClick={() => navigate('/diet')} className="group relative display-inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-all shadow-xl hover:shadow-emerald-500/20">
              <div className="absolute inset-0 bg-emerald-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/40">
                  <Leaf size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Next Step</span>
                  <span className="block text-white font-bold text-lg">View Curated Diet Plan</span>
                </div>
                <ArrowRight className="text-slate-400 group-hover:translate-x-2 transition-transform duration-300 ml-2" />
              </div>
            </button>
          </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
          <p className="text-center text-xs text-slate-500 max-w-3xl mx-auto border-t border-slate-700/50 pt-6">
            {result.disclaimer}
          </p>
        </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Recommendations;
