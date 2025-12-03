import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  FolderIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  CogIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import CommandPalette from './CommandPalette';

const getNavigation = (isAdmin, hasPermission) => {
  const baseNav = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, section: 'main' },
  ];

  const adminNav = [
    { name: 'Users', href: '/admin/users', icon: UsersIcon, section: 'admin', permission: 'users.read' },
    { name: 'Customers', href: '/admin/customers', icon: BuildingOfficeIcon, section: 'admin', permission: 'customers.read' },
    { name: 'Guardian AI', href: '/admin/guardian', icon: SparklesIcon, section: 'admin', badge: 'Abigail', permission: 'guardian.read' },
    { name: 'Guardian SOC', href: '/admin/guardian/soc', icon: ShieldCheckIcon, section: 'admin', badge: 'Enterprise', permission: 'guardian.security.read' },
    { name: 'Server Management', href: '/server-management', icon: RocketLaunchIcon, section: 'admin', badge: 'Deploy', permission: 'deployments.read' },
    { name: 'Provisioning', href: '/provisioning', icon: CogIcon, section: 'admin', badge: 'Auto', permission: 'provisioning.read' },
    { name: 'Migra Shield', href: '/admin/shield', icon: ShieldCheckIcon, section: 'admin', badge: 'Zero Trust', permission: 'platform:shield:manage' },
    { name: 'Role Management', href: '/admin/roles', icon: UserGroupIcon, section: 'admin', badge: 'RBAC', permission: 'roles.read' },
  ];

  const hostingNav = [
    { name: 'Servers', href: '/servers', icon: ServerIcon, section: 'hosting', permission: 'servers.read' },
    { name: 'Server Metrics', href: '/metrics', icon: ChartBarIcon, section: 'hosting', permission: 'servers.metrics' },
    { name: 'Websites', href: '/websites', icon: GlobeAltIcon, section: 'hosting', permission: 'websites.read' },
    { name: 'Domains', href: '/domains', icon: GlobeAltIcon, section: 'hosting', permission: 'dns.read' },
    { name: 'DNS', href: '/dns', icon: GlobeAltIcon, section: 'hosting', permission: 'dns.read' },
    { name: 'Email', href: '/email', icon: EnvelopeIcon, section: 'hosting', permission: 'email.read' },
    { name: 'File Manager', href: '/files', icon: FolderIcon, section: 'hosting', permission: 'servers.read' },
    { name: 'Databases', href: '/databases', icon: CircleStackIcon, section: 'hosting', permission: 'databases.read' },
  ];

  const premiumNav = [
    { name: 'Premium Tools', href: '/premium-tools', icon: SparklesIcon, section: 'premium', badge: '33' },
    { name: 'SSL Certificates', href: '/ssl-certificates', icon: ShieldCheckIcon, section: 'premium', badge: 'Auto' },
    { name: 'App Installer', href: '/app-installer', icon: CubeIcon, section: 'premium', badge: '9' },
    { name: 'API Keys', href: '/api-keys', icon: CommandLineIcon, section: 'premium', badge: 'Keys' },
    { name: 'Backups', href: '/backups', icon: CircleStackIcon, section: 'premium', badge: 'DR' },
    { name: 'AI Features', href: '/ai', icon: SparklesIcon, section: 'premium', badge: 'GPT-4' },
    { name: 'WebSocket', href: '/websocket', icon: CommandLineIcon, section: 'premium', badge: 'Live' },
    { name: 'GraphQL API', href: '/graphql', icon: CommandLineIcon, section: 'premium', badge: 'API' },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, section: 'premium', badge: 'BI' },
    { name: 'Kubernetes', href: '/kubernetes', icon: ServerIcon, section: 'premium', badge: 'K8s' },
    { name: 'CDN Management', href: '/cdn', icon: GlobeAltIcon, section: 'premium', badge: 'Multi-Region' },
    { name: 'Monitoring', href: '/monitoring', icon: ChartBarIcon, section: 'premium', badge: 'Pro' },
    { name: 'API Marketplace', href: '/marketplace', icon: CubeIcon, section: 'premium', badge: 'Hub' },
    { name: 'White-Label', href: '/white-label', icon: SparklesIcon, section: 'premium', badge: 'Reseller' },
  ];

  const billingNav = [
    { name: 'Products', href: '/products', icon: CubeIcon, section: 'billing', permission: 'billing.read' },
    { name: 'Invoices', href: '/invoices', icon: DocumentTextIcon, section: 'billing', permission: 'billing.read' },
    { name: 'Subscriptions', href: '/subscriptions', icon: ClockIcon, section: 'billing', permission: 'billing.read' },
  ];

  const securityNav = [
    { name: 'Security', href: '/security', icon: ShieldCheckIcon, section: 'security' },
  ];

  // Filter nav items based on permissions
  const filterByPermission = (items) => {
    return items.filter(item => {
      // If no permission required, show it
      if (!item.permission) return true;
      // Admins can see everything (bypass permission check if permissions aren't loaded)
      if (isAdmin) return true;
      // Otherwise check if user has the permission
      return hasPermission(item.permission);
    });
  };

  const allNav = isAdmin 
    ? [...baseNav, ...filterByPermission(adminNav), ...filterByPermission(hostingNav), ...premiumNav, ...filterByPermission(billingNav), ...securityNav]
    : [...baseNav, ...filterByPermission(hostingNav), ...filterByPermission(billingNav), ...securityNav];

  return allNav;
};

const getSections = (isAdmin) => {
  const base = {
    main: 'Overview',
    hosting: 'Hosting',
    billing: 'Billing',
    security: 'Security'
  };

  return isAdmin ? { 
    main: 'Overview', 
    admin: 'Administration', 
    hosting: 'Hosting',
    premium: 'Enterprise Features',
    billing: 'Billing',
    security: 'Security'
  } : base;
};

export default function Layout({ children }) {
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, logout, hasPermission, isAdmin } = useAuth();
  
  const navigation = getNavigation(isAdmin, hasPermission);
  const sections = getSections(isAdmin);
  
  // Get user initial for avatar
  const userInitial = user?.name 
    ? user.name[0].toUpperCase() 
    : user?.email 
      ? user.email[0].toUpperCase() 
      : 'U';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CommandPalette isOpen={isCommandPaletteOpen} setIsOpen={setIsCommandPaletteOpen} />
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isMobileSidebarOpen ? (
            <XMarkIcon className="h-6 w-6 text-gray-700" />
          ) : (
            <Bars3Icon className="h-6 w-6 text-gray-700" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <img src="/brand/migrahosting-icon.svg" alt="M" className="h-8 w-8" />
          <span className="text-lg font-bold text-gray-900">MigraHosting</span>
        </div>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <img src="/brand/migrahosting-icon.svg" alt="M" className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900">MigraHosting</span>
            </div>
          </div>

          {/* Command Palette Trigger */}
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
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
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className={`
                          flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        <div className="flex items-center">
                          <item.icon className="h-5 w-5 mr-3" />
                          {item.name}
                        </div>
                        {item.badge && (
                          <span className={`
                            px-2 py-0.5 text-xs font-semibold rounded-full
                            ${isActive 
                              ? 'bg-primary-100 text-primary-700' 
                              : 'bg-gray-100 text-gray-600'
                            }
                          `}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 flex-1">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white font-medium">
                    {userInitial}
                  </div>
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {user?.name || user?.email || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
