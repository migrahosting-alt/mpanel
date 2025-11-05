import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ServerIcon,
  GlobeAltIcon,
  CubeIcon,
  DocumentTextIcon,
  ClockIcon,
  ChartBarIcon,
  CommandLineIcon,
  EnvelopeIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import CommandPalette from './CommandPalette';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, section: 'main' },
  { name: 'Servers', href: '/servers', icon: ServerIcon, section: 'hosting' },
  { name: 'Websites', href: '/websites', icon: GlobeAltIcon, section: 'hosting' },
  { name: 'DNS', href: '/dns', icon: GlobeAltIcon, section: 'hosting' },
  { name: 'Email', href: '/email', icon: EnvelopeIcon, section: 'hosting' },
  { name: 'Databases', href: '/databases', icon: CircleStackIcon, section: 'hosting' },
  { name: 'Products', href: '/products', icon: CubeIcon, section: 'billing' },
  { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon, section: 'billing' },
  { name: 'Subscriptions', href: '/subscriptions', icon: ClockIcon, section: 'billing' },
];

const sections = {
  main: 'Overview',
  hosting: 'Hosting',
  billing: 'Billing'
};

export default function Layout({ children }) {
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <CommandPalette isOpen={commandPaletteOpen} setIsOpen={setCommandPaletteOpen} />
      
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">MPanel</span>
            </div>
          </div>

          {/* Command Palette Trigger */}
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <CommandLineIcon className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Quick actions...</span>
              <kbd className="px-2 py-0.5 text-xs bg-white rounded border border-gray-200">⌘K</kbd>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
            {Object.entries(sections).map(([key, label]) => {
              const sectionItems = navigation.filter(item => item.section === key);
              return (
                <div key={key} className="mb-4">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {label}
                  </div>
                  {sectionItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`
                          flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                  A
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-500">admin@mpanel.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
