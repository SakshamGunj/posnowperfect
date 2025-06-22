import { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
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
  Grid3X3,
  Receipt,
  ShoppingCart,
  Smartphone
} from 'lucide-react';
import { formatCurrency, getBusinessTypeDisplayName } from '@/lib/utils';
import { OrderService } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { SeedDataService } from '@/services/seedDataService';
import { RevenueService } from '@/services/revenueService';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalOrdersToday: number;
  revenueToday: number;
  actualRevenueToday: number;
  creditAmountToday: number;
  activeTables: number;
  totalTables: number;
  ordersYesterday: number;
  revenueYesterday: number;
  actualRevenueYesterday: number;
  growth: number;
  actualGrowth: number;
}

export default function RestaurantDashboard() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const { canAccess } = useEmployeePermissions();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrdersToday: 0,
    revenueToday: 0,
    actualRevenueToday: 0,
    creditAmountToday: 0,
    activeTables: 0,
    totalTables: 0,
    ordersYesterday: 0,
    revenueYesterday: 0,
    actualRevenueYesterday: 0,
    growth: 0,
    actualGrowth: 0
  });
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

        // Calculate revenue (both total and actual)
        const revenueToday = todaysOrders.reduce((sum, order) => {
          return sum + (order.total || 0);
        }, 0);

        const revenueYesterday = yesterdaysOrders.reduce((sum, order) => {
          return sum + (order.total || 0);
        }, 0);

        // Calculate actual revenue accounting for credits
        let todayRevenueData = { actualRevenue: 0, totalCreditAmount: 0 };
        let yesterdayRevenueData = { actualRevenue: 0, totalCreditAmount: 0 };
        
        try {
          todayRevenueData = await RevenueService.calculateOrdersRevenue(todaysOrders, restaurant.id);
          yesterdayRevenueData = await RevenueService.calculateOrdersRevenue(yesterdaysOrders, restaurant.id);
        } catch (error) {
          console.error('Error calculating revenue data:', error);
          // Use fallback values
          todayRevenueData = { actualRevenue: revenueToday, totalCreditAmount: 0 };
          yesterdayRevenueData = { actualRevenue: revenueYesterday, totalCreditAmount: 0 };
        }

        // Count active tables (tables with active orders)
        const activeTables = tables.filter(table => table.status === 'occupied').length;

        // Calculate growth percentage (both total and actual)
        const growth = revenueYesterday > 0 
          ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
          : revenueToday > 0 ? 100 : 0;

        const actualGrowth = yesterdayRevenueData.actualRevenue > 0 
          ? ((todayRevenueData.actualRevenue - yesterdayRevenueData.actualRevenue) / yesterdayRevenueData.actualRevenue) * 100
          : todayRevenueData.actualRevenue > 0 ? 100 : 0;

        setStats({
          totalOrdersToday: todaysOrders.length,
          revenueToday: revenueToday,
          actualRevenueToday: todayRevenueData.actualRevenue,
          creditAmountToday: todayRevenueData.totalCreditAmount,
          activeTables: activeTables,
          totalTables: tables.length,
          ordersYesterday: yesterdaysOrders.length,
          revenueYesterday: revenueYesterday,
          actualRevenueYesterday: yesterdayRevenueData.actualRevenue,
          growth: growth,
          actualGrowth: actualGrowth
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
    if (!stats || (stats.ordersYesterday ?? 0) === 0) return '+0%';
    const change = (((stats.totalOrdersToday ?? 0) - (stats.ordersYesterday ?? 0)) / (stats.ordersYesterday ?? 1)) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getRevenueChange = () => {
    if (!stats || (stats.revenueYesterday ?? 0) === 0) return '+0%';
    const change = (((stats.revenueToday ?? 0) - (stats.revenueYesterday ?? 0)) / (stats.revenueYesterday ?? 1)) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getActualRevenueChange = () => {
    if (!stats || (stats.actualRevenueYesterday ?? 0) === 0) return '+0%';
    const change = (((stats.actualRevenueToday ?? 0) - (stats.actualRevenueYesterday ?? 0)) / (stats.actualRevenueYesterday ?? 1)) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getTableOccupancy = () => {
    if (!stats || (stats.totalTables ?? 0) === 0) return '0%';
    return `${Math.round(((stats.activeTables ?? 0) / (stats.totalTables ?? 1)) * 100)}%`;
  };

  const dashboardStats = [
    {
      title: 'Total Orders Today',
      value: loading ? '...' : (stats?.totalOrdersToday ?? 0).toString(),
      change: loading ? '...' : getOrdersChange(),
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      isPositive: !loading && stats ? (stats.totalOrdersToday ?? 0) >= (stats.ordersYesterday ?? 0) : true,
    },
    {
      title: 'Actual Revenue Today',
      value: loading ? '...' : formatCurrency(stats?.actualRevenueToday ?? 0),
      change: loading ? '...' : getActualRevenueChange(),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      isPositive: !loading && stats ? (stats.actualRevenueToday ?? 0) >= (stats.actualRevenueYesterday ?? 0) : true,
    },
    {
      title: 'Pending Credits',
      value: loading ? '...' : formatCurrency(stats?.creditAmountToday ?? 0),
      change: loading ? '...' : 'to collect',
      icon: Receipt,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      isPositive: false,
    },
    {
      title: 'Active Tables',
      value: loading ? '...' : `${stats?.activeTables ?? 0}/${stats?.totalTables ?? 0}`,
      change: loading ? '...' : getTableOccupancy(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isPositive: true,
    },
    {
      title: 'Revenue Growth',
      value: loading ? '...' : `${(stats?.growth ?? 0).toFixed(1)}%`,
      change: loading ? '...' : 'vs yesterday',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      isPositive: !loading && stats ? (stats.growth ?? 0) >= 0 : true,
    },
  ];

  const allQuickActions = [
    {
      title: 'Manage Tables',
      description: 'View and manage tables',
      icon: Users,
      href: `/${restaurant.slug}/tables`,
      color: 'from-blue-500 to-blue-600',
      moduleId: 'tables',
    },
    {
      title: 'Orders Dashboard',
      description: 'View and analyze orders',
      icon: ShoppingBag,
      href: `/${restaurant.slug}/orders`,
      color: 'from-indigo-500 to-indigo-600',
      moduleId: 'orders',
    },
    {
      title: 'Menu Management',
      description: 'Manage menu items & categories',
      icon: ChefHat,
      href: `/${restaurant.slug}/menu`,
      color: 'from-orange-500 to-orange-600',
      moduleId: 'menu',
    },
    {
      title: 'Inventory Management',
      description: 'Track stock & inventory',
      icon: Package,
      href: `/${restaurant.slug}/inventory`,
      color: 'from-green-500 to-green-600',
      moduleId: 'inventory',
    },
    {
      title: 'Kitchen Display',
      description: 'View kitchen orders',
      icon: Store,
      href: `/${restaurant.slug}/kitchen`,
      color: 'from-purple-500 to-purple-600',
      moduleId: 'kitchen',
    },
    {
      title: 'Customer Portal',
      description: 'Configure menu portal & QR codes',
      icon: Smartphone,
      href: `/${restaurant.slug}/customer-portal`,
      color: 'from-blue-500 to-indigo-600',
      moduleId: 'customer-portal',
    },
    {
      title: 'Customer Management',
      description: 'Manage customer database',
      icon: Users,
      href: `/${restaurant.slug}/customers`,
      color: 'from-teal-500 to-teal-600',
      moduleId: 'customers',
    },
    {
      title: 'Credit Management',
      description: 'Manage customer credits & payments',
      icon: Receipt,
      href: `/${restaurant.slug}/credits`,
      color: 'from-red-500 to-red-600',
      moduleId: 'credits',
    },
    {
      title: 'Coupon Dashboard',
      description: 'Manage coupons & promotions',
      icon: Gift,
      href: `/${restaurant.slug}/coupons`,
      color: 'from-pink-500 to-pink-600',
      moduleId: 'coupons',
    },
    {
      title: 'Gamification Tools',
      description: 'Spin wheel & customer engagement',
      icon: Grid3X3,
      href: `/${restaurant.slug}/gamification`,
      color: 'from-indigo-500 to-purple-600',
      moduleId: 'gamification',
    },
    {
      title: 'Employee Management',
      description: 'Manage staff & permissions',
      icon: Users,
      href: `/${restaurant.slug}/employees`,
      color: 'from-blue-500 to-purple-600',
      moduleId: 'employees',
    },
    {
      title: 'Marketplace',
      description: 'Order bulk supplies & wholesale',
      icon: ShoppingCart,
      href: `/${restaurant.slug}/marketplace`,
      color: 'from-emerald-500 to-emerald-600',
      moduleId: 'marketplace',
    },
    {
      title: 'Settings',
      description: 'Restaurant settings',
      icon: Settings,
      href: `/${restaurant.slug}/settings`,
      color: 'from-gray-500 to-gray-600',
      moduleId: 'settings',
    },
  ];

  // Filter quick actions based on permissions
  const quickActions = allQuickActions.filter(action => canAccess(action.moduleId));

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Welcome back! Here's an overview of your restaurant operations.
              </p>
            </div>
            <div className="text-left lg:text-right">
              <div className="text-xs sm:text-sm text-gray-500">Your Restaurant URL</div>
              <code className="text-xs sm:text-sm font-mono bg-gray-100 px-2 py-1 rounded break-all">
                {window.location.origin}/{restaurant.slug}
              </code>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {dashboardStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="card p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                      {loading && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-gray-400 flex-shrink-0" />}
                    </div>
                    <p className={`text-xs sm:text-sm mt-1 ${
                      stat.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change} {stat.title !== 'Active Tables' && stat.title !== 'Revenue Growth' ? 'from yesterday' : ''}
                    </p>
                  </div>
                  
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Quick Actions</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <div
                    key={index}
                    className="card card-hover p-4 sm:p-6 cursor-pointer group"
                    onClick={() => window.location.href = action.href}
                  >
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                        <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{action.title}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{action.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Restaurant Info */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Restaurant Information</h2>
            
            <div className="card p-4 sm:p-6 space-y-4">
              <div className="text-center pb-4 border-b border-gray-200">
                <div 
                  className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-2xl flex items-center justify-center text-white mb-3"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Store className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{restaurant.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{getBusinessTypeDisplayName(restaurant.businessType)}</p>
              </div>
              
              <div className="space-y-3">
                {restaurant.settings.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600 break-words">{restaurant.settings.address}</span>
                  </div>
                )}
                
                {restaurant.settings.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">{restaurant.settings.phone}</span>
                  </div>
                )}
                
                {restaurant.settings.email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600 break-all">{restaurant.settings.email}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-600">
                    Created {new Date(restaurant.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <button 
                  className="w-full btn btn-theme-primary text-sm"
                  onClick={() => window.location.href = `/${restaurant.slug}/settings`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 