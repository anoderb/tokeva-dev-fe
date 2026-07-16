"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar for Desktop */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* Main Page Area */}
      <div
        className={`flex-1 min-h-screen pb-16 md:pb-0 transition-all duration-300 ${
          isCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {children}
      </div>

      {/* Bottom Nav for Mobile */}
      <MobileNav />
    </div>
  );
}
