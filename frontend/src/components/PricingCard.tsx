/**
 * Reusable Pricing Card Component
 * Displays a plan with features, pricing, and CTAs
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Plan, BillingCycle } from '../config/pricing-config';
import { formatPrice, getMonthlyEquivalent, calculateYearlySavings } from '../lib/priceCalculator';

interface PricingCardProps {
  plan: Plan;
  billingCycle: BillingCycle;
  featured?: boolean;
  onSelectTrial?: () => void;
  onSelectNow?: () => void;
}

export function PricingCard({ plan, billingCycle, featured = false, onSelectTrial, onSelectNow }: PricingCardProps) {
  const navigate = useNavigate();
  const price = plan.basePrice[billingCycle];
  const monthlyEquivalent = billingCycle === 'yearly' ? getMonthlyEquivalent(price) : null;
  const savings = billingCycle === 'yearly' ? calculateYearlySavings(plan.basePrice.monthly, price) : null;

  const handleSelectTrial = () => {
    if (onSelectTrial) {
      onSelectTrial();
    }
    navigate(`/checkout?plan=${plan.id}&trial=1&cycle=${billingCycle}`);
  };

  const handleSelectNow = () => {
    if (onSelectNow) {
      onSelectNow();
    }
    navigate(`/checkout?plan=${plan.id}&trial=0&cycle=${billingCycle}`);
  };

  return (
    <div 
      className={`relative rounded-2xl border-2 p-8 ${
        featured 
          ? 'border-blue-600 shadow-2xl scale-105' 
          : 'border-gray-200 shadow-lg'
      } bg-white hover:shadow-xl transition-all duration-300`}
    >
      {/* Popular badge */}
      {featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
            Most Popular
          </span>
        </div>
      )}

      {/* Plan name */}
      <div className="mb-4">
        <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
        <p className="text-gray-600 mt-1">{plan.description}</p>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="text-5xl font-extrabold text-gray-900">
            {formatPrice(billingCycle === 'yearly' && monthlyEquivalent ? monthlyEquivalent : price, false)}
          </span>
          <span className="text-gray-600 ml-2">
            {billingCycle === 'monthly' ? '/month' : '/month'}
          </span>
        </div>
        {billingCycle === 'yearly' && savings && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Billed {formatPrice(price)}/year
            </p>
            <p className="text-sm font-semibold text-green-600">
              Save {formatPrice(savings.amount)} ({savings.percentage}%) vs monthly
            </p>
          </div>
        )}
      </div>

      {/* Trial info */}
      {plan.trialEnabled && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">
            🎉 {plan.trialDays}-day free trial included
          </p>
        </div>
      )}

      {/* Features list */}
      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg 
              className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="space-y-3">
        {plan.trialEnabled && (
          <button
            onClick={handleSelectTrial}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
              featured
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Start {plan.trialDays}-Day Free Trial
          </button>
        )}
        <button
          onClick={handleSelectNow}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
            plan.trialEnabled
              ? 'border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              : featured
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
