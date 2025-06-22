import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { OrderService } from '@/services/orderService';
import { RestaurantService } from '@/services/restaurantService';
import { GamificationIntegrationService } from '@/services/gamificationIntegrationService';
import { formatCurrency, formatTime, formatDate } from '@/lib/utils';
import { Order, Restaurant } from '@/types';
import toast from 'react-hot-toast';
import {
  X,
  Clock,
  CheckCircle,
  Package,
  Star,
  Gift,
  TrendingUp,
  Calendar,
  Phone,
  MapPin,
  Receipt,
  ShoppingBag,
  Heart,
  Award,
  CreditCard,
  RefreshCw,
  User,
  Smartphone,
  Eye,
  Plus,
  ArrowRight,
  Zap,
  Crown,
  Target,
  Trophy,
  Coffee,
  Utensils,
  Percent,
  Home,
  ArrowLeft,
  Ticket,
  Coins,
  Copy
} from 'lucide-react';

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  loyaltyPoints: number;
  favoriteItems: Array<{
    name: string;
    orderCount: number;
    totalSpent: number;
  }>;
  visitFrequency: string;
  lastVisit: Date | null;
  // Gamification data
  spinData: {
    totalSpins: number;
    totalCoupons: number;
    redeemedCoupons: number;
    totalDiscountEarned: number;
    totalDiscountUsed: number;
    availableCoupons: any[];
    spinHistory: any[];
  };
}

