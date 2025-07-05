import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  Check,
  Receipt,
  CreditCard,
  Search,
  Printer,
  Filter,
  Trash2,
  Utensils,
  ArrowRightLeft,
  MoreVertical,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { MenuService } from '@/services/menuService';
import { OrderService, CartManager, CartItem } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { CustomerService } from '@/services/customerService';
import { CouponService } from '@/services/couponService';
import { CreditService } from '@/services/creditService';
import { MenuItem, Category, Table, Order, PaymentMethod, Discount, SelectedVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { generateUPIPaymentString, generateQRCodeDataURL } from '@/utils/upiUtils';
import VariantSelectionModal from '@/components/restaurant/VariantSelectionModal';
import PaymentModalWithCoupons from '@/components/restaurant/PaymentModalWithCoupons';
import TableManagementModal from '@/components/restaurant/TableManagementModal';
import { VoiceCommand } from '@/services/voiceService';
import { VoiceLoadingOverlay } from '@/components/voice/VoiceLoadingOverlay';
import { VoiceKOTDialog } from '@/components/voice/VoiceKOTDialog';

interface OrderNotes {
  orderNotes: string;
}

interface PaymentForm {
  method: PaymentMethod;
  amountReceived?: number;
  tip?: number;
  reference?: string;
  customerId?: string;
  discount?: Discount;
  couponCode?: string;
}

type OrderState = 'cart' | 'placed' | 'completed' | 'adding_more';

export default function TakeOrder() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  
  const [table, setTable] = useState<Table | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [, setCurrentOrder] = useState<Order | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderState, setOrderState] = useState<OrderState>('cart');
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [showTableManagement, setShowTableManagement] = useState(false);
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);
  
  // Voice command loading states
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceLoadingStage, setVoiceLoadingStage] = useState<'processing' | 'placing' | 'completed'>('processing');
  const [voiceLoadingMessage, setVoiceLoadingMessage] = useState('');
  const [showVoiceKOTDialog, setShowVoiceKOTDialog] = useState(false);
  const [voiceOrderDetails, setVoiceOrderDetails] = useState<{
    orderNumber: string;
    tableNumber: string;
    items: Array<{ name: string; quantity: number }>;
  } | null>(null);

  // Add state for manual order KOT dialog
  const [showKOTDialog, setShowKOTDialog] = useState(false);
  const [kotOrderDetails, setKotOrderDetails] = useState<{
    orderNumber: string;
    tableNumber: string;
    items: Array<{ name: string; quantity: number }>;
  } | null>(null);
  const [currentOrderForKOT, setCurrentOrderForKOT] = useState<Order | null>(null);

  // WhatsApp functionality state
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [useWhatsAppWeb, setUseWhatsAppWeb] = useState(true); // Default to web since user mentioned they have it open

  const { register, handleSubmit, reset } = useForm<OrderNotes>();
  const { setValue: setPaymentValue } = useForm<PaymentForm>({
    defaultValues: { method: 'cash' }
  });

  // Debug: Track authentication state changes
  useEffect(() => {
    console.log('🔐 TakeOrder: Auth state changed:', {
      hasUser: !!user,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      loading: false // Note: loading state not available in this component
    });
  }, [user]);

  // Close mobile actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileActionsMenu) {
        const target = event.target as Element;
        if (!target.closest('.mobile-actions-menu')) {
          setShowMobileActionsMenu(false);
        }
      }
    };

    if (showMobileActionsMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMobileActionsMenu]);

  // Load table, menu, and cart data
  const loadData = async () => {
    if (!restaurant || !tableId) return;

    try {
      setIsLoading(true);

      // Load table details
      const tableResult = await TableService.getTableById(tableId, restaurant.id);
      if (tableResult.success && tableResult.data) {
        setTable(tableResult.data);
      }

      // Initialize menu if needed
      console.log('🍽️ Initializing default menu for restaurant:', restaurant.id);
      const initResult = await MenuService.initializeDefaultMenu(restaurant.id);
      if (initResult.success) {
        console.log('✅ Default menu initialization successful');
      } else {
        console.error('❌ Default menu initialization failed:', initResult.error);
      }

      // Load menu items and categories
      const [menuResult, categoriesResult] = await Promise.all([
        MenuService.getMenuItemsForRestaurant(restaurant.id),
        MenuService.getCategoriesForRestaurant(restaurant.id),
      ]);

      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data.filter(item => item.isAvailable));
      }

      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      toast.error('Failed to load menu data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = () => {
    if (restaurant && tableId) {
      const items = CartManager.getCartItems(restaurant.id, tableId);
      setCartItems(items);
    }
  };

  const checkExistingOrder = async (retryCount = 0) => {
    if (!restaurant || !tableId) return;

    try {
      // Clear cache to ensure we get fresh data
      OrderService.clearCache(restaurant.id);
      
      // Small delay to allow Firebase updates to propagate if this is a retry
      if (retryCount > 0) {
        console.log(`🔄 TakeOrder: Retry attempt ${retryCount} for table ${tableId}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Check if there's an active order for this table
      const ordersResult = await OrderService.getOrdersByTable(restaurant.id, tableId);
      if (ordersResult.success && ordersResult.data) {
        const activeOrders = ordersResult.data.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status) ||
          (order.status === 'completed' && order.paymentStatus !== 'paid')
        );
        
        console.log(`🍽️ TakeOrder: Found ${activeOrders.length} active orders for table ${tableId}`, {
          orders: activeOrders.map(o => ({ id: o.id, status: o.status, paymentStatus: o.paymentStatus }))
        });
        
        // Check for inconsistent state: table is available but has active orders
        if (table && table.status === 'available' && activeOrders.length > 0) {
          console.warn(`⚠️ TakeOrder: Inconsistent state detected - Table ${table.number} shows as available but has ${activeOrders.length} active orders`);
          
          // Auto-cancel these stale orders since table is marked available
          console.log(`🔧 TakeOrder: Auto-cancelling ${activeOrders.length} stale orders for available table ${table.number}`);
          
          const cancelPromises = activeOrders.map(async (order) => {
            return OrderService.updateOrderStatus(order.id, restaurant.id, 'cancelled', {
              notes: `Auto-cancelled: Table marked as available but order was still active - ${new Date().toLocaleString()}`
            });
          });
          
          await Promise.all(cancelPromises);
          
          // Clear cache and reset state after cleaning up
          OrderService.clearCache(restaurant.id);
          setAllOrders([]);
          setCurrentOrder(null);
          setCurrentOrderForKOT(null);
          setOrderState('cart');
          CartManager.clearCart(restaurant.id, tableId);
          setCartItems([]);
          
          toast.success(`🔧 Cleaned up ${activeOrders.length} stale order(s) for Table ${table.number}`);
          return;
        }
        
        // Deduplicate orders by ID before setting
        const uniqueOrders = activeOrders.filter((order, index, self) => 
          index === self.findIndex(o => o.id === order.id)
        );
        setAllOrders(uniqueOrders);
        
        if (activeOrders.length > 0) {
          // Set the most recent order as current
          const latestOrder = activeOrders.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          
          setCurrentOrder(latestOrder);
          
          // Always set to 'placed' if we have active orders, regardless of current state
          console.log(`🍽️ TakeOrder: Found ${activeOrders.length} active orders, forcing state to 'placed'`);
          setOrderState('placed');
          
          // Clear cart since order is already placed
          CartManager.clearCart(restaurant!.id, tableId);
          setCartItems([]);
        } else {
          console.log(`🍽️ TakeOrder: No active orders found for table ${tableId}`);
          
          // If no orders found and this is first attempt, retry once
          if (retryCount === 0) {
            console.log(`🔄 TakeOrder: No orders found, retrying once for table ${tableId}`);
            setTimeout(() => checkExistingOrder(1), 500);
            return;
          }
          
          // Only reset to cart if we're not already in a specific state
          if (orderState !== 'completed') {
            console.log(`🍽️ TakeOrder: Resetting to cart state`);
            setOrderState('cart');
            setCurrentOrder(null);
            setCurrentOrderForKOT(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check existing order:', error);
      
      // Retry once on error
      if (retryCount === 0) {
        console.log(`🔄 TakeOrder: Error occurred, retrying for table ${tableId}`);
        setTimeout(() => checkExistingOrder(1), 1000);
      }
    }
  };

  const addToCart = (menuItem: MenuItem, quantity: number = 1, forceAdd: boolean = false) => {
    console.log(`🛒 addToCart called:`, { 
      itemName: menuItem.name, 
      quantity, 
      forceAdd, 
      orderState, 
      hasRestaurant: !!restaurant, 
      hasTableId: !!tableId 
    });

    if (!restaurant || !tableId) {
      console.error(`🛒 Missing required data: restaurant=${!!restaurant}, tableId=${!!tableId}`);
      return;
    }

    // For voice commands with forceAdd, bypass orderState checks
    if (!forceAdd && !['cart', 'adding_more'].includes(orderState)) {
      console.log(`🛒 Order state ${orderState} not allowed for manual add, skipping`);
      return;
    }

    // Check if item has variants (skip for voice commands with forceAdd)
    if (menuItem.variants && menuItem.variants.length > 0 && !forceAdd) {
      setSelectedMenuItem(menuItem);
      setShowVariantModal(true);
      return;
    }

    // Add item without variants
    const cartItem: CartItem = {
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      total: menuItem.price * quantity,
    };

    console.log(`🛒 Adding cart item:`, cartItem);
    const updatedCart = CartManager.addToCart(restaurant.id, cartItem, tableId);
    console.log(`🛒 Cart updated, new length: ${updatedCart.length}`);
    setCartItems(updatedCart);
    toast.success(`${menuItem.name} added to order`);
  };

  const handleVariantConfirm = (variants: SelectedVariant[], finalPrice: number) => {
    if (!restaurant || !tableId || !selectedMenuItem) return;

    // Ensure finalPrice is a valid number
    const validPrice = Number(finalPrice) || Number(selectedMenuItem.price) || 0;
    
    // Create item name with variants
    const variantDescriptions = variants.map(v => `${v.variantName}: ${v.optionName}`);
    const itemName = variantDescriptions.length > 0 
      ? `${selectedMenuItem.name} (${variantDescriptions.join(', ')})`
      : selectedMenuItem.name;

    const cartItem: CartItem = {
      menuItemId: selectedMenuItem.id,
      name: itemName,
      price: validPrice,
      quantity: 1,
      total: validPrice,
      variants: variants,
    };

    const updatedCart = CartManager.addToCart(restaurant.id, cartItem, tableId);
    setCartItems(updatedCart);
    toast.success(`${selectedMenuItem.name} added to order`);
    
    // Reset variant modal state
    setSelectedMenuItem(null);
    setShowVariantModal(false);
  };

  const updateCartItemQuantity = (menuItemId: string, quantity: number) => {
    if (!restaurant || !tableId || !['cart', 'adding_more'].includes(orderState)) return;

    const updatedCart = CartManager.updateCartItemQuantity(restaurant.id, menuItemId, quantity, tableId);
    setCartItems(updatedCart);
  };

  const removeFromCart = (menuItemId: string) => {
    if (!restaurant || !tableId || !['cart', 'adding_more'].includes(orderState)) return;

    const updatedCart = CartManager.removeFromCart(restaurant.id, menuItemId, tableId);
    setCartItems(updatedCart);
  };

  const handleAddMoreOrder = () => {
    setOrderState('adding_more');
    setShowSidePanel(true);
    if (restaurant) {
    CartManager.clearCart(restaurant.id, tableId);
    }
    setCartItems([]);
    reset();
  };

  // Helper function for placing orders with specific cart items (used by voice commands)
  const handlePlaceOrderWithCart = async (cartItemsToUse: CartItem[], data: OrderNotes): Promise<Order | null> => {
    console.log('📝 handlePlaceOrderWithCart called with:', { 
      restaurant: restaurant?.name, 
      tableId, 
      cartItemsCount: cartItemsToUse.length,
      user: user?.name,
      userId: user?.id,
      orderNotes: data.orderNotes,
      isVoiceProcessing 
    });

    if (!restaurant || !tableId || cartItemsToUse.length === 0 || !user) {
      const missingItems = [];
      if (!restaurant) missingItems.push('restaurant');
      if (!tableId) missingItems.push('tableId');
      if (cartItemsToUse.length === 0) missingItems.push('cartItems');
      if (!user) missingItems.push('user');
      
      const errorMsg = `Unable to place order. Missing: ${missingItems.join(', ')}`;
      console.error('❌ Order placement failed:', errorMsg);
      if (!isVoiceProcessing) {
        toast.error(errorMsg);
      }
      return null;
    }

    try {
      setIsPlacingOrder(true);

      // Calculate totals
      const subtotal = cartItemsToUse.reduce((sum, item) => sum + item.total, 0);
      const taxRate = restaurant.settings?.taxRate || 8.5;
      const tax = (subtotal * taxRate) / 100;
      const total = subtotal + tax;

      console.log('💰 Order totals:', { subtotal, taxRate, tax, total });

      // Create order
      const result = await OrderService.createOrder(
        restaurant.id,
        tableId,
        user.id,
        cartItemsToUse,
        taxRate,
        data.orderNotes
      );

      if (result.success && result.data) {
        const newOrder = result.data;
        console.log('✅ Order created successfully:', {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          total: newOrder.total,
          itemCount: newOrder.items.length
        });

        setCurrentOrder(newOrder);
        setCurrentOrderForKOT(newOrder); // Track this order for KOT printing
        
        // Update orders list
        if (orderState === 'adding_more') {
          setAllOrders(prev => {
            // Check if order already exists to prevent duplicates
            const existingOrder = prev.find(order => order.id === newOrder.id);
            if (existingOrder) {
              return prev; // Order already exists, don't add duplicate
            }
            return [...prev, newOrder];
          });
          setOrderState('placed');
          setShowSidePanel(false);
        } else {
          setAllOrders([newOrder]);
          setOrderState('placed');
        }
        
        // Clear cart and form
        CartManager.clearCart(restaurant.id, tableId);
        setCartItems([]);
        reset();
        
        // Only show success toast if not voice processing (voice has its own final message)
        if (!isVoiceProcessing) {
          const message = orderState === 'adding_more' ? 'Additional order placed successfully!' : 'Order placed successfully!';
          toast.success(message);
        }
        console.log('🎉 Order placement completed successfully');
        
        // Show KOT dialog instead of automatically printing
        if (table) {
          setKotOrderDetails({
            orderNumber: newOrder.orderNumber,
            tableNumber: table.number,
            items: newOrder.items.map(item => ({
              name: item.name,
              quantity: item.quantity
            }))
          });
          setShowKOTDialog(true);
        }
        
        return newOrder;
      } else {
        console.error('❌ Order creation failed:', result.error);
        if (!isVoiceProcessing) {
          toast.error(result.error || 'Failed to place order');
        }
        return null;
      }
    } catch (error) {
      console.error('❌ Order placement exception:', error);
      if (!isVoiceProcessing) {
        toast.error('Failed to place order');
      }
      return null;
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async (data: OrderNotes) => {
    console.log('📝 handlePlaceOrder called with:', { 
      restaurant: restaurant?.name, 
      tableId, 
      cartItemsCount: cartItems.length,
      user: user?.name,
      userId: user?.id,
      orderNotes: data.orderNotes 
    });

    if (!restaurant || !tableId || cartItems.length === 0 || !user) {
      const missingItems = [];
      if (!restaurant) missingItems.push('restaurant');
      if (!tableId) missingItems.push('tableId');
      if (cartItems.length === 0) missingItems.push('cartItems');
      if (!user) missingItems.push('user');
      
      const errorMsg = `Unable to place order. Missing: ${missingItems.join(', ')}`;
      console.error('❌ Order placement failed:', errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setIsPlacingOrder(true);
      console.log('🚀 Starting order placement process...');

      // Update table status to occupied only if it's the first order
      if (orderState === 'cart') {
        console.log('📋 Updating table status to occupied...');
        await TableService.updateTable(tableId, restaurant.id, { status: 'occupied' });
      }

      // Create order
      console.log('📝 Creating order in Firebase...', {
        restaurantId: restaurant.id,
        tableId,
        staffId: user.id,
        itemCount: cartItems.length,
        taxRate: restaurant.settings.taxRate
      });

      const result = await OrderService.createOrder(
        restaurant.id,
        tableId,
        user.id,
        cartItems,
        restaurant.settings.taxRate,
        data.orderNotes || undefined
      );

      if (result.success && result.data) {
        const newOrder = result.data;
        console.log('✅ Order created successfully:', {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          total: newOrder.total,
          itemCount: newOrder.items.length
        });

        setCurrentOrder(newOrder);
        setCurrentOrderForKOT(newOrder); // Track this order for KOT printing
        
        // Update orders list
        if (orderState === 'adding_more') {
          setAllOrders(prev => {
            // Check if order already exists to prevent duplicates
            const existingOrder = prev.find(order => order.id === newOrder.id);
            if (existingOrder) {
              return prev; // Order already exists, don't add duplicate
            }
            return [...prev, newOrder];
          });
          setOrderState('placed');
          setShowSidePanel(false);
        } else {
          setAllOrders([newOrder]);
          setOrderState('placed');
          // Close mobile sidebar if it's open
          setShowSidePanel(false);
        }
        
        // Clear cart and form
        CartManager.clearCart(restaurant.id, tableId);
        setCartItems([]);
        reset();
        
        const message = orderState === 'adding_more' ? 'Additional order placed successfully!' : 'Order placed successfully!';
        toast.success(message);
        console.log('🎉 Order placement completed successfully');
        
        // Show KOT dialog instead of automatically printing
        if (table) {
          setKotOrderDetails({
            orderNumber: newOrder.orderNumber,
            tableNumber: table.number,
            items: newOrder.items.map(item => ({
              name: item.name,
              quantity: item.quantity
            }))
          });
          setShowKOTDialog(true);
        }
      } else {
        console.error('❌ Order creation failed:', result.error);
        toast.error(result.error || 'Failed to place order');
      }
    } catch (error) {
      console.error('❌ Order placement exception:', error);
      toast.error('Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };



  const handlePrintKOT = () => {
    if (!restaurant || !table || !currentOrderForKOT) return;

    // Use the tracked order that was just placed
    const orderToPrint = currentOrderForKOT;
    let kotContent;
    
    if (allOrders.length === 1) {
      // Single order - use regular KOT
      kotContent = generateKOTContent(orderToPrint, restaurant, table);
    } else {
      // Multiple orders - show only the latest order as "ADDITIONAL ORDER"
      kotContent = generateAdditionalKOTContent(orderToPrint, restaurant, table, allOrders.length);
    }
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(kotContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
    
    toast.success('KOT sent to printer');
  };



  const handlePayment = async (data: any) => {
    if (!restaurant || !tableId || !table || allOrders.length === 0) return;

    try {
      setIsProcessingPayment(true);

      // Handle coupon usage if applied
      if (data.appliedCoupon) {
        try {
          await CouponService.markCouponAsUsed(data.appliedCoupon.coupon.id, restaurant.id);
          toast.success(`Coupon "${data.appliedCoupon.coupon.code}" has been redeemed!`);
        } catch (error) {
          console.error('Failed to mark coupon as used:', error);
          // Continue with payment even if coupon marking fails
        }
      }

      // Handle credit transaction if payment is partial
      let creditTransactionId = null;
      if (data.isCredit && data.creditCustomerName) {
        const creditResult = await CreditService.createCreditTransaction({
          restaurantId: restaurant.id,
          customerId: data.customerId,
          customerName: data.creditCustomerName,
          customerPhone: data.creditCustomerPhone,
          orderId: allOrders.map(o => o.id).join(','),
          tableNumber: table.number,
          totalAmount: data.finalTotal,
          amountReceived: data.amountReceived,
          paymentMethod: data.method,
          notes: `Credit payment for Table ${table.number}`
        });

        if (creditResult.success) {
          creditTransactionId = creditResult.creditId;
          toast.success(`Credit transaction created for ${formatCurrency(data.creditAmount)}`);
        } else {
          toast.error('Failed to create credit transaction');
          return;
        }
      }

      // Update all active orders status to completed
      const updatePromises = allOrders.map(async (order) => {
        // Calculate this order's proportional share of the payment
        const orderOriginalTotal = order.subtotal + order.tax;
        const totalOriginalAmount = allOrders.reduce((sum, o) => sum + o.subtotal + o.tax, 0);
        const orderProportion = totalOriginalAmount > 0 ? orderOriginalTotal / totalOriginalAmount : 1;
        
        // Calculate proportional amounts for this specific order
        const orderFinalTotal = data.finalTotal * orderProportion;
        const orderAmountReceived = data.amountReceived * orderProportion;
        
        const updateData: any = { 
          status: 'completed',
          paymentMethod: data.isCredit ? (data.addWholeAmountAsCredit ? 'credit' : 'partial_credit') : data.method,
          amountReceived: orderAmountReceived,
          finalTotal: orderFinalTotal,
          originalTotal: orderOriginalTotal,
          // Keep original total to preserve the actual order amount - DO NOT overwrite with combined total
          // total: order.total // Keep the original order total unchanged
        };
        
        // Add discount information to preserve it in order record (proportional to this order)
        if (data.manualDiscountAmount > 0 || data.couponDiscountAmount > 0) {
          const totalDiscountAmount = (data.manualDiscountAmount || 0) + (data.couponDiscountAmount || 0);
          const orderDiscountAmount = totalDiscountAmount * orderProportion;
          
          updateData.discountApplied = true;
          updateData.totalDiscountAmount = orderDiscountAmount;
          updateData.originalTotalBeforeDiscount = orderOriginalTotal;
          
          // Store manual discount details (proportional)
          if (data.manualDiscount) {
            updateData.manualDiscount = {
              type: data.manualDiscount.type,
              value: data.manualDiscount.value,
              amount: data.manualDiscountAmount * orderProportion,
              reason: data.manualDiscount.reason || ''
            };
          }
          
          // Store coupon discount details (proportional)
          if (data.couponDiscountAmount > 0) {
            updateData.couponDiscountAmount = data.couponDiscountAmount * orderProportion;
          }
          
          // Update the discount field for backward compatibility (proportional)
          updateData.discount = orderDiscountAmount;
        }
        
        // Add tip information if provided (proportional)
        if (data.tip > 0) {
          updateData.tip = data.tip * orderProportion;
        }
        
        // Add total savings information (proportional)
        if (data.totalSavings > 0) {
          updateData.totalSavings = data.totalSavings * orderProportion;
        }
        
        // Add credit information if applicable (proportional)
        if (data.isCredit) {
          updateData.isCredit = true;
          updateData.creditAmount = data.creditAmount * orderProportion;
          updateData.creditCustomerName = data.creditCustomerName;
          updateData.creditCustomerPhone = data.creditCustomerPhone;
          updateData.creditTransactionId = creditTransactionId;
        }
        
        // Add coupon information if applied (proportional)
        if (data.appliedCoupon) {
          updateData.appliedCoupon = {
            code: data.appliedCoupon.coupon.code,
            name: data.appliedCoupon.coupon.name,
            discountAmount: (data.appliedCoupon.discountAmount || 0) * orderProportion,
            freeItems: data.appliedCoupon.freeItems || [],
            totalSavings: (data.totalSavings || 0) * orderProportion
          };
        }
        
        // Add customer to order if selected
        if (data.customerId) {
          updateData.customerId = data.customerId;
        }
        
        return OrderService.updateOrderStatus(order.id, restaurant.id, 'completed', updateData);
      });
      
      const results = await Promise.all(updatePromises);
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        // Link orders to customer if provided
        if (data.customerId) {
          await CustomerService.addOrderToCustomer(
            data.customerId,
            restaurant.id,
            allOrders.map(o => o.id).join(','),
            data.finalTotal
          );
        }
        
        // Update table status back to available
        await TableService.updateTable(tableId, restaurant.id, { status: 'available' });
        
        setOrderState('completed');
        setShowPaymentModal(false);
        
        let successMessage = 'Payment processed successfully!';
        if (data.isCredit) {
          successMessage = `Payment processed! Credit of ${formatCurrency(data.creditAmount)} recorded for ${data.creditCustomerName}`;
        } else if (data.totalSavings > 0) {
          successMessage = `Payment processed! Customer saved ${formatCurrency(data.totalSavings)} with coupon!`;
        }
        
        toast.success(successMessage);
        
        // Automatically open print dialog for combined bill
        setTimeout(async () => {
          await handlePrintCombinedBill(allOrders, data);
        }, 500);
      } else {
        toast.error('Failed to complete payment for some orders');
      }
    } catch (error) {
      toast.error('Failed to process payment');
      console.error('Payment error:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const clearCart = () => {
    if (!restaurant || !tableId || !['cart', 'adding_more'].includes(orderState)) return;

    CartManager.clearCart(restaurant.id, tableId);
    setCartItems([]);
    
    if (orderState === 'adding_more') {
      setOrderState('placed');
      setShowSidePanel(false);
    }
    
    toast.success('Order cleared');
  };

  // Cancel all orders for the table
  const handleCancelAllOrders = async () => {
    if (!restaurant || !tableId || !table || allOrders.length === 0) return;

    const confirmed = confirm(
      `Are you sure you want to cancel all ${allOrders.length} order(s) for Table ${table.number}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsPlacingOrder(true); // Show loading state

      // Update all active orders status to cancelled
      const cancelPromises = allOrders.map(async (order) => {
        return OrderService.updateOrderStatus(order.id, restaurant.id, 'cancelled', {
          notes: 'Order cancelled manually - ' + new Date().toLocaleString()
        });
      });

      const results = await Promise.all(cancelPromises);
      const allSuccessful = results.every(result => result.success);

      if (allSuccessful) {
        // Update table status back to available
        await TableService.updateTable(tableId, restaurant.id, { status: 'available' });

                  // Clear the current orders and cart
          setAllOrders([]);
          setCurrentOrder(null);
          setCurrentOrderForKOT(null);
          setOrderState('cart');
          CartManager.clearCart(restaurant.id, tableId);
          setCartItems([]);

        toast.success(`All orders for Table ${table.number} have been cancelled successfully`);

        // Navigate back to tables page after a brief delay
        setTimeout(() => {
          navigate(`/${restaurant.slug}/tables`);
        }, 1500);
      } else {
        toast.error('Failed to cancel some orders. Please try again.');
      }
    } catch (error) {
      console.error('Error canceling orders:', error);
      toast.error('Failed to cancel orders');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePrintCombinedBill = async (orders: Order[], paymentData: any) => {
    if (!orders.length || !restaurant || !table) return;

    try {
      // Show loading toast
      const toastId = toast.loading('Generating bill with QR code...');
      
      // Create combined bill content (now async for QR code generation)
      console.log('🏷️ Starting bill generation with QR code...');
      const billContent = await generateCombinedBillContent(orders, restaurant, table, paymentData);
      
      // Dismiss loading toast
      toast.dismiss(toastId);
      
      // Small delay to ensure QR code is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(billContent);
        printWindow.document.close();
        
        // Wait a bit more for images to load
        printWindow.addEventListener('load', () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 1000);
        });
        
        // Fallback for immediate print
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 2000);
      }
      
      toast.success('Combined bill sent to printer');
    } catch (error) {
      console.error('❌ Error generating bill:', error);
      toast.error('Failed to generate bill');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappNumber.trim()) {
      toast.error('Please enter a WhatsApp number');
      return;
    }

    if (!restaurant || !table) {
      toast.error('Restaurant or table data not available');
      return;
    }

    setIsSendingWhatsApp(true);

    try {
      // Import WhatsApp utilities
      const { WhatsAppUtils } = await import('@/utils/whatsappUtils');

      // Get orders data - use current state or fetch recent completed orders
      let ordersToUse = allOrders;
      
      if (ordersToUse.length === 0) {
        // Fallback: fetch recent completed orders for this table
        console.log('🔄 WhatsApp: No orders in state, fetching recent completed orders...');
        const ordersResult = await OrderService.getOrdersByTable(restaurant.id, tableId || '');
        
        if (ordersResult.success && ordersResult.data) {
          // Get completed orders from today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const recentCompletedOrders = ordersResult.data.filter(order => 
            order.status === 'completed' && 
            new Date(order.createdAt) >= today
          ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (recentCompletedOrders.length > 0) {
            ordersToUse = recentCompletedOrders;
            console.log(`✅ WhatsApp: Found ${ordersToUse.length} recent completed orders`);
          }
        }
      }

      if (ordersToUse.length === 0) {
        toast.error('No recent orders found for this table');
        return;
      }

      // Generate bill content for WhatsApp
      const lastPaymentData = {
        method: 'cash', // Default, can be enhanced to store actual payment data
        amountReceived: ordersToUse.reduce((sum, order) => sum + order.total, 0),
        finalTotal: ordersToUse.reduce((sum, order) => sum + order.total, 0),
        originalTotal: ordersToUse.reduce((sum, order) => sum + order.total, 0)
      };

      const billContent = await generateCombinedBillContent(ordersToUse, restaurant, table, lastPaymentData);
      
      // Create formatted message using utility
      const messageData = {
        restaurantName: restaurant.name || 'Restaurant',
        tableNumber: table.number,
        orderNumbers: ordersToUse.map(order => order.orderNumber),
        totalAmount: ordersToUse.reduce((sum, order) => sum + order.total, 0),
        billContent: billContent
      };

      const messageText = WhatsAppUtils.generateBillMessage(messageData);

      // Create WhatsApp URL using utility
      const whatsappUrl = WhatsAppUtils.createWhatsAppUrl(whatsappNumber, messageText, useWhatsAppWeb);
      
      // Open WhatsApp in a new window/tab
      window.open(whatsappUrl, '_blank');
      
      const successMessage = useWhatsAppWeb 
        ? 'WhatsApp Web opened! Send the bill to complete sharing.'
        : 'WhatsApp opened! Send the bill to complete sharing.';
      toast.success(successMessage);
      
      // Clear the WhatsApp number after successful operation
      setWhatsappNumber('');
      
    } catch (error) {
      console.error('Error preparing WhatsApp bill:', error);
      if (error instanceof Error && error.message.includes('Invalid phone number')) {
        toast.error('Please enter a valid phone number');
      } else {
        toast.error('Failed to prepare WhatsApp bill');
      }
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleDownloadPDFAndShare = async () => {
    if (!whatsappNumber.trim()) {
      toast.error('Please enter a WhatsApp number');
      return;
    }

    if (!restaurant || !table) {
      toast.error('Restaurant or table data not available');
      return;
    }

    setIsGeneratingPDF(true);

    try {
      // Import WhatsApp utilities
      const { WhatsAppUtils } = await import('@/utils/whatsappUtils');

      // Get orders data - use current state or fetch recent completed orders
      let ordersToUse = allOrders;
      
      if (ordersToUse.length === 0) {
        // Fallback: fetch recent completed orders for this table
        console.log('🔄 PDF: No orders in state, fetching recent completed orders...');
        const ordersResult = await OrderService.getOrdersByTable(restaurant.id, tableId || '');
        
        if (ordersResult.success && ordersResult.data) {
          // Get completed orders from today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const recentCompletedOrders = ordersResult.data.filter(order => 
            order.status === 'completed' && 
            new Date(order.createdAt) >= today
          ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          if (recentCompletedOrders.length > 0) {
            ordersToUse = recentCompletedOrders;
            console.log(`✅ PDF: Found ${ordersToUse.length} recent completed orders`);
          }
        }
      }

      if (ordersToUse.length === 0) {
        toast.error('No recent orders found for this table');
        return;
      }

      // Generate bill content for PDF
      const lastPaymentData = {
        method: 'cash', // Default, can be enhanced to store actual payment data
        amountReceived: ordersToUse.reduce((sum, order) => sum + order.total, 0),
        finalTotal: ordersToUse.reduce((sum, order) => sum + order.total, 0),
        originalTotal: ordersToUse.reduce((sum, order) => sum + order.total, 0)
      };

      const billContent = await generateCombinedBillContent(ordersToUse, restaurant, table, lastPaymentData);
      
      // Generate and download PDF
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `${restaurant.name.replace(/\s+/g, '_')}_Table_${table.number}_${timestamp}.pdf`;
      
      await WhatsAppUtils.generateBillPDF(billContent, fileName);
      
      // Create short message for PDF sharing
      const messageData = {
        restaurantName: restaurant.name || 'Restaurant',
        tableNumber: table.number,
        orderNumbers: ordersToUse.map(order => order.orderNumber),
        totalAmount: ordersToUse.reduce((sum, order) => sum + order.total, 0)
      };

      const messageText = WhatsAppUtils.generatePDFSharingMessage(messageData);

      // Create WhatsApp URL with message
      const whatsappUrl = WhatsAppUtils.createWhatsAppUrl(whatsappNumber, messageText, useWhatsAppWeb);
      
      // Open WhatsApp in a new window/tab
      window.open(whatsappUrl, '_blank');
      
      const successMessage = useWhatsAppWeb 
        ? 'PDF downloaded! WhatsApp Web opened - please attach the downloaded PDF file.'
        : 'PDF downloaded! WhatsApp opened - please attach the downloaded PDF file.';
      toast.success(successMessage, { duration: 5000 });
      
      // Clear the WhatsApp number after successful operation
      setWhatsappNumber('');
      
    } catch (error) {
      console.error('Error generating PDF or preparing WhatsApp:', error);
      if (error instanceof Error && error.message.includes('Invalid phone number')) {
        toast.error('Please enter a valid phone number');
      } else if (error instanceof Error && error.message.includes('Failed to generate PDF')) {
        toast.error('Failed to generate PDF. Please try the text version instead.');
      } else {
        toast.error('Failed to generate PDF bill');
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Voice Command Handlers
  const handleVoiceOrderCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 TakeOrder: Voice order command received:', command);
    
    if (!restaurant || !tableId) {
      toast.error('🎤 Unable to process order at this time');
      return;
    }
    
    if (!command.tableNumber || parseInt(table?.number || '') !== command.tableNumber) {
      const currentTableNumber = table?.number;
      console.warn(`🎤 Table mismatch: current=${currentTableNumber}, requested=${command.tableNumber}`);
      toast.error(`🎤 This is table ${currentTableNumber}, but order was requested for table ${command.tableNumber}`);
      return;
    }
    
    // Start voice loading and dismiss all existing toasts
    toast.dismiss();
    setIsVoiceProcessing(true);
    setVoiceLoadingStage('processing');
    setVoiceLoadingMessage('Processing voice command...');
    
    // Check if table already has existing orders
    const hasExistingOrders = allOrders.length > 0;
    const isAddingToExistingOrder = hasExistingOrders && (orderState === 'placed' || orderState === 'completed');
    
    console.log('🎤 Voice Order Context:', {
      tableNumber: table?.number,
      hasExistingOrders,
      existingOrdersCount: allOrders.length,
      currentOrderState: orderState,
      isAddingToExistingOrder
    });
    
    if (command.menuItems && command.menuItems.length > 0) {
      let addedItems = 0;
      
      // Use AI-powered menu matching
      try {
        console.log('🎤 TakeOrder: Using AI to match voice items to menu items...');
        const { VoiceService } = await import('@/services/voiceService');
        const matchedItems = await VoiceService.matchMenuItemsIntelligently(command.menuItems, menuItems);
        
        setVoiceLoadingStage('placing');
        
        // Update loading message based on context
        if (isAddingToExistingOrder) {
          setVoiceLoadingMessage(`Adding items to existing order for table ${table?.number}...`);
          console.log('🎤 Adding items to existing order (add-more functionality)');
        } else {
          setVoiceLoadingMessage('Adding items to new order...');
          console.log('🎤 Creating new order for table');
        }
        
        for (const matchedItem of matchedItems) {
          if (matchedItem.matchedItem) {
            console.log(`🎤 TakeOrder: AI matched "${matchedItem.name}" → "${matchedItem.matchedItem.name}"`);
            
            // Store cart state before adding
            const cartBefore = restaurant && tableId ? CartManager.getCartItems(restaurant.id, tableId) : [];
            
            // Update voice loading message
            setVoiceLoadingMessage(`Adding ${matchedItem.matchedItem.name} to order...`);
            
            // Handle order state for voice commands
            if (isAddingToExistingOrder) {
              // Simulate "Add More Items" button functionality for voice
              console.log(`🎤 Setting orderState to 'adding_more' for voice command on table with existing orders`);
              setOrderState('adding_more');
              setShowSidePanel(true); // Show side panel briefly to maintain UI consistency
              
              // Clear existing cart to start fresh for additional items
              if (restaurant && tableId) {
                CartManager.clearCart(restaurant.id, tableId);
                setCartItems([]);
              }
            } else if (orderState === 'placed' || orderState === 'completed') {
              console.log(`🎤 Setting orderState to 'cart' for voice command on empty table`);
              setOrderState('cart');
            }
            
            // Add to cart with forceAdd=true to bypass orderState restrictions
            addToCart(matchedItem.matchedItem, matchedItem.quantity, true);
            
            // Give time for cart state to update
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify item was actually added
            const cartAfter = restaurant && tableId ? CartManager.getCartItems(restaurant.id, tableId) : [];
            
            if (cartAfter.length > cartBefore.length) {
              addedItems++;
              console.log(`🎤 Verified: Added ${matchedItem.quantity}x ${matchedItem.matchedItem.name} to cart (${cartBefore.length} → ${cartAfter.length})`);
            } else {
              console.error(`❌ Failed to add ${matchedItem.matchedItem.name} to cart - orderState: ${orderState}`);
              
              // Try direct cart manipulation as fallback
              if (restaurant && tableId) {
                console.log(`🎤 Attempting direct cart addition as fallback`);
                const cartItem: CartItem = {
                  menuItemId: matchedItem.matchedItem.id,
                  name: matchedItem.matchedItem.name,
                  price: matchedItem.matchedItem.price,
                  quantity: matchedItem.quantity,
                  total: matchedItem.matchedItem.price * matchedItem.quantity,
                };
                
                const directCart = CartManager.addToCart(restaurant.id, cartItem, tableId);
                setCartItems(directCart);
                
                // Verify direct addition
                const finalCart = CartManager.getCartItems(restaurant.id, tableId);
                if (finalCart.length > cartBefore.length) {
                  addedItems++;
                  console.log(`🎤 Direct addition successful: ${cartBefore.length} → ${finalCart.length}`);
                } else {
                  console.error(`❌ Direct addition also failed`);
                }
              }
            }
          } else {
            console.warn(`🎤 TakeOrder: No match found for voice item: ${matchedItem.name}`);
            // Don't show toast during voice processing - will show summary at end
          }
        }
        
        // If items were added successfully, place the order immediately
        if (addedItems > 0) {
          console.log(`🎤 Voice cart update complete. Added ${addedItems} items.`);
          
          // Move to placing stage
          setVoiceLoadingStage('placing');
          
          // Update message based on context
          if (isAddingToExistingOrder) {
            setVoiceLoadingMessage('Creating additional order...');
          } else {
            setVoiceLoadingMessage('Creating your order...');
          }
          
          // Reload cart to ensure UI is synced
          if (restaurant && tableId) {
            const freshCart = CartManager.getCartItems(restaurant.id, tableId);
            setCartItems(freshCart);
            console.log(`🎤 Cart updated: ${freshCart.length} items total`);
            
            // Ensure we have items before auto-placing the order
            if (freshCart.length > 0) {
              // Automatically place the order for voice commands
              setTimeout(async () => {
                console.log(`🎤 Auto-placing order after voice command`);
                
                // Double-check cart has items before placing order
                const finalCart = CartManager.getCartItems(restaurant.id, tableId);
                console.log(`🎤 Final cart check before placing: ${finalCart.length} items`);
                
                if (finalCart.length > 0) {
                  try {
                    // Create order notes with context
                    const orderNotesText = isAddingToExistingOrder 
                      ? `Voice add-more order: ${matchedItems.filter(item => item.matchedItem).map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}`
                      : `Voice order: ${matchedItems.filter(item => item.matchedItem).map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}`;
                    
                    // Call handlePlaceOrderWithCart to bypass state synchronization issues
                    const newOrder = await handlePlaceOrderWithCart(finalCart, { 
                      orderNotes: orderNotesText
                    });

                    if (newOrder) {
                      // Move to completed stage
                      setVoiceLoadingStage('completed');
                      
                      if (isAddingToExistingOrder) {
                        setVoiceLoadingMessage('Additional order placed successfully!');
                      } else {
                        setVoiceLoadingMessage('Order placed successfully!');
                      }
                      
                      // Prepare order details for KOT dialog
                      if (table && command.menuItems) {
                        setVoiceOrderDetails({
                          orderNumber: newOrder.orderNumber,
                          tableNumber: table.number,
                          items: matchedItems.filter(item => item.matchedItem).map(item => ({
                            name: item.matchedItem?.name || item.name,
                            quantity: item.quantity
                          }))
                        });
                      }

                      // Hide loading after a brief delay and show final success message
                      setTimeout(() => {
                        setIsVoiceProcessing(false);
                        
                        // Hide side panel if it was shown
                        setShowSidePanel(false);
                        
                        // Show single consolidated success message
                        const successItems = matchedItems.filter(item => item.matchedItem);
                        const itemsText = successItems.map(item => `${item.quantity}x ${item.matchedItem?.name}`).join(', ');
                        
                        if (isAddingToExistingOrder) {
                          toast.success(`🎤 Additional items added: ${itemsText} - KOT printed for new items only!`, {
                            duration: 4000
                          });
                        } else {
                          toast.success(`🎤 Voice order completed: ${itemsText} placed for table ${table?.number}!`, {
                            duration: 4000
                          });
                        }
                        
                        // Print KOT only for the newly added items (this is automatic in handlePlaceOrder)
                        // The handlePlaceOrder function already prints KOT for the new order only
                        console.log(`🎤 KOT will be printed automatically for the new order: ${newOrder.orderNumber}`);
                      }, 1000);
                    } else {
                      throw new Error('Failed to create order');
                    }

                  } catch (error) {
                    console.error(`❌ Voice order placement failed:`, error);
                    setIsVoiceProcessing(false);
                    setShowSidePanel(false);
                    toast.error(`🎤 Failed to place order. Please try manually.`);
                  }
                } else {
                  console.error(`❌ Cart is empty during auto-place, cannot proceed`);
                  setIsVoiceProcessing(false);
                  setShowSidePanel(false);
                  toast.error(`🎤 Failed to place order - cart appears to be empty`);
                }
              }, 500);
            } else {
              console.error(`❌ No items in cart after voice command processing`);
              setIsVoiceProcessing(false);
              setShowSidePanel(false);
              toast.error(`🎤 Failed to add items to cart`);
            }
          }
        } else {
          // No items were added, end voice processing
          setIsVoiceProcessing(false);
          setShowSidePanel(false);
          const failedItems = matchedItems.filter(item => !item.matchedItem);
          if (failedItems.length > 0) {
            const failedNames = failedItems.map(item => item.name).join(', ');
            toast.error(`🎤 Menu items not found: ${failedNames}`);
          } else {
            toast.error(`🎤 No valid menu items found to add to the order`);
          }
        }
      } catch (error) {
        console.error('❌ Voice order processing failed:', error);
        setIsVoiceProcessing(false);
        setShowSidePanel(false);
        toast.error('🎤 Failed to process voice order');
      }
    } else {
      setIsVoiceProcessing(false);
      toast.error(`🎤 Please specify menu items to add to the order`);
    }
  }, [menuItems, addToCart, handlePlaceOrderWithCart, table, restaurant, tableId, orderState, allOrders]);

  const handleVoicePaymentCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Voice payment command received:', {
      command,
      currentTable: table?.number,
      ordersCount: allOrders.length,
      cartItemsCount: cartItems.length
    });
    
    // Check if we're on the correct table
    if (command.tableNumber && table && parseInt(table.number) !== command.tableNumber) {
      toast.error(`🎤 This is table ${table.number}, but payment was requested for table ${command.tableNumber}`);
      return;
    }
    
    // Check if there are orders to pay for
    if (allOrders.length === 0 && cartItems.length === 0) {
      toast.error(`🎤 No orders found for payment on table ${table?.number}`);
      return;
    }
    
    // If there are items in cart, place the order first
    if (cartItems.length > 0) {
      toast.error(`🎤 Please place the current order first before making payment`);
      console.log('🎤 Cart has items, cannot process payment yet');
      return;
    }
    
    // Get payment method with enhanced mapping
    const methodMap: { [key: string]: PaymentMethod } = {
      'UPI': 'upi',
      'CASH': 'cash',
      'BANK': 'bank',
      // Common aliases
      'CARD': 'bank',
      'CREDIT': 'bank',
      'DEBIT': 'bank',
      'MONEY': 'cash',
      'GPAY': 'upi',
      'PAYTM': 'upi',
      'PHONEPE': 'upi',
    };

    // Determine primary payment method – if split payments are present, pick the first one; else use command.paymentMethod (fallback to cash)
    let primaryMethod: PaymentMethod = 'cash';
    if (command.splitPayments && command.splitPayments.length > 0) {
      const firstSplitMethod = command.splitPayments[0].method as keyof typeof methodMap;
      primaryMethod = methodMap[firstSplitMethod] || 'cash';
    } else if (command.paymentMethod) {
      const key = command.paymentMethod as keyof typeof methodMap;
      primaryMethod = methodMap[key] || 'cash';
    }

    if (!primaryMethod) {
      toast.error(`🎤 Invalid payment method: ${command.paymentMethod}`);
      return;
    }
    
    // ---------------------- Totals Calculation ----------------------
    const combinedTotal = allOrders.reduce((total, order) => total + order.total, 0);
    
    // ----- Discount handling -----
    let manualDiscountAmount = 0;
    let manualDiscount: any = undefined;

    if (command.discount && command.discount.value > 0) {
      manualDiscount = {
        type: command.discount.type,
        value: command.discount.value,
      };
      manualDiscountAmount = command.discount.type === 'percentage'
        ? (combinedTotal * command.discount.value) / 100
        : command.discount.value;
    }

    const discountedTotal = combinedTotal - manualDiscountAmount;

    // ----- Credit & Split payments handling -----
    const creditAmount = command.creditAmount && command.creditAmount > 0 ? command.creditAmount : 0;

    const splitAmount = command.splitPayments
      ? command.splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      : 0;

    // If no split specified, assume full amount is being paid now (minus credit if any)
    let amountReceived = splitAmount > 0 ? splitAmount : (discountedTotal - creditAmount);
    if (amountReceived < 0) amountReceived = 0; // safety check

    const finalTotal = discountedTotal;
    const isCredit = creditAmount > 0;

    console.log('🎤 Voice payment breakdown:', {
      combinedTotal,
      manualDiscountAmount,
      discountedTotal,
      splitAmount,
      creditAmount,
      amountReceived,
      finalTotal,
      primaryMethod,
      splitPayments: command.splitPayments,
    });

    // Prepare data object expected by existing handlePayment()
    const paymentData: any = {
      method: primaryMethod,
      amountReceived,
        originalTotal: combinedTotal,
      finalTotal,
        tip: 0,
        reference: `Voice payment - ${new Date().toLocaleTimeString()}`,
        customerId: undefined,
        appliedCoupon: undefined,
      discount: command.discount,
      manualDiscount,
      manualDiscountAmount,
      totalSavings: manualDiscountAmount,
      isCredit,
      creditAmount,
      printBill: true,
    };

    // ---------------------- Process Payment ----------------------
    try {
      toast.success(`🎤 Processing payment for table ${table?.number}...`);
      toast(`🎤 Amount due: ₹${finalTotal.toFixed(2)}`);
      if (manualDiscountAmount > 0) {
        toast(`🎤 Discount applied: -₹${manualDiscountAmount.toFixed(2)}`);
      }
      if (isCredit && creditAmount > 0) {
        toast(`🎤 Credit recorded: ₹${creditAmount.toFixed(2)}`);
      }

      await handlePayment(paymentData);
      
      // Success feedback
      toast.success(`🎤 Received ₹${amountReceived.toFixed(2)} via ${primaryMethod.toUpperCase()}`);
      if (isCredit && creditAmount > 0) {
        toast.success(`🎤 Remaining ₹${creditAmount.toFixed(2)} recorded as credit.`);
      }
      toast.success(`🎤 Table ${table?.number} is now available.`);

      // Navigate back to tables after a brief pause
      setTimeout(() => {
        navigate(`/${restaurant?.slug}/tables`);
      }, 3000);
      
    } catch (error) {
      console.error('🎤 Voice payment failed:', error);
      toast.error('🎤 Voice payment failed. Please process manually.');
      setShowPaymentModal(true);
      toast('🎤 Opening payment window for manual processing...');
    }
  }, [table, allOrders, cartItems, handlePayment, restaurant, navigate]);

  // Voice KOT print command handler
  const handleVoiceKotPrintCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 TakeOrder: Voice KOT print command received:', command);
    
    if (!restaurant || !table || allOrders.length === 0) {
      console.log('🎤 Missing requirements for KOT printing:', {
        hasRestaurant: !!restaurant,
        hasTable: !!table,
        orderCount: allOrders.length
      });
      
      if (allOrders.length === 0) {
        toast.error('🎤 No orders to print KOT for');
      } else {
        toast.error('🎤 Unable to print KOT at this time');
      }
      return;
    }
    
    console.log('🎤 Triggering KOT print for table:', table.number);
    
    // Call the existing KOT print function
    handlePrintKOT();
    
    toast.success(`🎤 KOT printed for table ${table.number}`);
  }, [restaurant, table, allOrders, handlePrintKOT]);

  // Voice order cancel command handler
  const handleVoiceOrderCancelCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 TakeOrder: Voice order cancel command received:', command);
    
    if (!restaurant || !table || allOrders.length === 0) {
      console.log('🎤 Missing requirements for order cancellation:', {
        hasRestaurant: !!restaurant,
        hasTable: !!table,
        orderCount: allOrders.length
      });
      
      if (allOrders.length === 0) {
        toast.error('🎤 No orders to cancel');
      } else {
        toast.error('🎤 Unable to cancel orders at this time');
      }
      return;
    }
    
    // Directly cancel without confirmation for voice commands
    try {
      console.log('🎤 Canceling orders for table:', table.number);
      
      // Update all active orders status to cancelled
      const cancelPromises = allOrders.map(async (order) => {
        return OrderService.updateOrderStatus(order.id, restaurant.id, 'cancelled', {
          notes: 'Voice command cancellation - ' + new Date().toLocaleString()
        });
      });
      
      const results = await Promise.all(cancelPromises);
      const allSuccessful = results.every(result => result.success);
      
      if (allSuccessful) {
        // Update table status back to available
        await TableService.updateTable(table.id, restaurant.id, { status: 'available' });
        
        // Clear the current orders and cart
        setAllOrders([]);
        setCurrentOrder(null);
        setOrderState('cart');
        CartManager.clearCart(restaurant.id, table.id);
        setCartItems([]);
        
        toast.success('🎤 All orders cancelled successfully');
        
        // Navigate back to tables page
        setTimeout(() => {
          navigate(`/${restaurant.slug}/tables`);
        }, 1500);
      } else {
        toast.error('🎤 Failed to cancel some orders');
      }
    } catch (error) {
      console.error('🎤 Error canceling orders:', error);
      toast.error('🎤 Failed to cancel orders');
    }
  }, [restaurant, table, allOrders, navigate, OrderService, TableService, CartManager]);

  // Voice customer command handler
  const handleVoiceCustomerCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('👤 TakeOrder: Voice customer command received:', command);
    
    if (!restaurant) {
      toast.error('🎤 Restaurant context not available');
      return;
    }

    const { customerName, customerPhone, customerEmail } = command;
    
    if (!customerName && !customerPhone) {
      toast.error('🎤 Please specify customer name or phone number');
      return;
    }

    try {
      // Prepare customer data
      const customerData = {
        name: customerName || '',
        phone: customerPhone || '',
        email: customerEmail || '',
        address: '',
        preferences: ['voice_added'] // Tag as voice-added customer
      };

      console.log('👤 Creating customer via voice:', customerData);
      
      // Import CustomerService dynamically
      const { CustomerService } = await import('@/services/customerService');
      
      // Create customer
      const result = await CustomerService.createCustomer(restaurant.id, customerData);
      
      if (result.success) {
        const customerInfo = customerName || `Customer with phone ${customerPhone}`;
        toast.success(`🎤 Successfully added ${customerInfo} to CRM!`);
        
        // Also show email if provided
        if (customerEmail) {
          toast.success(`📧 Email ${customerEmail} saved for ${customerInfo}`);
        }
        
        console.log('👤 Customer created successfully:', result.data);
      } else {
        console.error('❌ Customer creation failed:', result.error);
        
        // Check if it's a duplicate customer error
        if (result.error?.includes('already exists') || result.error?.includes('duplicate')) {
          toast.error(`�� Customer with this information already exists in CRM`);
        } else {
          toast.error(`🎤 Failed to add customer: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error creating customer:', error);
      toast.error('🎤 Failed to add customer to CRM');
    }
  }, [restaurant]);

  // Voice place order command handler
  const handleVoicePlaceOrderCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 TakeOrder: Voice place order command received:', {
      command,
      currentTable: table?.number,
      commandTableNumber: command.tableNumber,
      commandMenuItems: command.menuItems,
      cartItemsLength: cartItems.length,
      restaurantExists: !!restaurant
    });
    
    if (!restaurant || !table) {
      console.error('🎤 Missing restaurant or table:', { restaurant: !!restaurant, table: !!table });
      toast.error('🎤 Unable to place order at this time');
      return;
    }
    
    // Check if we're on the correct table (more flexible check)
    if (command.tableNumber && parseInt(table.number) !== command.tableNumber) {
      console.warn(`🎤 Table mismatch: current=${table.number}, requested=${command.tableNumber}`);
      toast.error(`🎤 This is table ${table.number}, but order was requested for table ${command.tableNumber}`);
      return;
    }
    
    try {
      // If command has menu items, add them to cart first then place order
      if (command.menuItems && command.menuItems.length > 0) {
        console.log('🎤 Processing voice menu items directly:', command.menuItems);
        
        // Process each menu item from voice command
        for (const voiceItem of command.menuItems) {
          const findMenuItem = (searchTerm: string) => {
            const normalizeWord = (word: string) => {
              return word.toLowerCase()
                .replace(/s$/, '') // Remove plural 's'
                .replace(/ies$/, 'y') // Convert 'ies' to 'y'
                .replace(/es$/, '') // Remove 'es'
                .trim();
            };
            
            const searchWords = searchTerm.toLowerCase().split(' ').map(normalizeWord);
            
            return menuItems.find(item => {
              const itemWords = item.name.toLowerCase().split(' ').map(normalizeWord);
              return searchWords.every(searchWord => 
                itemWords.some(itemWord => 
                  itemWord.includes(searchWord) || searchWord.includes(itemWord)
                )
              );
            });
          };
          
          const foundMenuItem = findMenuItem(voiceItem.name);
          if (foundMenuItem) {
            console.log(`🎤 Found menu item: ${foundMenuItem.name} for voice item: ${voiceItem.name}`);
            addToCart(foundMenuItem, voiceItem.quantity, true); // Use forceAdd=true
          } else {
            console.warn(`🎤 Menu item not found: ${voiceItem.name}`);
            toast.error(`Menu item "${voiceItem.name}" not found`);
          }
        }
        
        // Wait a moment for cart to update, then place order
        setTimeout(async () => {
          console.log('🎤 Placing order after adding voice items to cart');
          await handlePlaceOrder({ orderNotes: `Voice order: ${command.menuItems?.map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}` });
          toast.success(`🎤 Order placed successfully for table ${table.number}!`);
        }, 100);
        
      } else {
        // No menu items in voice command, check if there are items in cart
        if (cartItems.length === 0) {
          console.warn('🎤 No items in cart and no voice menu items');
          toast.error(`🎤 No items to place order for table ${table.number}`);
          return;
        }
        
        // Place order with existing cart items
        await handlePlaceOrder({ orderNotes: `Voice order placed at ${new Date().toLocaleTimeString()}` });
        toast.success(`🎤 Order placed successfully for table ${table.number}!`);
      }
      
      console.log('🎤 Voice place order completed successfully');
      
    } catch (error) {
      console.error('🎤 Voice place order failed:', error);
      toast.error('🎤 Failed to place order. Please try manually.');
    }
  }, [restaurant, table, cartItems, handlePlaceOrder, orderState, menuItems, addToCart]);

  // Voice command event listeners
  useEffect(() => {
    console.log('🎤 TakeOrder: Setting up voice command event listeners');
    
    window.addEventListener('voiceOrderCommand', handleVoiceOrderCommand as unknown as EventListener);
    window.addEventListener('voicePlaceOrderCommand', handleVoicePlaceOrderCommand as unknown as EventListener);
    window.addEventListener('voicePaymentCommand', handleVoicePaymentCommand as unknown as EventListener);
    window.addEventListener('voiceKotPrintCommand', handleVoiceKotPrintCommand as unknown as EventListener);
    window.addEventListener('voiceOrderCancelCommand', handleVoiceOrderCancelCommand as unknown as EventListener);
    window.addEventListener('voiceCustomerCommand', handleVoiceCustomerCommand as unknown as EventListener);
    
    return () => {
      console.log('🎤 TakeOrder: Cleaning up voice command event listeners');
      window.removeEventListener('voiceOrderCommand', handleVoiceOrderCommand as unknown as EventListener);
      window.removeEventListener('voicePlaceOrderCommand', handleVoicePlaceOrderCommand as unknown as EventListener);
      window.removeEventListener('voicePaymentCommand', handleVoicePaymentCommand as unknown as EventListener);
      window.removeEventListener('voiceKotPrintCommand', handleVoiceKotPrintCommand as unknown as EventListener);
      window.removeEventListener('voiceOrderCancelCommand', handleVoiceOrderCancelCommand as unknown as EventListener);
      window.removeEventListener('voiceCustomerCommand', handleVoiceCustomerCommand as unknown as EventListener);
    };
  }, [handleVoiceOrderCommand, handleVoicePlaceOrderCommand, handleVoicePaymentCommand, handleVoiceKotPrintCommand, handleVoiceOrderCancelCommand, handleVoiceCustomerCommand]);

  // Load data when component mounts
  useEffect(() => {
    console.log('🚀 TakeOrder: Component mounting/loading data...', {
      tableId,
      restaurantSlug: restaurant?.slug,
      hasUser: !!user
    });
    if (restaurant && tableId) {
      loadData();
      loadCart();
      // Don't call checkExistingOrder immediately - let the real-time subscription handle it
      // This prevents race conditions between initial load and real-time updates
    }
  }, [restaurant, tableId]);

  // Set payment amount to combined order total by default
  useEffect(() => {
    if (allOrders.length > 0 && showPaymentModal) {
      const combinedTotal = allOrders.reduce((total, order) => total + order.total, 0);
      setPaymentValue('amountReceived', combinedTotal);
    }
  }, [allOrders, showPaymentModal, setPaymentValue]);

  // Real-time subscription to orders for this table
  useEffect(() => {
    if (!restaurant || !tableId) return;

    console.log(`🔄 TakeOrder: Setting up real-time subscription for table ${tableId}`);
    
    // Subscribe to all orders for this restaurant and filter for our table
    const unsubscribe = OrderService.subscribeToOrders(
      restaurant.id,
      (allOrders) => {
        // Filter orders for this specific table
        const tableOrders = allOrders.filter(order => order.tableId === tableId);
        
        // Filter for active orders (including completed but unpaid)
        const activeOrders = tableOrders.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status) ||
          (order.status === 'completed' && order.paymentStatus !== 'paid')
        );

        console.log(`🔄 TakeOrder: Real-time update for table ${tableId}:`, {
          totalTableOrders: tableOrders.length,
          activeOrders: activeOrders.length,
          orderDetails: activeOrders.map(o => ({ 
            id: o.id, 
            orderNumber: o.orderNumber, 
            status: o.status, 
            paymentStatus: o.paymentStatus 
          }))
        });

        // Check for inconsistent state in real-time updates too
        if (table && table.status === 'available' && activeOrders.length > 0) {
          console.warn(`⚠️ TakeOrder: Real-time inconsistency - Table ${table.number} is available but has ${activeOrders.length} active orders`);
          
          // Auto-cancel these stale orders
          const cancelStaleOrders = async () => {
            const cancelPromises = activeOrders.map(async (order) => {
              return OrderService.updateOrderStatus(order.id, restaurant.id, 'cancelled', {
                notes: `Auto-cancelled via real-time sync: Table marked as available - ${new Date().toLocaleString()}`
              });
            });
            
            await Promise.all(cancelPromises);
            console.log(`🔧 TakeOrder: Real-time cleaned up ${activeOrders.length} stale orders`);
          };
          
          cancelStaleOrders();
          
          // Reset state immediately
          setAllOrders([]);
          setCurrentOrder(null);
          setOrderState('cart');
          CartManager.clearCart(restaurant.id, tableId);
          setCartItems([]);
          return;
        }

        // Update state with active orders
        setAllOrders(activeOrders);

        if (activeOrders.length > 0) {
          // Set the most recent order as current
          const latestOrder = activeOrders.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          
          setCurrentOrder(latestOrder);
          
          // Force to 'placed' state when we have active orders
          console.log(`🔄 TakeOrder: Real-time update forcing state to 'placed' for table ${tableId}`);
          setOrderState('placed');
          
          // Clear cart since order is already placed
          CartManager.clearCart(restaurant.id, tableId);
          setCartItems([]);
        } else {
          // Only change state if we don't have any active orders and we're not completed
          if (orderState === 'placed' && activeOrders.length === 0) {
            console.log(`🔄 TakeOrder: Real-time update - no active orders, resetting to cart`);
            setOrderState('cart');
            setCurrentOrder(null);
          }
        }
      },
      100 // Get more orders to ensure we don't miss any
    );

    // Cleanup subscription
    return () => {
      console.log(`🔄 TakeOrder: Cleaning up real-time subscription for table ${tableId}`);
      unsubscribe();
    };
  }, [restaurant?.id, tableId]); // Don't include orderState to prevent loops

  // Filter menu items with real-time search (optimized with useMemo)
  const filteredItems = useMemo(() => {
    const filtered = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      
      if (searchTerm === '') {
        return matchesCategory;
      }
      
      // Real-time search logic - simple and fast
      const searchTermLower = searchTerm.toLowerCase().trim();
      const itemNameLower = item.name.toLowerCase();
      const itemDescLower = item.description?.toLowerCase() || '';
      
      // Primary matches - direct substring search (most common use case)
      const nameMatch = itemNameLower.includes(searchTermLower);
      const descMatch = itemDescLower.includes(searchTermLower);
      
      // Secondary matches - word starts with search term (for "cae" -> "Caesar")
      const nameWordsMatch = itemNameLower.split(' ').some(word => word.startsWith(searchTermLower));
      const descWordsMatch = itemDescLower.split(' ').some(word => word.startsWith(searchTermLower));
      
      // Tertiary matches - any word contains search term
      const nameContainsMatch = itemNameLower.split(' ').some(word => word.includes(searchTermLower));
      const descContainsMatch = itemDescLower.split(' ').some(word => word.includes(searchTermLower));
      
      const matchesSearch = nameMatch || descMatch || nameWordsMatch || descWordsMatch || nameContainsMatch || descContainsMatch;
    
    return matchesCategory && matchesSearch;
  });
    
    // Debug search results (remove in production)
    if (searchTerm && filtered.length > 0) {
      console.log(`🔍 Found ${filtered.length} items for "${searchTerm}"`);
    }
    
    return filtered;
  }, [menuItems, selectedCategory, searchTerm]);



  const cartTotal = cartItems.reduce((total, item) => total + item.total, 0);

  const taxAmount = (cartTotal * (restaurant?.settings.taxRate || 8.5)) / 100;
  const finalTotal = cartTotal + taxAmount;

  if (!restaurant || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/${restaurant.slug}/tables`)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  Table {table.number} - {table.area}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                  <span className="whitespace-nowrap">Capacity: {table.capacity} guests</span>
                  <span className="capitalize whitespace-nowrap">Status: {table.status.replace('_', ' ')}</span>
                  {orderState === 'placed' && allOrders.length > 0 && (
                    <span className="text-blue-600 font-medium whitespace-nowrap">
                      {allOrders.length} Active Order{allOrders.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Action Buttons - Desktop */}
              {orderState === 'placed' && allOrders.length > 0 && cartItems.length === 0 && (
                <div className="hidden sm:flex items-center space-x-2">
                  <button
                    onClick={handleAddMoreOrder}
                    className="btn btn-theme-primary text-sm px-3 py-1.5"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add More
                  </button>
                  
                  <button
                    onClick={handlePrintKOT}
                    className="btn btn-secondary text-sm px-3 py-1.5"
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    KOT
                  </button>
                  
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn bg-green-600 text-white hover:bg-green-700 text-sm px-3 py-1.5"
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Payment
                  </button>
                  
                  <button
                    onClick={() => setShowTableManagement(true)}
                    className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm px-3 py-1.5"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-1" />
                    Manage
                  </button>
                  
                  <button
                    onClick={handleCancelAllOrders}
                    disabled={isPlacingOrder}
                    className="btn bg-red-600 text-white hover:bg-red-700 text-sm px-3 py-1.5"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {isPlacingOrder ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                </div>
              )}
              
              {/* Mobile Action Button */}
              {orderState === 'placed' && allOrders.length > 0 && cartItems.length === 0 && (
                <div className="sm:hidden">
                  <div className="relative mobile-actions-menu">
                  <button
                      onClick={() => setShowMobileActionsMenu(!showMobileActionsMenu)}
                      className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm px-3 py-1.5 relative"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {/* Mobile Actions Dropdown */}
                    {showMobileActionsMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <button
                          onClick={() => {
                            handleAddMoreOrder();
                            setShowMobileActionsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4 mr-3" />
                          Add More Items
                        </button>
                        
                        <button
                          onClick={() => {
                            handlePrintKOT();
                            setShowMobileActionsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Printer className="w-4 h-4 mr-3" />
                          Print KOT
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowPaymentModal(true);
                            setShowMobileActionsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                          <CreditCard className="w-4 h-4 mr-3" />
                          Payment
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowTableManagement(true);
                            setShowMobileActionsMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-3" />
                          Manage Table
                        </button>
                        
                        <div className="border-t border-gray-200"></div>
                        
                        <button
                          onClick={() => {
                            handleCancelAllOrders();
                            setShowMobileActionsMenu(false);
                          }}
                          disabled={isPlacingOrder}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-3" />
                          {isPlacingOrder ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {['cart', 'adding_more'].includes(orderState) && cartItems.length > 0 && (
                <button
                  onClick={clearCart}
                  className="btn btn-secondary text-sm px-3 py-1.5"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </button>
              )}
              
              {orderState === 'completed' && (
                <div className="flex items-center space-x-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Order Completed</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="h-[calc(100vh-80px)]">
        {/* Main Content - Full Width */}
        <div className="h-full overflow-hidden">
          <main className="h-full px-4 sm:px-6 lg:px-8 py-6">


            {(orderState === 'cart' || orderState === 'adding_more') && (
          <>
            {/* Desktop Layout */}
            <div className="hidden lg:flex gap-6 h-[calc(100vh-200px)]">
            {/* Left Side - Menu Items */}
            <div className="flex-1 overflow-hidden">
              {/* Search and Filter Bar */}
              <div className="card p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Menu Items Grid */}
              <div className="overflow-y-auto h-full">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Loading menu...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm ? `No menu items match "${searchTerm}"` : `No items in "${selectedCategory}" category`}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="btn btn-secondary"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div 
                    key={`desktop-grid-${searchTerm}-${filteredItems.length}`}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-6"
                  >
                    {filteredItems.map((item, index) => {
                      const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                      return (
                        <MenuItemCard
                          key={`desktop-${item.id}-${index}-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                          item={item}
                          onAddToCart={addToCart}
                          cartQuantity={cartItem?.quantity || 0}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Order Summary */}
            <div className="w-80 lg:w-96 flex flex-col">
              <div className="card h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Current Order</h2>
                  <p className="text-sm text-gray-600">Table {table.number}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No items added yet</p>
                      <p className="text-sm text-gray-500">Select items from the menu to start building the order</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartItems.map((item, index) => (
                        <OrderItemCard
                          key={`${item.menuItemId}-${index}-${item.variants?.map(v => `${v.variantName}-${v.optionName}`).join('-') || 'no-variants'}`}
                          item={item}
                          onUpdateQuantity={updateCartItemQuantity}
                          onRemove={removeFromCart}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {cartItems.length > 0 && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({restaurant?.settings.taxRate || 8.5}%):</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(finalTotal)}</span>
                      </div>
                    </div>
                    
                    <form onSubmit={handleSubmit(handlePlaceOrder)} className="space-y-3">
                      <textarea
                        {...register('orderNotes')}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Order notes (optional)"
                      />
                      
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={clearCart}
                          className="flex-1 btn btn-secondary"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear
                        </button>
                        
                        <button
                          type="submit"
                          disabled={isPlacingOrder}
                          className="flex-2 btn btn-theme-primary"
                        >
                          {isPlacingOrder ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Placing...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Place Order
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden">
              {/* Search and Filter Bar */}
              <div className="card p-4 mb-4">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Cart Summary Bar (Mobile) */}
              {cartItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm text-gray-600">{cartItems.length} items</div>
                      <div className="font-bold text-lg">{formatCurrency(finalTotal)}</div>
                    </div>
                    <button
                      onClick={() => setShowSidePanel(true)}
                      className="btn btn-theme-primary"
                    >
                      View Cart
                    </button>
            </div>
          </div>
              )}

              {/* Menu Items Grid */}
              <div className={`${cartItems.length > 0 ? 'pb-24' : 'pb-6'}`}>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Loading menu...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchTerm ? `No menu items match "${searchTerm}"` : `No items in "${selectedCategory}" category`}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="btn btn-secondary"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div 
                    key={`mobile-grid-${searchTerm}-${filteredItems.length}`}
                    className="grid grid-cols-2 sm:grid-cols-2 gap-4"
                  >
                    {filteredItems.map((item, index) => {
                      const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                      return (
                        <MenuItemCard
                          key={`mobile-${item.id}-${index}-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                          item={item}
                          onAddToCart={addToCart}
                          cartQuantity={cartItem?.quantity || 0}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile Cart Sidebar */}
              {showSidePanel && (
                <div className="fixed inset-0 z-50 lg:hidden">
                  <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowSidePanel(false)}></div>
                  <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl">
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">Current Order</h2>
                            <p className="text-sm text-gray-600">Table {table.number}</p>
                          </div>
                          <button
                            onClick={() => setShowSidePanel(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4">
                        {cartItems.length === 0 ? (
                          <div className="text-center py-8">
                            <Utensils className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No items added yet</p>
                            <p className="text-sm text-gray-500">Select items from the menu to start building the order</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {cartItems.map((item, index) => (
                              <OrderItemCard
                                key={`mobile-${item.menuItemId}-${index}-${item.variants?.map(v => `${v.variantName}-${v.optionName}`).join('-') || 'no-variants'}`}
                                item={item}
                                onUpdateQuantity={updateCartItemQuantity}
                                onRemove={removeFromCart}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {cartItems.length > 0 && (
                        <div className="border-t border-gray-200 p-4">
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span>{formatCurrency(cartTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Tax ({restaurant?.settings.taxRate || 8.5}%):</span>
                              <span>{formatCurrency(taxAmount)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                              <span>Total:</span>
                              <span>{formatCurrency(finalTotal)}</span>
                            </div>
                          </div>
                          
                          <form onSubmit={handleSubmit(handlePlaceOrder)} className="space-y-3">
                            <textarea
                              {...register('orderNotes')}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              placeholder="Order notes (optional)"
                            />
                            
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={clearCart}
                                className="flex-1 btn btn-secondary"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Clear
                              </button>
                              
                              <button
                                type="submit"
                                disabled={isPlacingOrder}
                                className="flex-2 btn btn-theme-primary"
                              >
                                {isPlacingOrder ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Placing...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Place Order
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

            {orderState === 'placed' && allOrders.length > 0 && (
              <div className="max-w-4xl mx-auto px-3 sm:px-4">
                <div className="text-center mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Receipt className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Orders Placed!</h2>
                  <p className="text-gray-600 text-sm sm:text-base">
                    {allOrders.length} active order{allOrders.length > 1 ? 's' : ''} for Table {table.number}
                  </p>
                  {allOrders.length > 5 && (
                    <p className="text-blue-600 text-xs mt-1 font-medium">
                      ↕ Scroll down to see all orders
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:gap-4 md:gap-6 max-h-[70vh] overflow-y-auto">
                  {allOrders.map((order, index) => (
                    <div key={order.id} className="card p-4 sm:p-6 relative">
                      <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                        {index + 1} of {allOrders.length}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{order.orderNumber}
                        </h3>
                        <span className="text-gray-600 text-sm">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="space-y-2 sm:space-y-3 mb-4">
                        {order.items.map(item => (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{item.name}</h4>
                              <p className="text-sm text-gray-600">
                                {item.quantity} × {formatCurrency(item.price)}
                              </p>
                            </div>
                            <div className="font-medium text-gray-900 sm:text-right">
                              {formatCurrency(item.total)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Order Total:</span>
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Action Bar - Fixed at bottom */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
                  <div className="flex space-x-2">
                    <button
                      onClick={handleAddMoreOrder}
                      className="flex-1 btn btn-theme-primary text-sm py-3"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add More
                    </button>
                    
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex-1 btn bg-green-600 text-white hover:bg-green-700 text-sm py-3"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Payment
                    </button>
                  </div>
                  
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={handlePrintKOT}
                      className="flex-1 btn btn-secondary text-sm py-2"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print KOT
                    </button>
                    
                    <button
                      onClick={() => setShowTableManagement(true)}
                      className="flex-1 btn bg-blue-600 text-white hover:bg-blue-700 text-sm py-2"
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Manage
                    </button>
                  </div>
                </div>

                {/* Add bottom padding to prevent content from being hidden behind fixed bar */}
                <div className="sm:hidden h-32"></div>
              </div>
            )}

            {orderState === 'completed' && (
              <div className="max-w-2xl mx-auto text-center">
                <div className="card p-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Completed!</h2>
                  <p className="text-gray-600 mb-6">
                    All orders for Table {table.number} have been paid and completed.
                  </p>

                  {/* WhatsApp Bill Sharing Section */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.787"/>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-green-800">Share Bill on WhatsApp</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-2">
                          WhatsApp Number
                        </label>
                        <input
                          type="tel"
                          id="whatsappNumber"
                          value={whatsappNumber}
                          onChange={(e) => {
                            // Only allow numbers and limit to 10 digits
                            const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            setWhatsappNumber(value);
                          }}
                          placeholder="Enter WhatsApp number (e.g., 9876543210)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          disabled={isSendingWhatsApp}
                          maxLength={10}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter 10-digit mobile number without country code
                        </p>
                      </div>

                      {/* WhatsApp Platform Choice */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Choose WhatsApp Platform
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="whatsappPlatform"
                              checked={useWhatsAppWeb}
                              onChange={() => setUseWhatsAppWeb(true)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                              disabled={isSendingWhatsApp}
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              <strong>WhatsApp Web</strong> - Open in browser (recommended if you have WhatsApp Web open)
                            </span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="whatsappPlatform"
                              checked={!useWhatsAppWeb}
                              onChange={() => setUseWhatsAppWeb(false)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                              disabled={isSendingWhatsApp}
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              <strong>WhatsApp App</strong> - Open mobile/desktop app
                            </span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={handleSendWhatsApp}
                          disabled={isSendingWhatsApp || isGeneratingPDF || !whatsappNumber.trim() || whatsappNumber.length !== 10}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isSendingWhatsApp ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              Preparing...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.787"/>
                              </svg>
                              Send Text Bill
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadPDFAndShare}
                          disabled={isSendingWhatsApp || isGeneratingPDF || !whatsappNumber.trim() || whatsappNumber.length !== 10}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isGeneratingPDF ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              Creating PDF...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download PDF & Share
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Text Bill:</span> Send formatted bill text directly in WhatsApp<br/>
                          <span className="font-medium">PDF Bill:</span> Download PDF and manually attach to WhatsApp
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        // Reset for new order on same table
                        setOrderState('cart');
                        setAllOrders([]);
                        setCurrentOrder(null);
                        setCartItems([]);
                        CartManager.clearCart(restaurant.id, tableId);
                      }}
                      className="btn btn-theme-primary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Order
                    </button>
                    
                    <button
                      onClick={() => navigate(`/${restaurant.slug}/tables`)}
                      className="btn btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Tables
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && allOrders.length > 0 && (
        <PaymentModalWithCoupons
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          restaurant={restaurant}
          table={table}
          onPayment={handlePayment}
          isProcessing={isProcessingPayment}
          cartItems={allOrders.flatMap(order => order.items.map(item => ({
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.total,
            variants: item.variants
          })))}
          orders={allOrders}
          menuItems={menuItems}
        />
      )}

      {/* Variant Selection Modal */}
      {selectedMenuItem && (
        <VariantSelectionModal
          isOpen={showVariantModal}
          onClose={() => {
            setShowVariantModal(false);
            setSelectedMenuItem(null);
          }}
          menuItem={selectedMenuItem}
          onConfirm={handleVariantConfirm}
        />
      )}

      {/* Table Management Modal */}
      {showTableManagement && table && restaurant && (
        <TableManagementModal
          isOpen={showTableManagement}
          onClose={() => setShowTableManagement(false)}
          currentTable={table}
          restaurantId={restaurant.id}
          currentOrders={allOrders}
          onOperationComplete={() => {
            // Refresh data after table operation
            checkExistingOrder();
            // Navigate back to table layout
            navigate(`/${restaurant.slug}/tables`);
          }}
        />
      )}

      {/* Voice Loading Overlay */}
      <VoiceLoadingOverlay
        isVisible={isVoiceProcessing}
        stage={voiceLoadingStage}
        message={voiceLoadingMessage}
      />

      {/* Voice KOT Dialog */}
      <VoiceKOTDialog
        isVisible={showVoiceKOTDialog}
        onClose={() => setShowVoiceKOTDialog(false)}
        onPrintKOT={handlePrintKOT}
        orderDetails={voiceOrderDetails}
      />

      {/* Manual Order KOT Dialog */}
      <VoiceKOTDialog
        isVisible={showKOTDialog}
        onClose={() => setShowKOTDialog(false)}
        onPrintKOT={() => {
          // Print KOT for the manually placed order
          if (kotOrderDetails && restaurant && table && currentOrderForKOT) {
            // Use the tracked order that was just placed
            const orderToPrint = currentOrderForKOT;
            let kotContent;
            
            if (allOrders.length === 1) {
              // Single order - use regular KOT
              kotContent = generateKOTContent(orderToPrint, restaurant, table);
            } else {
              // Multiple orders - show only the latest order as "ADDITIONAL ORDER"
              kotContent = generateAdditionalKOTContent(orderToPrint, restaurant, table, allOrders.length);
            }
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(kotContent);
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
              printWindow.close();
            }
            toast.success('KOT sent to kitchen');
          }
        }}
        orderDetails={kotOrderDetails}
      />


    </div>
  );
}

// Menu Item Card Component
interface MenuItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem, quantity: number) => void;
  cartQuantity: number;
}

function MenuItemCard({ item, onAddToCart, cartQuantity }: MenuItemCardProps) {
  return (
    <div className="card hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => onAddToCart(item, 1)}>
      {item.image && (
        <div className="h-32 bg-gray-200 rounded-t-xl overflow-hidden">
          <img 
            src={item.image} 
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
          <div className="text-right">
            <div className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatCurrency(item.price)}
            </div>
            {cartQuantity > 0 && (
              <div className="text-xs text-green-600 font-medium">
                {cartQuantity} in order
              </div>
            )}
          </div>
        </div>
        
        {item.description && (
          <p className="text-gray-600 text-xs mb-2 line-clamp-2">
            {item.description}
          </p>
        )}
        
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(item, 1);
            }}
            className="btn btn-theme-primary btn-sm w-full"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}

// Order Item Card Component
interface OrderItemCardProps {
  item: CartItem;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemove: (menuItemId: string) => void;
}

function OrderItemCard({ item, onUpdateQuantity, onRemove }: OrderItemCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
        <p className="text-xs text-gray-600">{formatCurrency(item.price)} each</p>
        {item.variants && item.variants.length > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            {item.variants.map((variant, index) => (
              <span key={`${variant.variantName}-${variant.optionName}-${index}`}>
                {variant.variantName}: {variant.optionName}
                {index < item.variants!.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onUpdateQuantity(item.menuItemId, item.quantity - 1)}
            className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.menuItemId, item.quantity + 1)}
            className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        
        <div className="text-right min-w-[60px]">
          <div className="font-medium text-gray-900 text-sm">{formatCurrency(item.total)}</div>
        </div>
        
        <button
          onClick={() => onRemove(item.menuItemId)}
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}





// Additional KOT Generation Function for Add More Orders
function generateAdditionalKOTContent(order: Order, restaurant: any, table: Table, totalOrderCount: number): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Additional KOT - ${order.orderNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          font-weight: bold;
          font-size: 12px;
          line-height: 1.1;
          width: 100%;
          background: #fff;
          color: #000;
          padding: 0 5px;
        }
        .kot-container {
          width: 100%;
          padding: 5px 0;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 3px; 
          margin-bottom: 5px; 
        }
        .restaurant-name { 
          font-size: 14px; 
          font-weight: bold; 
          margin-bottom: 2px;
        }
        .kot-title {
          font-size: 12px;
          font-weight: bold;
        }
        .additional-notice {
          background-color: #000;
          color: #fff;
          text-align: center;
          padding: 2px;
          margin: 3px 0;
          font-weight: bold;
          font-size: 11px;
        }
        .order-info { 
          margin-bottom: 5px; 
          line-height: 1.1;
        }
        .order-info p {
          margin: 1px 0;
          font-weight: bold;
        }
        .items { 
          border-collapse: collapse; 
          width: 100%; 
          margin: 5px 0;
        }
        .items th, .items td { 
          border: 1px solid #000; 
          padding: 3px 4px; 
          text-align: left; 
          font-size: 11px;
          font-weight: bold;
          line-height: 1.1;
        }
        .items th { 
          background-color: #000; 
          color: #fff;
          font-weight: bold;
        }
        .footer { 
          margin-top: 5px; 
          text-align: center; 
          font-size: 10px; 
          border-top: 1px dashed #000;
          padding-top: 3px;
          font-weight: bold;
        }
        .order-notes {
          margin-top: 5px; 
          padding: 3px; 
          border: 1px solid #000;
          background: #f0f0f0;
          font-weight: bold;
          font-size: 11px;
          line-height: 1.1;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0 3px;
            width: 100%;
            font-size: 11px;
          }
          .kot-container {
            padding: 3px 0;
            width: 100%;
          }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="kot-container">
      <div class="header">
        <div class="restaurant-name">${restaurant.name}</div>
          <div class="kot-title">KITCHEN ORDER TICKET</div>
      </div>
      
      <div class="additional-notice">
        *** ADDITIONAL ORDER - NEW ITEMS ONLY ***
      </div>
      
      <div class="order-info">
        <p><strong>Order #:</strong> ${order.orderNumber}</p>
        <p><strong>Table:</strong> ${table.number} (${table.area})</p>
        <p><strong>Date/Time:</strong> ${order.createdAt.toLocaleString()}</p>
        <p><strong>Staff:</strong> ${order.staffId}</p>
        <p><strong>Order ${totalOrderCount} of ${totalOrderCount} for this table</strong></p>
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
          ${order.items.map(item => `
            <tr>
              <td>${item.quantity}</td>
              <td>${item.name}</td>
              <td>${item.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${order.notes ? `
          <div class="order-notes">
          <strong>Order Notes:</strong><br>
          ${order.notes}
        </div>
      ` : ''}
      
      <div class="footer">
        <p>*** KITCHEN COPY - ADDITIONAL ITEMS ***</p>
          <p>Printed: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// KOT Generation Function
function generateKOTContent(order: Order, restaurant: any, table: Table): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOT - ${order.orderNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          font-weight: bold;
          font-size: 12px;
          line-height: 1.1;
          width: 100%;
          background: #fff;
          color: #000;
          padding: 0 5px;
        }
        .kot-container {
          width: 100%;
          padding: 5px 0;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 3px; 
          margin-bottom: 5px; 
        }
        .restaurant-name { 
          font-size: 14px; 
          font-weight: bold; 
          margin-bottom: 2px;
        }
        .kot-title {
          font-size: 12px;
          font-weight: bold;
        }
        .order-info { 
          margin-bottom: 5px; 
          line-height: 1.1;
        }
        .order-info p {
          margin: 1px 0;
          font-weight: bold;
        }
        .items { 
          border-collapse: collapse; 
          width: 100%; 
          margin: 5px 0;
        }
        .items th, .items td { 
          border: 1px solid #000; 
          padding: 3px 4px; 
          text-align: left; 
          font-size: 11px;
          font-weight: bold;
          line-height: 1.1;
        }
        .items th { 
          background-color: #000; 
          color: #fff;
          font-weight: bold;
        }
        .footer { 
          margin-top: 5px; 
          text-align: center; 
          font-size: 10px; 
          border-top: 1px dashed #000;
          padding-top: 3px;
          font-weight: bold;
        }
        .order-notes {
          margin-top: 5px; 
          padding: 3px; 
          border: 1px solid #000;
          background: #f0f0f0;
          font-weight: bold;
          font-size: 11px;
          line-height: 1.1;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0 3px;
            width: 100%;
            font-size: 11px;
          }
          .kot-container {
            padding: 3px 0;
            width: 100%;
          }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="kot-container">
      <div class="header">
        <div class="restaurant-name">${restaurant.name}</div>
          <div class="kot-title">KITCHEN ORDER TICKET</div>
      </div>
      
      <div class="order-info">
        <p><strong>Order #:</strong> ${order.orderNumber}</p>
        <p><strong>Table:</strong> ${table.number} (${table.area})</p>
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
          ${order.items.map(item => `
            <tr>
              <td>${item.quantity}</td>
              <td>${item.name}</td>
              <td>${item.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${order.notes ? `
          <div class="order-notes">
          <strong>Order Notes:</strong><br>
          ${order.notes}
        </div>
      ` : ''}
      
      <div class="footer">
        <p>*** KITCHEN COPY ***</p>
          <p>Printed: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Bill Generation Function

async function generateCombinedBillContent(orders: Order[], restaurant: any, table: Table, paymentData: any): Promise<string> {
  const combinedSubtotal = orders.reduce((total, order) => total + order.subtotal, 0);
  let couponDiscountAmount = 0;
  let manualDiscountAmount = 0;
  let totalDiscountAmount = 0;
  let couponInfo = null;
  
  // Check for merged tables information from order notes
  const mergedTableNotes = orders.find(order => order.notes?.includes('Merged tables:'));
  const isMergedTable = mergedTableNotes !== undefined;
  const mergedTableInfo = isMergedTable ? mergedTableNotes.notes : null;
  
  // Check for coupon discount from new payment data structure
  if (paymentData.appliedCoupon) {
    couponDiscountAmount = paymentData.appliedCoupon.discountAmount || 0;
    couponInfo = paymentData.appliedCoupon;
  }
  
  // Check for manual discount
  if (paymentData.manualDiscountAmount > 0) {
    manualDiscountAmount = paymentData.manualDiscountAmount;
  }
  // Fallback to old discount structure
  else if (paymentData.discount && !paymentData.appliedCoupon) {
    if (paymentData.discount.type === 'percentage') {
      manualDiscountAmount = (combinedSubtotal * paymentData.discount.value) / 100;
    } else {
      manualDiscountAmount = paymentData.discount.value;
    }
  }
  
  totalDiscountAmount = couponDiscountAmount + manualDiscountAmount;
  const discountedSubtotal = combinedSubtotal - totalDiscountAmount;
  const combinedTax = (discountedSubtotal * (restaurant?.settings?.taxRate || 8.5)) / 100;
  const discountedTotal = discountedSubtotal + combinedTax;
  const tip = paymentData.tip || 0;
  const finalAmount = paymentData.finalTotal || (discountedTotal + tip);

  const allItems: { [key: string]: { name: string; price: number; quantity: number; total: number } } = {};
  
  // Combine all items from all orders
  orders.forEach(order => {
    order.items.forEach(item => {
      const key = `${item.name}-${item.price}`;
      if (allItems[key]) {
        allItems[key].quantity += item.quantity;
        allItems[key].total += item.total;
      } else {
        allItems[key] = {
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total
        };
      }
    });
  });

  const combinedItems = Object.values(allItems);

  // Generate UPI QR code if UPI settings are configured
  let upiQRCodeDataURL = '';
  const upiSettings = restaurant?.settings?.upiSettings;
  if (upiSettings?.enableQRCode && upiSettings?.upiId) {
    try {
      console.log('🏷️ Generating UPI QR code for bill:', {
        upiId: upiSettings.upiId,
        amount: finalAmount,
        restaurant: restaurant.name
      });
      
      const upiPaymentString = generateUPIPaymentString(
        upiSettings.upiId,
        finalAmount,
        restaurant.name,
        `Payment for Table ${table.number} - ${restaurant.name}`
      );
      
      console.log('🔗 UPI Payment String:', upiPaymentString);
      
      upiQRCodeDataURL = await generateQRCodeDataURL(upiPaymentString);
      
      if (upiQRCodeDataURL) {
        console.log('✅ UPI QR Code generated successfully');
      } else {
        console.error('❌ Failed to generate UPI QR Code');
      }
    } catch (error) {
      console.error('❌ Error generating UPI QR Code:', error);
    }
  } else {
    console.log('ℹ️ UPI QR Code not enabled or UPI ID not configured:', {
      enableQRCode: upiSettings?.enableQRCode,
      hasUpiId: !!upiSettings?.upiId
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill - Table ${table.number}</title>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: bold;
          line-height: 1.1;
          width: 100%;
          margin: 0;
          padding: 0 5px;
          background: #fff;
          color: #000;
        }
        
        .receipt {
          width: 100%;
          padding: 5px 0;
          background: #fff;
        }
        
        .header {
          text-align: center;
          margin-bottom: 5px;
          border-bottom: 2px solid #000;
          padding-bottom: 3px;
        }
        
        .restaurant-name {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
          text-transform: uppercase;
        }
        
        .contact-info {
          font-size: 9px;
          line-height: 1.1;
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .separator {
          text-align: center;
          margin: 3px 0;
          font-size: 10px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        
        .bill-header {
          text-align: center;
          margin: 5px 0;
          padding: 3px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .bill-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }
        
        .bill-info {
          font-size: 10px;
          line-height: 1.1;
          font-weight: bold;
        }
        
        .order-details {
          margin: 5px 0;
          padding: 3px 0;
          border-bottom: 1px dashed #000;
        }
        
        .section-title {
          font-weight: bold;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 10px;
        }
        
        .order-line {
          margin: 1px 0;
          font-size: 9px;
          font-weight: bold;
        }
        
        .items-section {
          margin: 5px 0;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          margin-bottom: 3px;
          font-weight: bold;
          font-size: 10px;
        }
        
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          padding: 1px 0;
        }
        
        .item-details {
          flex: 1;
          padding-right: 5px;
        }
        
        .item-name {
          font-weight: bold;
          margin-bottom: 1px;
          font-size: 10px;
        }
        
        .item-qty-price {
          font-size: 9px;
          font-weight: bold;
        }
        
        .item-total {
          font-weight: bold;
          min-width: 50px;
          text-align: right;
          font-size: 10px;
        }
        
        .totals-section {
          margin-top: 5px;
          border-top: 1px solid #000;
          padding-top: 3px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          padding: 1px 0;
          font-weight: bold;
          font-size: 10px;
        }
        
        .total-row.subtotal {
          border-bottom: 1px dotted #000;
          padding-bottom: 2px;
          margin-bottom: 2px;
        }
        
        .total-row.discount {
          font-weight: bold;
        }
        
        .total-row.savings {
          font-weight: bold;
          background: #f0f0f0;
          padding: 2px;
          margin: 1px -2px;
        }
        
        .total-row.final {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 3px 0;
          margin-top: 3px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .coupon-section {
          background: #f0f0f0;
          margin: 3px -2px;
          padding: 3px;
          border: 1px dashed #000;
        }
        
        .coupon-title {
          font-weight: bold;
          margin-bottom: 1px;
          font-size: 9px;
        }
        
        .coupon-code {
          font-size: 8px;
          font-weight: bold;
        }
        
        .free-items {
          font-weight: bold;
          font-size: 8px;
        }
        
        .payment-section {
          margin: 5px 0;
          padding: 3px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .payment-title {
          font-weight: bold;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 10px;
        }
        
        .payment-details {
          font-size: 9px;
          line-height: 1.1;
          font-weight: bold;
        }
        
        .payment-method {
          background: #f0f0f0;
          padding: 1px 2px;
          display: inline-block;
          font-weight: bold;
        }
        
        .upi-section {
          margin: 5px 0;
          padding: 8px;
          border: 2px solid #000;
          text-align: center;
          background: #f9f9f9;
        }
        
        .upi-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 3px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        
        .upi-id {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 5px;
          color: #333;
        }
        
        .qr-code {
          display: block;
          margin: 5px auto;
          border: 2px solid #000;
          border-radius: 4px;
          background: #fff;
          padding: 5px;
        }
        
        .upi-instructions {
          font-size: 8px;
          line-height: 1.2;
          margin-top: 3px;
          color: #666;
        }
        
        .footer {
          text-align: center;
          margin-top: 5px;
          padding-top: 3px;
          border-top: 2px solid #000;
        }
        
        .thank-you {
          font-size: 11px;
          font-weight: bold;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
        }
        
        .footer-info {
          font-size: 8px;
          font-weight: bold;
          line-height: 1.1;
        }
        
        .timestamp {
          text-align: center;
          margin-top: 3px;
          font-size: 8px;
          font-weight: bold;
        }
        
        @media print {
          body {
            padding: 0 3px;
            font-size: 10px;
            width: 100%;
            margin: 0;
          }
          .receipt {
            padding: 3px 0;
            width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- Header Section -->
      <div class="header">
        <div class="restaurant-name">${restaurant.name}</div>
        <div class="contact-info">
            ${restaurant.settings?.businessInfo?.businessAddress || restaurant.settings?.address || 'Restaurant Address'}
          ${restaurant.settings?.businessInfo?.city ? `, ${restaurant.settings.businessInfo.city}` : ''}
          ${restaurant.settings?.businessInfo?.state ? `, ${restaurant.settings.businessInfo.state}` : ''}
          ${restaurant.settings?.businessInfo?.pincode ? ` - ${restaurant.settings.businessInfo.pincode}` : ''}
          <br>
            ${restaurant.settings?.phone ? `📞 ${restaurant.settings.phone}` : ''}
          ${restaurant.settings?.businessInfo?.gstin ? `<br>GSTIN: ${restaurant.settings.businessInfo.gstin}` : ''}
          ${restaurant.settings?.businessInfo?.fssaiNumber ? `<br>FSSAI: ${restaurant.settings.businessInfo.fssaiNumber}` : ''}
        </div>
      </div>

        <!-- Bill Header -->
        <div class="bill-header">
          <div class="bill-title">BILL RECEIPT</div>
      <div class="bill-info">
            <strong>Table:</strong> ${isMergedTable ? mergedTableInfo : `${table.number} (${table.area})`}<br>
            <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br>
            <strong>Time:</strong> ${new Date().toLocaleTimeString('en-IN')}<br>
            ${orders.length > 1 ? `<strong>Combined Bill:</strong> ${orders.length} Orders<br>` : ''}
            ${isMergedTable ? `<strong>Billing Type:</strong> Merged Tables<br>` : ''}
            ${paymentData.customerId ? `<strong>Customer:</strong> ${paymentData.customerId}<br>` : ''}
          </div>
      </div>

        <!-- Order Details -->
        ${orders.length > 1 ? `
        <div class="order-details">
          <div class="section-title">Order Numbers</div>
          ${orders.map(order => `
            <div class="order-line"># ${order.orderNumber} - ${formatCurrency(order.total)}</div>
          `).join('')}
      </div>
        ` : ''}

        <!-- Items Section -->
        <div class="items-section">
          <div class="items-header">
            <span>ITEM</span>
            <span>TOTAL</span>
          </div>
          
        ${combinedItems.map(item => `
            <div class="item-row">
              <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-qty-price">${item.quantity} × ${formatCurrency(item.price)}</div>
              </div>
              <div class="item-total">${formatCurrency(item.total)}</div>
          </div>
        `).join('')}
      </div>

        <!-- Totals Section -->
        <div class="totals-section">
          <div class="total-row subtotal">
            <span>Subtotal</span>
          <span>${formatCurrency(combinedSubtotal)}</span>
        </div>
          
          ${couponInfo ? `
          <div class="coupon-section">
            <div class="coupon-title">🎟️ COUPON APPLIED</div>
            <div class="total-row discount">
              <span>${couponInfo.coupon.name}</span>
              <span>-${formatCurrency(couponDiscountAmount)}</span>
            </div>
            <div class="coupon-code">Code: ${couponInfo.coupon.code}</div>
            ${couponInfo.freeItems && couponInfo.freeItems.length > 0 ? `
            <div class="free-items">
              🎁 Free: ${couponInfo.freeItems.map((item: any) => `${item.quantity}× ${item.name}`).join(', ')}
            </div>
            ` : ''}
          </div>
          ` : ''}
          
          ${manualDiscountAmount > 0 ? `
          <div class="total-row discount">
            <span>Discount ${paymentData.manualDiscount?.type === 'percentage' ? `(${paymentData.manualDiscount.value}%)` : paymentData.discount?.type === 'percentage' ? `(${paymentData.discount.value}%)` : ''}</span>
            <span>-${formatCurrency(manualDiscountAmount)}</span>
          </div>
          ${(paymentData.manualDiscount?.reason || paymentData.discount?.reason) ? `
          <div class="total-row">
            <span style="font-size: 9px; color: #666;">${paymentData.manualDiscount?.reason || paymentData.discount?.reason}</span>
            <span></span>
          </div>
          ` : ''}
          ` : ''}
          
          ${paymentData.totalSavings > 0 ? `
          <div class="total-row savings">
            <span>💰 Total Savings</span>
            <span>-${formatCurrency(paymentData.totalSavings)}</span>
          </div>
          ` : ''}
          
          <div class="total-row">
            <span>Tax (${restaurant?.settings?.taxRate || 8.5}%)</span>
          <span>${formatCurrency(combinedTax)}</span>
        </div>
          
        ${tip > 0 ? `
          <div class="total-row">
            <span>Tip</span>
          <span>${formatCurrency(tip)}</span>
        </div>
        ` : ''}
          
          <div class="total-row final">
            <span>TOTAL AMOUNT</span>
          <span>${formatCurrency(finalAmount)}</span>
        </div>
      </div>

        <!-- Payment Section -->
        <div class="payment-section">
          <div class="payment-title">Payment Details</div>
          <div class="payment-details">
            ${paymentData.isCredit ? `
              <strong>Method:</strong> <span class="payment-method">${paymentData.addWholeAmountAsCredit ? 'FULL CREDIT' : 'PARTIAL CREDIT'}</span><br>
              ${!paymentData.addWholeAmountAsCredit ? `
                <strong>Amount Received:</strong> ${formatCurrency(paymentData.amountReceived || 0)}<br>
                <strong>Credit Amount:</strong> ${formatCurrency(paymentData.creditAmount || 0)}<br>
              ` : `
                <strong>Full Amount Added as Credit:</strong> ${formatCurrency(finalAmount)}<br>
              `}
              <strong>Credit Customer:</strong> ${paymentData.creditCustomerName}<br>
              ${paymentData.creditCustomerPhone ? `<strong>Phone:</strong> ${paymentData.creditCustomerPhone}<br>` : ''}
            ` : `
              <strong>Method:</strong> <span class="payment-method">${paymentData.method.toUpperCase()}</span><br>
              ${paymentData.method === 'cash' ? `
                <strong>Amount Received:</strong> ${formatCurrency(paymentData.amountReceived || finalAmount)}<br>
                <strong>Change Given:</strong> ${formatCurrency(Math.max(0, (paymentData.amountReceived || finalAmount) - finalAmount))}
              ` : ''}
              ${paymentData.reference ? `<strong>Reference:</strong> ${paymentData.reference}` : ''}
            `}
          </div>
      </div>

        ${upiSettings?.enableQRCode && upiSettings?.upiId && upiQRCodeDataURL ? `
        <!-- UPI QR Code Section - Only QR Code -->
        <div style="margin: 5px 0; text-align: center; background: #fff; padding: 5px; border: 1px solid #000;">
          <img src="${upiQRCodeDataURL}" 
               alt="UPI QR Code" 
               style="width: 80px; height: 80px; display: block; margin: 0 auto; background: white;" />
        </div>
        ` : ''}

        <!-- Footer -->
      <div class="footer">
          <div class="thank-you">🙏 THANK YOU! 🙏</div>
          <div class="footer-info">
            Please visit us again!<br>
            ${restaurant.settings?.businessInfo?.website ? `🌐 ${restaurant.settings.businessInfo.website}<br>` : ''}
            ${restaurant.settings?.businessInfo?.email ? `📧 ${restaurant.settings.businessInfo.email}` : ''}
          </div>
          
          <div class="timestamp">
            Generated on ${new Date().toLocaleString('en-IN')}
          </div>
        </div>

        <div class="separator">═══════════════════════</div>
      </div>
    </body>
    </html>
  `;
}

 