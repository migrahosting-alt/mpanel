import React, { useState } from 'react';
import { CommandLineIcon, PlayIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

export default function GraphQLPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const exampleQueries = [
    {
      name: 'Get Servers',
      query: `query {
  servers {
    id
    name
    hostname
    status
    ip_address
  }
}`
    },
    {
      name: 'Get Websites',
      query: `query {
  websites {
    id
    name
    primary_domain
    php_version
    status
  }
}`
    },
    {
      name: 'Get Domains',
      query: `query {
  domains {
    id
    name
    registrar
    expires_at
    status
  }
}`
    }
  ];

  const executeQuery = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post('/graphql', { query });
      setResult(JSON.stringify(response.data, null, 2));
    } catch (err) {
      setResult(JSON.stringify({
        error: err.response?.data?.error || err.message || 'Failed to execute query'
      }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GraphQL API Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Query your infrastructure data with GraphQL
        </p>
      </div>

      {/* Example Queries */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Example Queries</h3>
        <div className="flex gap-2 flex-wrap">
          {exampleQueries.map((example) => (
            <button
              key={example.name}
              onClick={() => setQuery(example.query)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              {example.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Editor */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Query Editor</h2>
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              {loading ? 'Running...' : 'Run Query'}
            </button>
          </div>
          <div className="p-4">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={20}
              className="w-full font-mono text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type your GraphQL query here..."
            />
          </div>
        </div>

        {/* Results Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Response</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : result ? (
              <pre className="bg-gray-50 p-4 rounded-md overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">
                {result}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <CommandLineIcon className="h-16 w-16 mb-4" />
                <p className="text-sm">Run a query to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">GraphQL API Documentation</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Available Queries</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><code className="bg-gray-100 px-1 rounded">servers</code> - List all servers</li>
              <li><code className="bg-gray-100 px-1 rounded">websites</code> - List all websites</li>
              <li><code className="bg-gray-100 px-1 rounded">domains</code> - List all domains</li>
              <li><code className="bg-gray-100 px-1 rounded">databases</code> - List all databases</li>
              <li><code className="bg-gray-100 px-1 rounded">customers</code> - List all customers</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Example Usage</h3>
            <pre className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
{`# Fetch servers with specific fields
query {
  servers {
    id
    name
    status
  }
}

# Fetch websites with nested data
query {
  websites {
    id
    name
    server {
      name
      ip_address
    }
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
