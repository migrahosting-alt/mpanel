// src/hooks/useCrudResource.ts
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

export interface CrudConfig<T, CreateInput, UpdateInput> {
  listPath: string;          // GET path   (e.g. "/users")
  listKey: string;           // key in response (e.g. "users")
  createPath: string;        // POST path
  updatePath: (id: string) => string; // PUT path
  deletePath: (id: string) => string; // DELETE path
  mapCreateInput: (input: CreateInput) => any; // to API shape
  mapUpdateInput: (input: UpdateInput) => any;
}

export function useCrudResource<T, CreateInput, UpdateInput>(
  config: CrudConfig<T, CreateInput, UpdateInput>
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<any>(config.listPath);
      setItems(data[config.listKey] ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [config.listPath, config.listKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createItem = useCallback(
    async (input: CreateInput) => {
      const payload = config.mapCreateInput(input);
      const data = await api.post<any>(config.createPath, payload);
      await reload();
      return data;
    },
    [config, reload]
  );

  const updateItem = useCallback(
    async (id: string, input: UpdateInput) => {
      const payload = config.mapUpdateInput(input);
      const data = await api.put<any>(config.updatePath(id), payload);
      await reload();
      return data;
    },
    [config, reload]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const data = await api.delete<any>(config.deletePath(id));
      await reload();
      return data;
    },
    [config, reload]
  );

  return { items, loading, error, reload, createItem, updateItem, deleteItem };
}
