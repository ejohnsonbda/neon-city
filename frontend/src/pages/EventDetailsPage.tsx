import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Tag,
  ArrowLeft,
  Edit,
  Trash2,
  Share2,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SPORT_COLORS: Record<string, string> = {
  'Football (Soccer)': '#10b981',
  'Cricket': '#f59e0b',
  'Rugby': '#8b5cf6',
  'Basketball': '#f97316',
  'Netball': '#ec4899',
  'Tennis': '#06b6d4',
  'Swimming': '#3b82f6',
  'Athletics (Track & Field)': '#ef4444',
  'Cycling': '#84cc16',
  'Triathlon': '#1e3799',
  'Squash': '#6366f1',
  'Sailing': '#0ea5e9',
};

const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, currentUser } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        setEvent(data.data);
      } catch {
        setError('Event not found.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const canManage = isAdmin || (isAuthenticated && currentUser?.organizationId === event?.organizationId);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${event?.title}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted.');
      navigate('/');
    } catch {
      toast.error('Failed to delete event.');
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  if (error || !event) {
    return (
      <Layout>
        <div className="text-center py-24">
          <div className="card p-10 max-w-md mx-auto">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--gray-800)' }}>Event Not Found</h2>
            <p className="mb-6" style={{ color: 'var(--gray-500)' }}>{error}</p>
            <Link to="/" className="btn btn-gradient">Back to Events</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const sportColor = SPORT_COLORS[event.sport || ''] || 'var(--blue)';
  const isUpcoming = new Date(event.date + 'T00:00:00') >= new Date();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-6 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--gray-500)' }}
        >
          <ArrowLeft size={16} />
          Back to Events
        </button>

        {/* Hero Image */}
        {event.imageUrl && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ height: '320px' }}>
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Main Card */}
        <div className="card p-6 md:p-8">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {event.sport && (
              <span
                className="badge text-white text-xs font-semibold px-3 py-1"
                style={{ background: sportColor }}
              >
                <Tag size={11} className="mr-1" />
                {event.sport}
              </span>
            )}
            {isUpcoming ? (
              <span className="badge badge-green">Upcoming</span>
            ) : (
              <span className="badge badge-gray">Past Event</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-extrabold mb-6 leading-tight" style={{ color: 'var(--gray-900)' }}>
            {event.title}
          </h1>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'var(--gray-50)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(30,55,153,.1)' }}
              >
                <Calendar size={16} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--gray-400)' }}>Date</div>
                <div className="font-semibold text-sm" style={{ color: 'var(--gray-800)' }}>{formatDate(event.date)}</div>
              </div>
            </div>

            {event.time && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'var(--gray-50)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(232,67,147,.1)' }}
                >
                  <Clock size={16} style={{ color: 'var(--pink)' }} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--gray-400)' }}>Time</div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--gray-800)' }}>{event.time}</div>
                </div>
              </div>
            )}

            {event.location && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'var(--gray-50)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,.1)' }}
                >
                  <MapPin size={16} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--gray-400)' }}>Location</div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--gray-800)' }}>{event.location}</div>
                </div>
              </div>
            )}

            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'var(--gray-50)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(100,116,139,.1)' }}
              >
                <Building2 size={16} style={{ color: 'var(--gray-500)' }} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--gray-400)' }}>Organizer</div>
                <div className="font-semibold text-sm" style={{ color: 'var(--gray-800)' }}>{event.organizationName}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h3 className="font-bold mb-3" style={{ color: 'var(--gray-800)' }}>About this Event</h3>
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--gray-600)' }}
              >
                {event.description}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--gray-100)' }}>
            <button className="btn btn-outline btn-sm" onClick={handleShare}>
              <Share2 size={13} />
              Share
            </button>

            {canManage && (
              <>
                <Link to={`/events/${event.id}/edit`} className="btn btn-blue btn-sm">
                  <Edit size={13} />
                  Edit Event
                </Link>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={13} />
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EventDetailsPage;
