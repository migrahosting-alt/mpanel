import React, { useEffect, useState } from 'react';
import {
  fetchGuardianSummary,
  fetchGuardianFindings,
  fetchGuardianRemediations,
  GuardianTenantSummary,
  GuardianFinding,
  GuardianRemediationTask,
} from '../../api/guardian';

/**
 * Platform-level SOC dashboard.
 * Expects the backend to enforce platform:guardian:* permissions.
 */
const GuardianSOC: React.FC = () => {
  const [summary, setSummary] = useState<GuardianTenantSummary | null>(null);
  const [findings, setFindings] = useState<GuardianFinding[]>([]);
  const [remediations, setRemediations] = useState<GuardianRemediationTask[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [summ, fnds, rems] = await Promise.all([
          fetchGuardianSummary(),
          fetchGuardianFindings({ status: 'open' }),
          fetchGuardianRemediations({ status: 'pending' }),
        ]);
        setSummary(summ);
        setFindings(fnds);
        setRemediations(rems);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load SOC view');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredFindings = severityFilter
    ? findings.filter(f => f.severity === severityFilter)
    : findings;

  if (loading) return <div className="p-6">Loading SOC…</div>;
  if (error) {
    const isAuth = /Unauthorized/i.test(error) || /HTTP\s*401/.test(error);
    const isNotFound = /Route not found/i.test(error) || /HTTP\s*404/.test(error);
    return (
      <div className="p-6 space-y-3">
        <div className="text-red-600 font-medium">SOC error: {error} (debug)</div>
        {isAuth && (
          <div className="text-gray-700 text-sm">
            Platform access required. Please login with an administrator account.
          </div>
        )}
        {isNotFound && (
          <div className="text-gray-700 text-sm">
            Endpoint unavailable. Contact support or try again shortly.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Guardian SOC Overview</h1>
          <p className="text-sm text-gray-500">
            Cross-tenant security posture, open incidents, and remediation status.
          </p>
        </div>
      </header>

      {/* Summary row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Active Instances" value={summary?.activeInstances ?? 0} />
        <SummaryCard label="Open Findings" value={summary?.openFindings ?? 0} />
        <SummaryCard label="Pending Tasks" value={summary?.pendingTasks ?? 0} />
        <SummaryCard label="Recent Scans" value={summary?.recentScansCount ?? 0} />
      </section>

      {/* Filters */}
      <section className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Severity filter:</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={severityFilter ?? ''}
          onChange={e => setSeverityFilter(e.target.value || undefined)}
        >
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </section>

      {/* Findings */}
      <section className="bg-white shadow rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Active findings (SOC view)</h2>
        {filteredFindings.length === 0 ? (
          <p className="text-sm text-gray-500">No active findings.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {filteredFindings.map(f => (
              <article
                key={f.id}
                className="border rounded p-3 text-sm flex flex-col gap-1 hover:bg-gray-50"
              >
                <div className="flex justify-between">
                  <div className="font-semibold">{f.title}</div>
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100">
                    {f.severity}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {f.code} • Category: {f.category}
                </div>
                <p className="text-xs text-gray-700 line-clamp-2">{f.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Remediations */}
      <section className="bg-white shadow rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Remediation queue (pending)</h2>
        {remediations.length === 0 ? (
          <p className="text-sm text-gray-500">No pending remediations.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Action</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Status</th>
                <th className="py-2">Requested</th>
              </tr>
            </thead>
            <tbody>
              {remediations.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1">{r.actionType}</td>
                  <td className="py-1">{r.severity ?? '-'}</td>
                  <td className="py-1">{r.status}</td>
                  <td className="py-1">
                    {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white shadow rounded p-4">
    <div className="text-xs text-gray-500 uppercase">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
  </div>
);

export default GuardianSOC;
