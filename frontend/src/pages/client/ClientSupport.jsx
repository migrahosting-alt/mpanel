import { useState, useEffect } from 'react';
import {
  LifebuoyIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientSupport = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    priority: 'medium',
    description: '',
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/client/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || mockTickets);
      } else {
        setTickets(mockTickets);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets(mockTickets);
      setLoading(false);
    }
  };

  const mockTickets = [
    {
      id: 'TKT-001',
      subject: 'Website loading slowly',
      status: 'open',
      priority: 'high',
      created: '2025-11-10T10:30:00Z',
      lastUpdate: '2025-11-11T14:20:00Z',
      replies: 3,
    },
    {
      id: 'TKT-002',
      subject: 'Email configuration help',
      status: 'closed',
      priority: 'medium',
      created: '2025-11-05T09:15:00Z',
      lastUpdate: '2025-11-06T16:40:00Z',
      replies: 5,
    },
  ];

  const handleCreateTicket = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/client/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTicket),
      });

      if (response.ok) {
        toast.success('Support ticket created successfully');
        setShowNewTicket(false);
        setNewTicket({ subject: '', priority: 'medium', description: '' });
        fetchTickets();
      } else {
        toast.error('Failed to create ticket');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ClockIcon },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: ChatBubbleLeftRightIcon },
      closed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.open;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="mr-1 h-4 w-4" />
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-2 text-sm text-gray-700">
            Get help from our support team
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowNewTicket(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul role="list" className="divide-y divide-gray-200">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="p-6 hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{ticket.subject}</h3>
                    <div className="flex items-center space-x-2">
                      {getPriorityBadge(ticket.priority)}
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <span className="font-medium text-gray-700">{ticket.id}</span>
                    <span>Created {new Date(ticket.created).toLocaleDateString()}</span>
                    <span>Last updated {new Date(ticket.lastUpdate).toLocaleDateString()}</span>
                    <span>{ticket.replies} replies</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {tickets.length === 0 && (
          <div className="text-center py-12">
            <LifebuoyIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No support tickets</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create a ticket if you need help with your services.
            </p>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Create Support Ticket</h3>
            </div>
            <form onSubmit={handleCreateTicket} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={6}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTicket(false);
                    setNewTicket({ subject: '', priority: 'medium', description: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSupport;
