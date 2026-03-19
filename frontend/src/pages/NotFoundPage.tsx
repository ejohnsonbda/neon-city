import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Trophy } from 'lucide-react';

const NotFoundPage: React.FC = () => (
  <div
    className="min-h-screen flex items-center justify-center p-4"
    style={{ background: 'var(--gray-50)' }}
  >
    <div className="text-center max-w-md">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: 'var(--gradient)' }}
      >
        <Trophy size={36} color="#fff" />
      </div>
      <h1 className="text-7xl font-black mb-4 text-gradient">404</h1>
      <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--gray-800)' }}>
        Page Not Found
      </h2>
      <p className="mb-8" style={{ color: 'var(--gray-500)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn btn-gradient btn-lg">
        <Home size={16} />
        Back to Events
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
