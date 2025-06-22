import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { OrderService } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { MenuService } from '@/services/menuService';
import { Order, OrderStatus, Table, MenuItem } from '@/types';
import { formatTime, generateId, generateOrderNumber } from '@/lib/utils';
import toast from 'react-hot-toast';
import PaymentModalWithCoupons from '@/components/restaurant/PaymentModalWithCoupons';
import {
  Clock,
  CheckCircle,
  ChefHat,
  Bell,
  BellOff,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Users,
  Calendar,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Utensils,
  Package,
  Smartphone,
  Zap,
  CreditCard,
  AlertCircle,
  Settings,
  Filter,
  Search,
  Hash,
  User,
  MapPin,
  Phone
} from 'lucide-react';

interface KitchenStats {
  totalActiveOrders: number;
  preparingOrders: number;
  readyOrders: number;
  avgPrepTime: number;
  oldestOrder: Date | null;
}

export default function KitchenDisplay() {
  const { restaurant } = useRestaurant();
  
  // State management
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuPortalOrders, setMenuPortalOrders] = useState<Order[]>([]);
  const [regularOrders, setRegularOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Update refs when state changes to avoid stale closures
  useEffect(() => {
    isInitializedRef.current = isInitialized;
    lastOrderCountRef.current = lastOrderCount;
    soundEnabledRef.current = soundEnabled;
    notificationsEnabledRef.current = notificationsEnabled;
  }, [isInitialized, lastOrderCount, soundEnabled, notificationsEnabled]);
  
  // Audio references
  const newOrderSoundRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to avoid stale closure issues in real-time callback
  const isInitializedRef = useRef(false);
  const lastOrderCountRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const notificationsEnabledRef = useRef(false);

  // Kitchen stats
  const [stats, setStats] = useState<KitchenStats>({
    totalActiveOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    avgPrepTime: 0,
    oldestOrder: null,
  });

  // Request notification permission and enable notifications
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          toast.success('🔔 Notifications enabled! You\'ll be alerted for new orders.');
          return true;
        } else {
          toast.error('Notification permission denied. Enable manually in browser settings.');
          return false;
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        toast.error('Failed to enable notifications');
        return false;
      }
    } else {
      toast.error('Notifications not supported in this browser');
      return false;
    }
  }, []);

  // Initialize audio with a simple beep sound
  useEffect(() => {
    // Create audio context and generate a simple beep
    const createBeepSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // 800 Hz tone
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.log('Audio context not available:', error);
      }
    };

    // Create audio element as fallback
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCjSO1+/ThC4FKnjJ8NuJOggZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhCjSO1+/ThC4FKnjJ8NuJOgg';
    newOrderSoundRef.current = audio;

    // Store beep function for use
    (newOrderSoundRef.current as any).playBeep = createBeepSound;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Load initial data
  const loadKitchenData = useCallback(async (showToast = false) => {
    if (!restaurant) return;

    try {
      const [ordersResult, tablesResult] = await Promise.all([
        OrderService.getOrdersForRestaurant(restaurant.id, 100),
        TableService.getTablesForRestaurant(restaurant.id)
      ]);

              if (ordersResult.success && ordersResult.data) {
        // Filter for active kitchen orders
        const activeOrders = ordersResult.data.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Separate menu portal orders from regular orders
        const menuPortalOrders = activeOrders.filter(order => 
          order.tableId === 'customer-portal' || 
          (order.notes && order.notes.includes('Customer Portal Order'))
        );
        const regularOrders = activeOrders.filter(order => 
          order.tableId !== 'customer-portal' && 
          !(order.notes && order.notes.includes('Customer Portal Order'))
        );

        // Check for new orders
        if (isInitialized && activeOrders.length > lastOrderCount) {
          const newOrdersCount = activeOrders.length - lastOrderCount;
          
          // Play sound notification
          if (soundEnabled && newOrderSoundRef.current) {
            try {
              // Try to play audio beep
              if ((newOrderSoundRef.current as any).playBeep) {
                (newOrderSoundRef.current as any).playBeep();
              } else {
                newOrderSoundRef.current.currentTime = 0;
                newOrderSoundRef.current.play().catch(e => console.log('Could not play sound:', e));
              }
            } catch (error) {
              console.log('Audio play error:', error);
            }
          }

          // Show browser notification
          if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`🍽️ New Order${newOrdersCount > 1 ? 's' : ''}!`, {
              body: `${newOrdersCount} new order${newOrdersCount > 1 ? 's' : ''} received in kitchen`,
              icon: '/favicon.ico',
              tag: 'new-order',
              requireInteraction: true
            });
          }

          // Show toast notification
          toast.success(`🔔 ${newOrdersCount} new order${newOrdersCount > 1 ? 's' : ''} received!`, {
            duration: 5000,
            position: 'top-center',
          });
        }

        setOrders(activeOrders);
        setMenuPortalOrders(menuPortalOrders);
        setRegularOrders(regularOrders);
        setLastOrderCount(activeOrders.length);
        setIsInitialized(true);

        // Calculate stats
        const preparingCount = activeOrders.filter(o => o.status === 'preparing').length;
        const readyCount = activeOrders.filter(o => o.status === 'ready').length;
        const oldestOrder = activeOrders.length > 0 ? new Date(activeOrders[0].createdAt) : null;

        setStats({
          totalActiveOrders: activeOrders.length,
          preparingOrders: preparingCount,
          readyOrders: readyCount,
          avgPrepTime: 0,
          oldestOrder,
        });
      }

      if (tablesResult.success && tablesResult.data) {
        setTables(tablesResult.data);
      }

      if (showToast) {
        toast.success('Kitchen display updated');
      }
    } catch (error) {
      console.error('Failed to load kitchen data:', error);
      toast.error('Failed to load kitchen data');
    } finally {
      setIsLoading(false);
    }
  }, [restaurant, isInitialized, lastOrderCount, soundEnabled, notificationsEnabled]);

  // Real-time subscription setup
  useEffect(() => {
    if (restaurant) {
      loadKitchenData();
      
      // Set up real-time listener for active orders
      console.log('🔄 Setting up real-time order subscription for KDS');
      setConnectionStatus('connecting');
      
      const unsubscribe = OrderService.subscribeToActiveOrders(restaurant.id, (newOrders) => {
        console.log('📡 Real-time orders update received:', newOrders.length);
        setConnectionStatus('connected');
        
        // Check for new orders
        if (isInitializedRef.current && newOrders.length > lastOrderCountRef.current) {
          const newOrdersCount = newOrders.length - lastOrderCountRef.current;
          
          // Play sound notification
          if (soundEnabledRef.current && newOrderSoundRef.current) {
            try {
              if ((newOrderSoundRef.current as any).playBeep) {
                (newOrderSoundRef.current as any).playBeep();
              } else {
                newOrderSoundRef.current.currentTime = 0;
                newOrderSoundRef.current.play().catch(e => console.log('Could not play sound:', e));
              }
            } catch (error) {
              console.log('Audio play error:', error);
            }
          }

          // Show browser notification
          if (notificationsEnabledRef.current && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`🍽️ New Order${newOrdersCount > 1 ? 's' : ''}!`, {
              body: `${newOrdersCount} new order${newOrdersCount > 1 ? 's' : ''} received in kitchen`,
              icon: '/favicon.ico',
              tag: 'new-order',
              requireInteraction: true
            });
          }

          // Show prominent toast notification for real-time updates
          toast.success(`🍽️ NEW ORDER ALERT! ${newOrdersCount} order${newOrdersCount > 1 ? 's' : ''} received!`, {
            duration: 8000,
            position: 'top-center',
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '2px solid rgba(34, 197, 94, 1)',
              boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.3)',
            },
          });
        }

        // Separate menu portal orders from regular orders
        const portalOrders = newOrders.filter(order => 
          order.tableId === 'customer-portal' || 
          (order.notes && order.notes.includes('Customer Portal Order'))
        );
        const dineInOrders = newOrders.filter(order => 
          order.tableId !== 'customer-portal' && 
          !(order.notes && order.notes.includes('Customer Portal Order'))
        );

        // Update orders and stats
        setOrders(newOrders);
        setMenuPortalOrders(portalOrders);
        setRegularOrders(dineInOrders);
        setLastOrderCount(newOrders.length);
        setIsInitialized(true);
        
        // Update refs for next comparison
        lastOrderCountRef.current = newOrders.length;
        isInitializedRef.current = true;
        
        // Log for debugging
        console.log(`📊 KDS Updated: ${newOrders.length} active orders total`);

        // Calculate stats
        const preparingCount = newOrders.filter(o => o.status === 'preparing').length;
        const readyCount = newOrders.filter(o => o.status === 'ready').length;
        const oldestOrder = newOrders.length > 0 ? new Date(newOrders[0].createdAt) : null;

        setStats({
          totalActiveOrders: newOrders.length,
          preparingOrders: preparingCount,
          readyOrders: readyCount,
          avgPrepTime: 0,
          oldestOrder,
        });
      });

      return () => {
        console.log('🔌 Unsubscribing from real-time orders');
        unsubscribe();
      };
    }
  }, [restaurant?.id]); // Only depend on restaurant ID to prevent infinite loops

  // Backup polling for additional reliability (only when auto-refresh is enabled)
  useEffect(() => {
    if (isAutoRefreshEnabled && restaurant) {
      intervalRef.current = setInterval(() => {
        console.log('⏰ Backup polling: Loading kitchen data');
        loadKitchenData();
      }, 30000); // Backup refresh every 30 seconds

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isAutoRefreshEnabled, restaurant, loadKitchenData]);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!restaurant) return;

    try {
      // If marking as completed, just remove from UI and log
      if (newStatus === 'completed') {
        console.log(`🍽️ KDS: Order ${orderId} marked as completed - removing from UI only (no database update)`);
        
        // Remove the order from both regular and menu portal orders UI
        setRegularOrders(prev => prev.filter(order => order.id !== orderId));
        setMenuPortalOrders(prev => prev.filter(order => order.id !== orderId));
        
        toast.success('Order completed and removed from kitchen display');
        return;
      }

      // For other status updates (preparing, ready, etc.), keep the original functionality
      const orderToUpdate = orders.find(o => o.id === orderId);
      if (orderToUpdate) {
        await OrderService.updateOrderStatus(orderId, restaurant?.id || '', newStatus);
        
        // @ts-ignore - Type overlap issue with OrderStatus
        if (newStatus === 'completed' && orderToUpdate.tableId && orderToUpdate.tableId !== 'customer-portal') {
          await handleTableStatusAfterOrderCompletion(orderToUpdate.tableId);
        }
        
        // Refresh orders
        await loadKitchenData();
        toast.success(`Order #${orderToUpdate.orderNumber} marked as ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  // Handle table status after order completion
  const handleTableStatusAfterOrderCompletion = async (tableId: string) => {
    if (!restaurant || !tableId) return;

    try {
      // Get all active orders for this table (excluding the one we just completed)
      const activeOrdersResult = await OrderService.getOrdersByTable(restaurant.id, tableId);
      
      if (activeOrdersResult.success && activeOrdersResult.data) {
        const activeOrders = activeOrdersResult.data.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
        );

        console.log(`🍽️ Table ${tableId}: Found ${activeOrders.length} remaining active orders`);

        // If no more active orders for this table, keep table occupied but ready for payment
        // Don't automatically make it available - that should only happen after payment
        if (activeOrders.length === 0) {
          console.log(`🍽️ Table ${tableId}: No more active orders, keeping table occupied for payment`);
          // Table remains occupied until payment is processed in TakeOrder page
        } else {
          console.log(`🍽️ Table ${tableId}: Still has ${activeOrders.length} active orders, keeping table occupied`);
        }
      }
    } catch (error) {
      console.error('Error checking table status after order completion:', error);
      // Don't throw error - this is not critical for order completion
    }
  };

  // Special confirm function for menu portal orders
  const confirmMenuPortalOrder = async (orderId: string) => {
    if (!restaurant) return;

    try {
      const result = await OrderService.updateOrderStatus(orderId, restaurant.id, 'confirmed');
      if (result.success) {
        await loadKitchenData();
        toast.success('📱 Menu Portal Order Confirmed! Customer will be notified.', {
          duration: 4000,
          style: {
            background: 'rgba(34, 197, 94, 0.95)',
            color: '#fff',
          }
        });
      } else {
        toast.error('Failed to confirm order');
      }
    } catch (error) {
      console.error('Error confirming order:', error);
      toast.error('Failed to confirm order');
    }
  };

  // Load menu items for payment processing
  const loadMenuItems = useCallback(async () => {
    if (!restaurant) return;

    try {
      const result = await MenuService.getMenuItemsForRestaurant(restaurant.id);
      if (result.success && result.data) {
        setMenuItems(result.data);
      }
    } catch (error) {
      console.error('Failed to load menu items:', error);
    }
  }, [restaurant]);

  // Handle payment for menu portal orders
  const handleMenuPortalPayment = async (order: Order) => {
    if (!restaurant) return;

    // Load menu items if not already loaded
    if (menuItems.length === 0) {
      await loadMenuItems();
    }

    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  // Process payment and complete order
  const processPayment = async (paymentData: any) => {
    if (!selectedOrder || !restaurant) return;

    setIsProcessingPayment(true);

    try {
      // Update order status to completed with payment info
      const updateData: any = {
        status: 'completed' as OrderStatus,
        paymentMethod: paymentData.method,
        amountReceived: paymentData.amountReceived,
        finalTotal: paymentData.finalTotal,
        originalTotal: paymentData.originalTotal || selectedOrder.total,
      };

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

      const result = await OrderService.updateOrderStatus(selectedOrder.id, restaurant.id, 'completed', updateData);

      if (result.success) {
        await loadKitchenData();
        setShowPaymentModal(false);
        setSelectedOrder(null);

        let successMessage = 'Payment processed successfully!';
        if (paymentData.totalSavings > 0) {
          successMessage = `Payment processed! Customer saved ₹${paymentData.totalSavings} with coupon!`;
        }

        toast.success(successMessage, {
          duration: 4000,
          style: {
            background: 'rgba(34, 197, 94, 0.95)',
            color: '#fff',
          }
        });
      } else {
        toast.error('Failed to process payment');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Load menu items on component mount
  useEffect(() => {
    if (restaurant) {
      loadMenuItems();
    }
  }, [restaurant, loadMenuItems]);

  // Get status configuration
  const getStatusConfig = (status: OrderStatus) => {
    const configs = {
      placed: { 
        color: 'border-yellow-300 bg-yellow-50', 
        textColor: 'text-yellow-800',
        icon: Clock, 
        label: 'New Order'
      },
      confirmed: { 
        color: 'border-blue-300 bg-blue-50', 
        textColor: 'text-blue-800',
        icon: CheckCircle, 
        label: 'Confirmed'
      },
      preparing: { 
        color: 'border-orange-300 bg-orange-50', 
        textColor: 'text-orange-800',
        icon: ChefHat, 
        label: 'Preparing'
      },
      ready: { 
        color: 'border-green-300 bg-green-50', 
        textColor: 'text-green-800',
        icon: CheckCircle2, 
        label: 'Ready'
      },
    };
    return configs[status as keyof typeof configs] || configs.placed;
  };

  // Get order age in minutes
  const getOrderAge = (createdAt: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(diff / (1000 * 60));
  };

  // Handle "Get Orders" button click
  const handleGetOrders = async () => {
    await requestNotificationPermission();
    setIsAutoRefreshEnabled(true);
    await loadKitchenData(true);
    toast.success('🚀 Kitchen Display activated! Real-time order monitoring enabled.');
  };

  // Test function to create sample orders
  const createTestOrders = async () => {
    if (!restaurant || !tables.length) {
      toast.error('No restaurant or tables found. Please set up tables first.');
      return;
    }

    try {
      const testOrderStatuses: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'ready'];
      const sampleItems = [
        { name: 'Chicken Tikka Masala', price: 380, quantity: 2 },
        { name: 'Garlic Naan', price: 80, quantity: 3 },
        { name: 'Basmati Rice', price: 120, quantity: 1 },
        { name: 'Paneer Butter Masala', price: 350, quantity: 1 },
        { name: 'Dal Makhani', price: 280, quantity: 2 },
        { name: 'Tandoori Roti', price: 60, quantity: 4 },
      ];

      const promises = [];

      // Create 4 test orders with different statuses
      for (let i = 0; i < 4; i++) {
        const table = tables[i % tables.length];
        const status = testOrderStatuses[i];
        const randomItems = sampleItems.slice(i, i + 2); // 2 items per order
        
        const orderItems = randomItems.map(item => ({
          id: generateId(),
          menuItemId: generateId(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        }));

        const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        const testOrder = {
          id: generateId(),
          restaurantId: restaurant.id,
          orderNumber: generateOrderNumber(restaurant.id),
          tableId: table.id,
          type: 'dine_in' as const,
          status,
          items: orderItems,
          subtotal,
          tax,
          discount: 0,
          total,
          paymentStatus: 'pending' as const,
          notes: i % 2 === 0 ? `Special request: ${i === 0 ? 'Extra spicy' : 'No onions'}` : undefined,
          staffId: 'test-staff',
          createdAt: new Date(Date.now() - (i * 15 * 60 * 1000)), // Stagger creation times
          updatedAt: new Date(),
        };

        // Use OrderService to create the order properly
        promises.push(
          OrderService.createOrder(
            restaurant.id,
            table.id,
            'test-staff',
            orderItems.map(item => ({
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
              notes: '',
            })),
            18,
            testOrder.notes
          ).then(async (result) => {
            if (result.success && result.data) {
              // Update the status to the desired test status
              await OrderService.updateOrderStatus(result.data.id, restaurant.id, status);
            }
          })
        );
      }

      await Promise.all(promises);
      
      // Refresh the kitchen display
      await loadKitchenData(true);
      toast.success('🧪 Test orders created successfully!');
      
    } catch (error) {
      console.error('Failed to create test orders:', error);
      toast.error('Failed to create test orders');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Kitchen Display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Kitchen Display System</h1>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-600">Real-time order management for kitchen staff</p>
                  {restaurant && (
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                      connectionStatus === 'connected' 
                        ? 'bg-green-100 text-green-700' 
                        : connectionStatus === 'connecting'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'connected' 
                          ? 'bg-green-500 animate-pulse' 
                          : connectionStatus === 'connecting'
                          ? 'bg-yellow-500 animate-spin'
                          : 'bg-red-500'
                      }`}></div>
                      <span>
                        {connectionStatus === 'connected' ? 'Live' : 
                         connectionStatus === 'connecting' ? 'Connecting...' : 
                         'Disconnected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg transition-colors ${
                    soundEnabled 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={soundEnabled ? 'Sound enabled' : 'Sound disabled'}
                >
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>

                <button
                  onClick={requestNotificationPermission}
                  className={`p-2 rounded-lg transition-colors ${
                    notificationsEnabled 
                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
                >
                  {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                </button>

                <button
                  onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
                  className={`p-2 rounded-lg transition-colors ${
                    isAutoRefreshEnabled 
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={isAutoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                >
                  {isAutoRefreshEnabled ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
              </div>

              {/* Get Orders Button */}
              {!isAutoRefreshEnabled && (
                <button
                  onClick={handleGetOrders}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center space-x-2 font-medium"
                >
                  <Bell className="w-5 h-5" />
                  <span>Get Orders</span>
                </button>
              )}

              {/* Manual Refresh */}
              <button
                onClick={() => loadKitchenData(true)}
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Refresh</span>
              </button>

              {/* Test Orders Button (for development) */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={createTestOrders}
                  className="bg-purple-100 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-200 transition-colors flex items-center space-x-2"
                  title="Create test orders for KDS demonstration"
                >
                  <Package className="w-5 h-5" />
                  <span>Test Orders</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Orders</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalActiveOrders}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Utensils className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Preparing</p>
                <p className="text-3xl font-bold text-orange-600">{stats.preparingOrders}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready to Serve</p>
                <p className="text-3xl font-bold text-green-600">{stats.readyOrders}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Oldest Order</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.oldestOrder ? `${getOrderAge(stats.oldestOrder)}m ago` : 'None'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <Timer className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Menu Portal Orders Section */}
        {menuPortalOrders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Menu Portal Orders</h2>
              <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {menuPortalOrders.length} order{menuPortalOrders.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {menuPortalOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const StatusIcon = statusConfig.icon;
                const orderAge = getOrderAge(order.createdAt);
                const isUrgent = orderAge > 20;
                const isPending = order.status === 'placed';

                return (
                  <div
                    key={order.id}
                    className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-lg border-2 ${
                      isPending ? 'border-blue-400 ring-2 ring-blue-300 ring-opacity-50' : statusConfig.color
                    } transition-all duration-200 hover:shadow-xl ${
                      isUrgent ? 'ring-2 ring-red-500 ring-opacity-50' : ''
                    }`}
                  >
                    {/* Special Portal Header */}
                    <div className="p-4 border-b border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          <span className="text-lg font-bold text-gray-900">#{order.orderNumber}</span>
                        </div>
                        <div className={`flex items-center space-x-2 ${statusConfig.textColor}`}>
                          <StatusIcon className="w-5 h-5" />
                          <span className="text-sm font-medium">{statusConfig.label}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-blue-600">
                          <Package className="w-4 h-4" />
                          <span className="font-medium">
                            {(() => {
                              // Check if this is a table-specific order
                              const table = tables.find(t => t.id === order.tableId);
                              if (table) {
                                return `Table ${table.number} - ${table.area}`;
                              } else {
                                return 'Online Order';
                              }
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Timer className="w-4 h-4" />
                          <span className={isUrgent ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {orderAge}m ago
                          </span>
                          {isUrgent && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      
                      {(() => {
                        const table = tables.find(t => t.id === order.tableId);
                        return (
                          <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
                            <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatTime(order.createdAt)}</span>
                      </div>
                            {table && (
                              <div className="flex items-center space-x-1 text-blue-600">
                                <Users className="w-4 h-4" />
                                <span className="font-medium">{table.capacity} seats</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Order Items */}
                    <div className="p-4">
                      <div className="space-y-2 mb-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              {item.notes && (
                                <div className="text-sm text-gray-600 mt-1">
                                  <em>"{item.notes}"</em>
                                </div>
                              )}
                            </div>
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-yellow-800">
                            <strong>Customer Notes:</strong> {order.notes}
                          </p>
                        </div>
                      )}

                      {/* Portal-specific Action Buttons */}
                      <div className="space-y-2">
                        {isPending && (
                          <button
                            onClick={() => confirmMenuPortalOrder(order.id)}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-medium flex items-center justify-center space-x-2 shadow-lg"
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>Confirm Order</span>
                          </button>
                        )}
                        
                        {['confirmed', 'preparing', 'ready'].includes(order.status) && (
                          <button
                            onClick={() => handleMenuPortalPayment(order)}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-medium flex items-center justify-center space-x-2 shadow-lg"
                          >
                            <CreditCard className="w-5 h-5" />
                            <span>Process Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular Dine-in Orders Section */}
        {regularOrders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Dine-in Orders</h2>
              <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                {regularOrders.length} order{regularOrders.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regularOrders.map((order) => {
                const table = tables.find(t => t.id === order.tableId);
                const statusConfig = getStatusConfig(order.status);
                const StatusIcon = statusConfig.icon;
                const orderAge = getOrderAge(order.createdAt);
                const isUrgent = orderAge > 20;

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-xl shadow-sm border-2 ${statusConfig.color} transition-all duration-200 hover:shadow-md ${
                      isUrgent ? 'ring-2 ring-red-500 ring-opacity-50' : ''
                    }`}
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-gray-900">#{order.orderNumber}</span>
                        <div className={`flex items-center space-x-2 ${statusConfig.textColor}`}>
                          <StatusIcon className="w-5 h-5" />
                          <span className="text-sm font-medium">{statusConfig.label}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>Table {table?.number || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Timer className="w-4 h-4" />
                          <span className={isUrgent ? 'text-red-600 font-medium' : ''}>
                            {orderAge}m ago
                          </span>
                          {isUrgent && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatTime(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="p-4">
                      <div className="space-y-2 mb-4">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              {item.notes && (
                                <div className="text-sm text-gray-600 mt-1">
                                  <em>"{item.notes}"</em>
                                </div>
                              )}
                            </div>
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-yellow-800">
                            <strong>Special Instructions:</strong> {order.notes}
                          </p>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="space-y-2">
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          <span>Order Done</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No Orders State */}
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Orders</h3>
            <p className="text-gray-600 mb-4">
              {isAutoRefreshEnabled 
                ? 'All caught up! New orders will appear here automatically.'
                : 'Click "Get Orders" to start receiving order notifications.'}
            </p>
            <div className="text-center">
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  Real-time monitoring is <strong className="text-green-600">ACTIVE</strong>
                </p>
                <p className="text-sm text-gray-500">
                  New orders will appear automatically when placed from other devices
                </p>
              </div>
              
              {!isAutoRefreshEnabled && (
                <button
                  onClick={handleGetOrders}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium"
                >
                  <Bell className="w-5 h-5 mr-2 inline" />
                  Enable Notifications
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Payment Modal for Menu Portal Orders */}
      {showPaymentModal && selectedOrder && (
        <PaymentModalWithCoupons
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOrder(null);
          }}
          restaurant={restaurant}
          table={{ number: 'Online', id: 'customer-portal' }} // Mock table for portal orders
          onPayment={processPayment}
          isProcessing={isProcessingPayment}
          cartItems={selectedOrder.items.map(item => ({
            menuItemId: item.id || item.menuItemId || '',
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.total,
            variants: item.variants || []
          }))}
          menuItems={menuItems}
        />
      )}
    </div>
  );
}