import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Event } from '../types';
import api from '../lib/api';
import { Calendar, List } from 'lucide-react';

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
};

const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const fetchAllEvents = async () => {
      try {
        // Fetch all events (no pagination for calendar)
        const { data } = await api.get('/events', { params: { limit: 500, sort: 'date_asc' } });
        setEvents(data.data);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchAllEvents();
  }, []);

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    backgroundColor: SPORT_COLORS[e.sport || ''] || '#1e3799',
    borderColor: 'transparent',
    extendedProps: { event: e },
  }));

  const handleEventClick = (info: EventClickArg) => {
    const event: Event = info.event.extendedProps.event;
    setSelectedEvent(event);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--gray-900)' }}>
              Sports Calendar
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
              All Bermuda sports events at a glance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => calendarRef.current?.getApi().changeView('dayGridMonth')}
            >
              <Calendar size={14} />
              Month
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => calendarRef.current?.getApi().changeView('listMonth')}
            >
              <List size={14} />
              List
            </button>
          </div>
        </div>

        {/* Sport Legend */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {Object.entries(SPORT_COLORS).slice(0, 10).map(([sport, color]) => (
              <div key={sport} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--gray-600)' }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                {sport}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="card p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="spinner" />
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,listMonth',
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="auto"
              eventDisplay="block"
              dayMaxEvents={3}
              moreLinkText={(n) => `+${n} more`}
            />
          )}
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
            <div className="modal-box w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              {/* Sport badge */}
              {selectedEvent.sport && (
                <span
                  className="badge text-white text-xs mb-3 inline-block"
                  style={{
                    background: SPORT_COLORS[selectedEvent.sport] || 'var(--blue)',
                  }}
                >
                  {selectedEvent.sport}
                </span>
              )}

              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--gray-900)' }}>
                {selectedEvent.title}
              </h2>

              <div className="space-y-2 mb-6 text-sm" style={{ color: 'var(--gray-600)' }}>
                <div><strong>Date:</strong> {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                {selectedEvent.time && <div><strong>Time:</strong> {selectedEvent.time}</div>}
                {selectedEvent.location && <div><strong>Location:</strong> {selectedEvent.location}</div>}
                <div><strong>Organizer:</strong> {selectedEvent.organizationName}</div>
              </div>

              {selectedEvent.description && (
                <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--gray-600)' }}>
                  {selectedEvent.description.slice(0, 200)}{selectedEvent.description.length > 200 ? '…' : ''}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  className="btn btn-gradient flex-1"
                  onClick={() => navigate(`/events/${selectedEvent.id}`)}
                >
                  View Details
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CalendarPage;
