/**
 * Domain Search Widget Component
 * For Marketing Website - Domain Registration Search
 * 
 * Features:
 * - Live domain availability check
 * - Shows pricing from domain_pricing table
 * - Suggests alternative TLDs
 * - Add to cart integration
 * - Responsive design with Tailwind CSS
 */

import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, ShoppingCart } from 'lucide-react';

interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
  price: string;
  registrationPrice: string;
  renewalPrice: string;
}

interface DomainPricing {
  tld: string;
  registration_price: string;
  renewal_price: string;
  transfer_price: string;
  is_active: boolean;
}

const MPANEL_URL = 'https://migrapanel.com';

export default function DomainSearchWidget() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [error, setError] = useState('');
  const [popularPricing, setPopularPricing] = useState<DomainPricing[]>([]);
  const [cart, setCart] = useState<DomainResult[]>([]);

  // Fetch popular domain pricing on mount
  useEffect(() => {
    fetchPopularPricing();
  }, []);

  const fetchPopularPricing = async () => {
    try {
      const response = await fetch(`${MPANEL_URL}/api/domain-pricing/popular`);
      const data = await response.json();
      if (data.success) {
        setPopularPricing(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
  };

  const searchDomains = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a domain name');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);

    try {
      // Remove any existing TLD from search term
      const cleanDomain = searchTerm.toLowerCase().replace(/\.(com|net|org|io|co|ai|app|dev)$/, '');
      
      // Build list of domains to check
      const domainsToCheck = popularPricing.map(p => `${cleanDomain}${p.tld}`);

      // Check availability (public endpoint - no auth required for marketing site)
      const availabilityResponse = await fetch(`${MPANEL_URL}/api/domain-registration/check-availability-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: domainsToCheck })
      });

      if (!availabilityResponse.ok) {
        throw new Error('Failed to check domain availability');
      }

      const availabilityData = await availabilityResponse.json();
      
      // Combine availability with pricing
      const domainResults: DomainResult[] = domainsToCheck.map((domain, index) => {
        const tld = popularPricing[index].tld;
        const pricing = popularPricing[index];
        const isAvailable = availabilityData.results[domain] === 'available';

        return {
          domain,
          tld,
          available: isAvailable,
          price: pricing.registration_price,
          registrationPrice: pricing.registration_price,
          renewalPrice: pricing.renewal_price
        };
      });

      // Sort: available domains first, then by price
      domainResults.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return parseFloat(a.price) - parseFloat(b.price);
      });

      setResults(domainResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search domains');
    } finally {
      setSearching(false);
    }
  };

  const addToCart = (domain: DomainResult) => {
    if (!cart.find(d => d.domain === domain.domain)) {
      setCart([...cart, domain]);
    }
  };

  const removeFromCart = (domain: string) => {
    setCart(cart.filter(d => d.domain !== domain));
  };

  const checkout = () => {
    // Redirect to mPanel signup with domain cart
    const domains = cart.map(d => d.domain).join(',');
    window.location.href = `${MPANEL_URL}/signup?domains=${encodeURIComponent(domains)}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchDomains();
    }
  };

  const cartTotal = cart.reduce((sum, d) => sum + parseFloat(d.price), 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
          Find Your Perfect Domain
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Search for available domains with competitive pricing
        </p>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your domain name (e.g., myawesomesite)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={searchDomains}
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {searching ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Search Results
          </h3>
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.domain}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  result.available
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {result.available ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-gray-400" />
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">
                      {result.domain}
                    </div>
                    {result.available && (
                      <div className="text-sm text-gray-600">
                        Renewal: ${result.renewalPrice}/year
                      </div>
                    )}
                  </div>
                </div>

                {result.available && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        ${result.price}
                      </div>
                      <div className="text-sm text-gray-600">/year</div>
                    </div>
                    {cart.find(d => d.domain === result.domain) ? (
                      <button
                        onClick={() => removeFromCart(result.domain)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => addToCart(result)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Add to Cart
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shopping Cart */}
      {cart.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Your Cart ({cart.length})
          </h3>
          <div className="space-y-2 mb-4">
            {cart.map((item) => (
              <div
                key={item.domain}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium">{item.domain}</span>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-green-600">
                    ${item.price}/year
                  </span>
                  <button
                    onClick={() => removeFromCart(item.domain)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold">Total:</span>
              <span className="text-2xl font-bold text-green-600">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={checkout}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}

      {/* Popular TLDs Preview */}
      {results.length === 0 && !searching && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Popular Domain Extensions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {popularPricing.slice(0, 8).map((pricing) => (
              <div
                key={pricing.tld}
                className="p-4 border border-gray-200 rounded-lg text-center hover:border-blue-500 transition-colors"
              >
                <div className="text-lg font-bold text-gray-900">
                  {pricing.tld}
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-2">
                  ${pricing.registration_price}
                </div>
                <div className="text-sm text-gray-600">/year</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
