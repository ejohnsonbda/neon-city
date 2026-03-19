import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SPORTS = [
  'Sports Event', 'Archery', 'Athletics (Track & Field)', 'Basketball', 'Boccia',
  'Bowling', 'Boxing', 'Cricket', 'Cycling', 'Equestrian', 'Football (Soccer)',
  'Golf', 'Gymnastics', 'Hockey', 'Karate', 'Karting', 'Motocross',
  'Motorcycle Racing', 'Netball', 'Paralympic Sports', 'Pickleball', 'Rowing',
  'Rugby', 'Sailing', 'Sanshou', 'Squash', 'Swimming', 'Tennis', 'Triathlon', 'Volleyball',
];

const EditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '', description: '', date: '', time: '',
    location: '', imageUrl: '', sport: '', organizationName: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await api.get(`/events/${id}`);
        const e: Event = data.data;
        setEvent(e);
        setFormData({
          title: e.title,
          description: e.description || '',
          date: e.date,
          time: e.time || '',
          location: e.location || '',
          imageUrl: e.imageUrl || '',
          sport: e.sport || '',
          organizationName: e.organizationName,
        });
      } catch {
        toast.error('Failed to load event.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, navigate]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim()) errs.title = 'Title is required.';
    if (!formData.date) errs.date = 'Date is required.';
    return errs;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      await api.put(`/events/${id}`, formData);
      toast.success('Event updated successfully!');
      navigate(`/events/${id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update event.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center gap-4 mb-8">
          <Link to={`/events/${id}`} className="btn btn-ghost btn-sm">
            <ArrowLeft size={14} />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--gray-900)' }}>
              Edit Event
            </h1>
            <p className="text-sm mt-1 line-clamp-1" style={{ color: 'var(--gray-500)' }}>
              {event?.title}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Event Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input name="title" value={formData.title} onChange={handleChange} className="form-input" />
            {errors.title && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Sport</label>
            <select name="sport" value={formData.sport} onChange={handleChange} className="form-select">
              <option value="">Select a sport…</option>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
                Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="form-input" />
              {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Time</label>
              <input type="time" name="time" value={formData.time} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Location</label>
            <input name="location" value={formData.location} onChange={handleChange} className="form-input" />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Organization</label>
              <input name="organizationName" value={formData.organizationName} onChange={handleChange} className="form-input" />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Image URL</label>
            <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://…" className="form-input" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={5} className="form-textarea" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn btn-gradient" disabled={submitting}>
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Save size={15} /> Save Changes</>
              )}
            </button>
            <Link to={`/events/${id}`} className="btn btn-outline">Cancel</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default EditEventPage;
