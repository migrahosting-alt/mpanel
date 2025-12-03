import React, { useEffect, useState } from 'react';
import {
  fetchGuardianInstance,
  fetchGuardianSummary,
  fetchGuardianFindings,
  fetchGuardianRemediations,
  triggerGuardianScan,
  GuardianInstance,
  GuardianTenantSummary,
  GuardianFinding,
  GuardianRemediationTask,
} from '../../api/guardian';

const GuardianManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<GuardianInstance | null>(null);
  const [summary, setSummary] = useState<GuardianTenantSummary | null>(null);
  const [findings, setFindings] = useState<GuardianFinding[]>([]);
  const [remediations, setRemediations] = useState<GuardianRemediationTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanType, setScanType] = useState('agent_full');
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [inst, summ, fnds, rems] = await Promise.all([
          fetchGuardianInstance(),
          fetchGuardianSummary(),
          fetchGuardianFindings({ status: 'open' }),
          fetchGuardianRemediations({ status: 'pending' }),
        ]);
        setInstance(inst);
        setSummary(summ);
        setFindings(fnds);
        setRemediations(rems);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load Guardian data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleScan = async () => {
    try {
      setScanLoading(true);
      await triggerGuardianScan(scanType);
      const summ = await fetchGuardianSummary();
      const fnds = await fetchGuardianFindings({ status: 'open' });
      setSummary(summ);
      setFindings(fnds);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to trigger scan');
    } finally {
      setScanLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading Guardian…</div>;
  if (error) return <div className="p-6 text-red-500">Guardian error: {error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Guardian AI</h1>
          <p className="text-sm text-gray-500">
            Tenant-level security posture, findings, and remediation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={scanType}
            onChange={e => setScanType(e.target.value)}
          >
            <option value="agent_full">Full Agent Scan</option>
            <option value="config_drift">Config Drift</option>
            <option value="quick_health">Quick Health</option>
          </select>
          <button
            onClick={handleScan}
            disabled={scanLoading}
            className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {scanLoading ? 'Running…' : 'Trigger Scan'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Active Instances" value={summary?.activeInstances ?? 0} />
        <SummaryCard label="Open Findings" value={summary?.openFindings ?? 0} />
        <SummaryCard label="Pending Tasks" value={summary?.pendingTasks ?? 0} />
        <SummaryCard label="Recent Scans" value={summary?.recentScansCount ?? 0} />
      </section>

      {/* Instance */}
      <section className="bg-white shadow rounded p-4 space-y-2">
        <h2 className="text-lg font-semibold">Guardian configuration</h2>
        {instance ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <InfoItem label="Enabled" value={instance.enabled ? 'Yes' : 'No'} />
            <InfoItem label="Environment" value={instance.environment} />
            <InfoItem
              label="Policy Pack"
              value={`${instance.policyPack} (${instance.policyVersion})`}
            />
            <InfoItem
              label="Auto-remediation"
              value={instance.autoRemediationEnabled ? 'Enabled' : 'Disabled'}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">Guardian not yet configured for this tenant.</p>
        )}
      </section>

      {/* Findings */}
      <section className="bg-white shadow rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Open findings</h2>
        {findings.length === 0 ? (
          <p className="text-sm text-gray-500">No open findings.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-auto">
            {findings.map(f => (
              <article
                key={f.id}
                className="border rounded p-3 text-sm flex flex-col gap-1 hover:bg-gray-50"
              >
                <div className="flex justify-between">
                  <div className="font-semibold">{f.title}</div>
                  <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{f.severity}</span>
                </div>
                <div className="text-xs text-gray-500">{f.code}</div>
                <p className="text-xs text-gray-700 line-clamp-2">{f.description}</p>
                <div className="text-xs text-gray-500">
                  Category: {f.category} • Status: {f.status}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Remediations */}
      <section className="bg-white shadow rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Remediation queue</h2>
        {remediations.length === 0 ? (
          <p className="text-sm text-gray-500">No remediation tasks.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Action</th>
                <th className="py-2">Status</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Requested</th>
                <th className="py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {remediations.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-1">{r.actionType}</td>
                  <td className="py-1">{r.status}</td>
                  <td className="py-1">{r.severity ?? '-'}</td>
                  <td className="py-1">
                    {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-1">
                    {r.resultStatus ? `${r.resultStatus} – ${r.resultMessage ?? ''}` : '-'}
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
    <div className="text-xs uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
  </div>
);

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="font-semibold">{value}</div>
  </div>
);

export default GuardianManagement;
