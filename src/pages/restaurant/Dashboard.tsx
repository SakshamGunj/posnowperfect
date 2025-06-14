import { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { 
  Store, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  MapPin,
  Phone,
  Mail,
  Settings,
  ChefHat,
  Package,
  Loader2,
  Database,
  Gift,
  Grid3X3
} from 'lucide-react';
import { formatCurrency, getBusinessTypeDisplayName } from '@/lib/utils';
import { OrderService } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { SeedDataService } from '@/services/seedDataService';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalOrdersToday: number;
  revenueToday: number;
  activeTables: number;
  totalTables: number;
  ordersYesterday: number;
  revenueYesterday: number;
  growth: number;
}

export default function RestaurantDashboard() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (!restaurant) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get today's date range
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        // Get yesterday's date range
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const yesterdayEnd = new Date(yesterdayStart.getTime() + 24 * 60 * 60 * 1000);

        // Fetch orders and tables
        const [ordersResult, tablesResult] = await Promise.all([
          OrderService.getOrdersForRestaurant(restaurant.id),
          TableService.getTablesForRestaurant(restaurant.id)
        ]);

        const allOrders = ordersResult.success ? ordersResult.data || [] : [];
        const tables = tablesResult.success ? tablesResult.data || [] : [];

        // Filter today's orders
        const todaysOrders = allOrders.filter(order => {
          const orderDate = order.createdAt;
          const orderDateTime = orderDate instanceof Date ? orderDate : new Date(orderDate);
          return orderDateTime >= todayStart && orderDateTime < todayEnd;
        });

        // Filter yesterday's orders
        const yesterdaysOrders = allOrders.filter(order => {
          const orderDate = order.createdAt;
          const orderDateTime = orderDate instanceof Date ? orderDate : new Date(orderDate);
          return orderDateTime >= yesterdayStart && orderDateTime < yesterdayEnd;
        });

        // Calculate revenue
        const revenueToday = todaysOrders.reduce((sum, order) => {
          return sum + (order.total || 0);
        }, 0);

        const revenueYesterday = yesterdaysOrders.reduce((sum, order) => {
          return sum + (order.total || 0);
        }, 0);

        // Count active tables (tables with active orders)
        const activeTables = tables.filter(table => table.status === 'occupied').length;

        // Calculate growth percentage
        const growth = revenueYesterday > 0 
          ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
          : revenueToday > 0 ? 100 : 0;

        setStats({
          totalOrdersToday: todaysOrders.length,
          revenueToday,
          activeTables,
          totalTables: tables.length,
          ordersYesterday: yesterdaysOrders.length,
          revenueYesterday,
          growth
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [restaurant]);

  const handleSeedData = async () => {
    if (!restaurant || !user) return;
    
    setIsSeeding(true);
    try {
      const result = await SeedDataService.seedRestaurantData(restaurant.id, user.id);
      
      if (result.success) {
        toast.success(result.message || 'Sample data loaded successfully!');
        // Refresh the dashboard data
        window.location.reload();
      } else {
        toast.error(result.error || 'Failed to load sample data');
      }
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to load sample data');
    } finally {
      setIsSeeding(false);
    }
  };

  if (!restaurant) return null;

  // Calculate percentage changes
  const getOrdersChange = () => {
    if (!stats || stats.ordersYesterday === 0) return '+0%';
    const change = ((stats.totalOrdersToday - stats.ordersYesterday) / stats.ordersYesterday) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getRevenueChange = () => {
    if (!stats || stats.revenueYesterday === 0) return '+0%';
    const change = ((stats.revenueToday - stats.revenueYesterday) / stats.revenueYesterday) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getTableOccupancy = () => {
    if (!stats || stats.totalTables === 0) return '0%';
    return `${Math.round((stats.activeTables / stats.totalTables) * 100)}%`;
  };

  const dashboardStats = [
    {
      title: 'Total Orders Today',
      value: loading ? '...' : stats?.totalOrdersToday.toString() || '0',
      change: loading ? '...' : getOrdersChange(),
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      isPositive: !loading && stats ? stats.totalOrdersToday >= stats.ordersYesterday : true,
    },
    {
      title: 'Revenue Today',
      value: loading ? '...' : formatCurrency(stats?.revenueToday || 0),
      change: loading ? '...' : getRevenueChange(),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      isPositive: !loading && stats ? stats.revenueToday >= stats.revenueYesterday : true,
    },
    {
      title: 'Active Tables',
      value: loading ? '...' : `${stats?.activeTables || 0}/${stats?.totalTables || 0}`,
      change: loading ? '...' : getTableOccupancy(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isPositive: true,
    },
    {
      title: 'Revenue Growth',
      value: loading ? '...' : `${stats?.growth.toFixed(1) || '0'}%`,
      change: loading ? '...' : 'vs yesterday',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      isPositive: !loading && stats ? stats.growth >= 0 : true,
    },
  ];

  const quickActions = [
    {
      title: 'Manage Tables',
      description: 'View and manage tables',
      icon: Users,
      href: `/${restaurant.slug}/tables`,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Orders Dashboard',
      description: 'View and analyze orders',
      icon: ShoppingBag,
      href: `/${restaurant.slug}/orders`,
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      title: 'Menu Management',
      description: 'Manage menu items & categories',
      icon: ChefHat,
      href: `/${restaurant.slug}/menu`,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Inventory Management',
      description: 'Track stock & inventory',
      icon: Package,
      href: `/${restaurant.slug}/inventory`,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Kitchen Display',
      description: 'View kitchen orders',
      icon: Store,
      href: `/${restaurant.slug}/kitchen`,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Customer Management',
      description: 'Manage customer database',
      icon: Users,
      href: `/${restaurant.slug}/customers`,
      color: 'from-teal-500 to-teal-600',
    },
    {
      title: 'Coupon Dashboard',
      description: 'Manage coupons & promotions',
      icon: Gift,
      href: `/${restaurant.slug}/coupons`,
      color: 'from-pink-500 to-pink-600',
    },
    {
      title: 'Gamification Tools',
      description: 'Spin wheel & customer engagement',
      icon: Grid3X3,
      href: `/${restaurant.slug}/gamification`,
      color: 'from-indigo-500 to-purple-600',
    },
    {
      title: 'Settings',
      description: 'Restaurant settings',
      icon: Settings,
      href: `/${restaurant.slug}/settings`,
      color: 'from-gray-500 to-gray-600',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back! Here's an overview of your restaurant operations.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Your Restaurant URL</div>
              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {window.location.origin}/{restaurant.slug}
              </code>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    </div>
                    <p className={`text-sm mt-1 ${
                      stat.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change} {stat.title !== 'Active Tables' && stat.title !== 'Revenue Growth' ? 'from yesterday' : ''}
                    </p>
                  </div>
                  
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <IconComponent className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <div
                    key={index}
                    className="card card-hover p-6 cursor-pointer group"
                    onClick={() => window.location.href = action.href}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-900">{action.title}</h3>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Restaurant Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Restaurant Information</h2>
            
            <div className="card p-6 space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <div 
                  className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-white mb-3"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Store className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
                <p className="text-sm text-gray-600">{getBusinessTypeDisplayName(restaurant.businessType)}</p>
              </div>
              
              <div className="space-y-3">
                {restaurant.settings.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{restaurant.settings.address}</span>
                  </div>
                )}
                
                {restaurant.settings.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{restaurant.settings.phone}</span>
                  </div>
                )}
                
                {restaurant.settings.email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{restaurant.settings.email}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">
                    Created {new Date(restaurant.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <button 
                  className="w-full btn btn-theme-primary"
                  onClick={() => window.location.href = `/${restaurant.slug}/settings`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Settings
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Message for New Restaurants */}
        <div className="mt-8 card p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Store className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Welcome to TenVerse POS!
              </h3>
              <p className="text-gray-600 mb-4">
                Your restaurant is now set up and ready to go. Start by creating your menu, 
                setting up tables, and adding staff members. Need help getting started?
              </p>
              
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary">
                  Setup Menu
                </button>
                <button className="btn btn-secondary">
                  Add Tables
                </button>
                <button className="btn btn-secondary">
                  Invite Staff
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Load Sample Data Button */}
        <div className="mt-8 card p-6 bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Load Sample Data
              </h3>
              <p className="text-sm text-gray-600">
                Load sample data to test the application
              </p>
            </div>
            <div className="text-right">
              <button
                className="btn btn-theme-primary"
                onClick={handleSeedData}
                disabled={isSeeding}
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                {isSeeding ? 'Loading...' : 'Load Sample Data'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 