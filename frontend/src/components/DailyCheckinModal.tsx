import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, ClipboardList, Pill } from 'lucide-react';
import { apiClient } from '../api/client';

type CheckinData = {
  message: string | null;
  next_steps: string[];
};

const DailyCheckinModal: React.FC = () => {
  const [data, setData] = useState<CheckinData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCheckin = async () => {
      try {
        const response = await apiClient.get<CheckinData>('/daily-checkin');
        if (response.data && response.data.message) {
          setData(response.data);
          setOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch daily checkin:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCheckin();
  }, []);

  if (!open || !data || !data.message) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-md overflow-hidden bg-slate-800 border border-slate-700 shadow-2xl rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-blue-600">
            <div className="flex items-center gap-2 text-white">
              <Activity size={20} />
              <h3 className="font-semibold tracking-wide">Daily Health Check-in</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-full">
                <Pill size={24} />
              </div>
              <div>
                <p className="text-slate-200 leading-relaxed text-sm">
                  {data.message}
                </p>
              </div>
            </div>

            {data.next_steps && data.next_steps.length > 0 && (
              <div className="bg-slate-750 p-4 rounded-xl border border-slate-700/50">
                <h4 className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <ClipboardList size={16} className="text-emerald-400" />
                  Suggested Next Steps
                </h4>
                <ul className="space-y-2">
                  {data.next_steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-800/80 border-t border-slate-700/50 flex justify-end gap-3">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Remind me later
            </button>
            <button
              onClick={() => {
                setOpen(false);
                // Can trigger opening the chatbot
                const chatButton = document.querySelector('button[aria-label="Open Chat"]');
                if (chatButton) (chatButton as HTMLButtonElement).click();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              Reply in Chat
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DailyCheckinModal;
