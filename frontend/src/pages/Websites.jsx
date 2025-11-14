import React, { useEffect, useState } from "react";

const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "http://localhost:3000/api") || "http://localhost:3000/api";

function getStatusColor(status) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "suspended":
      return "bg-amber-50 text-amber-700";
    case "pending":
      return "bg-sky-50 text-sky-700";
    default:
      return "bg-slate-50 text-slate-600";
  }
}

async function apiGet(path) {
  const res = await fetch(``, {
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed ()`);
  }
  return data;
}

async function apiSend(method, path, body) {
  const res = await fetch(``, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed ()`);
  }
  return data;
}

export default function Websites() {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    primaryDomain: "",
    phpVersion: "8.2",
    server: "",
    status: "active",
  });
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoadingId, setAiLoadingId] = useState(null);

  const loadWebsites = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet("/websites");
      setWebsites(data.websites || data.items || []);
    } catch (e) {
      setError(e.message || "Failed to load websites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebsites();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      primaryDomain: "",
      phpVersion: "8.2",
      server: "",
      status: "active",
    });
    setModalOpen(true);
  };

  const openEdit = (website) => {
    setEditing(website);
    setForm({
      name: website.name || "",
      primaryDomain: website.primary_domain || website.domain_name || "",
      phpVersion: website.php_version || "8.2",
      server: website.server_name || website.server || "",
      status: website.status || "active",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.primaryDomain) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        primary_domain: form.primaryDomain,
        php_version: form.phpVersion,
        server: form.server,
        status: form.status,
      };
      if (editing) {
        await apiSend("PUT", `/websites/`, payload);
      } else {
        await apiSend("POST", "/websites", payload);
      }
      setModalOpen(false);
      await loadWebsites();
    } catch (e) {
      alert(e.message || "Failed to save website");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (website) => {
    if (!window.confirm(`Delete website ""?`)) return;
    try {
      await apiSend("DELETE", `/websites/`);
      await loadWebsites();
    } catch (e) {
      alert(e.message || "Failed to delete website");
    }
  };

  const fetchAiSummary = async (website) => {
    const domainId = website.primary_domain_id || website.domain_id || website.id;
    if (!domainId) return;
    setAiSummary("");
    setAiLoadingId(website.id);
    try {
      const data = await apiGet(`/ai/domains//summary`);
      setAiSummary(data.summary || JSON.stringify(data, null, 2));
    } catch (e) {
      setAiSummary(e.message || "Failed to load AI summary");
    } finally {
      setAiLoadingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Websites</h1>
          <p className="text-sm text-slate-500">Manage hosted websites, their primary domains, and runtime config.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">+ Create Website</button>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Loading websites</div>
      ) : websites.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">No websites yet. Click <span className="font-semibold">"Create Website"</span> to add your first deployment.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-6 py-3">Website</th>
                <th className="px-6 py-3">Primary Domain</th>
                <th className="px-6 py-3">Server</th>
                <th className="px-6 py-3">PHP</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {websites.map((website) => (
                <tr key={website.id} className="border-t">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium">{website.name || website.primary_domain}</span>
                      <span className="text-xs text-slate-500">ID: {website.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{website.primary_domain || website.domain_name || ""}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{website.server_name || website.server || ""}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{website.php_version || "8.2"}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize `}>{website.status || "unknown"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                    <button onClick={() => fetchAiSummary(website)} className="text-xs px-3 py-1 rounded-full border border-violet-100 text-violet-700 hover:bg-violet-50">AI Summary</button>
                    <button onClick={() => openEdit(website)} className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50">Edit</button>
                    <button onClick={() => handleDelete(website)} className="text-xs px-3 py-1 rounded-full border border-red-100 text-red-600 hover:bg-red-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {aiSummary && (
            <div className="border-t px-6 py-4 bg-slate-50 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">AI Summary</span>
                <button onClick={() => setAiSummary("")} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap">{aiSummary}</pre>
            </div>
          )}
          {aiLoadingId && <div className="px-6 py-3 text-xs text-slate-500">Generating AI summary</div>}
        </div>
      )}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? "Edit Website" : "Create Website"}</h2>
              <button onClick={() => setModalOpen(false)}></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Website Name</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="migrahosting-main" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Primary Domain</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.primaryDomain} onChange={(e) => setForm((f) => ({ ...f, primaryDomain: e.target.value }))} placeholder="example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">PHP Version</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.phpVersion} onChange={(e) => setForm((f) => ({ ...f, phpVersion: e.target.value }))}>
                    <option value="8.3">8.3</option>
                    <option value="8.2">8.2</option>
                    <option value="8.1">8.1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Server Label</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.server} onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))} placeholder="us-east-1a" />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm" disabled={saving}>Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-60" disabled={saving}>{saving ? "Saving" : editing ? "Save Changes" : "Create Website"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
