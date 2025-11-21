const terms = {
  monthly: { key: 'monthly', label: 'Monthly', months: 1 },
  annually: { key: 'annually', label: 'Annually (1 year)', months: 12 },
  biennially: { key: 'biennially', label: 'Biennially (2 years)', months: 24 },
  triennially: { key: 'triennially', label: 'Triennially (3 years)', months: 36 },
};

const plan = (id, name, description, envPrefix) => ({
  id,
  name,
  description,
  prices: {
    monthly: process.env[`PRICE_${envPrefix}_MONTHLY`] || null,
    annually: process.env[`PRICE_${envPrefix}_ANNUAL`] || null,
    biennially: process.env[`PRICE_${envPrefix}_BIENNIAL`] || null,
    triennially: process.env[`PRICE_${envPrefix}_TRIENNIAL`] || null,
  },
});

export const PLAN_CATALOG = {
  student: plan('student', 'Student Plan', 'Verified student hosting', 'STUDENT'),
  starter: plan('starter', 'Starter', 'Single-site NVMe hosting', 'STARTER'),
  premium: plan('premium', 'Premium', 'Multi-site performance hosting', 'PREMIUM'),
  business: plan('business', 'Business', 'High-allowance business hosting', 'BUSINESS'),
};

export const SETUP_FEE_PRICE = process.env.PRICE_SETUP_FEE || null;

export function resolvePriceId(planId, termKey) {
  const planConfig = PLAN_CATALOG[planId];
  if (!planConfig) return null;
  return planConfig.prices[termKey] || null;
}

export function serializePlans() {
  return Object.values(PLAN_CATALOG).map((planConfig) => {
    const billing = Object.entries(planConfig.prices)
      .filter(([, priceId]) => Boolean(priceId))
      .map(([termKey, priceId]) => ({
        term: termKey,
        label: terms[termKey]?.label || termKey,
        months: terms[termKey]?.months || null,
        priceId,
      }));

    return {
      id: planConfig.id,
      name: planConfig.name,
      description: planConfig.description,
      billing,
    };
  });
}
