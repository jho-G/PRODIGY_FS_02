import { useState, useEffect } from 'react';
import {
  Calendar,
  Copy,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { calendarApi } from '../api';

export default function CalendarModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchToken = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await calendarApi.getToken();
        setData(res);
      } catch (err) {
        console.error('Failed to load calendar feed token:', err);
        setError('Failed to load calendar synchronization token.');
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!data?.feed_url) return;
    navigator.clipboard.writeText(data.feed_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      'Regenerating your token will invalidate any external calendar apps currently subscribed to this URL. Proceed?'
    );
    if (!confirmed) return;
    try {
      setRegenerating(true);
      setError('');
      const res = await calendarApi.regenerateToken();
      setData(res);
      setCopied(false);
    } catch (err) {
      console.error('Failed to regenerate token:', err);
      setError('Failed to regenerate calendar token.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0A0A0A',
          border: '1px solid #262626',
          borderRadius: '12px',
          maxWidth: '560px',
          width: '100%',
          padding: '24px',
          color: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #262626',
            paddingBottom: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#171717',
                border: '1px solid #333333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={20} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                Calendar Synchronization
              </h2>
              <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '2px 0 0' }}>
                Subscribe via iCalendar (.ics) in Google Calendar, Outlook, or Apple
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#A3A3A3',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>
              Loading calendar subscription URL...
            </p>
          </div>
        ) : error ? (
          <div
            style={{
              backgroundColor: '#1C1917',
              border: '1px solid #44403C',
              borderRadius: '8px',
              padding: '12px',
              color: '#EF4444',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <div>
            {/* Feed URL Box */}
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#A3A3A3',
                  marginBottom: '6px',
                }}
              >
                Personal Subscription URL
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={data?.feed_url || ''}
                  style={{
                    flex: 1,
                    backgroundColor: '#171717',
                    border: '1px solid #333333',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#E5E5E5',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              {data?.webcal_url && (
                <a
                  href={data.webcal_url}
                  style={{
                    backgroundColor: '#1F1F1F',
                    border: '1px solid #333333',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Subscribe in Calendar App</span>
                </a>
              )}
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #333333',
                  color: '#A3A3A3',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw
                  size={14}
                  className={regenerating ? 'spin' : ''}
                />
                <span>{regenerating ? 'Regenerating...' : 'Reset Secret Token'}</span>
              </button>
            </div>

            {/* Platform Instructions Accordion/List */}
            <div
              style={{
                backgroundColor: '#121212',
                border: '1px solid #262626',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '12px',
                color: '#D4D4D4',
              }}
            >
              <div style={{ fontWeight: 600, color: '#FFFFFF', marginBottom: '8px' }}>
                How to add to your calendar:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.6' }}>
                <li>
                  <b>Google Calendar:</b> Go to Google Calendar $\rightarrow$ Other calendars (+) $\rightarrow$ <i>"From URL"</i> $\rightarrow$ Paste the copied URL.
                </li>
                <li>
                  <b>Outlook / Microsoft 365:</b> Click Add calendar $\rightarrow$ <i>"Subscribe from web"</i> $\rightarrow$ Paste the URL.
                </li>
                <li>
                  <b>Apple Calendar (Mac/iOS):</b> File $\rightarrow$ <i>"New Calendar Subscription"</i> $\rightarrow$ Paste the URL (or click the button above).
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
