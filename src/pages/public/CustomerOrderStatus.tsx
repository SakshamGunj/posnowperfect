import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { OrderService } from '@/services/orderService';
import { RestaurantService } from '@/services/restaurantService';
import { Restaurant, Order } from '@/types';
import { formatCurrency, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  Clock,
  Package,
  AlertTriangle,
  Smartphone,
  Users,
  Timer,
  Calendar,
  RefreshCw,
  Phone
} from 'lucide-react';

export default function CustomerOrderStatus() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const orderNumber = searchParams.get('orderNumber');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (order && ['placed', 'confirmed'].includes(order.status)) {
        refreshOrderStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [orderNumber, slug]);

  const loadData = async () => {
    if (!slug) return;

    try {
      setLoading(true);

      // Load restaurant
      const restaurantResult = await RestaurantService.getRestaurantBySlug(slug);
      if (!restaurantResult.success || !restaurantResult.data) {
        toast.error('Restaurant not found');
        return;
      }
      setRestaurant(restaurantResult.data);

      // Load order if orderNumber provided
      if (orderNumber) {
        await loadOrder(restaurantResult.data.id, orderNumber);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load order information');
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = async (restaurantId: string, orderIdToLoad: string) => {
    try {
      const ordersResult = await OrderService.getOrdersForRestaurant(restaurantId, 100);
      if (ordersResult.success && ordersResult.data) {
        const foundOrder = ordersResult.data.find(o => 
          o.id === orderIdToLoad || o.orderNumber === orderIdToLoad
        );
        
        if (foundOrder) {
          setOrder(foundOrder);
        } else {
          toast.error('Order not found');
        }
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      toast.error('Failed to load order');
    }
  };

  const refreshOrderStatus = async () => {
    if (!restaurant || !order) return;

    try {
      await loadOrder(restaurant.id, order.id);
      toast.success('Order status updated');
    } catch (error) {
      console.error('Failed to refresh order:', error);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      placed: { 
        color: 'border-yellow-300 bg-yellow-50 text-yellow-800', 
        icon: Clock, 
        label: 'Order Placed',
        description: 'Your order has been received and is waiting for confirmation.'
      },
      confirmed: { 
        color: 'border-blue-300 bg-blue-50 text-blue-800', 
        icon: CheckCircle, 
        label: 'Order Confirmed',
        description: 'Your order has been confirmed. Please wait for payment notification.'
      },
      preparing: { 
        color: 'border-blue-300 bg-blue-50 text-blue-800', 
        icon: CheckCircle, 
        label: 'Order Confirmed',
        description: 'Your order has been confirmed. Please wait for payment notification.'
      },
      ready: { 
        color: 'border-blue-300 bg-blue-50 text-blue-800', 
        icon: CheckCircle, 
        label: 'Order Confirmed',
        description: 'Your order has been confirmed. Please wait for payment notification.'
      },
      completed: { 
        color: 'border-green-300 bg-green-50 text-green-800', 
        icon: Package, 
        label: 'Payment Done',
        description: 'Thank you for your order! Payment has been completed.'
      },
    };
    return configs[status as keyof typeof configs] || configs.placed;
  };

  const getOrderAge = (createdAt: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(diff / (1000 * 60));
  };

  const generateBill = () => {
    if (!order || !restaurant) return;

    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order Bill - ${order.orderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { border-top: 2px solid #333; padding-top: 10px; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${restaurant.name}</h2>
          <p>Customer Order Bill</p>
          <p>Order #: ${order.orderNumber}</p>
          <p>Date: ${formatTime(order.createdAt)}</p>
        </div>
        
        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <span>${item.name} x${item.quantity}</span>
              <span>₹${item.total}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="total">
          <div class="item">
            <span>Subtotal:</span>
            <span>₹${order.subtotal}</span>
          </div>
          <div class="item">
            <span>Tax:</span>
            <span>₹${order.tax}</span>
          </div>
          <div class="item">
            <span>Total:</span>
            <span>₹${order.total}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for your order!</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(billContent);
      newWindow.document.close();
      newWindow.print();
    }
  };

  // @ts-ignore - variable name mismatch
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Restaurant Not Found</h2>
          <p className="text-gray-600">The restaurant you're looking for could not be found.</p>
        </div>
      </div>
    );
  }

  if (!order && orderNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Order Not Found</h2>
          <p className="text-gray-600">The order you're looking for could not be found or may have been cancelled.</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{restaurant.name}</h1>
            <p className="text-gray-600 text-lg">Check your order status</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Status Lookup</h2>
            <p className="text-gray-600 mb-6">
              To check your order status, you need your order ID. This is provided when you place an order.
            </p>
            
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Enter your order details to check status</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const orderAge = getOrderAge(order.createdAt);
  const isOrderReady = order.status === 'ready';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{restaurant.name}</h1>
          <p className="text-gray-600 text-lg">Order Status Dashboard</p>
        </div>

        {/* Order Details */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
            <button
              onClick={refreshOrderStatus}
              // @ts-ignore - variable naming issue
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              {/* @ts-ignore - variable naming issue */}
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Order Header */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Order #{order.orderNumber}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{formatTime(order.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Timer className="w-4 h-4" />
                <span>{orderAge}m ago</span>
              </div>
            </div>
          </div>

          {/* Status Display */}
          <div className={`rounded-2xl border-2 ${statusConfig.color} p-6 mb-6`}>
            <div className="flex items-center space-x-4 mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${statusConfig.color.replace('border-', 'bg-').replace('bg-', 'bg-opacity-20 bg-')}`}>
                <StatusIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{statusConfig.label}</h3>
                <p className="text-sm opacity-80">{statusConfig.description}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-1000"
                style={{ 
                  width: order.status === 'placed' ? '33%' : 
                         ['confirmed', 'preparing', 'ready'].includes(order.status) ? '66%' : 
                         order.status === 'completed' ? '100%' : '33%'
                }}
              ></div>
            </div>

            {/* Status Steps */}
            <div className="flex justify-between text-xs text-gray-600">
              <span className={order.status === 'placed' ? 'font-bold text-blue-600' : ''}>Placed</span>
              <span className={['confirmed', 'preparing', 'ready'].includes(order.status) ? 'font-bold text-blue-600' : ''}>Confirmed</span>
              <span className={order.status === 'completed' ? 'font-bold text-green-600' : ''}>Payment Done</span>
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4 mb-6">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  {item.notes && (
                    <p className="text-sm text-gray-500 italic">Note: {item.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(item.total)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer Dashboard Button */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Portal</h3>
                <p className="text-gray-600 text-sm">View your order history, rewards, and more</p>
              </div>
              <button
                onClick={() => {
                  const phone = new URLSearchParams(window.location.search).get('phone');
                  if (phone && restaurant) {
                    window.location.href = `/${restaurant.slug}/customer-dashboard?phone=${phone}`;
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-medium flex items-center space-x-2 shadow-lg"
              >
                <Users className="w-4 h-4" />
                <span>View Dashboard</span>
              </button>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Need Help?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Call Restaurant</h4>
                <p className="text-sm text-gray-600">Get instant support</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-xl">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Track Order</h4>
                <p className="text-sm text-gray-600">Real-time updates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 