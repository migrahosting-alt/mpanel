import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon,
  ServerIcon,
  GlobeAltIcon,
  CubeIcon,
  DocumentTextIcon,
  ClockIcon,
  EnvelopeIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';

const actions = [
  { id: 'dashboard', name: 'Go to Dashboard', icon: HomeIcon, to: '/', category: 'Navigation' },
  { id: 'servers', name: 'View Servers', icon: ServerIcon, to: '/servers', category: 'Navigation' },
  { id: 'websites', name: 'View Websites', icon: GlobeAltIcon, to: '/websites', category: 'Navigation' },
  { id: 'dns', name: 'Manage DNS', icon: GlobeAltIcon, to: '/dns', category: 'Navigation' },
  { id: 'products', name: 'View Products', icon: CubeIcon, to: '/products', category: 'Navigation' },
  { id: 'invoices', name: 'View Invoices', icon: DocumentTextIcon, to: '/invoices', category: 'Navigation' },
  { id: 'subscriptions', name: 'View Subscriptions', icon: ClockIcon, to: '/subscriptions', category: 'Navigation' },
  { id: 'email', name: 'Manage Email', icon: EnvelopeIcon, to: '/email', category: 'Navigation' },
  { id: 'databases', name: 'Manage Databases', icon: CircleStackIcon, to: '/databases', category: 'Navigation' },
  { id: 'create-server', name: 'Create Server', icon: ServerIcon, action: 'create-server', category: 'Actions' },
  { id: 'create-website', name: 'Create Website', icon: GlobeAltIcon, action: 'create-website', category: 'Actions' },
  { id: 'create-dns-zone', name: 'Create DNS Zone', icon: GlobeAltIcon, action: 'create-dns', category: 'Actions' },
  { id: 'create-invoice', name: 'Create Invoice', icon: DocumentTextIcon, action: 'create-invoice', category: 'Actions' },
];

export default function CommandPalette({ isOpen, setIsOpen }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filteredActions = query === ''
    ? actions
    : actions.filter((action) =>
        action.name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (action) => {
    if (action.to) {
      navigate(action.to);
    } else if (action.action) {
      console.log('Trigger action:', action.action);
      // Handle custom actions here
    }
    setIsOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  return (
    <Transition.Root show={isOpen} as={Fragment} afterLeave={() => setQuery('')}>
      <Dialog as="div" className="relative z-50" onClose={setIsOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="mx-auto max-w-2xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
              <div className="relative">
                <MagnifyingGlassIcon
                  className="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm outline-none"
                  placeholder="Search or type a command..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {filteredActions.length > 0 && (
                <div className="max-h-96 scroll-py-2 overflow-y-auto py-2">
                  {['Navigation', 'Actions'].map((category) => {
                    const categoryActions = filteredActions.filter(
                      (action) => action.category === category
                    );
                    
                    if (categoryActions.length === 0) return null;

                    return (
                      <div key={category}>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {category}
                        </div>
                        {categoryActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => handleSelect(action)}
                            className="group flex w-full items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <action.icon
                              className="h-5 w-5 flex-none text-gray-400 group-hover:text-primary-600"
                              aria-hidden="true"
                            />
                            <span className="ml-3 flex-auto truncate text-sm text-gray-900 group-hover:text-primary-600">
                              {action.name}
                            </span>
                            <kbd className="ml-3 flex-none text-xs font-semibold text-gray-400 group-hover:text-primary-600">
                              ↵
                            </kbd>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {query !== '' && filteredActions.length === 0 && (
                <div className="py-14 px-4 text-center sm:px-14">
                  <p className="text-sm text-gray-500">No results found for "{query}"</p>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↑↓</kbd>
                    <span className="ml-2">Navigate</span>
                  </span>
                  <span className="flex items-center">
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↵</kbd>
                    <span className="ml-2">Select</span>
                  </span>
                </div>
                <div className="flex items-center">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd>
                  <span className="ml-2">Close</span>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
