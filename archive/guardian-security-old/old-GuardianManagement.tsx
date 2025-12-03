import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface GuardianInstance {
  id: string;
  name: string;
  customer_email: string;
  product_name: string;
  gateway_url: string;
  widget_token: string;
  status: 'active' | 'suspended' | 'deleted';
  total_sessions: number;
  total_messages: number;
  created_at: string;
  branding: {
    title?: string;
    subtitle?: string;
    primaryColor?: string;
    assistantName?: string;
  };
}

interface Session {
  id: string;
  session_id: string;
  user_identifier: string;
  message_count: number;
  user_satisfaction_rating: number | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_name: string | null;
  tool_input: any;
  tool_result: any;
  llm_tokens_used: number;
  llm_cost: number;
  created_at: string;
}

export default function GuardianManagement() {
  const [instances, setInstances] = useState<GuardianInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<GuardianInstance | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'instances' | 'sessions' | 'conversation'>('instances');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    customerId: '',
    instanceName: '',
    gatewayUrl: 'https://guardian.migrapanel.com',
    widgetTitle: 'AI Support Assistant',
    widgetSubtitle: 'How can I help you today?',
    primaryColor: '#3b82f6',
    assistantName: 'Abigail',
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    maxMessagesPerDay: 100,
    enableVoice: false
  });

  useEffect(() => {
    loadInstances();
    loadCustomers();
  }, []);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: GuardianInstance[] }>('/guardian/instances');
      setInstances(response.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load Guardian instances');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await api.get<{ data: any[] }>('/customers');
      setCustomers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load customers:', error);
    }
  };

  const createInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.instanceName) {
      toast.error('Please enter an instance name');
      return;
    }

    try {
      // Convert empty customerId to null for database
      const payload = {
        ...formData,
        customerId: formData.customerId || null
      };
      await api.post('/guardian/instances', payload);
      toast.success('Guardian instance created successfully!');
      setShowCreateModal(false);
      setFormData({
        customerId: '',
        instanceName: '',
        gatewayUrl: 'https://guardian.migrapanel.com',
        widgetTitle: 'AI Support Assistant',
        widgetSubtitle: 'How can I help you today?',
        primaryColor: '#3b82f6',
        assistantName: 'Abigail',
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        maxMessagesPerDay: 100,
        enableVoice: false
      });
      loadInstances();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create Guardian instance');
    }
  };

  const loadSessions = async (instanceId: string) => {
    try {
      const response = await api.get<{ data: Session[] }>(`/guardian/instances/${instanceId}/sessions`);
      setSessions(response.data || []);
      setView('sessions');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load sessions');
    }
  };

  const loadConversation = async (sessionId: string) => {
    try {
      const response = await api.get<{ data: Message[] }>(`/guardian/sessions/${sessionId}/conversation`);
      setMessages(response.data || []);
      setView('conversation');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load conversation');
    }
  };

  const regenerateToken = async (instanceId: string) => {
    if (!confirm('Regenerate widget token? This will invalidate the current token.')) return;
    
    try {
      await api.post(`/guardian/instances/${instanceId}/regenerate-token`);
      toast.success('Token regenerated successfully');
      loadInstances();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate token');
    }
  };

  const copyEmbedCode = async (instanceId: string) => {
    try {
      const response = await api.get<{ embedCode: string }>(`/guardian/instances/${instanceId}/embed-code`);
      await navigator.clipboard.writeText(response.embedCode);
      toast.success('Embed code copied to clipboard!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to copy embed code');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guardian AI Management</h1>
          <p className="text-gray-600 mt-1">Manage AI support assistants and monitor conversations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Instance
        </button>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <button 
          onClick={() => { setView('instances'); setSelectedInstance(null); setSelectedSession(null); }}
          className={`hover:text-blue-600 ${view === 'instances' ? 'font-bold text-blue-600' : ''}`}
        >
          Instances
        </button>
        {selectedInstance && (
          <>
            <span>/</span>
            <button 
              onClick={() => { setView('sessions'); setSelectedSession(null); }}
              className={`hover:text-blue-600 ${view === 'sessions' ? 'font-bold text-blue-600' : ''}`}
            >
              {selectedInstance.name}
            </button>
          </>
        )}
        {selectedSession && (
          <>
            <span>/</span>
            <span className="font-bold text-blue-600">Conversation</span>
          </>
        )}
      </div>

      {/* Instances View */}
      {view === 'instances' && (
        <div className="grid gap-6">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-600 mb-4">No Guardian instances yet</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Your First Instance
              </button>
            </div>
          ) : (
            instances.map(instance => (
              <div key={instance.id} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{instance.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        instance.status === 'active' ? 'bg-green-100 text-green-800' :
                        instance.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {instance.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">
                      Customer: <strong>{instance.customer_email}</strong> | Plan: <strong>{instance.product_name}</strong>
                    </p>
                    <p className="text-gray-500 text-sm">
                      Gateway: {instance.gateway_url}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{instance.total_sessions}</div>
                    <div className="text-xs text-gray-600">Sessions</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Total Messages</div>
                    <div className="text-lg font-bold">{instance.total_messages}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Branding</div>
                    <div className="text-sm font-semibold">{instance.branding?.title || 'Default'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Created</div>
                    <div className="text-sm">{new Date(instance.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedInstance(instance); loadSessions(instance.id); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                  >
                    View Sessions
                  </button>
                  <button
                    onClick={() => copyEmbedCode(instance.id)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                  >
                    Copy Embed Code
                  </button>
                  <button
                    onClick={() => regenerateToken(instance.id)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold"
                  >
                    Regenerate Token
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-semibold"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sessions View */}
      {view === 'sessions' && selectedInstance && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <h2 className="text-2xl font-bold mb-2">{selectedInstance.name}</h2>
            <p className="opacity-90">Recent chat sessions</p>
          </div>
          
          <div className="p-6">
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                No sessions yet for this instance
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => { setSelectedSession(session); loadConversation(session.session_id); }}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 cursor-pointer transition-all hover:shadow-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 mb-1">
                          {session.user_identifier || 'Anonymous User'}
                        </div>
                        <div className="text-sm text-gray-600">
                          Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{session.session_id}</code>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">{session.message_count}</div>
                        <div className="text-xs text-gray-600">Messages</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Started: {new Date(session.created_at).toLocaleString()}
                      </div>
                      {session.user_satisfaction_rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span className="font-bold">{session.user_satisfaction_rating}/5</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation View */}
      {view === 'conversation' && selectedSession && (
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
            <h2 className="text-2xl font-bold mb-2">Live Conversation</h2>
            <p className="opacity-90">
              {selectedSession.user_identifier || 'Anonymous User'} • {messages.length} messages
            </p>
          </div>
          
          <div className="p-6 bg-gray-50 max-h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                No messages in this conversation
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white text-gray-900 border-2 border-gray-200'
                    } rounded-2xl p-4 shadow-md`}>
                      {/* Role Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold ${
                          message.role === 'user' ? 'text-blue-200' : 'text-purple-600'
                        }`}>
                          {message.role === 'user' ? '👤 USER' : '🤖 ABIGAIL'}
                        </span>
                        <span className={`text-xs ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {/* Message Content */}
                      <div className="whitespace-pre-wrap mb-2">{message.content}</div>
                      
                      {/* Tool Usage */}
                      {message.tool_name && (
                        <div className={`mt-3 pt-3 border-t ${
                          message.role === 'user' ? 'border-blue-400' : 'border-gray-200'
                        }`}>
                          <div className={`text-xs font-bold mb-2 ${
                            message.role === 'user' ? 'text-blue-200' : 'text-orange-600'
                          }`}>
                            🔧 Tool Used: {message.tool_name}
                          </div>
                          {message.tool_input && (
                            <details className="text-xs">
                              <summary className={`cursor-pointer ${
                                message.role === 'user' ? 'text-blue-200' : 'text-gray-600'
                              }`}>
                                Input
                              </summary>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto ${
                                message.role === 'user' ? 'bg-blue-700' : 'bg-gray-100'
                              }`}>
                                {JSON.stringify(message.tool_input, null, 2)}
                              </pre>
                            </details>
                          )}
                          {message.tool_result && (
                            <details className="text-xs mt-1">
                              <summary className={`cursor-pointer ${
                                message.role === 'user' ? 'text-blue-200' : 'text-gray-600'
                              }`}>
                                Result
                              </summary>
                              <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto ${
                                message.role === 'user' ? 'bg-blue-700' : 'bg-gray-100'
                              }`}>
                                {JSON.stringify(message.tool_result, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                      
                      {/* LLM Metrics */}
                      {message.llm_tokens_used > 0 && (
                        <div className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                        }`}>
                          Tokens: {message.llm_tokens_used} • Cost: ${message.llm_cost.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">Create Guardian AI Instance</h2>
              <p className="text-gray-600 mt-1">Set up a new AI support assistant for your customer</p>
            </div>

            <form onSubmit={createInstance} className="p-6 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">None (Admin/System Instance)</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name || customer.first_name + ' ' + customer.last_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Optional - Leave as 'None' for admin-owned instances</p>
              </div>

              {/* Instance Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Instance Name *</label>
                <input
                  type="text"
                  value={formData.instanceName}
                  onChange={(e) => setFormData({ ...formData, instanceName: e.target.value })}
                  placeholder="e.g., MigraTech Support Assistant"
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Widget Configuration */}
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="font-bold text-blue-900 mb-4">Widget Appearance</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Widget Title</label>
                    <input
                      type="text"
                      value={formData.widgetTitle}
                      onChange={(e) => setFormData({ ...formData, widgetTitle: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Assistant Name</label>
                    <input
                      type="text"
                      value={formData.assistantName}
                      onChange={(e) => setFormData({ ...formData, assistantName: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Widget Subtitle</label>
                  <input
                    type="text"
                    value={formData.widgetSubtitle}
                    onChange={(e) => setFormData({ ...formData, widgetSubtitle: e.target.value })}
                    placeholder="e.g., How can I help you today?"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Primary Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="h-10 w-20 border-2 border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* AI Configuration */}
              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <h3 className="font-bold text-purple-900 mb-4">AI Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">LLM Provider</label>
                    <select
                      value={formData.llmProvider}
                      onChange={(e) => setFormData({ ...formData, llmProvider: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="groq">Groq</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Model</label>
                    <select
                      value={formData.llmModel}
                      onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="gpt-4o">GPT-4o (Best Quality)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (Balanced)</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Max Messages/Day</label>
                  <input
                    type="number"
                    value={formData.maxMessagesPerDay}
                    onChange={(e) => setFormData({ ...formData, maxMessagesPerDay: parseInt(e.target.value) })}
                    min="10"
                    max="10000"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Rate limit to prevent abuse</p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enableVoice}
                    onChange={(e) => setFormData({ ...formData, enableVoice: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-bold text-gray-700">Enable Voice Input (Beta)</label>
                </div>
              </div>

              {/* Gateway URL */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Gateway URL</label>
                <input
                  type="url"
                  value={formData.gatewayUrl}
                  onChange={(e) => setFormData({ ...formData, gatewayUrl: e.target.value })}
                  placeholder="https://guardian.migrapanel.com"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">The backend API endpoint for this Guardian instance</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                >
                  🚀 Create Instance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
