import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Edit, Trash2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Event } from '../../types';
import api from '../../lib/api';
import toast from 'react-hot-toast';

// Sport color mapping
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
  'Volleyball': '#f59e0b',
  'Golf': '#22c55e',
  'Boxing': '#dc2626',
  'Karate': '#7c3aed',
  'Rowing': '#0891b2',
  'Motocross': '#92400e',
  'Gymnastics': '#db2777',
  'Archery': '#059669',
};

interface EventCardProps {
  event: Event;
  onDelete?: (id: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onDelete }) => {
  const { isAuthenticated, isAdmin, currentUser } = useAuth();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = isAdmin || (isAuthenticated && currentUser?.organizationId === event.organizationId);

  const sportColor = SPORT_COLORS[event.sport || ''] || 'var(--blue)';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isUpcoming = new Date(event.date + 'T00:00:00') >= new Date();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${event.title}"?`)) return;

    setIsDeleting(true);
    try {
      await api.delete(`/events/${event.id}`);
      toast.success('Event deleted successfully.');
      onDelete?.(event.id);
    } catch {
      toast.error('Failed to delete event.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article
      className="card cursor-pointer group"
      onClick={() => navigate(`/events/${event.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/events/${event.id}`)}
    >
      {/* ── Image / Sport Banner ── */}
      <div className="relative overflow-hidden" style={{ height: '180px' }}>
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${sportColor}22, ${sportColor}44)` }}
          >
            <div
              className="text-5xl font-black opacity-30"
              style={{ color: sportColor }}
            >
              {event.sport?.charAt(0) || 'S'}
            </div>
          </div>
        )}

        {/* Sport badge */}
        {event.sport && (
          <span
            className="absolute top-3 left-3 badge text-white text-xs font-semibold px-2 py-1 rounded-md"
            style={{ background: sportColor, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}
          >
            {event.sport}
          </span>
        )}

        {/* Upcoming indicator */}
        {isUpcoming && (
          <span
            className="absolute top-3 right-3 badge-green badge text-xs"
            style={{ background: 'rgba(16,185,129,.9)', color: '#fff' }}
          >
            Upcoming
          </span>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-5">
        <h3
          className="font-bold text-base mb-3 line-clamp-2 leading-snug group-hover:text-blue-DEFAULT transition-colors"
          style={{ color: 'var(--gray-800)' }}
        >
          {event.title}
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gray-500)' }}>
            <Calendar size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span>{formatDate(event.date)}</span>
            {event.time && (
              <>
                <Clock size={12} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                <span>{event.time}</span>
              </>
            )}
          </div>

          {event.location && (
            <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--gray-500)' }}>
              <MapPin size={14} style={{ color: 'var(--pink)', flexShrink: 0, marginTop: '2px' }} />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gray-400)' }}>
            <Building2 size={14} style={{ flexShrink: 0 }} />
            <span className="line-clamp-1 text-xs">{event.organizationName}</span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      {canManage && (
        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-outline btn-sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/edit`); }}
          >
            <Edit size={13} />
            Edit
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 size={13} />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </article>
  );
};

export default EventCard;
