import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, Mail, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: 'var(--gray-900)', color: 'rgba(255,255,255,.7)' }}>
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient)' }}>
                <Trophy size={18} color="#fff" />
              </div>
              <div>
                <span className="text-white font-extrabold">Sport</span>
                <span className="font-extrabold" style={{ color: 'var(--pink-light)' }}>Cal</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
              The official sports events calendar for Bermuda. Powered by the Department of Sports &amp; Recreation.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Trophy size={14} /> Events
                </Link>
              </li>
              <li>
                <Link to="/calendar" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Calendar size={14} /> Calendar View
                </Link>
              </li>
              <li>
                <Link to="/login" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail size={14} /> Organization Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://www.gov.bm/department/sport-and-recreation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <ExternalLink size={14} /> Department of Sports &amp; Recreation
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} />
                <a href="mailto:sports@gov.bm" className="hover:text-white transition-colors">
                  sports@gov.bm
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs"
          style={{ borderTop: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.35)' }}
        >
          <span>&copy; {year} SportCal — Bermuda Sports Events Calendar. All rights reserved.</span>
          <span>Powered by the Department of Sports &amp; Recreation, Bermuda</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
