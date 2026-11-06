import React from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SupportBot } from '../support/SupportBot';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { pathname } = useLocation();

  // The admin dashboard has its own sidebar and top bar, so it is shown
  // without the public website's header, footer and chat assistant.
  if (pathname.startsWith('/admin')) {
    return <div className="layout layout-bare">{children}</div>;
  }

  return (
    <div className="layout">
      <Header />
      <main className="layout-content">
        {children}
      </main>
      <Footer />

      {/*
        The assistant replaces the bare WhatsApp button: it answers the
        common questions itself and still offers WhatsApp (or an in-app
        ticket) when a human is needed.
      */}
      <SupportBot />
    </div>
  );
};
