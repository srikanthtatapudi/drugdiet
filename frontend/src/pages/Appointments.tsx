import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '../api/client';
import { Appointment } from '../api/types';

type FormState = {
  title: string;
  provider: string;
  date: string;
  time: string;
  mode: string;
  notes: string;
};

const initialForm: FormState = {
  title: '',
  provider: '',
  date: '',
  time: '',
  mode: 'in_person',
  notes: '',
};

const modeLabels: Record<string, string> = {
  in_person: 'In Person',
  video: 'Video Call',
  phone: 'Phone',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  missed: 'Missed',
};

const statusClassByStatus: Record<string, string> = {
  scheduled: 'scheduled',
  completed: 'completed',
  cancelled: 'cancelled',
  missed: 'missed',
};

const getApiError = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
};

const toDateInput = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

const toDateTimePayload = (date: string, time: string): string => `${date}T${time}:00`;

const toDisplayDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const loadAppointments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await apiClient.get<Appointment[]>('/appointments');
      setAppointments(response.data);
    } catch (error) {
      setMessage({ tone: 'error', text: getApiError(error, 'Unable to load appointments.') });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const orderedAppointments = useMemo(() => {
    return [...appointments].sort((left, right) => {
      const leftTime = new Date(left.appointment_time).getTime();
      const rightTime = new Date(right.appointment_time).getTime();
      return leftTime - rightTime;
    });
  }, [appointments]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return orderedAppointments.filter((item) => {
      const appointmentTime = new Date(item.appointment_time).getTime();
      return item.status === 'scheduled' && !Number.isNaN(appointmentTime) && appointmentTime >= now;
    });
  }, [orderedAppointments]);

  const history = useMemo(() => {
    const now = Date.now();
    return orderedAppointments
      .filter((item) => {
        const appointmentTime = new Date(item.appointment_time).getTime();
        return item.status !== 'scheduled' || Number.isNaN(appointmentTime) || appointmentTime < now;
      })
      .reverse();
  }, [orderedAppointments]);

  const stats = useMemo(() => {
    const completed = appointments.filter((item) => item.status === 'completed').length;
    const cancelled = appointments.filter((item) => item.status === 'cancelled').length;
    return {
      upcoming: upcoming.length,
      history: history.length,
      completed,
      cancelled,
    };
  }, [appointments, upcoming.length, history.length]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const saveAppointment = async () => {
    if (!form.title.trim() || !form.provider.trim() || !form.date || !form.time) {
      setMessage({ tone: 'error', text: 'Please fill title, provider, date, and time.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      title: form.title.trim(),
      provider: form.provider.trim(),
      appointment_time: toDateTimePayload(form.date, form.time),
      mode: form.mode,
      notes: form.notes.trim(),
    };

    try {
      if (editingId === null) {
        await apiClient.post('/appointments', { ...payload, status: 'scheduled' });
      } else {
        await apiClient.put(`/appointments/${editingId}`, payload);
      }
      resetForm();
      await loadAppointments(false);
      setMessage({ tone: 'success', text: editingId === null ? 'Appointment added.' : 'Appointment updated.' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiError(error, editingId === null ? 'Failed to add appointment.' : 'Failed to update appointment.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (appointment: Appointment) => {
    const date = toDateInput(appointment.appointment_time);
    const time = toTimeInput(appointment.appointment_time);
    if (!date || !time) {
      setMessage({ tone: 'error', text: 'Unable to edit this appointment due to invalid date/time format.' });
      return;
    }

    setEditingId(appointment.id);
    setForm({
      title: appointment.title,
      provider: appointment.provider,
      date,
      time,
      mode: appointment.mode || 'in_person',
      notes: appointment.notes || '',
    });
    setMessage(null);
  };

  const updateAppointmentStatus = async (appointmentId: number, nextStatus: 'cancelled' | 'completed' | 'scheduled') => {
    setBusyAppointmentId(appointmentId);
    try {
      await apiClient.put(`/appointments/${appointmentId}`, { status: nextStatus });
      await loadAppointments(false);
      if (editingId === appointmentId && nextStatus !== 'scheduled') {
        resetForm();
      }
      const messageByStatus: Record<'cancelled' | 'completed' | 'scheduled', string> = {
        cancelled: 'Appointment cancelled.',
        completed: 'Appointment marked as completed.',
        scheduled: 'Appointment restored to scheduled.',
      };
      setMessage({ tone: 'success', text: messageByStatus[nextStatus] });
    } catch (error) {
      setMessage({ tone: 'error', text: getApiError(error, 'Failed to update appointment status.') });
    } finally {
      setBusyAppointmentId(null);
    }
  };

  const deleteAppointment = async (appointmentId: number) => {
    setBusyAppointmentId(appointmentId);
    try {
      await apiClient.delete(`/appointments/${appointmentId}`);
      if (editingId === appointmentId) {
        resetForm();
      }
      await loadAppointments(false);
      setMessage({ tone: 'success', text: 'Appointment deleted.' });
    } catch (error) {
      setMessage({ tone: 'error', text: getApiError(error, 'Failed to delete appointment.') });
    } finally {
      setBusyAppointmentId(null);
    }
  };

  return (
    <div className="vs-appointments-page" data-testid="appointments-page">
      <section className="vs-appointments-hero">
        <div className="vs-appointments-hero-text">
          <h2>Appointments</h2>
          <p>Schedule, track, and update consultations from one place.</p>
        </div>
        <div className="vs-appointments-stats">
          <article className="vs-appointments-stat">
            <span>Upcoming</span>
            <strong>{stats.upcoming}</strong>
          </article>
          <article className="vs-appointments-stat">
            <span>History</span>
            <strong>{stats.history}</strong>
          </article>
          <article className="vs-appointments-stat">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </article>
          <article className="vs-appointments-stat">
            <span>Cancelled</span>
            <strong>{stats.cancelled}</strong>
          </article>
        </div>
      </section>

      <section className="vs-appointments-layout">
        <article className="vs-settings-card vs-appointments-form-card">
          <div className="vs-appointments-card-head">
            <h3>{editingId === null ? 'Add Appointment' : 'Edit Appointment'}</h3>
            {editingId !== null ? <span className="vs-edit-pill">Editing</span> : null}
          </div>

          <div className="vs-form-grid vs-appointments-form-grid">
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                data-testid="appointment-title"
                placeholder="General Checkup"
              />
            </label>
            <label>
              Provider
              <input
                value={form.provider}
                onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                data-testid="appointment-provider"
                placeholder="Dr. Sharma"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                data-testid="appointment-date"
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={form.time}
                onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                data-testid="appointment-time"
              />
            </label>
            <label>
              Mode
              <select
                value={form.mode}
                onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value }))}
                data-testid="appointment-mode"
              >
                <option value="in_person">In Person</option>
                <option value="video">Video Call</option>
                <option value="phone">Phone</option>
              </select>
            </label>
            <label>
              Notes
              <input
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                data-testid="appointment-notes"
                placeholder="Optional notes"
              />
            </label>
          </div>

          <div className="vs-settings-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void saveAppointment()}
              disabled={saving}
              data-testid="add-appointment-button"
            >
              {saving ? 'Saving...' : editingId === null ? 'Add Appointment' : 'Update Appointment'}
            </button>
            {editingId !== null ? (
              <button type="button" onClick={resetForm} data-testid="reset-appointment-form">
                Cancel Edit
              </button>
            ) : null}
          </div>
        </article>

        <div className="vs-appointments-lists">
          <section className="vs-settings-card vs-appointments-list-card">
            <div className="vs-appointments-card-head">
              <h3>Upcoming ({upcoming.length})</h3>
            </div>
            {loading ? <p className="vs-appointments-empty">Loading appointments...</p> : null}
            {!loading && !upcoming.length ? <p className="vs-appointments-empty">No upcoming appointments.</p> : null}
            <div className="vs-appointment-list" data-testid="upcoming-appointments">
              {upcoming.map((appointment) => (
                <article key={appointment.id} className="vs-appointment-item">
                  <div className="vs-appointment-main">
                    <div className="vs-appointment-title-row">
                      <strong>{appointment.title}</strong>
                      <span className={`vs-status-chip ${statusClassByStatus[appointment.status] || 'scheduled'}`}>
                        {statusLabels[appointment.status] || appointment.status}
                      </span>
                    </div>
                    <p className="vs-appointment-provider">{appointment.provider}</p>
                    <div className="vs-appointment-meta-row">
                      <span>{toDisplayDate(appointment.appointment_time)}</span>
                      <span className="vs-appointment-dot">|</span>
                      <span className={`vs-mode-chip ${appointment.mode}`}>{modeLabels[appointment.mode] || appointment.mode}</span>
                    </div>
                    {appointment.notes ? <p className="vs-appointment-notes">{appointment.notes}</p> : null}
                  </div>
                  <div className="vs-appointment-actions">
                    <button type="button" onClick={() => startEdit(appointment)} data-testid={`edit-appointment-${appointment.id}`}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAppointmentStatus(appointment.id, 'completed')}
                      data-testid={`complete-appointment-${appointment.id}`}
                      disabled={busyAppointmentId === appointment.id}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateAppointmentStatus(appointment.id, 'cancelled')}
                      data-testid={`cancel-appointment-${appointment.id}`}
                      disabled={busyAppointmentId === appointment.id}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deleteAppointment(appointment.id)}
                      data-testid={`delete-appointment-${appointment.id}`}
                      disabled={busyAppointmentId === appointment.id}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="vs-settings-card vs-appointments-list-card">
            <div className="vs-appointments-card-head">
              <h3>History ({history.length})</h3>
            </div>
            {!loading && !history.length ? <p className="vs-appointments-empty">No appointment history yet.</p> : null}
            <div className="vs-appointment-list" data-testid="history-appointments">
              {history.map((appointment) => (
                <article key={appointment.id} className="vs-appointment-item">
                  <div className="vs-appointment-main">
                    <div className="vs-appointment-title-row">
                      <strong>{appointment.title}</strong>
                      <span className={`vs-status-chip ${statusClassByStatus[appointment.status] || 'scheduled'}`}>
                        {statusLabels[appointment.status] || appointment.status}
                      </span>
                    </div>
                    <p className="vs-appointment-provider">{appointment.provider}</p>
                    <div className="vs-appointment-meta-row">
                      <span>{toDisplayDate(appointment.appointment_time)}</span>
                      <span className="vs-appointment-dot">|</span>
                      <span className={`vs-mode-chip ${appointment.mode}`}>{modeLabels[appointment.mode] || appointment.mode}</span>
                    </div>
                    {appointment.notes ? <p className="vs-appointment-notes">{appointment.notes}</p> : null}
                  </div>
                  <div className="vs-appointment-actions">
                    {appointment.status === 'cancelled' ? (
                      <button
                        type="button"
                        onClick={() => void updateAppointmentStatus(appointment.id, 'scheduled')}
                        data-testid={`restore-appointment-${appointment.id}`}
                        disabled={busyAppointmentId === appointment.id}
                      >
                        Restore
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deleteAppointment(appointment.id)}
                      data-testid={`delete-appointment-${appointment.id}`}
                      disabled={busyAppointmentId === appointment.id}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      {message ? <div className={message.tone === 'error' ? 'vs-error-banner' : 'vs-inline-info'}>{message.text}</div> : null}
    </div>
  );
};

export default Appointments;
