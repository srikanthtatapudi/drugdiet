import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './History.css';

interface Recommendation {
  id: number;
  type: string;
  symptoms: string;
  recommendation: string;
  confidence: number;
  created_at: string;
}

const History: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { apiClient } = await import('../api/client');
      const response = await apiClient.get('/history');
      setHistory(response.data);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type: string) => {
    return type === 'drug' ? '💊' : '🥗';
  };

  const getTypeLabel = (type: string) => {
    return type === 'drug' ? 'Drug Recommendation' : 'Diet Recommendation';
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your recommendation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>Recommendation History</h1>
        <p>View your past drug and diet recommendations</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No History Yet</h2>
          <p>You haven't received any recommendations yet. Start by describing your symptoms to get personalized recommendations.</p>
          <button 
            className="get-started-btn"
            onClick={() => window.location.href = '/recommendations'}
          >
            Get Recommendations
          </button>
        </div>
      ) : (
        <div className="history-content">
          <div className="history-stats">
            <div className="stat-card">
              <div className="stat-number">{history.length}</div>
              <div className="stat-label">Total Recommendations</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {history.filter(item => item.type === 'drug').length}
              </div>
              <div className="stat-label">Drug Recommendations</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {history.filter(item => item.type === 'diet').length}
              </div>
              <div className="stat-label">Diet Recommendations</div>
            </div>
          </div>

          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="item-header">
                  <div className="item-type">
                    <span className="type-icon">{getTypeIcon(item.type)}</span>
                    <span className="type-label">{getTypeLabel(item.type)}</span>
                  </div>
                  <div className="item-date">
                    {formatDate(item.created_at)}
                  </div>
                </div>

                <div className="item-content">
                  <div className="symptoms-section">
                    <h4>Symptoms</h4>
                    <div className="symptoms-text">
                      {item.symptoms}
                    </div>
                  </div>

                  <div className="recommendation-section">
                    <h4>Recommendation</h4>
                    <div className="recommendation-text">
                      {item.recommendation}
                    </div>
                  </div>

                  <div className="confidence-section">
                    <span className="confidence-label">Confidence:</span>
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill"
                        style={{ width: `${item.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="confidence-value">
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
