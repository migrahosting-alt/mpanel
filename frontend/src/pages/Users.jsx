import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useCrud } from '../hooks/useCrud';
import { usersApi } from '../lib/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const Users = () => {
  const { items: users, loading, createItem, updateItem, deleteItem } = useCrud(usersApi, {
    resourceName: 'user',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
  });

  const resetForm = () => {
    setFormData({ email: '', password: '', name: '', role: 'user' });
    setEditingUser(null);
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email || '',
        password: '',
        name: user.name || '',
        role: user.role || 'user',
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Don't send password if empty on update
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await updateItem(editingUser.id, updateData);
      } else {
        await createItem(formData);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Are you sure you want to delete ${user.email}?`)) {
      try {
        await deleteItem(user.id);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
    { 
      key: 'role', 
      label: 'Role',
      render: (user) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {user.role}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (user) => user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          emptyMessage="No users found. Create your first user to get started."
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? 'Edit User' : 'Create New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {editingUser && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingUser ? 'Update' : 'Create'} User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
