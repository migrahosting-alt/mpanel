// src/pages/WebsitesPage.tsx
import { useState } from 'react';
import { useCrudResource } from '../hooks/useCrudResource';

type Website = {
  id: string;
  domain: string;
  customer_id: string;
  document_root: string | null;
  php_version: string | null;
  status: string;
};

type WebsiteCreate = {
  domain: string;
  customerId: string;
  documentRoot?: string;
  phpVersion?: string;
};

type WebsiteUpdate = WebsiteCreate;

const config = {
  listPath: '/websites',
  listKey: 'websites',
  createPath: '/websites',
  updatePath: (id: string) => `/websites/${id}`,
  deletePath: (id: string) => `/websites/${id}`,
  mapCreateInput: (input: WebsiteCreate) => ({
    domain: input.domain,
    customer_id: input.customerId,
    document_root: input.documentRoot,
    php_version: input.phpVersion,
  }),
  mapUpdateInput: (input: WebsiteUpdate) => ({
    domain: input.domain,
    customer_id: input.customerId,
    document_root: input.documentRoot,
    php_version: input.phpVersion,
  }),
};

export function WebsitesPage() {
  const { items, loading, error, createItem, updateItem, deleteItem } =
    useCrudResource<Website, WebsiteCreate, WebsiteUpdate>(config);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Website | null>(null);
  const [form, setForm] = useState<WebsiteCreate>({
    domain: '',
    customerId: '',
    documentRoot: '/public_html',
    phpVersion: '8.2',
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ domain: '', customerId: '', documentRoot: '/public_html', phpVersion: '8.2' });
    setModalOpen(true);
  };

  const openEdit = (w: Website) => {
    setEditing(w);
    setForm({
      domain: w.domain,
      customerId: w.customer_id,
      documentRoot: w.document_root ?? '/public_html',
      phpVersion: w.php_version ?? '8.2',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.domain || !form.customerId) return;
    if (editing) {
      await updateItem(editing.id, form);
    } else {
      await createItem(form);
    }
    setModalOpen(false);
  };

  const handleDelete = async (w: Website) => {
    if (!window.confirm(`Delete website ${w.domain}?`)) return;
    await deleteItem(w.id);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Websites</h1>
          <p className="text-sm text-slate-500">
            Manage hosted websites and their configurations.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
        >
          + Add Website
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading websites…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          No websites yet. Click{" "}
          <span className="font-semibold">"Add Website"</span> to create one.
        </div>
      ) : (
        <table className="min-w-full text-sm bg-white rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Document Root</th>
              <th className="px-4 py-3">PHP Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="px-4 py-3 font-medium">{w.domain}</td>
                <td className="px-4 py-3">{w.document_root || '—'}</td>
                <td className="px-4 py-3">
                  {w.php_version ? `PHP ${w.php_version}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(w.status)}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEdit(w)}
                    className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(w)}
                    className="text-xs px-3 py-1 rounded-full border border-red-100 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Website' : 'Add Website'}
              </h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Primary Domain
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="example.com"
                  value={form.domain}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, domain: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Customer ID
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Customer UUID"
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Document Root
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="/public_html"
                    value={form.documentRoot}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, documentRoot: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    PHP Version
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.phpVersion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phpVersion: e.target.value }))
                    }
                  >
                    <option value="7.4">PHP 7.4</option>
                    <option value="8.0">PHP 8.0</option>
                    <option value="8.1">PHP 8.1</option>
                    <option value="8.2">PHP 8.2</option>
                    <option value="8.3">PHP 8.3</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
              >
                {editing ? 'Save Changes' : 'Create Website'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
