import React, { useEffect, useState } from 'react';
import { CubeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { kubernetesApi } from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function Kubernetes() {
  const [clusters, setClusters] = useState([]);
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', endpoint: '', kubeconfig: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await kubernetesApi.clusters();
      setClusters(response.data || []);
    } catch (err) {
      console.error('Failed to load Kubernetes data:', err);
      toast.error('Failed to load Kubernetes clusters');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await kubernetesApi.createCluster(formData);
      toast.success('Cluster added successfully');
      setShowModal(false);
      setFormData({ name: '', endpoint: '', kubeconfig: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to add cluster');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this cluster?')) return;
    try {
      await kubernetesApi.deleteCluster(id);
      toast.success('Cluster removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove cluster');
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Kubernetes Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Auto-scaling and multi-region orchestration
        </p>
      </div>

      {clusters.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-lg shadow">
          <CubeIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Kubernetes clusters configured</h3>
          <p className="text-sm text-gray-500 mb-4">
            Connect your Kubernetes clusters to enable auto-scaling and orchestration
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Connect Cluster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-semibold text-gray-900 mb-2">{cluster.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{cluster.region}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nodes:</span>
                  <span className="font-medium">{cluster.nodes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pods:</span>
                  <span className="font-medium">{cluster.pods}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${cluster.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                    {cluster.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
