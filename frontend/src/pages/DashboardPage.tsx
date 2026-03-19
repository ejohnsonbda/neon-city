import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  Calendar,
  Building2,
  TrendingUp,
  PlusCircle,
  Eye,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { AdminStats } from '../types';
import api from '../lib/api';

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
    <div className="text-3xl font-black mb-1" style={{ color: 'var(--gray-900)' }}>{value}</div>
    <div className="text-sm font-medium" style={{ color: 'var(--gray-500)' }}>{label}</div>
    {sub && <div className="text-xs mt-1" style={{ color: 'var(--gray-400)' }}>{sub}</div>}
  </div>
);

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sports' | 'orgs' | 'recent'>('overview');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  if (!stats) return null;

  const maxSportCount = Math.max(...stats.sportBreakdown.map((s) => s.count), 1);
  const maxOrgCount = Math.max(...stats.orgBreakdown.map((o) => o.count), 1);

  return (
    <Layout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--gray-900)' }}>
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--gray-500)' }}>
              SportCal — Bermuda Sports Events Overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm" onClick={fetchStats}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <Link to="/events/create" className="btn btn-gradient btn-sm">
              <PlusCircle size={14} />
              New Event
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Events"
            value={stats.events.total}
            icon={<Calendar size={18} />}
            color="var(--blue)"
          />
          <StatCard
            label="Upcoming Events"
            value={stats.events.upcoming}
            icon={<TrendingUp size={18} />}
            color="var(--success)"
            sub="From today onwards"
          />
          <StatCard
            label="This Month"
            value={stats.events.thisMonth}
            icon={<Trophy size={18} />}
            color="var(--pink)"
          />
          <StatCard
            label="Organizations"
            value={stats.organizations.active}
            icon={<Building2 size={18} />}
            color="var(--warning)"
            sub={`${stats.organizations.total} total`}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--gray-100)', width: 'fit-content' }}>
          {(['overview', 'sports', 'orgs', 'recent'] as const).map((tab) => (
            <button
              key={tab}
              className="px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
              style={{
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'orgs' ? 'Organizations' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Events by Sport */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={18} style={{ color: 'var(--blue)' }} />
                <h3 className="font-bold" style={{ color: 'var(--gray-800)' }}>Events by Sport</h3>
              </div>
              <div className="space-y-3">
                {stats.sportBreakdown.slice(0, 8).map((s, i) => (
                  <div key={s.sport || i}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span style={{ color: 'var(--gray-700)' }}>{s.sport}</span>
                      <span className="font-bold" style={{ color: 'var(--gray-900)' }}>{s.count}</span>
                    </div>
                    <div className="stat-bar-track">
                      <div
                        className="stat-bar-fill fill-blue"
                        style={{ width: `${(s.count / maxSportCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Events by Org */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users size={18} style={{ color: 'var(--pink)' }} />
                <h3 className="font-bold" style={{ color: 'var(--gray-800)' }}>Events by Organization</h3>
              </div>
              <div className="space-y-3">
                {stats.orgBreakdown.slice(0, 8).map((o, i) => (
                  <div key={o.organization || i}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="truncate max-w-[200px]" style={{ color: 'var(--gray-700)' }}>{o.organization}</span>
                      <span className="font-bold ml-2 flex-shrink-0" style={{ color: 'var(--gray-900)' }}>{o.count}</span>
                    </div>
                    <div className="stat-bar-track">
                      <div
                        className="stat-bar-fill fill-pink"
                        style={{ width: `${(o.count / maxOrgCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sports' && (
          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ color: 'var(--gray-800)' }}>All Sports Breakdown</h3>
            <div className="space-y-3">
              {stats.sportBreakdown.map((s, i) => (
                <div key={s.sport || i} className="flex items-center gap-4">
                  <div className="rank-badge" style={{ background: i < 3 ? 'var(--gradient)' : 'var(--gray-100)', color: i < 3 ? '#fff' : 'var(--gray-500)' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium" style={{ color: 'var(--gray-700)' }}>{s.sport}</span>
                      <span className="font-bold" style={{ color: 'var(--gray-900)' }}>{s.count} events</span>
                    </div>
                    <div className="stat-bar-track">
                      <div className="stat-bar-fill fill-blue" style={{ width: `${(s.count / maxSportCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orgs' && (
          <div className="card p-6">
            <h3 className="font-bold mb-5" style={{ color: 'var(--gray-800)' }}>Organizations Activity</h3>
            <div className="space-y-3">
              {stats.orgBreakdown.map((o, i) => (
                <div key={o.organization || i} className="flex items-center gap-4">
                  <div className="rank-badge" style={{ background: i < 3 ? 'var(--gradient)' : 'var(--gray-100)', color: i < 3 ? '#fff' : 'var(--gray-500)' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium truncate max-w-xs" style={{ color: 'var(--gray-700)' }}>{o.organization}</span>
                      <span className="font-bold ml-2 flex-shrink-0" style={{ color: 'var(--gray-900)' }}>{o.count} events</span>
                    </div>
                    <div className="stat-bar-track">
                      <div className="stat-bar-fill fill-pink" style={{ width: `${(o.count / maxOrgCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="card overflow-hidden">
            <div className="p-5" style={{ borderBottom: '1px solid var(--gray-100)' }}>
              <h3 className="font-bold" style={{ color: 'var(--gray-800)' }}>Recently Added Events</h3>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--gray-100)' }}>
              {stats.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--gray-800)' }}>{event.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-500)' }}>
                      {event.organizationName} · {event.sport}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <span className="text-xs" style={{ color: 'var(--gray-400)' }}>
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                    <Link to={`/events/${event.id}`} className="btn btn-ghost btn-sm">
                      <Eye size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardPage;
