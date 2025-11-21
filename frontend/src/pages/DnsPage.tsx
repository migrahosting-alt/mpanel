// src/pages/DnsPage.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

type Zone = {
  id: string;
  name: string;
  domain_name?: string;
};

type Record = {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  priority?: number | null;
};

export function DnsPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [zonesError, setZonesError] = useState<string | null>(null);

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [recordForm, setRecordForm] = useState({
    name: '',
    type: 'A',
    content: '',
    ttl: 300,
    priority: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setLoadingZones(true);
        const data = await api.get<{ success: boolean; zones: Zone[] }>(
          '/dns/zones'
        );
        setZones(data.zones || []);
        if (data.zones?.length) setSelectedZone(data.zones[0]);
      } catch (e: any) {
        setZonesError(e.message || 'Failed to load zones');
      } finally {
        setLoadingZones(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedZone) return;
    (async () => {
      try {
        setLoadingRecords(true);
        setRecordsError(null);
        const data = await api.get<{ success: boolean; records: Record[] }>(
          `/dns/zones/${selectedZone.id}/records`
        );
        setRecords(data.records || []);
      } catch (e: any) {
        setRecordsError(e.message || 'Failed to load records');
      } finally {
        setLoadingRecords(false);
      }
    })();
  }, [selectedZone?.id]);

  const openCreateRecord = () => {
    setEditingRecord(null);
    setRecordForm({ name: '@', type: 'A', content: '', ttl: 300, priority: '' });
    setRecordModalOpen(true);
  };

  const openEditRecord = (r: Record) => {
    setEditingRecord(r);
    setRecordForm({
      name: r.name,
      type: r.type,
      content: r.content,
      ttl: r.ttl,
      priority: r.priority?.toString() ?? '',
    });
    setRecordModalOpen(true);
  };

  const saveRecord = async () => {
    if (!selectedZone) return;
    const payload = {
      name: recordForm.name,
      type: recordForm.type,
      content: recordForm.content,
      ttl: Number(recordForm.ttl),
      priority: recordForm.priority ? Number(recordForm.priority) : null,
    };

    if (editingRecord) {
      await api.put(`/dns/records/${editingRecord.id}`, payload);
    } else {
      await api.post(`/dns/zones/${selectedZone.id}/records`, payload);
    }
    setRecordModalOpen(false);
    // reload records
    const data = await api.get<{ success: boolean; records: Record[] }>(
      `/dns/zones/${selectedZone.id}/records`
    );
    setRecords(data.records || []);
  };

  const deleteRecord = async (r: Record) => {
    if (!window.confirm(`Delete DNS record ${r.name} ${r.type}?`)) return;
    await api.delete(`/dns/records/${r.id}`);
    const data = await api.get<{ success: boolean; records: Record[] }>(
      `/dns/zones/${selectedZone?.id}/records`
    );
    setRecords(data.records || []);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">DNS Management</h1>
          <p className="text-sm text-slate-500">
            Manage DNS zones and records for hosted domains.
          </p>
        </div>
        {selectedZone && (
          <button
            onClick={openCreateRecord}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
          >
            + Add Record
          </button>
        )}
      </div>

      {zonesError && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {zonesError}
        </div>
      )}

      {loadingZones ? (
        <div className="text-sm text-slate-500">Loading zones…</div>
      ) : zones.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          No DNS zones found. Zones are usually created automatically when you
          add domains or link external DNS.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1">
            <h2 className="text-xs font-semibold text-slate-500 mb-2">
              Zones
            </h2>
            <div className="border rounded-xl bg-white max-h-[460px] overflow-auto">
              {zones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(z)}
                  className={`w-full text-left px-4 py-3 text-sm border-b last:border-b-0 hover:bg-slate-50 ${
                    selectedZone?.id === z.id ? 'bg-violet-50 font-medium' : ''
                  }`}
                >
                  {z.domain_name || z.name}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-3">
            <h2 className="text-xs font-semibold text-slate-500 mb-2">
              Records
            </h2>
            {recordsError && (
              <div className="mb-3 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
                {recordsError}
              </div>
            )}
            {loadingRecords ? (
              <div className="text-sm text-slate-500">Loading records…</div>
            ) : records.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-center text-slate-500">
                No DNS records. Click <b>Add Record</b> to create the first one.
              </div>
            ) : (
              <table className="min-w-full text-xs bg-white rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Content</th>
                    <th className="px-4 py-2">TTL</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2">{r.type}</td>
                      <td className="px-4 py-2">{r.content}</td>
                      <td className="px-4 py-2">{r.ttl}</td>
                      <td className="px-4 py-2">{r.priority ?? '—'}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          onClick={() => openEditRecord(r)}
                          className="text-[11px] px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRecord(r)}
                          className="text-[11px] px-3 py-1 rounded-full border border-red-100 text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {recordModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingRecord ? 'Edit DNS Record' : 'Add DNS Record'}
              </h2>
              <button onClick={() => setRecordModalOpen(false)}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Name
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={recordForm.name}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Type
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={recordForm.type}
                    onChange={(e) =>
                      setRecordForm((f) => ({ ...f, type: e.target.value }))
                    }
                  >
                    {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    TTL
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={recordForm.ttl}
                    onChange={(e) =>
                      setRecordForm((f) => ({
                        ...f,
                        ttl: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Content
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={recordForm.content}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, content: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Priority (MX only)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={recordForm.priority}
                  onChange={(e) =>
                    setRecordForm((f) => ({ ...f, priority: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setRecordModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveRecord}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
              >
                {editingRecord ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
