import React, { useEffect, useState } from 'react';
import { Bell, Calendar, LayoutDashboard, Pill, Settings, User, Utensils, Activity, Menu, LogOut } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import { DashboardData, SettingsState } from '../api/types';
import FloatingChatBot from './FloatingChatBot';
import DailyCheckinModal from './DailyCheckinModal';
import { motion, AnimatePresence } from 'framer-motion';

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Medicines', path: '/medicines', icon: <Pill size={20} /> },
  { label: 'Diet Plan', path: '/diet', icon: <Utensils size={20} /> },
  { label: 'Profile', path: '/profile', icon: <User size={20} /> },
  { label: 'Appointments', path: '/appointments', icon: <Calendar size={20} /> },
  { label: 'Settings', path: '/settings', icon: <Settings size={20} /> },
];

const titleByPath: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/profile': 'User Profile',
  '/medicines': 'AI Diagnostics & Meds',
  '/diet': 'Nutrition & Diet',
  '/appointments': 'Appointments',
  '/settings': 'Application Settings',
};

const AppShell: React.FC = () => {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<string[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadData = async () => {
      try {
        const [dashResponse, settingsResponse] = await Promise.all([
          apiClient.get<DashboardData>('/dashboard'),
          apiClient.get<SettingsState>('/settings')
        ]);
        setNotifications(dashResponse.data.notifications);
        // Force dark mode to align with the premium #0F172A AppShell background
        document.documentElement.classList.add('dark');
        document.body.classList.add('vs-dark-mode');
      } catch {
        setNotifications(['Unable to load notifications right now.']);
      }
    };
    void loadData();
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    setNotificationOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F172A]">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-16 w-16 rounded-full border-t-4 border-b-4 border-blue-500"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const pageTitle = titleByPath[location.pathname] || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0F172A] relative font-sans text-slate-100">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-900/30 blur-[120px] pointer-events-none" />

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="z-20 h-full flex-shrink-0 glass-panel border-y-0 border-l-0 rounded-none overflow-hidden hidden md:flex flex-col"
      >
        <div className="flex items-center gap-3 px-6 py-8 border-b border-slate-700/50">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Activity className="text-white" size={24} />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
            SmartHealth AI
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2 no-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 relative group ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator" 
                      className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-md" 
                    />
                  )}
                  <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                  <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-slate-700/50">
          <div className="glass-panel p-4 rounded-xl flex items-center gap-3 w-full">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-md">
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-sm truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-blue-400 font-medium">Premium Plan</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 w-full">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 glass-panel border-x-0 border-t-0 rounded-none z-10 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:block hidden p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
            >
              {sidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-400 tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 text-slate-300 transition-all hover:shadow-lg hover:shadow-blue-500/10"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border border-slate-800 animate-pulse"></span>
                )}
              </button>
              
              <AnimatePresence>
                {notificationOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 glass-panel rounded-2xl shadow-2xl overflow-hidden z-50 border border-slate-600/50"
                  >
                    <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
                      <h3 className="font-semibold">Notifications</h3>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">{notifications.length} New</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {notifications.length > 0 ? notifications.map((item, idx) => (
                        <div key={idx} className="p-3 hover:bg-slate-700/30 rounded-xl mb-1 cursor-pointer transition-colors border border-transparent hover:border-slate-600/50 flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <Bell size={14} className="text-blue-400" />
                          </div>
                          <p className="text-sm text-slate-300">{item}</p>
                        </div>
                      )) : (
                        <div className="p-6 text-center text-slate-500">
                          <Bell size={24} className="mx-auto mb-2 opacity-50" />
                          <p>No new notifications</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="h-10 w-10 md:hidden rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-md cursor-pointer">
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar relative z-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full max-w-7xl mx-auto"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <FloatingChatBot />
      <DailyCheckinModal />
    </div>
  );
};

export default AppShell;
