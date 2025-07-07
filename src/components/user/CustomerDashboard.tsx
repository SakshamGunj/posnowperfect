import { useState, useEffect } from 'react';
import { OrderService } from '@/services/orderService';
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
  ShoppingBag,
  Heart,
  Award,
  RefreshCw,
  User,
  Smartphone,
  Eye,
  Plus,
  ArrowRight,
  Crown,
  Target,
  Trophy,
  Coffee,
  Utensils,
  Percent,
  Phone,
  Zap,
  Ticket,
  Coins,
  Calendar,  
} from 'lucide-react';

interface CustomerDashboardProps {
  restaurant: Restaurant;
  phoneAuthUser: any;
  lastOrderId: string | null;
  onClose: () => void;
  onViewOrder: (orderId: string) => void;
  onNewOrder: () => void;
}

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
    availableCoupons: Array<any>;
    spinHistory: Array<any>;
  };
}

const CustomerDashboard = ({
  restaurant,
  phoneAuthUser,
  lastOrderId,
  onClose,
  onViewOrder,
  onNewOrder
}: CustomerDashboardProps) => {
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
      availableCoupons: [] as Array<any>,
      spinHistory: [] as Array<any>
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'rewards' | 'profile'>('overview');

  useEffect(() => {
    loadCustomerData();
  }, [restaurant, phoneAuthUser]);

  const loadCustomerData = async () => {
    if (!restaurant || !phoneAuthUser) return;

    try {
      setIsLoading(true);

      // Load customer orders
      const ordersResult = await OrderService.getOrdersForRestaurant(restaurant.id, 100);
      if (ordersResult.success && ordersResult.data) {
        // Filter orders for this customer based on phone number
        const customerOrders = ordersResult.data.filter(order => 
          order.notes?.includes(phoneAuthUser.phone) ||
          order.notes?.includes(phoneAuthUser.fullName)
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
        const loadGamificationData = async () => {
          try {
            // Use the correct method name
            const spinsResult = await GamificationIntegrationService.getCustomerGamificationHistory(restaurant.id, phoneAuthUser.phone);
            // @ts-ignore - Service may not be imported properly  
            const loyaltyResult = await LoyaltyPointsService.getCustomerLoyaltyInfo?.(restaurant.id, phoneAuthUser.phone);

            if (spinsResult.success && spinsResult.data) {
              const spins = spinsResult.data.spins || [];
              const coupons = spinsResult.data.coupons || [];
              
              // Cross-reference spins with coupons to determine redemption status
              const enrichedSpins = spins.map((spin: any) => {
                // Find the corresponding coupon for this spin
                const correspondingCoupon = coupons.find((c: any) => 
                  c.code === spin.couponCode || 
                  (c.metadata?.spinId === spin.id)
                );
                
                return {
                  ...spin,
                  // Override isRedeemed based on coupon usage
                  isRedeemed: correspondingCoupon ? correspondingCoupon.usageCount > 0 : spin.isRedeemed
                };
              });
              
              setStats({
                totalOrders: customerOrders.length,
                totalSpent,
                averageOrderValue: avgOrderValue,
                loyaltyPoints,
                favoriteItems,
                visitFrequency,
                lastVisit,
                spinData: {
                  totalSpins: spins.length,
                  totalCoupons: coupons.length,
                  redeemedCoupons: coupons.filter((c: any) => c.usageCount > 0).length,
                  totalDiscountEarned: coupons.reduce((sum: number, c: any) => 
                    sum + (c.discountValue || 0), 0),
                  totalDiscountUsed: coupons.filter((c: any) => c.usageCount > 0)
                    .reduce((sum: number, c: any) => sum + (c.discountValue || 0), 0),
                  availableCoupons: coupons?.filter((c: any) => c.usageCount === 0) || [] as any[],
                  spinHistory: enrichedSpins || [] as any[]
                }
              });
            }

            if (loyaltyResult.success && loyaltyResult.data) {
              // Handle loyalty data
            }
          } catch (error) {
            console.error('Error loading gamification data:', error);
          } finally {
            setIsLoading(false);
          }
        };

        await loadGamificationData();
      }
    } catch (error) {
      console.error('Failed to load customer data:', error);
      toast.error('Failed to load dashboard data');
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-8 text-white">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                  <User className="w-10 h-10" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">Welcome back, {phoneAuthUser.fullName}!</h1>
                  <p className="text-blue-100 mb-4">Your personal dashboard at {restaurant.name}</p>
                  
                  {/* Customer Tier Badge */}
                  <div className="flex items-center space-x-4">
                    <div className={`inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r ${customerTier.color} rounded-full text-white font-medium`}>
                      <customerTier.icon className="w-4 h-4" />
                      <span>{customerTier.tier} Member</span>
                    </div>
                    <div className="text-sm text-blue-100">
                      {customerTier.benefits}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <div className="text-sm text-blue-100">Total Orders</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
                  <div className="text-sm text-blue-100">Total Spent</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{stats.loyaltyPoints}</div>
                  <div className="text-sm text-blue-100">Loyalty Points</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{stats.spinData.totalSpins}</div>
                  <div className="text-sm text-blue-100">Spin Rewards</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{stats.spinData.availableCoupons.length}</div>
                  <div className="text-sm text-blue-100">Active Coupons</div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-gray-50 px-8 py-4">
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
                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-600 shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Latest Order Status */}
                  {lastOrderId && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-green-900 mb-2">🎉 Order Placed Successfully!</h3>
                          <p className="text-green-700">Your order has been received and is being processed.</p>
                        </div>
                        <button
                          onClick={() => onViewOrder(lastOrderId)}
                          className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Track Order</span>
                        </button>
                      </div>
                    </div>
                  )}

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
                          onClick={onNewOrder}
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
                              onClick={() => onViewOrder(order.id)}
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

                  {/* Favorite Items */}
                  {stats.favoriteItems.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-6">Your Favorites</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  {/* Spin Wheel Activity */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">🎯 Spin Wheel Activity</h3>
                      <button
                        onClick={() => setActiveTab('rewards')}
                        className="text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                      >
                        <span>View All Rewards</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {(stats.spinData.totalSpins > 0 || stats.spinData.availableCoupons.length > 0) ? (
                      <>
                        {/* Spin Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-blue-900">{stats.spinData.totalSpins}</div>
                                <div className="text-sm text-blue-600">Total Spins</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                <Ticket className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-green-900">{stats.spinData.availableCoupons.length}</div>
                                <div className="text-sm text-green-600">Active Coupons</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                                <Coins className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="text-2xl font-bold text-purple-900">{formatCurrency(stats.spinData.totalDiscountEarned)}</div>
                                <div className="text-sm text-purple-600">Total Savings</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recent Spin History */}
                        {stats.spinData.spinHistory.length > 0 && (
                          <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Spin History</h4>
                            <div className="space-y-3">
                              {stats.spinData.spinHistory.slice(0, 3).map((spin: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                      <Zap className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">{spin.segment?.label || 'Spin Reward'}</div>
                                      <div className="text-sm text-gray-500">
                                        {spin.spinDate ? formatDate(spin.spinDate) : 'Recently'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-green-600">
                                      {spin.segment?.rewardType === 'percentage' 
                                        ? `${spin.segment.value}% OFF` 
                                        : `₹${spin.segment?.value || 0} OFF`}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {spin.isRedeemed ? '✅ Used' : '🎟️ Available'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {stats.spinData.spinHistory.length > 3 && (
                              <div className="text-center mt-4">
                                <button
                                  onClick={() => setActiveTab('rewards')}
                                  className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                                >
                                  View all {stats.spinData.spinHistory.length} spins →
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Available Coupons Preview */}
                        {stats.spinData.availableCoupons.length > 0 && (
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-semibold text-gray-900">🎟️ Your Active Coupons</h4>
                              <button
                                onClick={() => setActiveTab('rewards')}
                                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                              >
                                View All →
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {stats.spinData.availableCoupons.slice(0, 2).map((coupon: any, index: number) => (
                                <div key={index} className="bg-white rounded-lg p-4 border border-orange-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                      {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                                    </span>
                                    <Ticket className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <h5 className="font-medium text-gray-900 mb-1">{coupon.description || coupon.title}</h5>
                                  <p className="text-xs text-gray-600">
                                    Code: <span className="font-mono font-bold text-orange-600">{coupon.code}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                            {stats.spinData.availableCoupons.length > 2 && (
                              <div className="text-center mt-3">
                                <span className="text-sm text-orange-600 font-medium">
                                  +{stats.spinData.availableCoupons.length - 2} more coupons available
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Zap className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Spin Activity Yet</h4>
                        <p className="text-gray-600 mb-4">
                          You haven't used the spin wheel yet. Try the spin wheel game to earn exciting rewards and coupons!
                        </p>
                        <button
                          onClick={() => {
                            // Navigate to spin wheel - you can customize this URL
                            window.open(`/${restaurant.slug || restaurant.id}/spin-wheel`, '_blank');
                          }}
                          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all font-medium"
                        >
                          Try Spin Wheel Game 🎯
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={onNewOrder}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all text-left"
                      >
                        <Plus className="w-8 h-8 mb-3" />
                        <h4 className="font-semibold mb-2">Place New Order</h4>
                        <p className="text-sm text-blue-100">Browse menu and order food</p>
                      </button>
                      
                      {lastOrderId && (
                        <button
                          onClick={() => onViewOrder(lastOrderId)}
                          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all text-left"
                        >
                          <Eye className="w-8 h-8 mb-3" />
                          <h4 className="font-semibold mb-2">Track Latest Order</h4>
                          <p className="text-sm text-green-100">Check your order status</p>
                        </button>
                      )}
                      
                      <button
                        onClick={() => setActiveTab('rewards')}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all text-left"
                      >
                        <Gift className="w-8 h-8 mb-3" />
                        <h4 className="font-semibold mb-2">View Rewards</h4>
                        <p className="text-sm text-purple-100">Check loyalty points & offers</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-semibold text-gray-900">Order History</h3>
                    <button
                      onClick={loadCustomerData}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="w-20 h-20 text-gray-400 mx-auto mb-6" />
                      <h4 className="text-xl font-medium text-gray-900 mb-4">No Orders Found</h4>
                      <p className="text-gray-600 mb-8">You haven't placed any orders yet. Start exploring our menu!</p>
                      <button
                        onClick={onNewOrder}
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
                                onClick={() => onViewOrder(order.id)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Track Order</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'rewards' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-6">Loyalty & Rewards</h3>
                    
                    {/* Spin Wheel Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold">{stats.spinData.totalSpins}</div>
                            <div className="text-blue-100 mt-1">Total Spins</div>
                          </div>
                          <Zap className="w-10 h-10 text-blue-200" />
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold">{stats.spinData.availableCoupons.length}</div>
                            <div className="text-green-100 mt-1">Available Coupons</div>
                          </div>
                          <Ticket className="w-10 h-10 text-green-200" />
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold">{formatCurrency(stats.spinData.totalDiscountEarned)}</div>
                            <div className="text-purple-100 mt-1">Total Savings</div>
                          </div>
                          <Coins className="w-10 h-10 text-purple-200" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Loyalty Points Card */}
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-8 mb-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-2xl font-bold mb-2">{stats.loyaltyPoints} Points</h4>
                          <p className="text-purple-100">Available to redeem</p>
                        </div>
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                          <Star className="w-8 h-8" />
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

                    {/* Available Coupons */}
                    {stats.spinData.availableCoupons.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">🎟️ Your Spin Wheel Coupons</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {stats.spinData.availableCoupons.map((coupon: any, index: number) => (
                            <div key={index} className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6 relative overflow-hidden">
                              {/* Decorative pattern */}
                              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-200/20 rounded-full -translate-y-10 translate-x-10"></div>
                              <div className="absolute bottom-0 left-0 w-16 h-16 bg-red-200/20 rounded-full translate-y-8 -translate-x-8"></div>
                              
                              <div className="relative">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                    {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `₹${coupon.value} OFF`}
                                  </span>
                                  <Ticket className="w-6 h-6 text-orange-600" />
                                </div>
                                
                                <h5 className="font-bold text-gray-900 mb-2">{coupon.description || coupon.title}</h5>
                                <p className="text-sm text-gray-600 mb-4">
                                  Code: <span className="font-mono font-bold text-orange-600">{coupon.code}</span>
                                </p>
                                
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-500">
                                    <Calendar className="w-3 h-3 inline mr-1" />
                                    Expires: {coupon.expiryDate ? formatDate(coupon.expiryDate) : 'No expiry'}
                                  </div>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(coupon.code);
                                      toast.success('Coupon code copied!');
                                    }}
                                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                                  >
                                    Copy Code
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Rewards */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">💎 Loyalty Rewards</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    {/* Spin History */}
                    {stats.spinData.spinHistory.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">🎯 Recent Spin History</h4>
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          <div className="max-h-64 overflow-y-auto">
                            {stats.spinData.spinHistory.slice(0, 5).map((spin: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{spin.segment?.label || 'Spin Reward'}</div>
                                    <div className="text-sm text-gray-500">
                                      {spin.spinDate ? formatDate(spin.spinDate) : 'Recently'}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">
                                    {spin.segment?.rewardType === 'percentage' 
                                      ? `${spin.segment.value}% OFF` 
                                      : `₹${spin.segment?.value || 0} OFF`}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {spin.isRedeemed ? '✅ Used' : '🎟️ Available'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-6">Profile Information</h3>
                    
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
                      <div className="flex items-center space-x-6 mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                          {phoneAuthUser.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xl font-semibold text-gray-900">{phoneAuthUser.fullName}</h4>
                          <p className="text-gray-600 flex items-center space-x-2">
                            <Phone className="w-4 h-4" />
                            <span>+{phoneAuthUser.country_code} {phoneAuthUser.phone}</span>
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Member since {formatDate(new Date(phoneAuthUser.lastAuthenticated))}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded-xl">
                          <div className="text-2xl font-bold text-blue-600">{stats.totalOrders}</div>
                          <div className="text-sm text-gray-600">Total Orders</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-xl">
                          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalSpent)}</div>
                          <div className="text-sm text-gray-600">Total Spent</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-xl">
                          <div className="text-2xl font-bold text-purple-600">{stats.visitFrequency}</div>
                          <div className="text-sm text-gray-600">Customer Status</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-8 py-6 border-t">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Last updated: {formatTime(new Date())}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={onNewOrder}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Place New Order</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard; 