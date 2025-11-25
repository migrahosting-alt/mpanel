// frontend/src/pages/DNSZoneEditorPage.tsx
import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, CloudIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface DNSZone {
  id: number;
  domain: string;
  default_ttl: number;
  serial: number;
  status: string;
  record_count: number;
  created_at: string;
}

interface DNSRecord {
  id: number;
  zone_id: number;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  created_at: string;
  updated_at: string;
}

interface NewRecordForm {
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority: string;
}

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

export default function DNSZoneEditorPage() {
  const [zones, setZones] = useState<DNSZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<DNSZone | null>(null);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewZoneModal, setShowNewZoneModal] = useState(false);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [newZoneDomain, setNewZoneDomain] = useState('');
  const [newRecord, setNewRecord] = useState<NewRecordForm>({
    type: 'A',
    name: '@',
    content: '',
    ttl: 3600,
    priority: '',
  });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await apiClient.get('/dns-zones');
      setZones(response.data.zones);
    } catch (error) {
      toast.error('Failed to fetch DNS zones');
    } finally {
      setLoading(false);
    }
  };

  const fetchZoneRecords = async (zoneId: number) => {
    try {
      const response = await apiClient.get(`/dns-zones/${zoneId}`);
      setSelectedZone(response.data.zone);
      setRecords(response.data.records);
    } catch (error) {
      toast.error('Failed to fetch DNS records');
    }
  };

  const createZone = async () => {
    try {
      await apiClient.post('/dns-zones', { domain: newZoneDomain });
      toast.success('DNS zone created successfully');
      setShowNewZoneModal(false);
      setNewZoneDomain('');
      fetchZones();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create DNS zone');
    }
  };

  const deleteZone = async (zoneId: number) => {
    if (!confirm('Are you sure you want to delete this DNS zone? All records will be removed.')) {
      return;
    }

    try {
      await apiClient.delete(`/dns-zones/${zoneId}`);
      toast.success('DNS zone deleted successfully');
      setSelectedZone(null);
      setRecords([]);
      fetchZones();
    } catch (error) {
      toast.error('Failed to delete DNS zone');
    }
  };

  const createRecord = async () => {
    if (!selectedZone) return;

    try {
      const payload = {
        type: newRecord.type,
        name: newRecord.name,
        content: newRecord.content,
        ttl: newRecord.ttl,
        priority: newRecord.priority ? parseInt(newRecord.priority) : null,
      };

      await apiClient.post(`/dns-zones/${selectedZone.id}/records`, payload);
      toast.success('DNS record created successfully');
      setShowNewRecordModal(false);
      setNewRecord({
        type: 'A',
        name: '@',
        content: '',
        ttl: 3600,
        priority: '',
      });
      fetchZoneRecords(selectedZone.id);
    } catch (error) {
      toast.error('Failed to create DNS record');
    }
  };

  const updateRecord = async () => {
    if (!selectedZone || !editingRecord) return;

    try {
      const payload = {
        type: editingRecord.type,
        name: editingRecord.name,
        content: editingRecord.content,
        ttl: editingRecord.ttl,
        priority: editingRecord.priority,
      };

      await apiClient.put(
        `/dns-zones/${selectedZone.id}/records/${editingRecord.id}`,
        payload
      );
      toast.success('DNS record updated successfully');
      setEditingRecord(null);
      fetchZoneRecords(selectedZone.id);
    } catch (error) {
      toast.error('Failed to update DNS record');
    }
  };

  const deleteRecord = async (recordId: number) => {
    if (!selectedZone) return;
    if (!confirm('Are you sure you want to delete this DNS record?')) return;

    try {
      await apiClient.delete(`/dns-zones/${selectedZone.id}/records/${recordId}`);
      toast.success('DNS record deleted successfully');
      fetchZoneRecords(selectedZone.id);
    } catch (error) {
      toast.error('Failed to delete DNS record');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DNS Zone Editor</h1>
          <p className="text-gray-600 mt-1">Advanced DNS management and record editing</p>
        </div>
        <button
          onClick={() => setShowNewZoneModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Zone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zones List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Your DNS Zones</h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {zones.length === 0 ? (
                <div className="p-8 text-center">
                  <CloudIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No DNS zones yet</p>
                  <button
                    onClick={() => setShowNewZoneModal(true)}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Create your first zone
                  </button>
                </div>
              ) : (
                zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => fetchZoneRecords(zone.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedZone?.id === zone.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">{zone.domain}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {zone.record_count} records
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(zone.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Records Editor */}
        <div className="lg:col-span-2">
          {selectedZone ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedZone.domain}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Serial: {selectedZone.serial} • Default TTL: {selectedZone.default_ttl}s
                  </p>
                </div>
                <button
                  onClick={() => setShowNewRecordModal(true)}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Record
                </button>
              </div>

              {/* Records Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TTL</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {record.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                          {record.content}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.ttl}s</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {record.priority || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="text-blue-600 hover:text-blue-700 mr-3"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteRecord(record.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {records.length === 0 && (
                <div className="p-8 text-center">
                  <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No DNS records yet</p>
                  <button
                    onClick={() => setShowNewRecordModal(true)}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Add your first record
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <CloudIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No zone selected</h3>
              <p className="text-gray-500">Select a DNS zone from the list to view and edit records</p>
            </div>
          )}
        </div>
      </div>

      {/* New Zone Modal */}
      {showNewZoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create DNS Zone</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain Name
                </label>
                <input
                  type="text"
                  value={newZoneDomain}
                  onChange={(e) => setNewZoneDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewZoneModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createZone}
                disabled={!newZoneDomain}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Record Modal */}
      {showNewRecordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add DNS Record</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newRecord.type}
                  onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {RECORD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newRecord.name}
                  onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                  placeholder="@ or subdomain"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <input
                  type="text"
                  value={newRecord.content}
                  onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
                  placeholder="IP address, domain, or value"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TTL (seconds)</label>
                  <input
                    type="number"
                    value={newRecord.ttl}
                    onChange={(e) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {['MX', 'SRV'].includes(newRecord.type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <input
                      type="number"
                      value={newRecord.priority}
                      onChange={(e) => setNewRecord({ ...newRecord, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewRecordModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createRecord}
                disabled={!newRecord.content}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit DNS Record</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={editingRecord.type}
                  onChange={(e) => setEditingRecord({ ...editingRecord, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {RECORD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editingRecord.name}
                  onChange={(e) => setEditingRecord({ ...editingRecord, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <input
                  type="text"
                  value={editingRecord.content}
                  onChange={(e) => setEditingRecord({ ...editingRecord, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TTL (seconds)</label>
                  <input
                    type="number"
                    value={editingRecord.ttl}
                    onChange={(e) => setEditingRecord({ ...editingRecord, ttl: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {['MX', 'SRV'].includes(editingRecord.type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <input
                      type="number"
                      value={editingRecord.priority || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, priority: parseInt(e.target.value) || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingRecord(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={updateRecord}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Update Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
