import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../lib/apiClient';

interface ShieldPolicy {
  id: string;
  name: string;
  version: number;
  mode: 'report_only' | 'enforce';
  status: 'active' | 'inactive' | 'archived' | 'draft';
  rolloutStage?: string | null;
  tenantId?: string | null;
  ruleset?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PoliciesResponse {
  policies: ShieldPolicy[];
}

type PolicyFormState = {
  name: string;
  tenantId: string;
  mode: ShieldPolicy['mode'];
  status: ShieldPolicy['status'];
  rolloutStage: string;
  ruleset: string;
};

interface ShieldDecision {
  id: string;
  tenantId?: string | null;
  policyId?: string | null;
  policyVersion?: number | null;
  result: 'allowed' | 'blocked' | string;
  reason?: string | null;
  mode: ShieldPolicy['mode'];
  requestId?: string | null;
  createdAt?: string;
  policy?: {
    id: string;
    name: string;
    version?: number | null;
  } | null;
  context?: Record<string, unknown> | null;
}

interface DecisionsResponse {
  decisions: ShieldDecision[];
}

type FormErrors = Partial<Record<keyof PolicyFormState | 'form', string>>;

const statusStyles: Record<ShieldPolicy['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  inactive: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  archived: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  draft: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

const modeBadge: Record<ShieldPolicy['mode'], string> = {
  enforce: 'text-red-600 bg-red-50 ring-red-500/20',
  report_only: 'text-blue-600 bg-blue-50 ring-blue-500/20',
};

const decisionResultStyles: Record<string, string> = {
  allowed: 'bg-emerald-50 text-emerald-700',
  blocked: 'bg-red-50 text-red-700',
};

const defaultCreateForm: PolicyFormState = {
  name: '',
  tenantId: 'global',
  mode: 'report_only',
  status: 'draft',
  rolloutStage: '',
  ruleset: '{\n  "rules": []\n}',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatTenantLabel(tenantId?: string | null) {
  if (tenantId === null) return 'Global';
  if (!tenantId) return 'Unassigned';
  return tenantId;
}

function normalizeTenantInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'global') return null;
  return trimmed;
}

function parseRulesetInput(value: string) {
  if (!value.trim()) {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Ruleset JSON is invalid: ${message}`);
  }
}

export default function ShieldManagement() {
  const [policies, setPolicies] = useState<ShieldPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<ShieldPolicy | null>(null);
  const [editForm, setEditForm] = useState<PolicyFormState | null>(null);
  const [createForm, setCreateForm] = useState<PolicyFormState>(defaultCreateForm);
  const [createErrors, setCreateErrors] = useState<FormErrors>({});
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [decisions, setDecisions] = useState<ShieldDecision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<PoliciesResponse>('/platform/shield/policies');
      const items = response?.policies ?? [];
      setPolicies(items);
      setSelectedPolicy((current) => {
        if (!current) return items[0] ?? null;
        const stillPresent = items.find((policy) => policy.id === current.id);
        return stillPresent ?? items[0] ?? null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch policies';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    setDecisionsError(null);
    try {
      const response = await api.get<DecisionsResponse>('/platform/shield/decisions', {
        params: { limit: 25 },
      });
      setDecisions(response?.decisions ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch shield activity';
      setDecisionsError(message);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  useEffect(() => {
    if (!selectedPolicy) {
      setEditForm(null);
      return;
    }

    setEditForm({
      name: selectedPolicy.name,
      tenantId: selectedPolicy.tenantId === null ? 'global' : selectedPolicy.tenantId ?? '',
      mode: selectedPolicy.mode,
      status: selectedPolicy.status,
      rolloutStage: selectedPolicy.rolloutStage ?? '',
      ruleset: JSON.stringify(selectedPolicy.ruleset ?? {}, null, 2),
    });
    setEditErrors({});
  }, [selectedPolicy]);

  const stats = useMemo(() => {
    const total = policies.length;
    const enforce = policies.filter((policy) => policy.mode === 'enforce').length;
    const reportOnly = policies.filter((policy) => policy.mode === 'report_only').length;
    const drafts = policies.filter((policy) => policy.status === 'draft').length;
    return { total, enforce, reportOnly, drafts };
  }, [policies]);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 5000);
  };

  const confirmationSummary = {
    enforce: 'This switches the policy into ENFORCE mode and will start actively blocking traffic.',
    archive: 'Archiving a policy removes it from active rotation until it is cloned or reactivated.',
    inactive: 'Inactive policies remain in storage but no longer evaluate API calls.',
  };

  const getUpdateConfirmationMessage = (original: ShieldPolicy, next: PolicyFormState) => {
    const messages: string[] = [];
    if (original.mode !== next.mode && next.mode === 'enforce') {
      messages.push(confirmationSummary.enforce);
    }
    if (original.status !== next.status && next.status === 'archived') {
      messages.push(confirmationSummary.archive);
    }
    if (original.status !== next.status && next.status === 'inactive') {
      messages.push(confirmationSummary.inactive);
    }
    return messages.length ? messages.join(' ') : null;
  };

  const getCreateConfirmationMessage = (form: PolicyFormState) => {
    const messages: string[] = [];
    if (form.mode === 'enforce') {
      messages.push(confirmationSummary.enforce);
    }
    if (form.status === 'archived') {
      messages.push(confirmationSummary.archive);
    }
    if (form.status === 'inactive') {
      messages.push(confirmationSummary.inactive);
    }
    return messages.length ? messages.join(' ') : null;
  };

  const executePolicyUpdate = async (payload: Record<string, unknown>, resetForm = false) => {
    if (!selectedPolicy) return;
    setIsUpdating(true);
    setEditErrors({});
    try {
      await api.patch(`/platform/shield/policies/${selectedPolicy.id}`, payload);
      showBanner('success', 'Shield policy updated.');
      await loadPolicies();
      await loadDecisions();
      if (resetForm) {
        setEditForm(null);
      }
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update policy';
      setEditErrors((prev) => ({ ...prev, form: message }));
      showBanner('error', message);
    } finally {
      setIsUpdating(false);
    }
  };

  const executePolicyCreate = async (payload: Record<string, unknown>) => {
    setIsCreating(true);
    setCreateErrors({});
    try {
      await api.post('/platform/shield/policies', payload);
      showBanner('success', 'Shield policy created.');
      setCreateForm(defaultCreateForm);
      await loadPolicies();
      await loadDecisions();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Failed to create policy';
      setCreateErrors((prev) => ({ ...prev, form: message }));
      showBanner('error', message);
    } finally {
      setIsCreating(false);
    }
  };

  const requestConfirmation = (config: { title: string; description: string; confirmLabel?: string; action: () => Promise<void> }) => {
    setConfirmState(config);
  };

  const handleConfirmDialog = async () => {
    if (!confirmState) return;
    setIsConfirming(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBanner(null);
    setCreateErrors({});

    const trimmedName = createForm.name.trim();
    if (!trimmedName) {
      const message = 'Policy name is required.';
      setCreateErrors((prev) => ({ ...prev, name: message }));
      showBanner('error', message);
      return;
    }

    let parsedRuleset: Record<string, unknown>;
    try {
      parsedRuleset = parseRulesetInput(createForm.ruleset);
    } catch (rulesetError) {
      const message = rulesetError instanceof Error ? rulesetError.message : 'Invalid ruleset';
      setCreateErrors((prev) => ({ ...prev, ruleset: message }));
      showBanner('error', message);
      return;
    }

    const payload = {
      name: trimmedName,
      tenantId: normalizeTenantInput(createForm.tenantId),
      mode: createForm.mode,
      status: createForm.status,
      rolloutStage: createForm.rolloutStage.trim() || undefined,
      ruleset: parsedRuleset,
    };

    const confirmationMessage = getCreateConfirmationMessage({ ...createForm, name: trimmedName });
    if (confirmationMessage) {
      requestConfirmation({
        title: 'Confirm new policy',
        description: confirmationMessage,
        confirmLabel: 'Create policy',
        action: () => executePolicyCreate(payload),
      });
      return;
    }

    await executePolicyCreate(payload);
  };

  const handleUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPolicy || !editForm) {
      return;
    }

    setEditErrors({});

    const trimmedName = editForm.name.trim();
    if (!trimmedName) {
      const message = 'Policy name is required.';
      setEditErrors((prev) => ({ ...prev, name: message }));
      showBanner('error', message);
      return;
    }

    let parsedRuleset: Record<string, unknown> | undefined;
    try {
      parsedRuleset = parseRulesetInput(editForm.ruleset);
    } catch (rulesetError) {
      const message = rulesetError instanceof Error ? rulesetError.message : 'Invalid ruleset';
      setEditErrors((prev) => ({ ...prev, ruleset: message }));
      showBanner('error', message);
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmedName,
      status: editForm.status,
      mode: editForm.mode,
      rolloutStage: editForm.rolloutStage.trim() || undefined,
      ruleset: parsedRuleset,
    };

    const confirmationMessage = getUpdateConfirmationMessage(selectedPolicy, { ...editForm, name: trimmedName });
    if (confirmationMessage) {
      requestConfirmation({
        title: 'Confirm enforcement change',
        description: confirmationMessage,
        confirmLabel: 'Save & apply',
        action: () => executePolicyUpdate(payload),
      });
      return;
    }

    await executePolicyUpdate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Migra Shield enforces tenant-specific guardrails before any `/api/v1` traffic reaches the core.
            Manage rollout mode, status, and auditability from here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/migrahosting-alt/mpanel/blob/master/docs/MPANEL_SHIELD.md"
            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
            target="_blank"
            rel="noreferrer"
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-1" /> Reference
          </a>
          <button
            onClick={loadPolicies}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isLoading}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin text-primary-600' : 'text-gray-500'}`} />
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Policies</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400">Active + Archived</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Enforce</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.enforce}</p>
          <p className="text-xs text-gray-400">Blocking traffic</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Report-only</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.reportOnly}</p>
          <p className="text-xs text-gray-400">Observability mode</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Drafts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.drafts}</p>
          <p className="text-xs text-gray-400">Needs review</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Shield Policies</h2>
              <p className="text-sm text-gray-500">Only admins with platform:shield:manage can edit.</p>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="px-2 py-4">
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Policy</th>
                    <th scope="col" className="px-4 py-3">Tenant</th>
                    <th scope="col" className="px-4 py-3">Mode</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        <ShieldCheckIcon className="mx-auto mb-2 h-6 w-6 animate-pulse text-primary-600" />
                        Loading shield policies…
                      </td>
                    </tr>
                  )}
                  {!isLoading && policies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        No policies yet. Use the provisioning scripts or API to seed a baseline.
                      </td>
                    </tr>
                  )}
                  {!isLoading && policies.map((policy) => {
                    const isActive = selectedPolicy?.id === policy.id;
                    return (
                      <tr
                        key={policy.id}
                        className={`cursor-pointer transition-colors ${isActive ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedPolicy(policy)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="h-5 w-5 text-primary-600" />
                            <div>
                              <p>{policy.name}</p>
                              <p className="text-xs text-gray-500">v{policy.version}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatTenantLabel(policy.tenantId)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${modeBadge[policy.mode]}`}>
                            {policy.mode === 'enforce' ? 'Enforce' : 'Report-only'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusStyles[policy.status]}`}>
                            {policy.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(policy.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">Policy details & editor</h3>
            <p className="text-sm text-gray-500">Live data from Prisma with inline edits.</p>
          </div>

          {!selectedPolicy && (
            <div className="p-6 text-sm text-gray-500">
              Select a policy to edit its metadata, rollout mode, and ruleset JSON.
            </div>
          )}

          {selectedPolicy && editForm && (
            <form onSubmit={handleUpdateSubmit} className="space-y-5 p-6 text-sm text-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Policy name</label>
                  <input
                    type="text"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                      editErrors.name ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 focus:ring-primary-500'
                    }`}
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => prev ? { ...prev, name: event.target.value } : prev)}
                  />
                  {editErrors.name && <p className="mt-1 text-xs text-red-600">{editErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tenant scope</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                    value={formatTenantLabel(selectedPolicy.tenantId)}
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">Tenant is immutable; clone to target a new scope.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    value={editForm.mode}
                    onChange={(event) => setEditForm((prev) => prev ? { ...prev, mode: event.target.value as ShieldPolicy['mode'] } : prev)}
                  >
                    <option value="report_only">Report-only (observe)</option>
                    <option value="enforce">Enforce (block)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    value={editForm.status}
                    onChange={(event) => setEditForm((prev) => prev ? { ...prev, status: event.target.value as ShieldPolicy['status'] } : prev)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollout stage</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    value={editForm.rolloutStage}
                    onChange={(event) => setEditForm((prev) => prev ? { ...prev, rolloutStage: event.target.value } : prev)}
                    placeholder="e.g. canary, 50%, GA"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last updated</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                    value={formatDate(selectedPolicy.updatedAt)}
                    disabled
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ruleset JSON</label>
                  <span className="text-xs text-gray-400">v{selectedPolicy.version}</span>
                </div>
                <textarea
                  className={`mt-1 h-56 w-full rounded-xl border bg-gray-900/90 p-4 font-mono text-xs text-emerald-200 focus:outline-none focus:ring-2 ${
                    editErrors.ruleset ? 'border-red-400 focus:ring-red-500' : 'border-gray-900/40 focus:ring-primary-500/50'
                  }`}
                  value={editForm.ruleset}
                  onChange={(event) => setEditForm((prev) => prev ? { ...prev, ruleset: event.target.value } : prev)}
                  spellCheck={false}
                />
                <p className="mt-2 text-xs text-gray-500">JSON must be valid; we persist exactly what you submit.</p>
                {editErrors.ruleset && <p className="mt-1 text-xs text-red-600">{editErrors.ruleset}</p>}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <p>Use report-only when testing. Switch to enforce only after the smoke harness passes.</p>
                <button
                  type="submit"
                  className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                    isUpdating ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-700'
                  } disabled:opacity-60`}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Saving…' : 'Save changes'}
                </button>
              </div>
              {editErrors.form && <p className="text-xs text-red-600">{editErrors.form}</p>}
            </form>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">Create new policy</h3>
          <p className="text-sm text-gray-500">Use this when seeding a fresh tenant or cloning a baseline.</p>
        </div>
        <form onSubmit={handleCreateSubmit} className="space-y-5 p-6 text-sm text-gray-700">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Policy name</label>
              <input
                type="text"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                  createErrors.name ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 focus:ring-primary-500'
                }`}
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Global baseline"
              />
              {createErrors.name && <p className="mt-1 text-xs text-red-600">{createErrors.name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tenant scope</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={createForm.tenantId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, tenantId: event.target.value }))}
                placeholder="global or tenant UUID"
              />
              <p className="mt-1 text-xs text-gray-500">Use “global” for platform-wide defaults; leave blank to assign manually via SQL.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={createForm.mode}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, mode: event.target.value as ShieldPolicy['mode'] }))}
              >
                <option value="report_only">Report-only (default)</option>
                <option value="enforce">Enforce immediately</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={createForm.status}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as ShieldPolicy['status'] }))}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollout stage</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                value={createForm.rolloutStage}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, rolloutStage: event.target.value }))}
                placeholder="baseline, pilot, ga"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ruleset JSON</label>
            <textarea
              className={`mt-1 h-48 w-full rounded-xl border bg-gray-900/90 p-4 font-mono text-xs text-emerald-200 focus:outline-none focus:ring-2 ${
                createErrors.ruleset ? 'border-red-400 focus:ring-red-500' : 'border-gray-900/40 focus:ring-primary-500/50'
              }`}
              value={createForm.ruleset}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, ruleset: event.target.value }))}
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-gray-500">Paste the compiled policy document from the smoke harness or author JSON inline.</p>
            {createErrors.ruleset && <p className="mt-1 text-xs text-red-600">{createErrors.ruleset}</p>}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <p>CLI helpers remain available (`npm run shield:seed`, `shield:smoke`).</p>
            <button
              type="submit"
              className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                isCreating ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-700'
              } disabled:opacity-60`}
              disabled={isCreating}
            >
              {isCreating ? 'Creating…' : 'Create policy'}
            </button>
          </div>
          {createErrors.form && <p className="text-xs text-red-600">{createErrors.form}</p>}
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Recent Shield decisions</h3>
              <p className="text-sm text-gray-500">Latest audit trail of request outcomes (max 25).</p>
            </div>
            <button
              onClick={loadDecisions}
              className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={decisionsLoading}
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${decisionsLoading ? 'animate-spin text-primary-600' : 'text-gray-500'}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="p-6">
          {decisionsError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {decisionsError}
            </div>
          )}
          <div className="space-y-4">
            {decisionsLoading && (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-16 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            )}
            {!decisionsLoading && decisions.length === 0 && (
              <p className="text-sm text-gray-500">No Shield decisions recorded yet.</p>
            )}
            {!decisionsLoading && decisions.length > 0 && (
              <ul className="space-y-3">
                {decisions.map((decision) => {
                  const resultKey = decisionResultStyles[decision.result] ? decision.result : 'allowed';
                  const normalizedMode = decision.mode ? decision.mode.replace('_', ' ') : 'unknown';
                  return (
                    <li key={decision.id} className="rounded-xl border border-gray-100 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {decision.policy?.name || 'Unlinked policy'}
                          </p>
                          <p className="text-xs text-gray-500">Tenant: {formatTenantLabel(decision.tenantId)}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${decisionResultStyles[resultKey]}`}>
                          {decision.result === 'blocked' ? 'Blocked' : 'Allowed'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4" />
                          <span>{formatDate(decision.createdAt)}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-700">Mode: {normalizedMode}</p>
                          {decision.reason && <p>Reason: {decision.reason}</p>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <ShieldExclamationIcon className="h-5 w-5" />
          Admin-only preview
        </div>
        <p className="mt-2 text-amber-800">
          This module is intentionally hidden from tenant dashboards. Keep it restricted to platform staff until we finish the change-management workflow and approvals.
        </p>
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{confirmState.title}</h4>
                <p className="text-sm text-gray-600">{confirmState.description}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => (!isConfirming ? setConfirmState(null) : null)}
                disabled={isConfirming}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  isConfirming ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-700'
                } disabled:opacity-60`}
                onClick={handleConfirmDialog}
                disabled={isConfirming}
              >
                {isConfirming ? 'Applying…' : confirmState.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
