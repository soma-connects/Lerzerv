import React from 'react';
import './Legal.css';

const Terms: React.FC = () => {
  return (
    <div className="legal-page container section">
      <h1>Terms of Service</h1>
      <p className="last-updated">Last Updated: October 2023</p>
      
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using Lezerv, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>Lezerv provides a platform connecting homeowners with third-party service professionals. Lezerv does not directly provide home services and is not responsible for the performance of the professionals.</p>
      </section>

      <section>
        <h2>3. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
      </section>

      <section>
        <h2>4. Payment Terms</h2>
        <p>Payments for services are processed through our secure payment gateway. Fees and cancellation policies are outlined at the time of booking.</p>
      </section>
    </div>
  );
};

export default Terms;
