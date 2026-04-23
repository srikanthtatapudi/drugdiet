import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    age: user?.age || 0,
    height: user?.height || 0,
    weight: user?.weight || 0,
    gender: user?.gender || 'male',
    allergies: user?.allergies || '',
    medical_conditions: user?.medical_conditions || '',
    dietary_preferences: user?.dietary_preferences || '',
    activity_level: user?.activity_level || 'moderate',
  });

  useEffect(() => {
    setForm({
      age: user?.age || 0,
      height: user?.height || 0,
      weight: user?.weight || 0,
      gender: user?.gender || 'male',
      allergies: user?.allergies || '',
      medical_conditions: user?.medical_conditions || '',
      dietary_preferences: user?.dietary_preferences || '',
      activity_level: user?.activity_level || 'moderate',
    });
  }, [user]);

  const bmi = useMemo(() => {
    if (!user?.height || !user?.weight) {
      return 'N/A';
    }
    const heightMeters = user.height / 100;
    return (user.weight / (heightMeters * heightMeters)).toFixed(1);
  }, [user?.height, user?.weight]);

  const estimatedBirthYear = useMemo(() => {
    if (!user?.age) {
      return 'Not provided';
    }
    const year = new Date().getFullYear() - user.age;
    return `${year}`;
  }, [user?.age]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiClient.put('/profile', form);
      await refreshProfile();
      setMessage('Profile updated successfully.');
    } catch {
      setMessage('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vs-profile-page">
      <section className="vs-profile-left">
        <article className="vs-profile-card" style={{ textAlign: 'center' }}>
          <div className="vs-large-avatar">{(user?.username || 'J').slice(0, 1).toUpperCase()}</div>
          <h2 className="profile-name">{user?.username || 'Jane Doe'}</h2>
          <p className="profile-role">Premium Member</p>

          <div className="vs-profile-stats">
            <div><small>Age</small><strong>{user?.age || 0}</strong></div>
            <div><small>Height</small><strong>{user?.height || 0}cm</strong></div>
            <div><small>Weight</small><strong>{user?.weight || 0}kg</strong></div>
          </div>
          <div className="vs-bmi-tag">BMI: {bmi}</div>
        </article>
      </section>

      <section className="vs-profile-right">
        <article className="vs-medical-profile-card">
          <h3>Medical Profile</h3>
          <p>Update your health metrics and personal information.</p>

          <div className="vs-form-grid">
            <label>
              Estimated Birth Year
              <input type="text" value={estimatedBirthYear} readOnly />
            </label>
            <label>
              Age
              <input type="number" value={form.age || ''} onChange={(e) => setForm(p => ({ ...p, age: parseInt(e.target.value) || 0 }))} />
            </label>
            <label>
              Height (cm)
              <input type="number" value={form.height || ''} onChange={(e) => setForm(p => ({ ...p, height: parseInt(e.target.value) || 0 }))} />
            </label>
            <label>
              Weight (kg)
              <input type="number" value={form.weight || ''} onChange={(e) => setForm(p => ({ ...p, weight: parseInt(e.target.value) || 0 }))} />
            </label>
            <label>
              Gender
              <select
                value={form.gender}
                onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Account Email
              <input type="text" value={user?.email || ''} readOnly />
            </label>
            <label>
              Known Allergies
              <input
                type="text"
                value={form.allergies}
                onChange={(event) => setForm((prev) => ({ ...prev, allergies: event.target.value }))}
                data-testid="profile-allergies"
              />
            </label>
          </div>

          <label className="vs-textarea-field">
            Medical History
            <textarea
              rows={4}
              value={form.medical_conditions}
              onChange={(event) => setForm((prev) => ({ ...prev, medical_conditions: event.target.value }))}
              data-testid="profile-medical-history"
            />
          </label>

          <label className="vs-textarea-field">
            Current Medications / Dietary Notes
            <textarea
              rows={3}
              value={form.dietary_preferences}
              onChange={(event) => setForm((prev) => ({ ...prev, dietary_preferences: event.target.value }))}
              data-testid="profile-dietary-preferences"
            />
          </label>

          <label>
            Activity Level
            <select
              value={form.activity_level}
              onChange={(event) => setForm((prev) => ({ ...prev, activity_level: event.target.value }))}
              data-testid="profile-activity-level"
            >
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very Active</option>
            </select>
          </label>

          <div className="vs-profile-actions">
            <button type="button" onClick={() => setForm({
              age: user?.age || 0,
              height: user?.height || 0,
              weight: user?.weight || 0,
              gender: user?.gender || 'male',
              allergies: user?.allergies || '',
              medical_conditions: user?.medical_conditions || '',
              dietary_preferences: user?.dietary_preferences || '',
              activity_level: user?.activity_level || 'moderate',
            })} data-testid="profile-cancel-button">
              Cancel
            </button>
            <button type="button" className="primary" onClick={() => void saveProfile()} disabled={saving} data-testid="profile-save-button">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {message && <div className="vs-inline-info">{message}</div>}
        </article>
      </section>
    </div>
  );
};

export default Profile;
