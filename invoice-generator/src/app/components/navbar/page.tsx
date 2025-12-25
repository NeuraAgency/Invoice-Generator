"use client";

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import "./styles.css"

const Navbar = () => {
  const pathname = usePathname();
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    // initialize theme from localStorage or system preference
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
        document.documentElement.setAttribute('data-theme', stored);
        return;
      }
    } catch {}

    // fallback to prefers-color-scheme
    try {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const init = prefersDark ? 'dark' : 'light';
      setTheme(init);
      document.documentElement.setAttribute('data-theme', init);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const makeActive = (href: string) => {
    if (!pathname) return false;
    try {
      // normalize and check prefix match so nested routes still mark parent active
      const p = String(pathname).toLowerCase();
      const h = String(href).toLowerCase();
      return p === h || p.startsWith(h + "/") || p.startsWith(h);
    } catch {
      return false;
    }
  };

  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--accent)] flex items-center justify-between px-4 z-40 shadow-md">
        <Link href="/">
          <img src="/logo.png" alt="logo" className='h-10 cursor-pointer' />
        </Link>
        <button 
          onClick={toggleMenu}
          className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-[280px] lg:min-w-[260px] h-screen bg-[var(--accent)] flex flex-col items-center shadow-2xl lg:shadow-none
      `}>
        <div className="mt-8 lg:mt-3 flex items-center gap-3">
          <Link href="/">
            <img src="/logo.png" alt="logo" className='w-40 lg:w-44 cursor-pointer' />
          </Link>

          <button
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            title="Toggle theme"
            className="ml-2 rounded-full bg-white/10 hover:bg-white/20 text-white p-2 transition-colors"
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
        </div>

        <div className="flex flex-col justify-center mt-10 lg:mt-6 font-semibold text-[13px] lg:text-[12px] text-white pl-0 gap-2 w-full">
          <Link href='/Datacenter' className={`nav-link roundborder2 ${makeActive('/Datacenter') ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="7" ry="2.5"/><path d="M5 5v4c0 1.38 3.134 2.5 7 2.5s7-1.12 7-2.5V5"/><ellipse cx="12" cy="13.5" rx="7" ry="2.5"/></svg>
            </span>
            <span className="nav-label">Purchase Order and Gate Pass</span>
          </Link>

          <Link href='/Challan' className={`nav-link roundborder2 ${makeActive('/Challan') ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3a1 1 0 0 1-1 1h-2"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="18.5" cy="19.5" r="1.5"/></svg>
            </span>
            <span className="nav-label">Generate Delivery Challan</span>
          </Link>

          <Link href='/Bill' className={`nav-link roundborder2 ${makeActive('/Bill') ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="2" width="14" height="20" rx="2"/><path d="M7 7h6M7 11h6M7 15h6"/></svg>
            </span>
            <span className="nav-label">Generate Invoices</span>
          </Link>

          <Link href='/Quotation' className={`nav-link roundborder2 ${makeActive('/Quotation') ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7a4 4 0 11-4 4"/><path d="M20 7a4 4 0 11-4 4"/><path d="M2 21h20"/></svg>
            </span>
            <span className="nav-label">Generate Quotation</span>
          </Link>
        </div>
      </div>
    </>
  )
}
 
export default Navbar