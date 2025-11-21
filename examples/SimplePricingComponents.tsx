// Example React component for Email/VPS/Cloud/Storage Pricing
// Copy this to your marketing site and adapt as needed

import React, { useState } from 'react';
import { 
  mailPlans,
  vpsPlans,
  cloudPlans,
  storagePlans,
  SimpleBillingCycle,
  formatPrice,
  getBillingCycleLabel,
  getMonthsForCycle,
  getPriceWithSavings
} from './pricingConfig';

// Email Pricing Component
export function EmailPricingComponent() {
  const [billingCycle, setBillingCycle] = useState<SimpleBillingCycle>('yearly');

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Professional Email Hosting</h2>
        <p className="text-gray-600 mb-8">Secure, reliable email for your business</p>
        
        {/* Billing Toggle */}
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          {mailPlans.billingCycles.map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === cycle
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {getBillingCycleLabel(cycle)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {mailPlans.plans.map((plan) => {
          const price = plan.pricing[billingCycle];
          const monthlyPrice = plan.pricing.monthly;
          const yearlyTotal = price * 12;
          const monthlySavings = billingCycle === 'yearly' 
            ? (monthlyPrice * 12 - yearlyTotal).toFixed(2)
            : '0';

          return (
            <div key={plan.id} className="border rounded-lg p-6 bg-white hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {formatPrice(price, mailPlans.currency)}
              </div>
              <div className="text-sm text-gray-600 mb-4">per mailbox/month</div>
              
              {billingCycle === 'yearly' && parseFloat(monthlySavings) > 0 && (
                <div className="mb-4">
                  <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full">
                    Save ${monthlySavings}/year
                  </span>
                </div>
              )}

              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg">
                Order Now
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// VPS Pricing Component
export function VPSPricingComponent() {
  const [billingCycle, setBillingCycle] = useState<SimpleBillingCycle>('monthly');

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Virtual Private Servers</h2>
        <p className="text-gray-600 mb-8">Full root access, dedicated resources</p>
        
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          {vpsPlans.billingCycles.map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === cycle
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {getBillingCycleLabel(cycle)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {vpsPlans.plans.map((plan) => {
          const price = plan.pricing[billingCycle];

          return (
            <div key={plan.id} className="border rounded-lg p-6 bg-white hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-indigo-600 mb-2">
                {formatPrice(price, vpsPlans.currency)}
              </div>
              <div className="text-sm text-gray-600 mb-4">per month</div>

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg">
                Deploy VPS
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Cloud Pricing Component
export function CloudPricingComponent() {
  const [billingCycle, setBillingCycle] = useState<SimpleBillingCycle>('monthly');

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Cloud Infrastructure</h2>
        <p className="text-gray-600 mb-8">Scalable cloud computing platform</p>
        
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          {cloudPlans.billingCycles.map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === cycle
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {getBillingCycleLabel(cycle)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {cloudPlans.plans.map((plan) => {
          const price = plan.pricing[billingCycle];

          return (
            <div key={plan.id} className="border rounded-lg p-6 bg-white hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-cyan-600 mb-2">
                {formatPrice(price, cloudPlans.currency)}
              </div>
              <div className="text-sm text-gray-600 mb-4">per month</div>

              <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-6 rounded-lg">
                Get Started
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Storage Pricing Component
export function StoragePricingComponent() {
  const [billingCycle, setBillingCycle] = useState<SimpleBillingCycle>('yearly');

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Cloud Storage</h2>
        <p className="text-gray-600 mb-8">Secure file storage and collaboration</p>
        
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          {storagePlans.billingCycles.map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-6 py-2 rounded-md transition-colors ${
                billingCycle === cycle
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {getBillingCycleLabel(cycle)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {storagePlans.plans.map((plan) => {
          const price = plan.pricing[billingCycle];

          return (
            <div key={plan.id} className="border rounded-lg p-6 bg-white hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold text-emerald-600 mb-2">
                {formatPrice(price, storagePlans.currency)}
              </div>
              <div className="text-sm text-gray-600 mb-4">per month</div>

              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg">
                Start Free Trial
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
