import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { SupportBot } from '../support/SupportBot';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
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
