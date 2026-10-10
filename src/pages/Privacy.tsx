import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import './Legal.css';

/**
 * Privacy policy for lezerv.com and the Lezerv Android app. Google Play links to this
 * page, so it must describe what the app actually does with data. Keep it in step with
 * the app and the database (location: migrations 0022/0027; push: 0024; emails: 0026).
 * DRAFT for legal review under the Nigeria Data Protection Act 2023.
 */
const Privacy: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | Lezerv',
    description: 'What Lezerv collects in the app and on lezerv.com, why, who sees it, and how to delete it.',
  });

  return (
    <div className="legal-page container section">
      <h1>Privacy Policy</h1>
      <p className="last-updated">Last updated: 10 October 2026 · Covers lezerv.com and the Lezerv Android app</p>

      <section>
        <h2>1. Who we are</h2>
        <p>
          Lezerv connects people in Lagos who need help at home with independent, verified artisans.
          Lezerv is responsible for the personal data described here. Questions or requests:{' '}
          <a href="mailto:support@lezerv.com">support@lezerv.com</a>.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <p><strong>Your account:</strong> name, phone number and/or email, and your password if you sign in with email (stored only in scrambled form).</p>
        <p><strong>Places:</strong> addresses you save, and, if you choose "use my location" on an address, the exact point of that address.</p>
        <p>
          <strong>Your location, only while you use the app:</strong> to show artisans near you, the app reads your phone's location
          and sends it with the search. We do not store a client's location. If you are an artisan and go online, the app shares
          your location when you go online and every few minutes while you stay online, so clients nearby can find you. The app
          never reads location in the background, and you can say no: the app then shows Lekki Phase 1 instead.
        </p>
        <p><strong>Jobs and messages:</strong> what you book, quotes and prices, job photos you add, reviews, and chat messages with artisans and with our support team.</p>
        <p><strong>Artisans' verification:</strong> the ID number and documents artisans upload so our team can check them.</p>
        <p><strong>Your phone, for notifications:</strong> a notification token from Google Firebase and the app version, so we can send you job updates.</p>
        <p><strong>On the website:</strong> what you send through forms (bookings, contact messages, job applications and CVs, ambassador sign-ups, support requests).</p>
      </section>

      <section>
        <h2>3. Why we use it</h2>
        <p>
          To run the service you asked for: find artisans near you, send your request to the artisan you choose, let you chat
          and agree the price, check the right artisan has arrived (start codes), send you notifications and emails about your
          jobs, verify artisans, keep people safe, handle problems you report, and stop fraud and abuse.
        </p>
      </section>

      <section>
        <h2>4. Who sees it</h2>
        <p>
          <strong>Artisans</strong> see your first name and the area of a job when it is offered to them, and your street address and
          the address pin only once they accept that job. They do not see your phone number or email: chat hides phone numbers,
          emails and links.
        </p>
        <p>
          <strong>Clients</strong> see an artisan's name, profile, reviews and an approximate position, rounded to about 550 metres.
          An artisan's exact location is never shown to clients.
        </p>
        <p><strong>Our team</strong> sees what it needs to verify artisans, resolve problems and answer support requests.</p>
        <p>
          <strong>Service providers that process data for us:</strong> Supabase (database, sign-in and file storage), Google Firebase
          (notifications to your phone), Resend (emails), and OpenFreeMap (map images; your phone requests the map area you are
          looking at). We do not sell your data.
        </p>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <p>
          For as long as you have an account. When you delete your account we delete your personal data within 30 days, except
          records the law requires us to keep, such as payment records, which we keep only as long as required.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <p>
          Under the Nigeria Data Protection Act 2023 you can ask for a copy of your data, ask us to correct it, object to how
          we use it, or ask us to delete it. Write to <a href="mailto:support@lezerv.com">support@lezerv.com</a>. You can also
          complain to the Nigeria Data Protection Commission.
        </p>
        <p>
          <strong>Delete your account:</strong> in the app, Account → Settings → Delete account, or on the web at{' '}
          <Link to="/delete-account">lezerv.com/delete-account</Link>.
        </p>
      </section>

      <section>
        <h2>7. Security</h2>
        <p>
          Data travels encrypted. Access is limited by rules in our database, so each person can only read what is theirs or what
          a job lets them see, and artisans' documents are kept in private storage.
        </p>
      </section>

      <section>
        <h2>8. Children</h2>
        <p>Lezerv is for adults. You must be 18 or older to create an account.</p>
      </section>

      <section>
        <h2>9. Changes</h2>
        <p>If we change this policy we will update the date above, and tell you in the app if the change matters to you.</p>
      </section>
    </div>
  );
};

export default Privacy;
