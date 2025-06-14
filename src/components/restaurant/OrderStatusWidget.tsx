import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { OrderService } from '@/services/orderService';
import { Order, OrderStatus } from '@/types';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { formatCurrency } from '@/lib/utils';

interface OrderStatusWidgetProps {
  className?: string;
}

export default function OrderStatusWidget({ className = '' }: OrderStatusWidgetProps) {
  const { restaurant } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (restaurant) {
      loadActiveOrders();
      // Set up polling for real-time updates
      const interval = setInterval(loadActiveOrders, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [restaurant]);

  const loadActiveOrders = async () => {
    if (!restaurant) return;

    try {
      const result = await OrderService.getOrdersForRestaurant(restaurant.id);
      if (result.success && result.data) {
        // Filter for active orders only
        const activeOrders = result.data.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
        );
        setOrders(activeOrders);
      }
    } catch (error) {
      console.error('Failed to load active orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = (status: OrderStatus) => {
    const configs = {
      placed: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Placed' },
      confirmed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Confirmed' },
      preparing: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Preparing' },
      ready: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Ready' },
    };
    return configs[status as keyof typeof configs] || configs.placed;
  };

  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      totalValue: orders.reduce((sum, order) => sum + order.total, 0),
    };
    return stats;
  };

  const stats = getOrderStats();

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Active Orders
        </h3>
        <p className="text-sm text-gray-600 mt-1">Real-time order status</p>
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.preparing}</div>
            <div className="text-xs text-gray-500">Preparing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
            <div className="text-xs text-gray-500">Ready</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalValue)}</div>
            <div className="text-xs text-gray-500">Value</div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="max-h-80 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No active orders</p>
            <p className="text-sm">Orders will appear here when placed</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => {
              const config = getStatusConfig(order.status);
              const Icon = config.icon;
              const orderTime = new Date(order.createdAt);
              const timeAgo = Math.floor((Date.now() - orderTime.getTime()) / 60000); // minutes ago

              return (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        #{order.orderNumber}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                        <Icon className="w-3 h-3 inline mr-1" />
                        {config.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{formatCurrency(order.total)}</div>
                      <div className="text-xs text-gray-500">
                        {timeAgo === 0 ? 'Just now' : `${timeAgo}m ago`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between items-center">
                      <span>Table {order.tableId || 'N/A'}</span>
                      <span>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    </div>
                    
                    {/* Show first few items */}
                    <div className="mt-1 text-xs text-gray-500">
                      {order.items.slice(0, 2).map((item, index) => (
                        <span key={index}>
                          {item.quantity}x {item.name}
                          {index < Math.min(order.items.length, 2) - 1 && ', '}
                        </span>
                      ))}
                      {order.items.length > 2 && (
                        <span> +{order.items.length - 2} more</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {orders.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
} 