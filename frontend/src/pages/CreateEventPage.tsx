import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, PlusCircle } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SPORTS = [
  'Sports Event',
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
  'Paralympic Sports',
  'Pickleball',
  'Rowing',
  'Rugby',
  'Sailing',
  'Sanshou',
  'Squash',
  'Swimming',
  'Tennis',
  'Triathlon',
  'Volleyball',
];

const CreateEventPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    imageUrl: '',
    sport: '',
    organizationName: currentUser?.organizationName || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
      const payload = {
        ...formData,
        organizationName: isAdmin ? formData.organizationName : currentUser?.organizationName,
      };
      const { data } = await api.post('/events', payload);
      toast.success('Event created successfully!');
      navigate(`/events/${data.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create event.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={14} />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--gray-900)' }}>
              Create New Event
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
              Add a new sports event to the calendar
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Event Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Football Premier Division Match"
              className="form-input"
            />
            {errors.title && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.title}</p>}
          </div>

          {/* Sport */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Sport / Category
            </label>
            <select name="sport" value={formData.sport} onChange={handleChange} className="form-select">
              <option value="">Select a sport…</option>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
                Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="form-input"
              />
              {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
                Time
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Location
            </label>
            <input
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. National Sports Centre, Devonshire"
              className="form-input"
            />
          </div>

          {/* Organization (admin override) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
                Organization Name
              </label>
              <input
                name="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                placeholder="Organization name"
                className="form-input"
              />
            </div>
          )}

          {/* Image URL */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Image URL <span className="text-xs font-normal" style={{ color: 'var(--gray-400)' }}>(optional)</span>
            </label>
            <input
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="form-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide details about the event…"
              rows={5}
              className="form-textarea"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn btn-gradient" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <PlusCircle size={15} />
                  Create Event
                </>
              )}
            </button>
            <Link to="/" className="btn btn-outline">Cancel</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CreateEventPage;
