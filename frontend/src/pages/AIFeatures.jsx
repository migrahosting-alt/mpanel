import React, { useState } from 'react';
import { SparklesIcon, CodeBracketIcon, BugAntIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

export default function AIFeatures() {
  const [activeTab, setActiveTab] = useState('code-gen');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  // Code Generation
  const [codePrompt, setCodePrompt] = useState('');
  
  // Debugging
  const [debugCode, setDebugCode] = useState('');
  const [debugError, setDebugError] = useState('');
  
  // Forecasting
  const [forecastMetric, setForecastMetric] = useState('revenue');
  const [forecastPeriod, setForecastPeriod] = useState(30);

  const handleCodeGeneration = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ai-api/generate-code', {
        prompt: codePrompt,
        language: 'javascript'
      });
      setResult(response.data.code || response.data.result);
    } catch (err) {
      setResult('Error: ' + (err.response?.data?.error || 'Failed to generate code'));
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ai-api/debug', {
        code: debugCode,
        error: debugError
      });
      setResult(response.data.analysis || response.data.result);
    } catch (err) {
      setResult('Error: ' + (err.response?.data?.error || 'Failed to debug'));
    } finally {
      setLoading(false);
    }
  };

  const handleForecast = async () => {
    setLoading(true);
    try {
      const response = await api.post('/ai-api/forecast', {
        metric: forecastMetric,
        period: forecastPeriod
      });
      setResult(JSON.stringify(response.data, null, 2));
    } catch (err) {
      setResult('Error: ' + (err.response?.data?.error || 'Failed to forecast'));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'code-gen', name: 'Code Generation', icon: CodeBracketIcon },
    { id: 'debug', name: 'AI Debugging', icon: BugAntIcon },
    { id: 'forecast', name: 'Forecasting', icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Features</h1>
        <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4" />
          Powered by GPT-4 and Claude AI
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setResult('');
                }}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Input</h3>
          
          {activeTab === 'code-gen' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe what code you need
                </label>
                <textarea
                  value={codePrompt}
                  onChange={(e) => setCodePrompt(e.target.value)}
                  rows={8}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Create a React component for a product card with image, title, price, and add to cart button"
                />
              </div>
              <button
                onClick={handleCodeGeneration}
                disabled={loading || !codePrompt}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          )}

          {activeTab === 'debug' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Code
                </label>
                <textarea
                  value={debugCode}
                  onChange={(e) => setDebugCode(e.target.value)}
                  rows={6}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Paste your code here..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Error Message
                </label>
                <textarea
                  value={debugError}
                  onChange={(e) => setDebugError(e.target.value)}
                  rows={3}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Paste error message here..."
                />
              </div>
              <button
                onClick={handleDebug}
                disabled={loading || !debugCode}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Analyzing...' : 'Debug with AI'}
              </button>
            </div>
          )}

          {activeTab === 'forecast' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metric to Forecast
                </label>
                <select
                  value={forecastMetric}
                  onChange={(e) => setForecastMetric(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="revenue">Revenue</option>
                  <option value="users">User Growth</option>
                  <option value="churn">Churn Rate</option>
                  <option value="resources">Resource Usage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forecast Period (Days)
                </label>
                <input
                  type="number"
                  value={forecastPeriod}
                  onChange={(e) => setForecastPeriod(parseInt(e.target.value))}
                  min="7"
                  max="365"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleForecast}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Forecasting...' : 'Generate Forecast'}
              </button>
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Output</h3>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : result ? (
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">
              {result}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <SparklesIcon className="h-16 w-16 mb-4" />
              <p className="text-sm">AI output will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
          <CodeBracketIcon className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Code Generation</h3>
          <p className="text-sm text-gray-600">
            Generate production-ready code snippets from natural language descriptions
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
          <BugAntIcon className="h-8 w-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">AI Debugging</h3>
          <p className="text-sm text-gray-600">
            Get intelligent suggestions to fix bugs and optimize your code
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
          <ChartBarIcon className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Forecasting</h3>
          <p className="text-sm text-gray-600">
            Predict revenue, user growth, and resource needs with AI-powered analytics
          </p>
        </div>
      </div>
    </div>
  );
}
