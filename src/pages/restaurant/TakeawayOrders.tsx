import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Printer,
  CreditCard,
  RefreshCw,
  Package,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { OrderService } from '@/services/orderService';
import { MenuService } from '@/services/menuService';
import { Order, OrderStatus, MenuItem } from '@/types';
import { formatCurrency, formatTime } from '@/lib/utils';
import PaymentModalWithCoupons from '@/components/restaurant/PaymentModalWithCoupons';

interface TakeawayOrderStats {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  completedToday: number;
  totalRevenue: number;
}

export default function TakeawayOrders() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const navigate = useNavigate();

  // State management
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Load takeaway orders
  const loadTakeawayOrders = useCallback(async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      
      // Get all orders for the restaurant
      const ordersResult = await OrderService.getOrdersForRestaurant(restaurant.id);
      
      if (ordersResult.success && ordersResult.data) {
        // Filter for takeaway orders only
        const takeawayOrders = ordersResult.data.filter(order => order.type === 'takeaway');
        
        // Sort by creation date (newest first)
        takeawayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setOrders(takeawayOrders);
        setFilteredOrders(takeawayOrders);
      }

      // Load menu items for displaying order details
      const menuResult = await MenuService.getMenuItemsForRestaurant(restaurant.id);
      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data);
      }
    } catch (error) {
      console.error('Failed to load takeaway orders:', error);
      toast.error('Failed to load takeaway orders');
    } finally {
      setIsLoading(false);
    }
  }, [restaurant]);

  // Load data on component mount
  useEffect(() => {
    loadTakeawayOrders();
  }, [loadTakeawayOrders]);

  // Filter orders based on search and status
  useEffect(() => {
    let filtered = orders;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter]);

  // Calculate stats
  const calculateStats = (): TakeawayOrderStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'placed').length,
      preparingOrders: orders.filter(o => o.status === 'preparing').length,
      readyOrders: orders.filter(o => o.status === 'ready').length,
      completedToday: orders.filter(o => 
        o.status === OrderStatus.COMPLETED && new Date(o.createdAt) >= today
      ).length,
      totalRevenue: orders
        .filter(o => o.status === OrderStatus.COMPLETED)
        .reduce((sum, o) => sum + o.total, 0),
    };
  };

  const stats = calculateStats();

  // Handle creating new takeaway order
  const handleCreateNewOrder = () => {
    navigate(`/${restaurant?.slug}/takeaway/new`);
  };

  // Handle order status update
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    if (!restaurant) return;

    try {
      const result = await OrderService.updateOrderStatus(orderId, restaurant.id, newStatus);
      
      if (result.success) {
        toast.success(`Order status updated to ${newStatus}`);
        loadTakeawayOrders(); // Refresh the list
      } else {
        toast.error('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  // Handle payment
  const handlePayment = (order: Order) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  // Handle payment processing
  const processPayment = async (paymentData: any) => {
    if (!selectedOrder || !restaurant) return;

    setIsProcessingPayment(true);
    
    try {
      // Prepare update data with comprehensive payment and discount information
      const updateData: any = {
        paymentStatus: 'paid',
        paymentMethod: paymentData.method,
        amountReceived: paymentData.amountReceived,
        finalTotal: paymentData.finalTotal,
        originalTotal: paymentData.originalTotal,
        // Update the main total field to reflect discounted amount
        total: paymentData.finalTotal
      };

      // Add discount information to preserve it in order record
      if (paymentData.manualDiscountAmount > 0 || paymentData.couponDiscountAmount > 0) {
        updateData.discountApplied = true;
        updateData.totalDiscountAmount = (paymentData.manualDiscountAmount || 0) + (paymentData.couponDiscountAmount || 0);
        updateData.originalTotalBeforeDiscount = paymentData.originalTotal;
        
        // Store manual discount details
        if (paymentData.manualDiscount) {
          updateData.manualDiscount = {
            type: paymentData.manualDiscount.type,
            value: paymentData.manualDiscount.value,
            amount: paymentData.manualDiscountAmount,
            reason: paymentData.manualDiscount.reason || ''
          };
        }
        
        // Store coupon discount details
        if (paymentData.couponDiscountAmount > 0) {
          updateData.couponDiscountAmount = paymentData.couponDiscountAmount;
        }
        
        // Update the discount field for backward compatibility
        updateData.discount = (paymentData.manualDiscountAmount || 0) + (paymentData.couponDiscountAmount || 0);
      }

      // Add tip information if provided
      if (paymentData.tip > 0) {
        updateData.tip = paymentData.tip;
      }

      // Add total savings information
      if (paymentData.totalSavings > 0) {
        updateData.totalSavings = paymentData.totalSavings;
      }

      // Add coupon information if applied
      if (paymentData.appliedCoupon) {
        updateData.appliedCoupon = {
          code: paymentData.appliedCoupon.coupon.code,
          name: paymentData.appliedCoupon.coupon.name,
          discountAmount: paymentData.appliedCoupon.discountAmount || 0,
          freeItems: paymentData.appliedCoupon.freeItems || [],
          totalSavings: paymentData.totalSavings || 0
        };
      }

      // Update order status to completed and mark as paid
      const result = await OrderService.updateOrderStatus(
        selectedOrder.id, 
        restaurant.id, 
        OrderStatus.COMPLETED,
        updateData
      );

      if (result.success) {
        toast.success('Payment processed successfully!');
        setShowPaymentModal(false);
        setSelectedOrder(null);
        loadTakeawayOrders(); // Refresh the list
      } else {
        toast.error('Failed to process payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle printing KOT
  const handlePrintKOT = async (order: Order) => {
    try {
      const kotContent = generateKOTContent(order, restaurant);
      
      // Open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(kotContent);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
        
        toast.success('KOT sent to printer');
      }
    } catch (error) {
      console.error('Error printing KOT:', error);
      toast.error('Failed to print KOT');
    }
  };

  // Generate KOT content
  const generateKOTContent = (order: Order, restaurant: any): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>KOT - ${order.orderNumber}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            margin: 0; 
            padding: 10px; 
            width: 100%;
            background: #fff;
          }
          .kot-container {
            width: 100%;
            padding: 15px 5px;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
            margin-bottom: 15px; 
          }
          .restaurant-name { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 5px;
          }
          .order-info { 
            margin-bottom: 15px; 
            line-height: 1.4;
          }
          .items { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 15px 0;
          }
          .items th, .items td { 
            border: 1px solid #000; 
            padding: 8px; 
            text-align: left; 
            font-size: 13px;
          }
          .items th { 
            background-color: #f0f0f0; 
            font-weight: bold;
          }
          .footer { 
            margin-top: 20px; 
            text-align: center; 
            font-size: 12px; 
            border-top: 1px dashed #000;
            padding-top: 15px;
          }
          @media print {
            body { margin: 0; padding: 8px; }
            .kot-container { padding: 10px 0; }
          }
        </style>
      </head>
      <body>
        <div class="kot-container">
          <div class="header">
            <div class="restaurant-name">${restaurant.name}</div>
            <div>KITCHEN ORDER TICKET - TAKEAWAY</div>
          </div>
          
          <div class="order-info">
            <p><strong>Order #:</strong> ${order.orderNumber}</p>
            <p><strong>Type:</strong> TAKEAWAY</p>
            <p><strong>Customer:</strong> ${order.customerName || 'Walk-in Customer'}</p>
            <p><strong>Date/Time:</strong> ${order.createdAt.toLocaleString()}</p>
            <p><strong>Staff:</strong> ${order.staffId}</p>
          </div>
          
          <table class="items">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Item</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => `
                <tr>
                  <td>${item.quantity}</td>
                  <td>${item.name}</td>
                  <td>${item.notes || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${order.notes ? `
            <div class="order-info">
              <p><strong>Special Instructions:</strong></p>
              <p>${order.notes}</p>
            </div>
          ` : ''}
          
          <div class="footer">
            <p>*** TAKEAWAY ORDER ***</p>
            <p>Please prepare for pickup</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Get status badge styling
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      placed: { color: 'bg-blue-100 text-blue-800', label: 'Placed' },
      confirmed: { color: 'bg-yellow-100 text-yellow-800', label: 'Confirmed' },
      preparing: { color: 'bg-orange-100 text-orange-800', label: 'Preparing' },
      ready: { color: 'bg-green-100 text-green-800', label: 'Ready' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
    };

    const config = statusConfig[status] || statusConfig.placed;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-4">
                <button
                                      onClick={() => navigate(`/${restaurant?.slug}/tables`)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Takeaway Orders</h1>
                  <p className="text-gray-600">Manage takeaway orders and track their status</p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={loadTakeawayOrders}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh orders"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleCreateNewOrder}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Takeaway Order
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalOrders}</div>
            <div className="text-sm text-gray-600">Total Orders</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.pendingOrders}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.preparingOrders}</div>
            <div className="text-sm text-gray-600">Preparing</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.readyOrders}</div>
            <div className="text-sm text-gray-600">Ready</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.completedToday}</div>
            <div className="text-sm text-gray-600">Completed Today</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalRevenue)}</div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by order number, customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Status</option>
                <option value="placed">Placed</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-600">Loading takeaway orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {orders.length === 0 ? 'No takeaway orders yet' : 'No orders match your filters'}
            </h3>
            <p className="text-gray-600 mb-6">
              {orders.length === 0 
                ? 'Create your first takeaway order to get started.'
                : 'Try adjusting your search or filters.'
              }
            </p>
            {orders.length === 0 && (
              <button
                onClick={handleCreateNewOrder}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Order
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <TakeawayOrderCard
                key={order.id}
                order={order}
                onPayment={handlePayment}
                onPrintKOT={handlePrintKOT}
              />
            ))}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedOrder && (
          <PaymentModalWithCoupons
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedOrder(null);
            }}
            restaurant={restaurant}
            table={{ id: 'takeaway', number: 'Takeaway', area: 'Takeaway' }}
            onPayment={processPayment}
            isProcessing={isProcessingPayment}
            cartItems={selectedOrder.items.map(item => ({
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
              variants: item.variants
            }))}
            orders={[selectedOrder]}
            menuItems={menuItems}
          />
        )}
      </main>
    </div>
  );
}

// Takeaway Order Card Component
interface TakeawayOrderCardProps {
  order: Order;
  onPayment: (order: Order) => void;
  onPrintKOT: (order: Order) => void;
}

function TakeawayOrderCard({ 
  order, 
  onPayment, 
  onPrintKOT 
}: TakeawayOrderCardProps) {
  const orderAge = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60));

  return (
    <div className="card p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Order Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-4 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">#{order.orderNumber}</h3>
            <span className="text-sm text-gray-500">
              {orderAge < 60 ? `${orderAge}m ago` : `${Math.floor(orderAge / 60)}h ${orderAge % 60}m ago`}
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Customer:</span>
              <div className="font-medium">{order.customerName || 'Walk-in Customer'}</div>
            </div>
            <div>
              <span className="text-gray-600">Items:</span>
              <div className="font-medium">{order.items.length} items</div>
            </div>
            <div>
              <span className="text-gray-600">Total:</span>
              <div className="font-medium text-lg">{formatCurrency(order.total)}</div>
            </div>
          </div>

          {order.notes && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">Notes:</span>
              <div className="text-gray-800">{order.notes}</div>
            </div>
          )}
        </div>

        {/* Actions - Only Print KOT and Make Payment */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Print KOT Button */}
          <button
            onClick={() => onPrintKOT(order)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            title="Print KOT"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print KOT
          </button>

          {/* Make Payment Button */}
          <button
            onClick={() => onPayment(order)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Process Payment"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Make Payment
          </button>
        </div>
      </div>
    </div>
  );
} 