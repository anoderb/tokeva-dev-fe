"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  FolderOpen,
  Cloud,
  Settings
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Master AI', path: '/master-produk', icon: Database },
    { name: 'Dataset', path: '/dataset', icon: FolderOpen },
    { name: 'Sync', path: '/sync', icon: Cloud },
    { name: 'Setting', path: '/pengaturan', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 bg-slate-900 border-t border-slate-800 md:hidden flex items-center justify-around h-16 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.4)]">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center justify-center flex-1 py-1 space-y-1 transition-all ${
              isActive ? 'text-blue-500' : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className="text-[9px] font-bold tracking-wide leading-none">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
