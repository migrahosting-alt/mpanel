import React, { useEffect, useState } from 'react';
import { CommandLineIcon, SignalIcon, UserIcon } from '@heroicons/react/24/outline';
import { io } from 'socket.io-client';

export default function WebSocketPage() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socketInstance = io('http://localhost:2271', {
      auth: { token },
      transports: ['websocket']
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      addMessage('System', 'Connected to WebSocket server');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      addMessage('System', 'Disconnected from WebSocket server');
    });

    socketInstance.on('notification', (data) => {
      addMessage('Notification', data.message || JSON.stringify(data));
    });

    socketInstance.on('presence', (users) => {
      setOnlineUsers(users);
    });

    socketInstance.on('message', (data) => {
      addMessage(data.from || 'User', data.message || data.text);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, []);

  const addMessage = (sender, text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender,
      text,
      timestamp: new Date()
    }]);
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socket) return;
    
    socket.emit('message', { message: messageInput });
    addMessage('You', messageInput);
    setMessageInput('');
  };

  const sendTestNotification = () => {
    if (!socket) return;
    socket.emit('notification', { message: 'Test notification from WebSocket page' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WebSocket Real-time Features</h1>
          <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
            <SignalIcon className="h-4 w-4" />
            Status: 
            <span className={connected ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
        </div>
        <button
          onClick={sendTestNotification}
          disabled={!connected}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          Send Test Notification
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Panel */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Real-time Messages</h2>
          </div>
          <div className="p-4 h-96 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <CommandLineIcon className="h-12 w-12 mb-2" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`p-3 rounded-lg ${
                  msg.sender === 'System' ? 'bg-blue-50 border border-blue-200' :
                  msg.sender === 'You' ? 'bg-green-50 border border-green-200' :
                  msg.sender === 'Notification' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-gray-700">{msg.sender}</span>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">{msg.text}</p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                disabled={!connected}
                className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!connected || !messageInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Online Users Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Online Users ({onlineUsers.length})
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No users online</p>
            ) : (
              onlineUsers.map((user, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-900">{user.name || user.email || `User ${user.id}`}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Real-time Notifications</h3>
          <p className="text-sm text-gray-600">
            Instant updates for server events, deployments, and system alerts
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Live Collaboration</h3>
          <p className="text-sm text-gray-600">
            See who's online and collaborate in real-time with your team
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-900 mb-2">Presence Detection</h3>
          <p className="text-sm text-gray-600">
            Track user activity and session status across your infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
