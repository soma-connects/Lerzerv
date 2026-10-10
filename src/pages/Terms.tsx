import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import './Legal.css';

/**
 * Terms of service for lezerv.com and the Lezerv Android app. Matches what the service
 * does today (requests with a short accept window, quotes, start codes, no in-app card
 * payment yet) and the app's own summary (LIVE_TERMS in the Android app). Fees are not
 * stated as numbers here: they are shown where they apply. DRAFT for legal review.
 */
const Terms: React.FC = () => {
  useSEO({
    title: 'Terms of Service | Lezerv',
    description: 'The terms for using Lezerv to book, or work as, a verified artisan in Lagos.',
  });

  return (
    <div className="legal-page container section">
      <h1>Terms of Service</h1>
      <p className="last-updated">Last updated: 10 October 2026 · Covers lezerv.com and the Lezerv Android app</p>

      <section>
        <h2>1. About these terms</h2>
        <p>
          These terms apply when you use Lezerv, on the website or in the app. By creating an account or booking through
          Lezerv you agree to them. You must be 18 or older to have an account.
        </p>
      </section>

      <section>
        <h2>2. What Lezerv is</h2>
        <p>
          Lezerv is a marketplace. It connects people who need help at home with independent artisans in Lagos. Artisans
          are not Lezerv's employees: each one is responsible for the work they do. Before an artisan can take jobs, our
          team checks their ID and address. We cannot promise the outcome of every job, but we act on problems you report
          (section 7).
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <p>
          Give accurate details and keep your sign-in to yourself. You are responsible for what happens on your account.
          Never share a job's start code until the artisan you booked is at your door: it is how they prove they are the
          right person.
        </p>
      </section>

      <section>
        <h2>4. Requests and quotes</h2>
        <p>
          When you book a particular artisan, they have a short time to accept. If they don't accept, or they decline,
          we may offer your job to other suitable artisans nearby. You can also post a job for our team to match.
        </p>
        <p>
          An artisan may give you an estimate, or visit first and then give a firm price. A price only applies once you
          accept it.
        </p>
      </section>

      <section>
        <h2>5. Prices and payment</h2>
        <p>
          Prices shown before booking are typical starting prices. The final price is the one you and the artisan agree
          before work starts, in chat or as an accepted quote. Each booking shows how it can be paid: by bank transfer to
          Lezerv, on delivery, or to the artisan when the job is done. Card payment is coming soon. When you pay Lezerv,
          we pass the artisan their share after the job is confirmed as done.
        </p>
        <p>
          Any service fee for clients, and Lezerv's commission for artisans, is shown before it applies. We never charge
          a fee you have not seen.
        </p>
      </section>

      <section>
        <h2>6. Cancelling</h2>
        <p>
          You can cancel a request until work starts, from your jobs in the app or on the website. Artisans can decline
          a request. Repeatedly not turning up for accepted jobs can lead to an account being suspended.
        </p>
      </section>

      <section>
        <h2>7. Problems, reviews and safety</h2>
        <p>
          If something goes wrong, report it within 48 hours of the job (Help → Report a problem in the app, or contact
          us). Our team looks into every report and decides on a fair outcome, which may include a refund of money paid
          through Lezerv. Reviews must be honest and about the job. In an emergency, call 112 first.
        </p>
      </section>

      <section>
        <h2>8. Using Lezerv properly</h2>
        <p>
          Don't give false information, harass anyone, ask for or share contact details to avoid the arrangement agreed
          through Lezerv, use someone else's account, or use Lezerv for anything illegal. Keep conversations about
          Lezerv jobs in Lezerv's chat, so our team can help if there's a problem.
        </p>
      </section>

      <section>
        <h2>9. For artisans</h2>
        <p>
          You work for yourself and are responsible for the quality and safety of your work, your tools, and your own
          taxes. Keep your profile, services, areas and documents accurate. Only go online when you can take jobs: while
          you are online the app shares your location so clients nearby can find you (see our{' '}
          <Link to="/privacy">privacy policy</Link>). Lezerv may suspend or remove artisans who break these terms or
          whose work leads to repeated complaints.
        </p>
      </section>

      <section>
        <h2>10. Our responsibility</h2>
        <p>
          We work hard to keep Lezerv available and safe, but we provide it as it is. To the extent the law allows,
          Lezerv is not liable for the work an artisan does, or for indirect losses. Nothing in these terms limits
          rights you have under Nigerian consumer protection law that cannot be limited.
        </p>
      </section>

      <section>
        <h2>11. Ending your account</h2>
        <p>
          You can delete your account at any time: in the app under Account → Settings → Delete account, or at{' '}
          <Link to="/delete-account">lezerv.com/delete-account</Link>. We may suspend or close an account that breaks
          these terms, and will tell you why.
        </p>
      </section>

      <section>
        <h2>12. Changes and the law</h2>
        <p>
          If we change these terms, we will update the date above and tell you in the app if the change matters to you.
          These terms are governed by the laws of the Federal Republic of Nigeria, and disputes go to the courts of Lagos
          State.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:support@lezerv.com">support@lezerv.com</a>.
        </p>
      </section>
    </div>
  );
};

export default Terms;
