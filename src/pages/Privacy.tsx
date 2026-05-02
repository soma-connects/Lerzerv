import React from 'react';
import './Legal.css';

const Privacy: React.FC = () => {
  return (
    <div className="legal-page container section">
      <h1>Privacy Policy</h1>
      <p className="last-updated">Last Updated: October 2023</p>
      
      <section>
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, including your name, email address, phone number, and address when you create an account or book a service.</p>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use your information to facilitate service bookings, communicate with you, and improve our platform. We share relevant details with service professionals only once a booking is confirmed.</p>
      </section>

      <section>
        <h2>3. Data Security</h2>
        <p>We implement industry-standard security measures to protect your personal information from unauthorized access or disclosure.</p>
      </section>
    </div>
  );
};

export default Privacy;
