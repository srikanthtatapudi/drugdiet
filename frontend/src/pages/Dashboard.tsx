import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { DashboardData } from '../api/types';
import { motion, Variants } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, Heart, Droplets, Clock, TrendingUp, AlertCircle, ArrowUpRight, Pill } from 'lucide-react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const Dashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get<DashboardData>('/dashboard');
        setDashboard(response.data);
      } catch {
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-16 w-16 bg-blue-500/20 rounded-full flex items-center justify-center"
        >
          <Activity className="text-blue-500 animate-pulse" size={32} />
        </motion.div>
        <p className="text-slate-400 font-medium animate-pulse">Syncing vital data...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="glass-panel p-6 text-center text-red-400 border-red-500/30 flex flex-col items-center justify-center">
        <AlertCircle size={48} className="mb-4 opacity-70" />
        <h3 className="text-lg font-bold">Connection Lost</h3>
        <p className="text-sm opacity-80">Unable to establish secure connection with health servers.</p>
      </div>
    );
  }

  const chartData = dashboard.activity.labels.map((label, i) => ({
    name: label,
    value: dashboard.activity.values[i]
  }));

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]';
    if (score >= 75) return 'text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]';
    if (score >= 60) return 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]';
    return 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]';
  };

  const getToneBadge = (tone: string) => {
    switch(tone) {
      case 'info': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'success': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-20"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="glass-panel p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <motion.h2 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-4xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400"
            >
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {dashboard.hero.greeting_name}!
            </motion.h2>
            <p className="text-slate-400 text-lg">{dashboard.hero.subtitle}</p>
          </div>
          
          <div className="flex items-center gap-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-md">
            <div>
              <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Health Score</p>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold ${getScoreColor(dashboard.hero.health_score)}`}>
                  {dashboard.hero.health_score}
                </span>
                <span className="flex items-center text-emerald-400 text-sm font-medium mb-1">
                  <ArrowUpRight size={16} />
                  {dashboard.hero.health_delta}
                </span>
              </div>
            </div>
            <div className="h-16 w-16 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-700" />
                <motion.circle 
                  cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" 
                  strokeDasharray="175"
                  initial={{ strokeDashoffset: 175 }}
                  animate={{ strokeDashoffset: 175 - (175 * dashboard.hero.health_score) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  className="text-blue-500" 
                  strokeLinecap="round"
                />
              </svg>
              <Heart className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-400 flex items-center justify-center p-2 rounded-full absolute" size={16} />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats Grid */}
      <motion.section variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {dashboard.stats.map((stat, i) => (
          <motion.article 
            key={stat.title} 
            variants={itemVariants}
            whileHover={{ y: -5, scale: 1.02 }}
            className="glass-panel p-6 relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/[0.03] rounded-full group-hover:scale-150 transition-transform duration-500" />
            <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mb-1">
              {stat.value}
            </h3>
            <p className="text-slate-300 font-medium">{stat.title}</p>
            <small className="text-slate-500 flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-emerald-500" />
              {stat.subtitle}
            </small>
          </motion.article>
        ))}
      </motion.section>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <motion.article variants={itemVariants} className="xl:col-span-2 glass-panel p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="text-blue-500" />
              Activity Tracking
            </h3>
            <select className="bg-slate-900/50 border border-slate-700 text-slate-300 text-sm rounded-lg py-1 px-3 outline-none">
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
            </select>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '8px', color: '#F8FAFC' }}
                  itemStyle={{ color: '#60A5FA' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        {/* Side Cards (Next Dose & Hydration) */}
        <div className="space-y-6 flex flex-col h-[400px]">
          <motion.aside variants={itemVariants} className="glass-panel p-6 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="text-purple-500" size={20} />
              Upcoming Medications
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 no-scrollbar">
              {dashboard.next_dose.map((dose, i) => (
                <motion.div 
                  key={`${dose.name}-${i}`} 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-900/80 flex items-center justify-center shadow-inner border border-slate-700">
                      <Pill size={18} className="text-slate-300" />
                    </div>
                    <div>
                      <strong className="block text-slate-200 group-hover:text-blue-400 transition-colors">{dose.name}</strong>
                      <span className="text-xs text-slate-500">{dose.detail}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border font-medium uppercase tracking-wider ${getToneBadge(dose.tone)}`}>
                    {dose.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.aside>

          <motion.div variants={itemVariants} className="glass-panel p-6 relative overflow-hidden group h-32 flex-shrink-0">
            <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:opacity-20 transition-opacity">
              <Droplets size={120} className="text-blue-400" />
            </div>
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <h3 className="text-white font-bold mb-1">Hydration Goal</h3>
                <span className="text-sm text-slate-400">Daily Intake</span>
              </div>
              <div className="text-right">
                <strong className="text-2xl font-bold text-blue-400">{dashboard.hydration.current_l.toFixed(1)}L</strong>
                <span className="text-slate-500 text-sm block">/ {dashboard.hydration.goal_l.toFixed(1)}L</span>
              </div>
            </div>
            
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden relative z-10 p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(dashboard.hydration.progress * 100)}%` }}
                transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
