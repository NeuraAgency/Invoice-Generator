"use client";

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import "./styles.css"

const Navbar = () => {
  const pathname = usePathname();
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
    <div className='min-w-[240px] lg:min-w-[260px] h-screen bg-[var(--accent)] flex flex-col items-center roundborder'>
      <img src="/logo.png" alt="logo" className='mt-2 w-48 lg:w-52' />

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