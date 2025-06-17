import React, { useState } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Store,
  Bell,
  Search,
  Filter,
  Database,
  Loader2
} from 'lucide-react';
import MarketplaceBrowse from '@/components/marketplace/MarketplaceBrowse';
import MarketplaceOrders from '@/components/marketplace/MarketplaceOrders';
import MarketplaceAnalytics from '@/components/marketplace/MarketplaceAnalytics';
import MarketplaceCart from '@/components/marketplace/MarketplaceCart';
import { seedMarketplaceData } from '@/services/marketplaceSeedService';
import { MarketplaceCartItem } from '@/types';
import toast from 'react-hot-toast';

type MarketplaceTab = 'browse' | 'orders' | 'analytics' | 'cart';

const MarketplacePage: React.FC = () => {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [cartItems, setCartItems] = useState<MarketplaceCartItem[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Only allow access to restaurant owners and managers (employees with proper permissions)
  if (!user || !restaurant || (user.role !== 'owner' && user.role !== 'manager')) {
    return <Navigate to={`/${restaurant?.slug}/login`} replace />;
  }

  const tabs = [
    {
      id: 'browse' as MarketplaceTab,
      label: 'Browse Products',
      icon: Store,
      description: 'Find and order supplies'
    },
    {
      id: 'orders' as MarketplaceTab,
      label: 'My Orders',
      icon: Package,
      description: 'Track your orders'
    },
    {
      id: 'analytics' as MarketplaceTab,
      label: 'Analytics',
      icon: BarChart3,
      description: 'Spending insights'
    },
    {
      id: 'cart' as MarketplaceTab,
      label: `Cart ${cartItems.length > 0 ? `(${cartItems.length})` : ''}`,
      icon: ShoppingCart,
      description: 'Review your cart'
    }
  ];

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const result = await seedMarketplaceData();
      
      if (result.success) {
        toast.success(result.message);
        // Optionally reload the page to show new data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error seeding marketplace data:', error);
      toast.error('Failed to seed marketplace data');
    } finally {
      setIsSeeding(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'browse':
        return <MarketplaceBrowse onCartUpdate={setCartItems} />;
      case 'orders':
        return <MarketplaceOrders />;
      case 'analytics':
        return <MarketplaceAnalytics />;
      case 'cart':
        return <MarketplaceCart cartItems={cartItems} onCartUpdate={setCartItems} />;
      default:
        return <MarketplaceBrowse onCartUpdate={setCartItems} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header with Gradient Background */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600"></div>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-8">
              <div className="text-white">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/20">
                    <Store className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-1">Marketplace</h1>
                    <p className="text-blue-100 text-lg font-medium">
                      Premium bulk supplies for {restaurant.name}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Quick Actions */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleSeedData}
                  disabled={isSeeding}
                  className="flex items-center gap-3 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 border border-white/20 shadow-lg hover:shadow-xl"
                >
                  {isSeeding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Database className="h-5 w-5" />
                  )}
                  <span className="font-medium">{isSeeding ? 'Loading...' : 'Load Sample Data'}</span>
                </button>

                <button className="p-3 text-white hover:bg-white/20 rounded-xl relative transition-all duration-300 group">
                  <Bell className="h-6 w-6 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse shadow-lg">
                    3
                  </span>
                </button>
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products, suppliers..."
                    className="pl-12 pr-4 py-3 bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-transparent w-80 text-gray-700 placeholder-gray-500 shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative px-6 py-4 font-medium text-sm flex items-center gap-3 transition-all duration-300 rounded-t-xl ${
                    isActive
                      ? 'text-blue-600 bg-white shadow-lg -mb-px border-x border-t border-gray-200'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-all duration-300 ${
                    isActive ? 'text-blue-600 scale-110' : 'text-gray-400 group-hover:text-gray-600 group-hover:scale-105'
                  }`} />
                  <span className="relative">
                    {tab.label}
                    {tab.id === 'cart' && cartItems.length > 0 && (
                      <span className="ml-3 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse shadow-md">
                        {cartItems.length}
                      </span>
                    )}
                  </span>
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Enhanced Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplacePage; 