export default function UserDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    loyaltyPoints: 0,
    favoriteItems: [],
    visitFrequency: 'New Customer',
    lastVisit: null,
    spinData: {
      totalSpins: 0,
      totalCoupons: 0,
      redeemedCoupons: 0,
      totalDiscountEarned: 0,
      totalDiscountUsed: 0,
      availableCoupons: [] as any[],
      spinHistory: [] as any[]
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'rewards' | 'profile'>('overview');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [selectedSpin, setSelectedSpin] = useState<any>(null);

  useEffect(() => {
    const phone = searchParams.get('phone');
    if (phone) {
      setCustomerPhone(phone);
      loadDashboardData(phone);
    } else {
      toast.error('Phone number required for dashboard access');
      navigate('/');
    }
  }, [slug, searchParams, navigate]);

  const loadDashboardData = async (phone: string) => {
    if (!slug) return;

    try {
      setIsLoading(true);

      // Load restaurant data by slug or ID
      let restaurantResult;
      try {
        // First try by slug
        restaurantResult = await RestaurantService.getRestaurantBySlug(slug);
        
        // If not found and slug looks like an ID (long alphanumeric), try by ID
        if (!restaurantResult.success && slug.length > 15 && /^[a-zA-Z0-9]+$/.test(slug)) {
          console.log('Slug not found, trying as restaurant ID:', slug);
          restaurantResult = await RestaurantService.getRestaurantById(slug);
        }
      } catch (error) {
        console.error('Error loading restaurant:', error);
        throw new Error('Failed to load restaurant information');
      }
      if (restaurantResult.success && restaurantResult.data) {
        setRestaurant(restaurantResult.data);

        // Load customer orders
        const ordersResult = await OrderService.getOrdersForRestaurant(restaurantResult.data.id, 100);
        if (ordersResult.success && ordersResult.data) {
          // Filter orders for this customer based on phone number
          const customerOrders = ordersResult.data.filter(order => 
            order.notes?.includes(phone) ||
            order.notes?.includes('Customer Portal')
          ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setOrders(customerOrders);

          // Calculate customer statistics
          const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);
          const avgOrderValue = customerOrders.length > 0 ? totalSpent / customerOrders.length : 0;

          // Calculate favorite items
          const itemMap = new Map<string, { orderCount: number; totalSpent: number }>();
          customerOrders.forEach(order => {
            order.items.forEach(item => {
              const existing = itemMap.get(item.name);
              if (existing) {
                existing.orderCount += item.quantity;
                existing.totalSpent += item.total;
              } else {
                itemMap.set(item.name, {
                  orderCount: item.quantity,
                  totalSpent: item.total
                });
              }
            });
          });

          const favoriteItems = Array.from(itemMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 5);

          // Calculate visit frequency
          let visitFrequency = 'New Customer';
          if (customerOrders.length >= 10) visitFrequency = 'VIP Customer';
          else if (customerOrders.length >= 5) visitFrequency = 'Regular Customer';
          else if (customerOrders.length >= 2) visitFrequency = 'Returning Customer';

          const lastVisit = customerOrders.length > 0 ? new Date(customerOrders[0].createdAt) : null;
          const loyaltyPoints = Math.floor(totalSpent / 10); // Simple calculation: 1 point per ₹10 spent

          // Load gamification data
          console.log('🎯 Loading gamification data for:', phone, 'at restaurant:', restaurantResult.data.id);
          let spinData = {
            totalSpins: 0,
            totalCoupons: 0,
            redeemedCoupons: 0,
            totalDiscountEarned: 0,
            totalDiscountUsed: 0,
            availableCoupons: [] as any[],
            spinHistory: [] as any[]
          };

          try {
            const gamificationResult = await GamificationIntegrationService.getCustomerGamificationHistory(
              restaurantResult.data.id,
              phone
            );
            console.log('🎯 Gamification result:', gamificationResult);
            
            if (gamificationResult.success && gamificationResult.data) {
              const data = gamificationResult.data;
              if (data.spins || data.coupons) {
                const spins = data.spins || [];
                const coupons = data.coupons || [];
                
                spinData = {
                  totalSpins: spins.length,
                  totalCoupons: coupons.length,
                  redeemedCoupons: coupons.filter((c: any) => c.isRedeemed).length,
                  totalDiscountEarned: coupons.reduce((sum: number, c: any) => 
                    sum + (c.discountValue || 0), 0),
                  totalDiscountUsed: coupons.filter((c: any) => c.isRedeemed)
                    .reduce((sum: number, c: any) => sum + (c.discountValue || 0), 0),
                  availableCoupons: (data.coupons || []).filter((c: any) => !c.isRedeemed && !c.isExpired) as any[],
                  spinHistory: (data.spins || []) as any[]
                };
              }
            }
          } catch (error) {
            console.warn('Failed to load gamification data:', error);
          }

          setStats({
            totalOrders: customerOrders.length,
            totalSpent,
            averageOrderValue: avgOrderValue,
            loyaltyPoints,
            favoriteItems,
            visitFrequency,
            lastVisit,
            spinData
          });
        }
      } else {
        toast.error('Restaurant not found');
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'placed': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'preparing': return <Utensils className="w-4 h-4 text-orange-600" />;
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'completed': return <Package className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'placed': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCustomerTierInfo = () => {
    if (stats.totalOrders >= 10) {
      return { tier: 'VIP', color: 'from-purple-500 to-pink-500', icon: Crown, benefits: 'Priority support, exclusive offers' };
    } else if (stats.totalOrders >= 5) {
      return { tier: 'Gold', color: 'from-yellow-500 to-orange-500', icon: Trophy, benefits: 'Special discounts, birthday treats' };
    } else if (stats.totalOrders >= 2) {
      return { tier: 'Silver', color: 'from-gray-400 to-gray-500', icon: Award, benefits: 'Loyalty points, member offers' };
    }
    return { tier: 'Bronze', color: 'from-orange-400 to-red-500', icon: Target, benefits: 'Welcome bonus, first order discount' };
  };

  const customerTier = getCustomerTierInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Restaurant Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden mb-4 sm:mb-8">
          <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-4 sm:p-8 text-white">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 mt-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-3xl font-bold mb-2">Welcome to Your Dashboard!</h1>
                <p className="text-blue-100 mb-4 text-sm sm:text-base">Your personal portal at {restaurant.name}</p>
                
                {/* Customer Tier Badge */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className={`inline-flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r ${customerTier.color} rounded-full text-white font-medium text-sm`}>
                    <customerTier.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{customerTier.tier} Member</span>
                  </div>
                  <div className="text-xs sm:text-sm text-blue-100">
                    {customerTier.benefits}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mt-6 sm:mt-8">
              <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold">{stats.totalOrders}</div>
                <div className="text-xs sm:text-sm text-blue-100">Total Orders</div>
              </div>
              <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
                <div className="text-xs sm:text-sm text-blue-100">Total Spent</div>
              </div>
              <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold">{stats.loyaltyPoints}</div>
                <div className="text-xs sm:text-sm text-blue-100">Loyalty Points</div>
              </div>
              <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold">{stats.spinData.totalSpins}</div>
                <div className="text-xs sm:text-sm text-blue-100">Spin Rewards</div>
              </div>
              <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-center">
                <div className="text-lg sm:text-2xl font-bold">{stats.spinData.availableCoupons.length}</div>
                <div className="text-xs sm:text-sm text-blue-100">Active Coupons</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg mb-4 sm:mb-8 p-1 sm:p-2">
          <div className="flex space-x-1">
            {[
              { id: 'overview', label: 'Overview', icon: Smartphone },
              { id: 'orders', label: 'Order History', icon: ShoppingBag },
              { id: 'rewards', label: 'Rewards', icon: Gift },
              { id: 'profile', label: 'Profile', icon: User },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-all flex-1 justify-center text-xs sm:text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Recent Orders */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Recent Orders</h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl">
                    <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Orders Yet</h4>
                    <p className="text-gray-600 mb-6">Start exploring our delicious menu!</p>
                    <button
                      onClick={() => navigate(`/${restaurant.slug}`)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      Browse Menu
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {orders.slice(0, 3).map((order) => (
                      <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-gray-900">#{order.orderNumber}</span>
                            <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(order.status)}`}>
                              {getOrderStatusIcon(order.status)}
                              <span className="capitalize">{order.status}</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(order.total)}</div>
                            <div className="text-sm text-gray-500">{formatDate(order.createdAt)}</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {order.items.slice(0, 2).map(item => `${item.quantity}x ${item.name}`).join(', ')}
                          {order.items.length > 2 && ` +${order.items.length - 2} more`}
                        </div>
                        <button
                          onClick={() => navigate(`/${restaurant.slug}/order-status?order=${order.id}&phone=${customerPhone}`)}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Spin Wheel Activity */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <span>🎯 Spin Wheel Activity</span>
                  </h3>
                  <button
                    onClick={() => navigate(`/${restaurant.slug}/spin-wheel?phone=${customerPhone}`)}
                    className="text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                  >
                    <span>Try Spin Wheel</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {stats.spinData.totalSpins > 0 ? (
                  <div className="space-y-6">
                    {/* Spin Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Target className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-purple-900">{stats.spinData.totalSpins}</div>
                            <div className="text-sm text-purple-600">Total Spins</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Ticket className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-900">{stats.spinData.availableCoupons.length}</div>
                            <div className="text-sm text-green-600">Active Coupons</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                            <Coins className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-yellow-900">{formatCurrency(stats.spinData.totalDiscountEarned)}</div>
                            <div className="text-sm text-yellow-600">Total Savings</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Spin History */}
                    {stats.spinData.spinHistory.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Recent Spins</h4>
                        <div className="space-y-3">
                          {stats.spinData.spinHistory.slice(0, 3).map((spin: any, index: number) => (
                            <button
                              key={index}
                              onClick={() => setSelectedSpin(spin)}
                              className="w-full bg-gray-50 hover:bg-gray-100 rounded-lg p-4 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <Target className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-gray-900">{spin.reward}</div>
                                  <div className="text-sm text-gray-500">{formatDate(spin.timestamp)}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-medium ${spin.isRedeemed ? 'text-green-600' : 'text-orange-600'}`}>
                                  {spin.isRedeemed ? 'Used' : 'Available'}
                                </div>
                                <Eye className="w-4 h-4 text-gray-400 mt-1" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Coupons Preview */}
                    {stats.spinData.availableCoupons.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Active Coupons</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {stats.spinData.availableCoupons.slice(0, 2).map((coupon: any, index: number) => (
                            <div key={index} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-green-900">{coupon.code}</div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(coupon.code);
                                    toast.success('Coupon code copied!');
                                  }}
                                  className="text-green-600 hover:text-green-700 text-sm"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="text-sm text-green-700 mb-1">{coupon.description}</div>
                              <div className="text-xs text-green-600">
                                Expires: {formatDate(coupon.expiryDate)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200">
                    <Target className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-purple-900 mb-2">No Spin Activity Yet</h4>
                    <p className="text-purple-600 mb-6">Try our exciting spin wheel game to win amazing rewards!</p>
                    <button
                      onClick={() => navigate(`/${restaurant.slug}/spin-wheel?phone=${customerPhone}`)}
                      className="bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition-colors font-medium"
                    >
                      Try Spin Wheel Game
                    </button>
                  </div>
                )}
              </div>

              {/* Favorite Items */}
              {stats.favoriteItems.length > 0 && (
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Your Favorites</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {stats.favoriteItems.map((item, index) => (
                      <div key={index} className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <Heart className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-600">Ordered {item.orderCount} times</p>
                          </div>
                        </div>
                        <div className="text-sm text-orange-700">
                          Total spent: {formatCurrency(item.totalSpent)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <button
                    onClick={() => navigate(`/${restaurant.slug}`)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 sm:p-6 rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all text-left"
                  >
                    <Plus className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" />
                    <h4 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Place New Order</h4>
                    <p className="text-xs sm:text-sm text-blue-100">Browse menu and order food</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('rewards')}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 sm:p-6 rounded-lg sm:rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all text-left"
                  >
                    <Gift className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" />
                    <h4 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">View Rewards</h4>
                    <p className="text-xs sm:text-sm text-purple-100">Check loyalty points & offers</p>
                  </button>

                  <button
                    onClick={() => setActiveTab('profile')}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 sm:p-6 rounded-lg sm:rounded-xl hover:from-green-600 hover:to-green-700 transition-all text-left sm:col-span-2 lg:col-span-1"
                  >
                    <User className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" />
                    <h4 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">View Profile</h4>
                    <p className="text-xs sm:text-sm text-green-100">Manage your account</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Order History</h3>
                <button
                  onClick={() => loadDashboardData(customerPhone)}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Refresh</span>
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-20 h-20 text-gray-400 mx-auto mb-6" />
                  <h4 className="text-xl font-medium text-gray-900 mb-4">No Orders Found</h4>
                  <p className="text-gray-600 mb-8">You haven't placed any orders yet. Start exploring our menu!</p>
                  <button
                    onClick={() => navigate(`/${restaurant.slug}`)}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Browse Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <span className="text-lg font-semibold text-gray-900">#{order.orderNumber}</span>
                          <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(order.status)}`}>
                            {getOrderStatusIcon(order.status)}
                            <span className="capitalize">{order.status}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">{formatCurrency(order.total)}</div>
                          <div className="text-sm text-gray-500">{formatDate(order.createdAt)} • {formatTime(order.createdAt)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Order Items ({order.items.length})</h4>
                          <div className="space-y-1">
                            {order.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-gray-600">{item.quantity}x {item.name}</span>
                                <span className="text-gray-900 font-medium">{formatCurrency(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Order Summary</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tax:</span>
                              <span className="text-gray-900">{formatCurrency(order.tax)}</span>
                            </div>
                            <div className="flex justify-between font-medium border-t pt-1">
                              <span className="text-gray-900">Total:</span>
                              <span className="text-gray-900">{formatCurrency(order.total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-sm text-gray-500">
                          Order placed {formatDate(order.createdAt)}
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => navigate(`/${restaurant.slug}/order-status?order=${order.id}&phone=${customerPhone}`)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Track Order</span>
                          </button>
                          {order.status === 'completed' && (
                            <button 
                              onClick={() => navigate(`/${restaurant.slug}`)}
                              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
                            >
                              <Receipt className="w-4 h-4" />
                              <span>Reorder</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-6 sm:space-y-8">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Loyalty & Rewards</h3>
                
                {/* Loyalty Points Card */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl sm:rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold mb-2">{stats.loyaltyPoints} Points</h4>
                      <p className="text-purple-100 text-sm sm:text-base">Available to redeem</p>
                    </div>
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <Star className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-purple-300">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-100">Next reward at 1000 points</span>
                      <span className="text-white font-medium">{Math.max(0, 1000 - stats.loyaltyPoints)} points to go</span>
                    </div>
                    <div className="w-full bg-purple-400 rounded-full h-2 mt-2">
                      <div 
                        className="bg-white h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (stats.loyaltyPoints / 1000) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Available Rewards */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Available Rewards</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-gray-900">Free Coffee</h5>
                        <Coffee className="w-6 h-6 text-amber-600" />
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Redeem for any coffee drink</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-purple-600">500 Points</span>
                        <button 
                          disabled={stats.loyaltyPoints < 500}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {stats.loyaltyPoints >= 500 ? 'Redeem' : 'Not enough points'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-gray-900">10% Discount</h5>
                        <Percent className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-sm text-gray-600 mb-4">10% off your next order</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-purple-600">750 Points</span>
                        <button 
                          disabled={stats.loyaltyPoints < 750}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {stats.loyaltyPoints >= 750 ? 'Redeem' : 'Not enough points'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coupon Status Section */}
                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-gray-900 mb-6">Your Coupons</h4>
                  
                  {/* Coupon Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-lg font-semibold text-green-900">Available Coupons</h5>
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <Ticket className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-green-600 mb-2">
                        {stats.spinData.availableCoupons.length}
                      </div>
                      <p className="text-green-700 text-sm">Ready to use on your next order</p>
                                             <div className="mt-4 text-xs text-green-600">
                         Total value: {(() => {
                           const fixedValue = stats.spinData.availableCoupons.reduce((sum, coupon) => {
                             if (coupon.discountType === 'fixed' && coupon.discountValue > 0) {
                               return sum + coupon.discountValue;
                             }
                             return sum;
                           }, 0);
                           const percentageCoupons = stats.spinData.availableCoupons.filter(c => 
                             c.discountType === 'percentage' && c.discountValue > 0
                           ).length;
                           
                           if (fixedValue > 0 && percentageCoupons > 0) {
                             return `${formatCurrency(fixedValue)} + ${percentageCoupons} % offers`;
                           } else if (fixedValue > 0) {
                             return formatCurrency(fixedValue);
                           } else if (percentageCoupons > 0) {
                             return `${percentageCoupons} percentage offers`;
                           } else {
                             return 'Special rewards';
                           }
                         })()}
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-lg font-semibold text-gray-900">Used Coupons</h5>
                        <div className="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-600 mb-2">
                        {stats.spinData.redeemedCoupons}
                      </div>
                      <p className="text-gray-700 text-sm">Successfully redeemed</p>
                      <div className="mt-4 text-xs text-gray-600">
                        Total saved: {formatCurrency(stats.spinData.totalDiscountUsed)}
                      </div>
                    </div>
                  </div>

                  {/* Available Coupons List */}
                  {stats.spinData.availableCoupons.length > 0 && (
                    <div className="mb-6">
                      <h5 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                        <Ticket className="w-5 h-5 text-green-600 mr-2" />
                        Coupons to Redeem ({stats.spinData.availableCoupons.length})
                      </h5>
                      <div className="space-y-3">
                        {stats.spinData.availableCoupons.slice(0, 5).map((coupon, index) => (
                          <div key={index} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                    <Gift className="w-4 h-4 text-white" />
                                  </div>
                                                                     <div>
                                     <h6 className="font-semibold text-green-900">
                                       {coupon.resultMessage || coupon.reward || coupon.rewardText || coupon.label || 'Spin Reward'}
                                     </h6>
                                     <p className="text-xs text-green-700">
                                       {coupon.discountValue && coupon.discountValue > 0 ? (
                                         coupon.discountType === 'percentage' 
                                           ? `${coupon.discountValue}% off` 
                                           : `${formatCurrency(coupon.discountValue)} off`
                                       ) : coupon.rewardDescription || coupon.description || 'Special offer'}
                                     </p>
                                   </div>
                                </div>
                                
                                {/* Enhanced Coupon Code Display */}
                                <div className="mt-3 p-3 bg-white border-2 border-green-300 rounded-lg">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-green-700 mb-1">COUPON CODE</div>
                                      <div className="text-base sm:text-lg font-bold font-mono text-green-900 tracking-wider break-all">
                                        {coupon.couponCode || coupon.code || coupon.id || `SPIN${Date.now().toString().slice(-6)}`}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const codeToShow = coupon.couponCode || coupon.code || coupon.id || `SPIN${Date.now().toString().slice(-6)}`;
                                        navigator.clipboard.writeText(codeToShow);
                                        toast.success('Coupon code copied!');
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center space-x-1 sm:space-x-2 transition-colors w-full sm:w-auto justify-center"
                                    >
                                      <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span>Copy</span>
                                    </button>
                                  </div>
                                  <div className="mt-2 text-xs text-green-600">
                                    📱 Show this code to restaurant staff
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                  <Coins className="w-3 h-3" />
                                  <span>Ready</span>
                                </div>
                                {coupon.expiryDate && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Expires: {formatDate(coupon.expiryDate)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {stats.spinData.availableCoupons.length > 5 && (
                          <div className="text-center">
                            <p className="text-sm text-gray-600">
                              +{stats.spinData.availableCoupons.length - 5} more coupons available
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Redeemed Coupons List */}
                  {(stats.spinData.redeemedCoupons > 0 || stats.spinData.spinHistory.filter(spin => spin.isRedeemed).length > 0) && (
                    <div className="mb-6">
                                              <h5 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          Redeemed Coupons ({Math.max(stats.spinData.redeemedCoupons, stats.spinData.spinHistory.filter(spin => spin.isRedeemed).length)})
                        </h5>
                        <div className="space-y-3">
                          {/* Show actual redeemed spins if available */}
                          {stats.spinData.spinHistory.filter(spin => spin.isRedeemed).length > 0 ? (
                            stats.spinData.spinHistory
                              .filter(spin => spin.isRedeemed)
                              .slice(0, 5)
                              .map((spin, index) => (
                          <div key={index} className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <h6 className="font-semibold text-gray-900">
                                      {spin.resultMessage || spin.reward || 'Redeemed Reward'}
                                    </h6>
                                    <p className="text-xs text-gray-700">
                                      Won on: {formatDate(spin.spinDate)} • {formatTime(spin.spinDate)}
                                    </p>
                                    {spin.redeemedDate && (
                                      <p className="text-xs text-green-700 font-medium">
                                        Redeemed on: {formatDate(spin.redeemedDate)} • {formatTime(spin.redeemedDate)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {spin.couponCode && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <span className="text-xs text-gray-600">Code:</span>
                                    <span className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                      {spin.couponCode}
                                    </span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(spin.couponCode);
                                        toast.success('Coupon code copied!');
                                      }}
                                      className="text-gray-600 hover:text-gray-700 text-xs flex items-center space-x-1"
                                    >
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Used</span>
                                </div>
                                {spin.discountValue && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    Saved: {spin.discountType === 'percentage' 
                                      ? `${spin.discountValue}%` 
                                      : formatCurrency(spin.discountValue)}
                                  </div>
                                )}
                              </div>
                            </div>
                                                      </div>
                          ))
                          ) : (
                            /* Show placeholder cards when we know there are redeemed coupons but no detailed data */
                            Array.from({ length: Math.min(stats.spinData.redeemedCoupons, 3) }, (_, index) => (
                              <div key={`placeholder-${index}`} className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                      </div>
                                      <div>
                                        <h6 className="font-semibold text-gray-900">
                                          Spin Reward #{index + 1}
                                        </h6>
                                        <p className="text-xs text-gray-700">
                                          Successfully redeemed coupon
                                        </p>
                                        <p className="text-xs text-green-700 font-medium">
                                          Used for discount on order
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                                      Coupon details not available
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                      <CheckCircle className="w-3 h-3" />
                                      <span>Used</span>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      Part of ₹{stats.spinData.totalDiscountUsed.toFixed(2)} saved
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                          {stats.spinData.redeemedCoupons > 5 && (
                            <div className="text-center">
                              <p className="text-sm text-gray-600">
                                +{stats.spinData.redeemedCoupons - (stats.spinData.spinHistory.filter(spin => spin.isRedeemed).length > 0 ? 5 : 3)} more redeemed coupons
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Spin History Summary */}
                  {stats.spinData.spinHistory.length > 0 && (
                    <div>
                      <h5 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 text-purple-600 mr-2" />
                        Recent Spin Activity
                      </h5>
                      <div className="space-y-3">
                        {stats.spinData.spinHistory.slice(0, 3).map((spin, index) => {
                          const isWinning = !spin.resultMessage?.toLowerCase().includes('luck');
                          return (
                            <div key={index} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isWinning ? 'bg-green-100' : 'bg-gray-100'
                                  }`}>
                                    {isWinning ? (
                                      <Gift className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <X className="w-4 h-4 text-gray-600" />
                                    )}
                                  </div>
                                  <div>
                                    <h6 className="font-medium text-gray-900">
                                      {spin.resultMessage || 'Spin Result'}
                                    </h6>
                                    <p className="text-xs text-gray-600">
                                      {formatDate(spin.spinDate)} • {formatTime(spin.spinDate)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    spin.isRedeemed 
                                      ? 'bg-gray-100 text-gray-800' 
                                      : isWinning 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                  }`}>
                                    <span>
                                      {spin.isRedeemed ? 'Used' : isWinning ? 'Available' : 'No Prize'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {stats.spinData.spinHistory.length > 3 && (
                          <div className="text-center">
                            <button 
                              onClick={() => setActiveTab('overview')}
                              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                            >
                              View all {stats.spinData.spinHistory.length} spins →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Coupons State */}
                  {stats.spinData.availableCoupons.length === 0 && stats.spinData.totalCoupons === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl">
                      <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Coupons Yet</h4>
                      <p className="text-gray-600 mb-6">Start spinning the wheel to earn coupons and rewards!</p>
                      <button
                        onClick={() => navigate(`/${restaurant.slug}/spin-wheel`)}
                        className="bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition-colors font-medium"
                      >
                        Try Spin Wheel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 sm:space-y-8">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-6">Profile Information</h3>
                
                <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-4 sm:mb-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-xl sm:text-2xl font-bold">
                      C
                    </div>
                    <div className="text-center sm:text-left">
                      <h4 className="text-lg sm:text-xl font-semibold text-gray-900">Customer</h4>
                      <p className="text-gray-600 flex items-center justify-center sm:justify-start space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>{customerPhone}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {stats.visitFrequency}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.totalOrders}</div>
                      <div className="text-xs sm:text-sm text-gray-600">Total Orders</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg sm:rounded-xl">
                      <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(stats.totalSpent)}</div>
                      <div className="text-xs sm:text-sm text-gray-600">Total Spent</div>
                    </div>
                    <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg sm:rounded-xl sm:col-span-2 lg:col-span-1">
                      <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats.visitFrequency}</div>
                      <div className="text-xs sm:text-sm text-gray-600">Customer Status</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mt-4 sm:mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
              Last updated: {formatTime(new Date())}
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto order-1 sm:order-2">
              <button
                onClick={() => navigate(`/${restaurant.slug}`)}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Place New Order</span>
              </button>
              <button
                onClick={() => navigate(`/${restaurant.slug}`)}
                className="bg-gray-200 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl hover:bg-gray-300 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
              >
                <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Back to Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spin Details Modal */}
      {selectedSpin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl sm:rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Spin Details</h2>
                <button
                  onClick={() => setSelectedSpin(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {/* Spin Result */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedSpin.reward}</h3>
                <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium ${
                  selectedSpin.isRedeemed ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${selectedSpin.isRedeemed ? 'bg-green-600' : 'bg-orange-600'}`}></div>
                  <span>{selectedSpin.isRedeemed ? 'Used' : 'Available'}</span>
                </div>
              </div>

              {/* Spin Information */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Spin Date</span>
                    <span className="text-sm text-gray-900">{formatDate(selectedSpin.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Spin Time</span>
                    <span className="text-sm text-gray-900">{formatTime(selectedSpin.timestamp)}</span>
                  </div>
                  {selectedSpin.couponCode && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Coupon Code</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono bg-gray-200 px-2 py-1 rounded">{selectedSpin.couponCode}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedSpin.couponCode);
                            toast.success('Coupon code copied!');
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedSpin.discountValue && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Discount Value</span>
                      <span className="text-sm text-green-600 font-medium">
                        {selectedSpin.discountType === 'percentage' ? `${selectedSpin.discountValue}%` : formatCurrency(selectedSpin.discountValue)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Redemption Info */}
                {selectedSpin.isRedeemed ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Reward Used</span>
                    </div>
                    {selectedSpin.redeemedAt && (
                      <div className="text-sm text-green-700">
                        Used on {formatDate(selectedSpin.redeemedAt)} at {formatTime(selectedSpin.redeemedAt)}
                      </div>
                    )}
                    {selectedSpin.orderId && (
                      <div className="text-sm text-green-700">
                        Order: #{selectedSpin.orderId}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-900">Ready to Use</span>
                    </div>
                    <div className="text-sm text-orange-700 mb-3">
                      This reward is available for your next order
                    </div>
                    {selectedSpin.expiryDate && (
                      <div className="text-sm text-orange-700">
                        Expires: {formatDate(selectedSpin.expiryDate)}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  {!selectedSpin.isRedeemed && (
                    <button
                      onClick={() => {
                        setSelectedSpin(null);
                        navigate(`/${restaurant.slug}`);
                      }}
                      className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl hover:bg-purple-700 transition-colors font-medium"
                    >
                      Use Now
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSpin(null)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 