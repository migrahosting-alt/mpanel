// frontend/src/pages/SubscriptionsPage.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

type Plan = {
  id: number;
  name: string;
  description: string;
  price: number;
  billing_period: 'month' | 'year';
  features: string[];
  stripe_price_id: string;
  active: boolean;
};

type Subscription = {
  id: number;
  user_id: string;
  plan_id: number;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  plan?: Plan;
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [changingPlan, setChangingPlan] = useState<{ subscriptionId: number; currentPlanId: number } | null>(null);

  useEffect(() => {
    fetchSubscriptions();
    fetchPlans();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ subscriptions: Subscription[] }>('/subscriptions');
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      // Only show error if it's not a 404 or empty response
      if (error && typeof error === 'object' && 'status' in error && error.status !== 404) {
        toast.error('Failed to load subscriptions');
      }
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await apiClient.get<{ plans: Plan[] }>('/subscriptions/plans');
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      // Only show error if it's not a 404 or empty response
      if (error && typeof error === 'object' && 'status' in error && error.status !== 404) {
        toast.error('Failed to load plans');
      }
      setPlans([]);
    }
  };

  const handleCancelSubscription = async (subscriptionId: number, immediate: boolean = false) => {
    if (!confirm(`Are you sure you want to ${immediate ? 'immediately cancel' : 'cancel at period end'} this subscription?`)) {
      return;
    }

    try {
      await apiClient.post(`/subscriptions/${subscriptionId}/cancel${immediate ? '?immediate=true' : ''}`);
      toast.success(immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end');
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const handleReactivate = async (subscriptionId: number) => {
    try {
      await apiClient.post(`/subscriptions/${subscriptionId}/reactivate`);
      toast.success('Subscription reactivated');
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to reactivate subscription:', error);
      toast.error('Failed to reactivate subscription');
    }
  };

  const handleChangePlan = async (subscriptionId: number, newPlanId: number) => {
    try {
      await apiClient.put(`/subscriptions/${subscriptionId}/change-plan`, { newPlanId });
      toast.success('Plan changed successfully!');
      setChangingPlan(null);
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to change plan:', error);
      toast.error('Failed to change plan');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'canceled':
        return 'bg-red-100 text-red-700';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'canceled':
        return <XCircleIcon className="w-5 h-5" />;
      default:
        return <ArrowPathIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your active subscriptions and billing
          </p>
        </div>
        <button
          onClick={() => setShowPlans(true)}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium inline-flex items-center gap-2"
        >
          <SparklesIcon className="w-5 h-5" />
          View Plans
        </button>
      </div>

      {/* Active Subscriptions */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-violet-600"></div>
          <p className="mt-2 text-sm text-slate-500">Loading subscriptions...</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <SparklesIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-900 font-medium mb-2">No subscriptions yet</p>
          <p className="text-slate-500 mb-4 text-sm">Subscriptions appear here after an order is completed and paid.</p>
          <button
            onClick={() => setShowPlans(true)}
            className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
          >
            Browse Plans
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((subscription) => {
            const plan = plans.find(p => p.id === subscription.plan_id);
            
            return (
              <div key={subscription.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{plan?.name || 'Unknown Plan'}</h3>
                    <p className="text-sm text-slate-500 mt-1">{plan?.description}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                    {getStatusIcon(subscription.status)}
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </span>
                </div>

                {/* Pricing */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">${plan?.price || 0}</span>
                    <span className="text-sm text-slate-500">/ {plan?.billing_period || 'month'}</span>
                  </div>
                </div>

                {/* Billing Period */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Current Period</span>
                    <span className="font-medium text-slate-900">
                      {new Date(subscription.current_period_start).toLocaleDateString()} - {new Date(subscription.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                  {subscription.cancel_at_period_end && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <XCircleIcon className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs text-yellow-700">
                        Cancels on {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {plan?.features && plan.features.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Includes</p>
                    <ul className="space-y-1">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                    <>
                      <button
                        onClick={() => setChangingPlan({ subscriptionId: subscription.id, currentPlanId: subscription.plan_id })}
                        className="flex-1 px-4 py-2 border-2 border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 font-medium text-sm"
                      >
                        Change Plan
                      </button>
                      <button
                        onClick={() => handleCancelSubscription(subscription.id)}
                        className="flex-1 px-4 py-2 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {subscription.cancel_at_period_end && (
                    <button
                      onClick={() => handleReactivate(subscription.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plans Modal */}
      {showPlans && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Available Plans</h2>
              <button
                onClick={() => setShowPlans(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border-2 border-slate-200 rounded-xl p-6 hover:border-violet-300 transition-colors"
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-600 mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
                      <span className="text-slate-500">/ {plan.billing_period}</span>
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => {
                      setSelectedPlan(plan);
                      setShowPlans(false);
                      toast.info('Subscription creation coming soon!');
                    }}
                    className="w-full px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
                  >
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {changingPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Change Plan</h2>
              <button
                onClick={() => setChangingPlan(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">
                Select a new plan. You'll be charged or credited prorated amounts based on the time remaining in your current billing cycle.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.filter(p => p.id !== changingPlan.currentPlanId).map((plan) => (
                  <div
                    key={plan.id}
                    className="border-2 border-slate-200 rounded-xl p-4 hover:border-violet-300 transition-colors cursor-pointer"
                    onClick={() => handleChangePlan(changingPlan.subscriptionId, plan.id)}
                  >
                    <h3 className="font-bold text-slate-900 mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-slate-900">${plan.price}</span>
                      <span className="text-xs text-slate-500">/ {plan.billing_period}</span>
                    </div>
                    {plan.features && (
                      <ul className="space-y-1">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-1 text-xs text-slate-600">
                            <CheckCircleIcon className="w-3 h-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
