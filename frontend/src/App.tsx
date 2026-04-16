import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import Diet from './pages/Diet';
import Login from './pages/Login';
import Recommendations from './pages/Recommendations';
import Profile from './pages/Profile';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Appointments from './pages/Appointments';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/medicines" element={<Recommendations />} />
            <Route path="/diet" element={<Diet />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/appointments" element={<Appointments />} />

            <Route path="/recommendations" element={<Navigate to="/medicines" replace />} />
            <Route path="/history" element={<Navigate to="/medicines" replace />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
