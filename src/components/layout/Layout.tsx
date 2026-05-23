import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { MessageCircle } from 'lucide-react';
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

      {/* Floating WhatsApp Chat Button */}
      <a 
        href="https://wa.me/2349046367604?text=Hello%20Lezerv%2C%20I%20have%20a%20question%20about%20your%20services." 
        target="_blank" 
        rel="noopener noreferrer" 
        className="floating-whatsapp-btn"
        title="Chat with Lezerv on WhatsApp"
        aria-label="Chat with Lezerv on WhatsApp"
      >
        <MessageCircle size={28} />
        <span className="tooltip-text">Chat with Us!</span>
      </a>
    </div>
  );
};
