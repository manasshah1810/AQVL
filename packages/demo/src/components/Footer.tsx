import React from 'react';
import './footer.css';

const LogoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const TwitterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.8c0-1.2-.4-2.2-1-2.8 3-.3 6-1.5 6-6.5 0-1.4-.5-2.5-1.3-3.4.1-.3.6-1.6-.1-3.4 0 0-1-.3-3.3 1.2-.9-.2-1.9-.3-2.9-.3-1 0-2 .1-2.9.3-2.3-1.5-3.3-1.2-3.3-1.2-.7 1.8-.2 3.1-.1 3.4-.8.9-1.3 2-1.3 3.4 0 5 3 6.2 6 6.5-.5.5-.9 1.4-1 2.8V21"></path>
  </svg>
);

export function Footer() {
  return (
    <footer className="nb-footer">
      <div className="nb-footer-container">
        
        {/* Top Content */}
        <div className="nb-footer-top">
          <div className="nb-footer-brand">
            <a href="#/" className="nb-footer-logo">
              <div className="nb-footer-logo-icon">
                <LogoIcon />
              </div>
              <span className="nb-footer-logo-text">AQVL</span>
            </a>
            <p className="nb-footer-desc">
              The Algorithmic Query and Visualization Language. Built for educators and engineers who want to <strong>show</strong> how algorithms think.
            </p>
          </div>
          
          <div className="nb-footer-links">
            <div className="nb-footer-col">
              <h4 className="nb-footer-col-title">Navigation</h4>
              <a href="#/" className="nb-footer-link">Home</a>
              <a href="#/playground" className="nb-footer-link">Playground</a>
              <a href="#/ide" className="nb-footer-link">Developer IDE</a>
            </div>

            <div className="nb-footer-col">
              <h4 className="nb-footer-col-title">Domains</h4>
              <span className="nb-footer-link nb-footer-link--active">
                <span className="nb-footer-link-dot" /> DSA
              </span>
              <span className="nb-footer-link nb-footer-link--disabled">
                AI / ML <span className="nb-footer-soon">Soon</span>
              </span>
              <span className="nb-footer-link nb-footer-link--disabled">
                Blockchain <span className="nb-footer-soon">Soon</span>
              </span>
            </div>

            <div className="nb-footer-col">
              <h4 className="nb-footer-col-title">Resources</h4>
              <a href="#/docs" className="nb-footer-link">Documentation</a>
              <a href="https://github.com/AlgoQuest/AQVL" target="_blank" rel="noopener noreferrer" className="nb-footer-link">GitHub</a>
              <a href="#/examples" className="nb-footer-link">Examples</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="nb-footer-bottom">
          <div className="nb-footer-copyright">
            © {new Date().getFullYear()} AlgoQuest. Built with <span className="nb-footer-heart">❤️</span> by the AlgoQuest team.
          </div>
          
          <div className="nb-footer-socials">
            <a href="#" className="nb-footer-social" aria-label="Twitter">
              <TwitterIcon />
            </a>
            <a href="https://github.com/AlgoQuest/AQVL" target="_blank" rel="noopener noreferrer" className="nb-footer-social" aria-label="GitHub">
              <GitHubIcon />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
