// Generic CRUD hook for any resource
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Reusable CRUD hook for any API resource
 * @param {Object} api - API module with getAll, create, update, delete methods
 * @param {Object} options - Configuration options
 */
export const useCrud = (api, options = {}) => {
  const {
    resourceName = 'item',
    autoLoad = true,
    onSuccess,
    onError,
  } = options;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all items
  const loadItems = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAll(params);
      // Handle different response formats
      const data = response.success !== undefined 
        ? response[Object.keys(response).find(k => Array.isArray(response[k]))] || []
        : response;
      setItems(Array.isArray(data) ? data : []);
      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load items';
      setError(message);
      toast.error(`Failed to load ${resourceName}s`);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, resourceName, onError]);

  // Create new item
  const createItem = useCallback(async (data) => {
    setLoading(true);
    try {
      const response = await api.create(data);
      const newItem = response.success !== undefined
        ? response[resourceName] || response.data
        : response;
      
      setItems((prev) => [newItem, ...prev]);
      toast.success(`${resourceName} created successfully`);
      onSuccess?.('create', newItem);
      return newItem;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to create';
      toast.error(message);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, resourceName, onSuccess, onError]);

  // Update existing item
  const updateItem = useCallback(async (id, data) => {
    setLoading(true);
    try {
      const response = await api.update(id, data);
      const updated = response.success !== undefined
        ? response[resourceName] || response.data
        : response;
      
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      toast.success(`${resourceName} updated successfully`);
      onSuccess?.('update', updated);
      return updated;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to update';
      toast.error(message);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, resourceName, onSuccess, onError]);

  // Delete item
  const deleteItem = useCallback(async (id) => {
    setLoading(true);
    try {
      await api.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(`${resourceName} deleted successfully`);
      onSuccess?.('delete', { id });
      return true;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to delete';
      toast.error(message);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api, resourceName, onSuccess, onError]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadItems();
    }
  }, [autoLoad, loadItems]);

  return {
    items,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    setItems, // Allow manual updates
  };
};

export default useCrud;
