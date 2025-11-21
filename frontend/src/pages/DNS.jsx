import React, { useState, useEffect } from 'react';
import { PlusIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { dnsApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function DNS() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    loadZones();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadRecords(selectedZone);
    }
  }, [selectedZone]);

  const loadZones = async () => {
    try {
      setLoading(true);
      const response = await dnsApi.zones.getAll();
      setZones(response.data || []);
      if (response.data?.length > 0) {
        setSelectedZone(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
      toast.error('Failed to load DNS zones');
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (zoneId) => {
    try {
      setLoadingRecords(true);
      const response = await dnsApi.records.getByZone(zoneId);
      setRecords(response.data || []);
    } catch (error) {
      console.error('Error loading records:', error);
      toast.error('Failed to load DNS records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const getRecordTypeColor = (type) => {
    const colors = {
      'A': 'bg-blue-100 text-blue-800',
      'AAAA': 'bg-indigo-100 text-indigo-800',
      'CNAME': 'bg-purple-100 text-purple-800',
      'MX': 'bg-green-100 text-green-800',
      'TXT': 'bg-yellow-100 text-yellow-800',
      'NS': 'bg-red-100 text-red-800',
      'SRV': 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading DNS zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">DNS Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage DNS zones and records for your domains
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zones List */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">DNS Zones</h2>
            <div className="space-y-2">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedZone === zone.id
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{zone.name}</p>
                        <p className="text-xs text-gray-500">{zone.recordCount} records</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {zone.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Records List */}
        <div className="lg:col-span-2">
          {selectedZone ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Records for {zones.find(z => z.id === selectedZone)?.name}
                </h2>
                <button className="btn-primary flex items-center text-sm">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Record
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TTL</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingRecords ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                          Loading records...
                        </td>
                      </tr>
                    ) : records.length > 0 ? (
                      records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRecordTypeColor(record.type)}`}>
                            {record.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{record.content}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.ttl}s</td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <button className="text-primary-600 hover:text-primary-900 mr-3">Edit</button>
                          <button className="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                      </tr>
                    ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                          No DNS records found for this zone.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : zones.length === 0 ? (
            <div className="card flex items-center justify-center h-64">
              <div className="text-center">
                <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No DNS zones configured. Create your first zone to get started.</p>
              </div>
            </div>
          ) : (
            <div className="card flex items-center justify-center h-64">
              <div className="text-center">
                <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a DNS zone to view records</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
