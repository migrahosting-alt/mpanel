// Example React component for Hosting Pricing
// Copy this to your marketing site and adapt as needed

import React, { useState } from 'react';
import { 
  hostingPlans, 
  HostingBillingCycle,
  formatPrice,
  getBillingCycleLabel,
  getMonthsForCycle,
  getPriceWithSavings
} from './pricingConfig';

export default function HostingPricingComponent() {
  const [billingCycle, setBillingCycle] = useState<HostingBillingCycle>('oneYear');

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4">Shared Hosting Plans</h2>
        <p className="text-gray-600 mb-8">Powerful hosting for everyone</p>
        
        {/* Billing Cycle Selector */}
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          {hostingPlans.billingCycles.map((cycle) => (
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

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {hostingPlans.plans.map((plan) => {
          const price = plan.pricing[billingCycle];
          const monthlyPrice = plan.pricing.monthly;
          const months = getMonthsForCycle(billingCycle);
          const { savings, savingsPercent } = billingCycle !== 'monthly' 
            ? getPriceWithSavings(monthlyPrice, price * months, months)
            : { savings: 0, savingsPercent: 0 };

          return (
            <div
              key={plan.id}
              className="border rounded-lg p-6 hover:shadow-xl transition-shadow bg-white"
            >
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              
              {/* Price */}
              <div className="mb-4">
                <div className="text-4xl font-bold text-blue-600">
                  {price === 0 ? 'FREE' : formatPrice(price, hostingPlans.currency)}
                </div>
                {price > 0 && (
                  <div className="text-sm text-gray-600">
                    per month
                    {billingCycle !== 'monthly' && (
                      <span className="block text-xs mt-1">
                        billed {getBillingCycleLabel(billingCycle).toLowerCase()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Savings Badge */}
              {savingsPercent > 0 && (
                <div className="mb-4">
                  <span className="inline-block bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                    Save {savingsPercent}% (${savings.toFixed(2)})
                  </span>
                </div>
              )}

              {/* Notes */}
              {plan.notes && (
                <p className="text-sm text-gray-600 mb-4 italic">{plan.notes}</p>
              )}

              {/* CTA Button */}
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                onClick={() => {
                  // Integrate with mPanel checkout
                  console.log('Selected plan:', plan.id, billingCycle);
                }}
              >
                {price === 0 ? 'Get Started Free' : 'Order Now'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
