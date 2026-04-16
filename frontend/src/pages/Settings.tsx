import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { SettingsState } from '../api/types';
import { useAuth } from '../contexts/AuthContext';

const defaultState: SettingsState = {
  dark_mode: false,
  medication_reminders: true,
  diet_alerts: true,
  weekly_reports: false,
};

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const [state, setState] = useState<SettingsState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.get<SettingsState>('/settings');
        setState(response.data);
      } catch {
        setMessage('Unable to load settings. Showing defaults.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('vs-dark-mode', state.dark_mode);
    return () => document.body.classList.remove('vs-dark-mode');
  }, [state.dark_mode]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await apiClient.put<SettingsState>('/settings', state);
      setState(response.data);
      setMessage('Settings saved successfully.');
    } catch {
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="vs-inline-loading">Loading settings...</div>;
  }

  return (
    <div className="vs-settings-page" data-testid="settings-page">
      <h2>Settings</h2>

      <section className="vs-settings-card">
        <h3>Appearance</h3>
        <div className="vs-setting-row">
          <div>
            <strong>Dark Mode</strong>
            <p>Adjust the appearance to reduce eye strain.</p>
          </div>
          <label className="vs-switch" data-testid="dark-mode-switch">
            <input
              type="checkbox"
              checked={state.dark_mode}
              onChange={() => setState((prev) => ({ ...prev, dark_mode: !prev.dark_mode }))}
              data-testid="dark-mode-toggle"
            />
            <span />
          </label>
        </div>
      </section>

      <section className="vs-settings-card">
        <h3>Notifications</h3>
        <p>These controls directly affect the alert items shown in your top-right notification panel.</p>
        <div className="vs-setting-row">
          <div>
            <strong>Medication Reminders</strong>
            <p>Receive push notifications for your daily meds.</p>
          </div>
          <label className="vs-switch" data-testid="medication-switch">
            <input
              type="checkbox"
              checked={state.medication_reminders}
              onChange={() => setState((prev) => ({ ...prev, medication_reminders: !prev.medication_reminders }))}
              data-testid="medication-toggle"
            />
            <span />
          </label>
        </div>
        <div className="vs-setting-row">
          <div>
            <strong>Diet Alerts</strong>
            <p>Get reminded about meal times and hydration.</p>
          </div>
          <label className="vs-switch" data-testid="diet-switch">
            <input
              type="checkbox"
              checked={state.diet_alerts}
              onChange={() => setState((prev) => ({ ...prev, diet_alerts: !prev.diet_alerts }))}
              data-testid="diet-toggle"
            />
            <span />
          </label>
        </div>
        <div className="vs-setting-row">
          <div>
            <strong>Weekly Reports</strong>
            <p>Receive a weekly summary of your health progress.</p>
          </div>
          <label className="vs-switch" data-testid="weekly-switch">
            <input
              type="checkbox"
              checked={state.weekly_reports}
              onChange={() => setState((prev) => ({ ...prev, weekly_reports: !prev.weekly_reports }))}
              data-testid="weekly-toggle"
            />
            <span />
          </label>
        </div>
      </section>

      <section className="vs-settings-actions">
        <button type="button" className="danger" onClick={logout} data-testid="logout-button">Log Out</button>
        <button type="button" className="primary" onClick={() => void save()} disabled={saving} data-testid="save-settings-button">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </section>

      {message && <div className="vs-inline-info">{message}</div>}
    </div>
  );
};

export default Settings;
