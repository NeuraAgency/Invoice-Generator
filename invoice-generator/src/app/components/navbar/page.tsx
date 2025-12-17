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

  return (
    <div className='min-w-[240px] lg:min-w-[260px] h-screen bg-[var(--accent)] flex flex-col items-center'>
      <div className="mt-3 flex items-center gap-3">
        <Link href="/">
          <img src="/logo.png" alt="logo" className='w-40 lg:w-44 cursor-pointer' />
        </Link>

        <button
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
          title="Toggle theme"
          className="ml-2 rounded-full bg-white/10 hover:bg-white/20 text-white p-2"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </button>
      </div>

      <div className="flex flex-col justify-center mt-6 font-semibold text-[11px] lg:text-[12px] text-white pl-0 gap-1.5 w-full">
        <Link href='/Datacenter' className={`nav-link roundborder2 ${makeActive('/Datacenter') ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/><rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/><rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/></svg>
          </span>
          <span className="nav-label">Purchase Order and Gate Pass</span>
        </Link>

        <Link href='/Challan' className={`nav-link roundborder2 ${makeActive('/Challan') ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </span>
          <span className="nav-label">Generate Delivery Challan</span>
        </Link>

        <Link href='/Bill' className={`nav-link roundborder2 ${makeActive('/Bill') ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v6H4z" fill="currentColor"/><path d="M4 14h16v6H4z" fill="currentColor"/></svg>
          </span>
          <span className="nav-label">Generate Invoices</span>
        </Link>

        <Link href='/Quotation' className={`nav-link roundborder2 ${makeActive('/Quotation') ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          <span className="nav-label">Generate Quotation</span>
        </Link>
      </div>
    </div>
  )
}
 
export default Navbar