import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Gift,
  Trophy,
  Star,
  MapPin,
  Package,
  Crown,
  Target,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { RestaurantService } from '@/services/restaurantService';
import { RestaurantInfo } from '@/types';
import { GamificationService } from '@/services/gamificationService';
import { LoyaltyPointsService } from '@/services/loyaltyPointsService';
import { formatCurrency, formatTime } from '@/lib/utils';
import {
  Ticket,
  Phone,
  Search,
  CheckCircle,
  Clock,
  Copy,
  Calendar,
  ExternalLink,
  Sparkles,
  X,
  Percent,
  Plus,
  ArrowRight,
  Zap,
  Coffee,
  Utensils,
  User,
  Smartphone,
  Eye,
  Heart,
  Receipt,
  ShoppingBag,
  Award,
  TrendingUp,
  Percent as PercentIcon,
  Percent as PercentIcon2
} from 'lucide-react';

import { CustomerSpin, Restaurant } from '@/types';
import { OrderService } from '@/services/orderService';
import { CustomerService } from '@/services/customerService';
import { formatDate } from '@/lib/utils';
import { Order } from '@/types';

interface PhoneSearchForm {
  phone: string;
}

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
}

export default function CustomerDashboard({
  restaurant,
  phoneAuthUser,
  lastOrderId,
  onClose,
  onViewOrder,
  onNewOrder
}: CustomerDashboardProps) {
  const [spins, setSpins] = useState<CustomerSpin[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPhone, setCurrentPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    loyaltyPoints: 0,
    favoriteItems: [],
    visitFrequency: 'New Customer',
    lastVisit: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'rewards' | 'profile'>('overview');
  const [showOrderDetails, setShowOrderDetails] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<PhoneSearchForm>();

  // Check if user has a phone number in localStorage
  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    if (storedPhone) {
      setCurrentPhone(storedPhone);
      handlePhoneSearch({ phone: storedPhone });
    }
  }, []);

  const handlePhoneSearch = async (data: PhoneSearchForm) => {
    setLoading(true);
    setHasSearched(true);
    setCurrentPhone(data.phone);
    setSpins([]);
    setRestaurants([]);

    try {
      // Get all restaurants (this is a simplified approach)
      // In production, you might want to have a more efficient way to search across restaurants
      const allRestaurantsResult = await RestaurantService.getAllActiveRestaurants();
      
      if (allRestaurantsResult.success && allRestaurantsResult.data) {
        const restaurantSpins: CustomerSpin[] = [];
        const restaurantInfos: RestaurantInfo[] = [];

        // Search spins from each restaurant
        for (const restaurant of allRestaurantsResult.data) {
          try {
            const spinsResult = await GamificationService.getCustomerSpinsFromRestaurant(
              restaurant.id,
              data.phone
            );

            if (spinsResult.success && spinsResult.data && spinsResult.data.length > 0) {
              // Add restaurant info to each spin
              const restaurantSpinsWithInfo = spinsResult.data.map(spin => ({
                ...spin,
                restaurantName: restaurant.name,
                restaurantSlug: restaurant.slug
              }));
              
              restaurantSpins.push(...restaurantSpinsWithInfo);
              
              if (!restaurantInfos.find(r => r.id === restaurant.id)) {
                restaurantInfos.push({
                  id: restaurant.id,
                  name: restaurant.name,
                  slug: restaurant.slug
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching spins from ${restaurant.name}:`, error);
          }
        }

        // Sort by date (newest first)
        restaurantSpins.sort((a, b) => new Date(b.spinDate).getTime() - new Date(a.spinDate).getTime());
        
        setSpins(restaurantSpins);
        setRestaurants(restaurantInfos);

        if (restaurantSpins.length === 0) {
          toast.error('No spins found for this phone number');
        } else {
          toast.success(`Found ${restaurantSpins.length} spins from ${restaurantInfos.length} restaurants`);
        }
      }
    } catch (error) {
      console.error('Error searching spins:', error);
      toast.error('Failed to search for spins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Coupon code copied!');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getSpinStatusBadge = (spin: CustomerSpin) => {
    if (spin.isRedeemed) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Redeemed
        </span>
      );
    } else if (spin.couponCode) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Ticket className="w-3 h-3 mr-1" />
          Claimed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Clock className="w-3 h-3 mr-1" />
          Not Claimed
        </span>
      );
    }
  };

  const claimedSpins = spins.filter(spin => spin.couponCode);
  const totalSpins = spins.length;
  const redeemedCount = spins.filter(spin => spin.isRedeemed).length;

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

        // Try to get loyalty points (if service exists)
        let loyaltyPoints = 0;
        try {
          const loyaltyResult = await LoyaltyPointsService.getCustomerPoints(restaurant.id, phoneAuthUser.phone);
          if (loyaltyResult.success) {
            loyaltyPoints = loyaltyResult.points || 0;
          }
        } catch (error) {
          console.log('Loyalty points not available:', error);
        }

        setStats({
          totalOrders: customerOrders.length,
          totalSpent,
          averageOrderValue: avgOrderValue,
          loyaltyPoints,
          favoriteItems,
          visitFrequency,
          lastVisit
        });
      }
    } catch (error) {
      console.error('Failed to load customer data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get order status icon
  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'preparing': return <Clock className="w-4 h-4 text-orange-600" />;
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'completed': return <Package className="w-4 h-4 text-green-600" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-600" />;
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
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
                  <div className="text-2xl font-bold">{formatCurrency(stats.averageOrderValue)}</div>
                  <div className="text-sm text-blue-100">Avg Order</div>
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
                              {order.status === 'completed' && (
                                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2">
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
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-6">Loyalty & Rewards</h3>
                    
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

                    {/* Tier Benefits */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
                      <div className="flex items-center space-x-4 mb-6">
                        <div className={`w-12 h-12 bg-gradient-to-r ${customerTier.color} rounded-xl flex items-center justify-center`}>
                          <customerTier.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{customerTier.tier} Member Benefits</h4>
                          <p className="text-gray-600">{customerTier.benefits}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <Zap className="w-6 h-6 text-blue-600" />
                            <div>
                              <h5 className="font-medium text-gray-900">Points Multiplier</h5>
                              <p className="text-sm text-gray-600">Earn 2x points on orders</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4">
                          <div className="flex items-center space-x-3">
                            <Gift className="w-6 h-6 text-green-600" />
                            <div>
                              <h5 className="font-medium text-gray-900">Birthday Treat</h5>
                              <p className="text-sm text-gray-600">Free dessert on your birthday</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Available Rewards */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Available Rewards</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">Free Coffee</h5>
                            <Coffee className="w-6 h-6 text-brown-600" />
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
                            <PercentIcon className="w-6 h-6 text-green-600" />
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

                    {/* Preferences */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <Smartphone className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-900">SMS Notifications</span>
                          </div>
                          <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <Gift className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-900">Promotional Offers</span>
                          </div>
                          <div className="w-12 h-6 bg-blue-600 rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
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
} 