import React, { useEffect, useState } from 'react';
import { GlobeAltIcon, PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { cdnApi } from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function CDNManagement() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', origin: '', regions: [] });

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const response = await cdnApi.zones();
      setZones(response.data || []);
    } catch (err) {
      console.error('Failed to load CDN zones:', err);
      toast.error('Failed to load CDN zones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await cdnApi.createZone(formData);
      toast.success('CDN zone created successfully');
      setShowModal(false);
      setFormData({ name: '', origin: '', regions: [] });
      loadZones();
    } catch (error) {
      toast.error('Failed to create CDN zone');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this CDN zone?')) return;
    try {
      await cdnApi.deleteZone(id);
      toast.success('CDN zone deleted');
      loadZones();
    } catch (error) {
      toast.error('Failed to delete CDN zone');
    }
  };

  const handlePurgeCache = async (id) => {
    try {
      await cdnApi.purgeCache(id);
      toast.success('Cache purged successfully');
    } catch (error) {
      toast.error('Failed to purge cache');
    }
  };

  const regions = [
    { name: 'North America', locations: 12, status: 'operational' },
    { name: 'Europe', locations: 18, status: 'operational' },
    { name: 'Asia Pacific', locations: 15, status: 'operational' },
    { name: 'South America', locations: 6, status: 'operational' },
    { name: 'Africa', locations: 4, status: 'operational' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CDN Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Multi-region content delivery network with 55+ global locations
        </p>
      </div>

      {/* Global Coverage */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Global Coverage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {regions.map((region) => (
            <div key={region.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPinIcon className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">{region.name}</h3>
              </div>
              <p className="text-sm text-gray-600">{region.locations} locations</p>
              <span className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                {region.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CDN Zones */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">CDN Zones</h2>
        </div>
        {zones.length === 0 ? (
          <div className="p-12 text-center">
            <GlobeAltIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No CDN zones configured</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first CDN zone to accelerate content delivery
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Create CDN Zone
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bandwidth</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {zone.domain}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.origin}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.bandwidth}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone.requests}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {zone.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
