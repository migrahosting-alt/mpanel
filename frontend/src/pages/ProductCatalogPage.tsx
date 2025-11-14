// src/pages/ProductCatalogPage.tsx
import React, { useState, useEffect } from 'react';
import { ShoppingCartIcon, GlobeAltIcon, ServerIcon, CircleStackIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import { useCartStore } from '../stores/cartStore';
import toast from 'react-hot-toast';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  type: string;
  category: string;
  billing_cycle: 'monthly' | 'yearly' | 'one_time';
  features: string[];
  active: boolean;
};

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [domainInput, setDomainInput] = useState<Record<string, string>>({});
  
  const { addItem, getItemCount } = useCartStore();
  const cartCount = getItemCount();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products');
      setProducts(Array.isArray(response) ? response : []);
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Products', icon: ShoppingCartIcon },
    { id: 'domains', name: 'Domains', icon: GlobeAltIcon },
    { id: 'hosting', name: 'Web Hosting', icon: ServerIcon },
    { id: 'databases', name: 'Databases', icon: CircleStackIcon },
    { id: 'email', name: 'Email', icon: EnvelopeIcon },
  ];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const handleAddToCart = (product: Product) => {
    let configuration: any = {};

    // For domains, require domain input
    if (product.category === 'domains') {
      const domain = domainInput[product.id];
      if (!domain || !domain.includes('.')) {
        toast.error('Please enter a valid domain name (e.g., example.com)');
        return;
      }
      configuration.domain = domain;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      type: product.type,
      billing_cycle: product.billing_cycle,
      category: product.category,
      configuration,
    });

    toast.success(`${product.name} added to cart!`);
    
    // Clear domain input after adding
    if (product.category === 'domains') {
      setDomainInput({ ...domainInput, [product.id]: '' });
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      domains: 'bg-blue-100 text-blue-700',
      hosting: 'bg-green-100 text-green-700',
      databases: 'bg-purple-100 text-purple-700',
      email: 'bg-orange-100 text-orange-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      domains: GlobeAltIcon,
      hosting: ServerIcon,
      databases: CircleStackIcon,
      email: EnvelopeIcon,
    };
    const Icon = icons[category] || ShoppingCartIcon;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingCartIcon className="w-7 h-7 text-violet-600" />
            Product Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse and purchase hosting products and services
          </p>
        </div>
        <a
          href="/cart"
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2"
        >
          <ShoppingCartIcon className="w-5 h-5" />
          Cart ({cartCount})
        </a>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {category.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <ShoppingCartIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No products found</h3>
          <p className="text-slate-500">
            {selectedCategory === 'all'
              ? 'No products available at the moment'
              : `No products in the ${selectedCategory} category`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                    {getCategoryIcon(product.category)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadge(product.category)}`}>
                      {product.category}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4">{product.description}</p>

              {product.features && product.features.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {product.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              {/* Domain input field for domain products */}
              {product.category === 'domains' && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="example.com"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={domainInput[product.id] || ''}
                    onChange={(e) => setDomainInput({ ...domainInput, [product.id]: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    ${product.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {product.billing_cycle === 'monthly' && '/month'}
                    {product.billing_cycle === 'yearly' && '/year'}
                    {product.billing_cycle === 'one_time' && 'one-time'}
                  </p>
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 flex items-center gap-2"
                >
                  <ShoppingCartIcon className="w-4 h-4" />
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
