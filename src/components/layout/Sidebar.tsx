"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  FolderOpen,
  Cpu,
  MessageSquare,
  FolderLock,
  Cloud,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Master Produk AI', path: '/master-produk', icon: Database },
    { name: 'Dataset Manager', path: '/dataset', icon: FolderOpen },
    { name: 'Model AI', path: '/model', icon: Cpu },
    { name: 'Feedback AI', path: '/feedback', icon: MessageSquare },
    { name: 'Produk Unknown', path: '/unknown', icon: FolderLock },
    { name: 'Hugging Face Sync', path: '/sync', icon: Cloud },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 bg-slate-900 border-r border-slate-800 transition-all duration-300 hidden md:flex flex-col justify-between ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-slate-850 h-20">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-blue-500" />
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              TOKIVA AI
            </span>
          </div>
        )}
        {isCollapsed && <Cpu className="w-6 h-6 text-blue-500 mx-auto" />}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors absolute right-[-14px] top-6 bg-slate-900 border border-slate-800 shadow-md"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10'
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-transform ${
                isActive ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              {!isCollapsed && (
                <span className="text-xs font-semibold tracking-wide truncate">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-850 text-center">
        {!isCollapsed ? (
          <p className="text-[10px] text-slate-500 font-medium">© 2026 TOKIVA MLOps</p>
        ) : (
          <span className="text-[9px] text-slate-600 font-bold font-mono">v1.1</span>
        )}
      </div>
    </aside>
  );
}
