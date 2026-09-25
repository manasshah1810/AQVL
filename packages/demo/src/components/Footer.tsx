import React from 'react';
import './footer.css';

const LogoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
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
              <a href="#/examples" className="nb-footer-link">Examples</a>
              <a href="#/privacy" className="nb-footer-link">Privacy Policy</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="nb-footer-bottom">
          <div className="nb-footer-copyright">
            © {new Date().getFullYear()} AQVL. Built with <span className="nb-footer-heart"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span> by the AlgoQuest team.
          </div>

        </div>

      </div>
    </footer>
  );
}
