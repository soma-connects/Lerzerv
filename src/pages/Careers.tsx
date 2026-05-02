import React from 'react';
import { ArrowRight } from 'lucide-react';
import './Careers.css';

const Careers: React.FC = () => {
  const corporateRoles = [
    { title: "Operations Manager", dept: "Logistics", location: "Lagos, Nigeria" },
    { title: "Frontend Engineer (React)", dept: "Engineering", location: "Remote" },
    { title: "Growth Specialist", dept: "Marketing", location: "Abuja, Nigeria" }
  ];

  const artisanPartners = [
    { title: "Certified Electrician Partner", location: "Lagos (Lekki, Ikeja)" },
    { title: "Master Plumber Partner", location: "Abuja (Gwarinpa, Maitama)" },
    { title: "Generator Specialist", location: "Port Harcourt" },
    { title: "AC & Cooling Expert", location: "Lagos / Abuja" }
  ];

  return (
    <div className="careers-page">
      <section className="careers-hero container section">
        <h1>Empower Your Craft, Grow Your Business.</h1>
        <p>Join the largest network of verified artisans and home service professionals in Nigeria.</p>
        <div className="hero-banner">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDT9PjhgiPU__b4kgz3524VZA9cx0Btgloc21UZhabZSRNtseUIrTJExyn75JC4HlYZd_qyNk-VKQHOsr5KdVLzPlIQJUWpX-DPtYcdiwFCJmh2kY2nJbu2vXrwjvZmP4rHcroejzTSbpelAyFex2SCL33oRIrKHFaBiRs-JFngQISg8nLpsF7KyYZI7NTUzGkfdwZLtKyRXOCy5GzLUvWQf61k-tJaYxEE5-w-7-TPEkc0gOCUO6m0GP5dyyZ4PFN5gcap4QGCB39Y" alt="Lezerv Artisan Community" />
        </div>
      </section>

      <section className="roles container section">
        <div className="roles-grid">
          <div className="roles-column">
            <h2>Artisan & Service Network</h2>
            <p className="column-desc">Become a verified partner and get access to high-value bookings in your area.</p>
            <div className="roles-list">
              {artisanPartners.map((partner, i) => (
                <div key={i} className="role-card">
                  <div className="role-info">
                    <h3>{partner.title}</h3>
                    <p>Verified Partner • {partner.location}</p>
                  </div>
                  <ArrowRight className="role-arrow" />
                </div>
              ))}
            </div>
          </div>

          <div className="roles-column">
            <h2>Corporate & Tech</h2>
            <p className="column-desc">Join our mission to revolutionize home maintenance across Africa.</p>
            <div className="roles-list">
              {corporateRoles.map((role, i) => (
                <div key={i} className="role-card">
                  <div className="role-info">
                    <h3>{role.title}</h3>
                    <p>{role.dept} • {role.location}</p>
                  </div>
                  <ArrowRight className="role-arrow" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Careers;
