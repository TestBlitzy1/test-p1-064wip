import Link from 'next/link';
import React from 'react';
import { ROUTES } from '../../config/constants';

const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

const Footer: React.FC = () => {
  return (
    <footer 
      className="bg-gray-900 text-gray-300" 
      aria-label="Site footer"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Navigation Links Section */}
          <div>
            <h2 className="text-white text-lg font-semibold mb-4">Quick Links</h2>
            <nav aria-label="Footer navigation">
              <ul className="space-y-2">
                <li>
                  <Link 
                    href={ROUTES.HOME}
                    className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link 
                    href={ROUTES.ANALYTICS.DASHBOARD}
                    className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
                  >
                    Analytics
                  </Link>
                </li>
                <li>
                  <Link 
                    href={ROUTES.SETTINGS.PROFILE}
                    className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Company Information Section */}
          <div>
            <h2 className="text-white text-lg font-semibold mb-4">Company</h2>
            <address className="not-italic">
              <p>Sales & Intelligence Platform</p>
              <p>123 Business Avenue</p>
              <p>Enterprise District</p>
              <a 
                href="mailto:contact@salesintelligence.com"
                className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
              >
                contact@salesintelligence.com
              </a>
            </address>
          </div>

          {/* Legal Section */}
          <div>
            <h2 className="text-white text-lg font-semibold mb-4">Legal</h2>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/privacy"
                  className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms"
                  className="hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 rounded"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm">
              © {getCurrentYear()} Sales & Intelligence Platform. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0">
              <a 
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-blue-500 focus:text-white"
              >
                Skip to main content
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;