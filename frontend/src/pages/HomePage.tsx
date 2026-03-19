import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  X,
  Filter,
  Calendar,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import EventCard from '../components/events/EventCard';
import { useAuth } from '../context/AuthContext';
import { Event, Pagination } from '../types';
import api from '../lib/api';

const SPORTS = [
  'All Sports',
  'Archery',
  'Athletics (Track & Field)',
  'Basketball',
  'Boccia',
  'Bowling',
  'Boxing',
  'Cricket',
  'Cycling',
  'Equestrian',
  'Football (Soccer)',
  'Golf',
  'Gymnastics',
  'Hockey',
  'Karate',
  'Karting',
  'Motocross',
  'Motorcycle Racing',
  'Netball',
  'Pickleball',
  'Rowing',
  'Rugby',
  'Sailing',
  'Squash',
  'Swimming',
  'Tennis',
  'Triathlon',
  'Volleyball',
];

const SORT_OPTIONS = [
  { value: 'date_asc', label: 'Date (Soonest First)' },
  { value: 'date_desc', label: 'Date (Latest First)' },
  { value: 'created_desc', label: 'Newest Added' },
  { value: 'title_asc', label: 'Title A–Z' },
];

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [sort, setSort] = useState('date_asc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 12,
        sort,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedSport !== 'All Sports') params.sport = selectedSport;

      const { data } = await api.get('/events', { params });
      setEvents(data.data);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedSport, sort, page]);

  useEffect(() => {
    const timer = setTimeout(fetchEvents, 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  const handleEventDelete = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSport('All Sports');
    setSort('date_asc');
    setPage(1);
  };

  const hasActiveFilters = search || selectedSport !== 'All Sports' || sort !== 'date_asc';

  return (
    <Layout fullWidth>
      {/* ── Hero Section ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--gray-900) 0%, #1a1f4e 50%, #2d1040 100%)',
          paddingTop: 'calc(var(--nav-h) + 3rem)',
          paddingBottom: '4rem',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'var(--gradient)', filter: 'blur(80px)', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'var(--gradient-r)', filter: 'blur(60px)', transform: 'translate(-30%, 30%)' }}
        />

        <div className="container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium" style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.8)' }}>
            <Trophy size={14} style={{ color: 'var(--pink-light)' }} />
            Bermuda Sports Events Calendar
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
            Discover{' '}
            <span className="text-gradient">Bermuda's</span>
            <br />
            Sports Events
          </h1>

          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,.65)' }}>
            Find upcoming competitions, tournaments, and sporting events from all of Bermuda's national sports associations.
          </p>

          {/* ── Search Bar ── */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--gray-400)' }}
              />
              <input
                type="text"
                placeholder="Search events, sports, locations…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-4 rounded-xl text-base"
                style={{
                  background: 'rgba(255,255,255,.95)',
                  border: 'none',
                  outline: 'none',
                  boxShadow: '0 8px 32px rgba(0,0,0,.3)',
                  color: 'var(--gray-800)',
                }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={16} style={{ color: 'var(--gray-400)' }} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters & Controls ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--gray-200)', position: 'sticky', top: 'var(--nav-h)', zIndex: 30 }}>
        <div className="container py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sport chips — horizontal scroll on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
              {SPORTS.slice(0, 8).map((sport) => (
                <button
                  key={sport}
                  className={`chip flex-shrink-0 ${selectedSport === sport ? 'active' : ''}`}
                  onClick={() => { setSelectedSport(sport); setPage(1); }}
                >
                  {sport}
                </button>
              ))}
              <button
                className={`chip flex-shrink-0 ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={12} />
                More
              </button>
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="form-select flex-shrink-0"
              style={{ width: 'auto', minWidth: '180px' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Clear */}
            {hasActiveFilters && (
              <button className="btn btn-ghost btn-sm flex-shrink-0" onClick={clearFilters}>
                <X size={13} />
                Clear
              </button>
            )}

            {/* Create Event */}
            {isAuthenticated && (
              <Link to="/events/create" className="btn btn-gradient btn-sm flex-shrink-0">
                <PlusCircle size={14} />
                New Event
              </Link>
            )}
          </div>

          {/* Expanded sport filter */}
          {showFilters && (
            <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--gray-100)' }}>
              {SPORTS.slice(8).map((sport) => (
                <button
                  key={sport}
                  className={`chip ${selectedSport === sport ? 'active' : ''}`}
                  onClick={() => { setSelectedSport(sport); setPage(1); setShowFilters(false); }}
                >
                  {sport}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="container py-8">
        {/* Results count */}
        {!loading && !error && pagination && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              Showing <strong style={{ color: 'var(--gray-800)' }}>{events.length}</strong> of{' '}
              <strong style={{ color: 'var(--gray-800)' }}>{pagination.total}</strong> events
              {selectedSport !== 'All Sports' && (
                <> in <strong style={{ color: 'var(--blue)' }}>{selectedSport}</strong></>
              )}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="spinner" />
            <p style={{ color: 'var(--gray-500)' }}>Loading events…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="card p-10 max-w-lg mx-auto">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--gray-800)' }}>Failed to Load Events</h3>
              <p className="mb-6" style={{ color: 'var(--gray-500)' }}>{error}</p>
              <button className="btn btn-gradient" onClick={fetchEvents}>Try Again</button>
            </div>
          </div>
        )}

        {/* Events Grid */}
        {!loading && !error && (
          <>
            {events.length > 0 ? (
              <div
                className="grid gap-6"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
              >
                {events.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={handleEventDelete} />
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="card p-12 max-w-lg mx-auto">
                  <Calendar size={56} className="mx-auto mb-6" style={{ color: 'var(--gray-300)' }} />
                  <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--gray-700)' }}>No Events Found</h3>
                  <p className="mb-8" style={{ color: 'var(--gray-500)' }}>
                    {hasActiveFilters
                      ? 'No events match your filters. Try adjusting your search.'
                      : 'There are no events scheduled at this time.'}
                  </p>
                  {hasActiveFilters && (
                    <button className="btn btn-outline" onClick={clearFilters}>
                      <X size={14} /> Clear Filters
                    </button>
                  )}
                  {isAuthenticated && (
                    <Link to="/events/create" className="btn btn-gradient ml-3">
                      <PlusCircle size={14} /> Create Event
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        className="w-9 h-9 rounded-lg text-sm font-semibold transition-all"
                        style={{
                          background: page === p ? 'var(--gradient)' : 'transparent',
                          color: page === p ? '#fff' : 'var(--gray-600)',
                          border: page === p ? 'none' : '1.5px solid var(--gray-200)',
                        }}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="btn btn-outline btn-sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default HomePage;
