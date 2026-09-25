import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import './privacy.css';

export default function Privacy() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('aqvl-docs-theme') ?? 'dark') as 'light' | 'dark'
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
    // Only the saved theme at mount; toggleTheme sets the attribute itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aqvl-docs-theme', next);
  };

  if (!mounted) return null;

  return (
    <div className="privacy-root" data-theme={theme}>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      
      <main className="privacy-main">
        <div className="privacy-container">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-last-updated">Last Updated: August 2026</p>

          <section className="privacy-section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to AQVL. This Privacy Policy explains our approach to data collection and storage when you use our website, tools, and services. Transparency and respecting user privacy are core tenets of our project.
            </p>
          </section>

          <section className="privacy-section">
            <h2>2. Local Storage (Functional Preferences)</h2>
            <p>
              AQVL stores a small amount of data in your browser's local storage. This data is used only to remember user preferences and improve usability (for example, your theme selection or whether you have previously visited the site).
            </p>
            <ul>
              <li>No personal information is stored in these values.</li>
              <li>The data is not used for advertising, analytics, behavioral profiling, or cross-site tracking.</li>
            </ul>
            <p>
              Because this storage is strictly necessary for the requested functionality, no cookie consent banner is required for these specific items. By using AQVL, you acknowledge and agree to this functional use of local storage.
            </p>
          </section>

          <section className="privacy-section">
            <h2>3. Third-Party Services</h2>
            <p>
              AQVL is a client-side application. We do not integrate with third-party tracking networks, analytics providers, or advertising services. Your code and visualizations run entirely within your local browser environment.
            </p>
          </section>

          <section className="privacy-section">
            <h2>4. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please reach out to the AlgoQuest team via our official channels.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
