import { MessageCircle, Send, X, Bot, User, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

type ChatResponse = {
  reply: string;
  quick_replies: string[];
};

type ChatMessage = {
  role: 'user' | 'bot';
  text: string;
  time: string;
};

const FloatingChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  const getCurrentTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Hello! I am AuraHealth AI. I can help analyze your symptoms, suggest diet plans, or review your medical records. How can I assist you today?', time: getCurrentTime() },
  ]);
  const [quickReplies, setQuickReplies] = useState<string[]>(['Analyze symptoms', 'Recent drugs', 'Diet suggestions']);

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) {
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: trimmed, time: getCurrentTime() }]);
    setInput('');
    setLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, content: m.text }));
      const response = await apiClient.post<ChatResponse>('/ai-chat', { 
        message: trimmed,
        history: chatHistory
      });
      setMessages((prev) => [...prev, { role: 'bot', text: response.data.reply, time: getCurrentTime() }]);
      setQuickReplies(response.data.quick_replies || []);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Chat service is unavailable right now. Try again in a few seconds.', time: getCurrentTime() },
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  const canSend = input.trim().length > 0 && !loading;

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[550px] max-h-[80vh] glass-panel flex flex-col overflow-hidden shadow-2xl border border-slate-700/50"
            data-testid="chat-panel"
          >
            {/* Header */}
            <div className="h-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex justify-between items-center text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">AuraHealth Assistant</h3>
                  <div className="flex items-center gap-1.5 text-xs text-blue-100">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    Online
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setOpen(false)} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors relative z-10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/60 backdrop-blur-sm no-scrollbar scroll-smooth">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center mt-1 ${message.role === 'user' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
                    {message.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                  </div>
                  
                  <div className={`max-w-[75%] flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
                    }`}>
                      {message.text}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">{message.time}</span>
                  </div>
                </motion.div>
              ))}
              
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mt-1">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div>
                    <div className="bg-slate-800 text-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1 border border-slate-700/50">
                      <span className="text-xs mr-2 text-slate-400">AI is analyzing</span>
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Quick Replies */}
            {quickReplies.length > 0 && (
              <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                {quickReplies.slice(0, 3).map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(reply)}
                    disabled={loading}
                    className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-blue-600/20 hover:text-blue-400 border border-slate-700 hover:border-blue-500/50 text-xs rounded-full text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
              className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message AuraHealth AI..."
                disabled={loading}
                className="flex-1 bg-slate-800/50 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 rounded-full px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-500 text-slate-200"
              />
              <button 
                type="submit" 
                disabled={!canSend}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                  canSend 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                    : 'bg-slate-800 text-slate-600'
                }`}
              >
                <Send size={16} className={canSend ? 'ml-0.5' : ''} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow relative"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        {!open && <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0F172A]"></span>
        </span>}
      </motion.button>
    </div>
  );
};

export default FloatingChatBot;
