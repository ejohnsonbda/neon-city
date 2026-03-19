import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, fullWidth = false }) => {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gray-50)' }}>
      <Header />
      <main
        className="flex-1"
        style={{ paddingTop: 'var(--nav-h)' }}
      >
        {fullWidth ? children : (
          <div className="container py-8">
            {children}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
