import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { MenuService } from '@/services/menuService';
import { OrderService, CartManager, CartItem } from '@/services/orderService';
import { TableService } from '@/services/tableService';
import { CustomerService } from '@/services/customerService';
import { CouponService } from '@/services/couponService';
import { MenuItem, Category, Table, Order, PaymentMethod, Discount, SelectedVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';
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

  const checkExistingOrder = async () => {
    if (!restaurant || !tableId) return;

    try {
      // Check if there's an active order for this table
      const ordersResult = await OrderService.getOrdersByTable(restaurant.id, tableId);
      if (ordersResult.success && ordersResult.data) {
        const activeOrders = ordersResult.data.filter(order => 
          ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status)
        );
        
        setAllOrders(activeOrders);
        
        if (activeOrders.length > 0) {
          // Set the most recent order as current
          const latestOrder = activeOrders.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
          
          setCurrentOrder(latestOrder);
          setOrderState('placed');
          
          // Clear cart since order is already placed
          CartManager.clearCart(restaurant!.id, tableId);
          setCartItems([]);
        }
      }
    } catch (error) {
      console.error('Failed to check existing order:', error);
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
      orderNotes: data.orderNotes 
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
      console.log('🚀 Starting order placement process...');

      // Update table status to occupied only if it's the first order
      if (orderState === 'cart') {
        console.log('📋 Updating table status to occupied...');
        await TableService.updateTable(tableId, restaurant.id, { status: 'occupied' });
      }

      // Create order using the provided cart items
      console.log('📝 Creating order in Firebase...', {
        restaurantId: restaurant.id,
        tableId,
        staffId: user.id,
        itemCount: cartItemsToUse.length,
        taxRate: restaurant.settings.taxRate
      });

      const result = await OrderService.createOrder(
        restaurant.id,
        tableId,
        user.id,
        cartItemsToUse,
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
        
        // Update orders list
        if (orderState === 'adding_more') {
          setAllOrders(prev => [...prev, newOrder]);
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
        
        const message = orderState === 'adding_more' ? 'Additional order placed successfully!' : 'Order placed successfully!';
        toast.success(message);
        console.log('🎉 Order placement completed successfully');
        
        // Automatically print KOT for the new order
        setTimeout(() => {
          if (table) {
          const kotContent = generateKOTContent(newOrder, restaurant, table);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(kotContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }
          if (!isVoiceProcessing) {
            toast.success('KOT sent to kitchen');
          }
          }
        }, 500);
        
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
        
        // Update orders list
        if (orderState === 'adding_more') {
          setAllOrders(prev => [...prev, newOrder]);
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
        
        // Automatically print KOT for the new order
        setTimeout(() => {
          if (table) {
          const kotContent = generateKOTContent(newOrder, restaurant, table);
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
        }, 500);
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
    if (!restaurant || !table || allOrders.length === 0) return;

    // Print KOT for the most recent order (last placed)
    const latestOrder = allOrders[allOrders.length - 1];
    
    // Create KOT content
    const kotContent = generateKOTContent(latestOrder, restaurant, table);
    
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
    if (!restaurant || !tableId || allOrders.length === 0) return;

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

      // Update all active orders status to completed
      const updatePromises = allOrders.map(async (order) => {
        const updateData: any = { 
          status: 'completed',
          paymentMethod: data.method,
          amountReceived: data.amountReceived,
          finalTotal: data.finalTotal,
          originalTotal: data.originalTotal
        };
        
        // Add coupon information if applied
        if (data.appliedCoupon) {
          updateData.appliedCoupon = {
            code: data.appliedCoupon.coupon.code,
            name: data.appliedCoupon.coupon.name,
            discountAmount: data.appliedCoupon.discountAmount || 0,
            freeItems: data.appliedCoupon.freeItems || [],
            totalSavings: data.totalSavings || 0
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
        
        const successMessage = data.totalSavings > 0 
          ? `Payment processed! Customer saved ${formatCurrency(data.totalSavings)} with coupon!`
          : 'Payment processed successfully!';
        
        toast.success(successMessage);
        
        // Automatically open print dialog for combined bill
        setTimeout(() => {
          handlePrintCombinedBill(allOrders, data);
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

  const handlePrintCombinedBill = (orders: Order[], paymentData: any) => {
    if (!orders.length || !restaurant || !table) return;

    // Create combined bill content
    const billContent = generateCombinedBillContent(orders, restaurant, table, paymentData);
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(billContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
    
    toast.success('Combined bill sent to printer');
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

  // Voice Command Handlers
  const handleVoiceOrderCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 TakeOrder: Voice order command received:', command);
    
    // Check authentication first
    if (!user) {
      console.log('🎤 User not authenticated, retrying in 2 seconds...');
      toast.error('🎤 Authentication loading... Please try again in a moment.');
      
      // Retry after authentication might be loaded
      setTimeout(() => {
        const retryEvent = new CustomEvent('voiceOrderCommand', {
          detail: { command }
        });
        window.dispatchEvent(retryEvent);
      }, 2000);
      return;
    }

    // Start voice processing workflow
    setIsVoiceProcessing(true);
    setVoiceLoadingStage('processing');
    setVoiceLoadingMessage('Analyzing your voice command...');
    
    // Hide any toast messages for a clean experience
    toast.dismiss();
    
    if (command.menuItems && command.menuItems.length > 0) {
      let addedItems = 0;
      
      // Add items to cart with verification
      const processVoiceItems = async () => {
        for (const voiceItem of command.menuItems || []) {
          console.log(`🎤 Searching for menu item: "${voiceItem.name}" in ${menuItems.length} available items`);
          
          // Enhanced smart search for menu items with singular/plural handling
          const findMenuItem = (searchTerm: string) => {
            const term = searchTerm.toLowerCase().trim();
            
            console.log(`🔍 Searching for: "${term}"`);
            
            // Helper function to normalize singular/plural
            const normalizeWord = (word: string) => {
              // Remove common plural endings
              if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) {
                return word.slice(0, -1);
              }
              return word;
            };
            
            // Helper function to add plural form
            const pluralize = (word: string) => {
              if (word.endsWith('s') || word.endsWith('x') || word.endsWith('sh') || word.endsWith('ch')) {
                return word + 'es';
              }
              if (word.endsWith('y') && word.length > 1) {
                return word.slice(0, -1) + 'ies';
              }
              return word + 's';
            };
            
            // 1. Exact match first
            let item = menuItems.find(item => 
              item.name.toLowerCase() === term
            );
            if (item) {
              console.log(`✅ Exact match found: ${item.name}`);
              return item;
            }
            
            // 2. Try plural/singular variations
            const termWords = term.split(' ');
            const variations = [
              // Try with last word pluralized
              [...termWords.slice(0, -1), pluralize(termWords[termWords.length - 1])].join(' '),
              // Try with last word singularized
              [...termWords.slice(0, -1), normalizeWord(termWords[termWords.length - 1])].join(' '),
              // Try with all words normalized (singular)
              termWords.map(normalizeWord).join(' '),
              // Try with all words pluralized
              termWords.map(pluralize).join(' ')
            ];
            
            for (const variation of variations) {
              item = menuItems.find(item => 
                item.name.toLowerCase() === variation ||
                item.name.toLowerCase().includes(variation) ||
                variation.includes(item.name.toLowerCase())
              );
              if (item) {
                console.log(`✅ Variation match found: "${variation}" → ${item.name}`);
                return item;
              }
            }
            
            // 3. Fuzzy word-by-word match with normalization
            const searchWords = term.split(' ').filter(word => word.length > 2);
            item = menuItems.find(item => {
              const itemWords = item.name.toLowerCase().split(' ');
              return searchWords.every(searchWord => {
                const normalizedSearchWord = normalizeWord(searchWord);
                return itemWords.some(itemWord => {
                  const normalizedItemWord = normalizeWord(itemWord);
                  return normalizedItemWord.includes(normalizedSearchWord) || 
                         normalizedSearchWord.includes(normalizedItemWord) ||
                         itemWord.includes(searchWord) || 
                         searchWord.includes(itemWord);
                });
              });
            });
            if (item) {
              console.log(`✅ Fuzzy match found: ${item.name}`);
              return item;
            }
            
            // 4. Alternative names/aliases (common variations)
            const aliases: { [key: string]: string[] } = {
              'wings': ['chicken wings', 'buffalo wings', 'hot wings'],
              'chicken wing': ['chicken wings', 'buffalo wings'],
              'wing': ['chicken wings', 'buffalo wings', 'hot wings'],
              'burger': ['beef burger', 'chicken burger', 'cheese burger'],
              'juice': ['fresh orange juice', 'apple juice', 'grape juice'],
              'orange': ['fresh orange juice', 'orange juice'],
              'salad': ['caesar salad', 'garden salad', 'greek salad'],
              'caesar': ['caesar salad'],
              'chicken': ['grilled chicken', 'fried chicken', 'chicken breast'],
              'fish': ['grilled fish', 'fried fish', 'fish fillet'],
              'pasta': ['spaghetti', 'penne pasta', 'pasta marinara'],
              'pizza': ['margherita pizza', 'cheese pizza', 'pepperoni pizza'],
            };
            
            for (const [alias, possibleNames] of Object.entries(aliases)) {
              if (term.includes(alias) || normalizeWord(term).includes(normalizeWord(alias))) {
                for (const possibleName of possibleNames) {
                  item = menuItems.find(item => 
                    item.name.toLowerCase().includes(possibleName.toLowerCase()) ||
                    possibleName.toLowerCase().includes(item.name.toLowerCase())
                  );
                  if (item) {
                    console.log(`✅ Alias match found: "${alias}" → ${item.name}`);
                    return item;
                  }
                }
              }
            }
            
            console.log(`❌ No match found for: "${term}"`);
            return null;
          };
          
          const menuItem = findMenuItem(voiceItem.name);
          
          if (menuItem) {
            // Store cart state before adding
            const cartBefore = restaurant && tableId ? CartManager.getCartItems(restaurant.id, tableId) : [];
            
            console.log(`🎤 Current orderState: ${orderState}, attempting to add ${menuItem.name}`);
            
            // For voice commands, use forceAdd to bypass orderState restrictions
            console.log(`🎤 Adding ${menuItem.name} to cart with force=true (orderState: ${orderState})`);
            
            // Update voice loading message
            setVoiceLoadingMessage(`Adding ${menuItem.name} to order...`);
            
            // Ensure we're in the right state for voice commands
            if (orderState === 'placed' || orderState === 'completed') {
              console.log(`🎤 Setting orderState to 'adding_more' for voice command`);
              setOrderState('adding_more');
            }
            
            // Add to cart with forceAdd=true to bypass orderState restrictions
            addToCart(menuItem, voiceItem.quantity, true);
            
            // Give time for cart state to update
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify item was actually added
            const cartAfter = restaurant && tableId ? CartManager.getCartItems(restaurant.id, tableId) : [];
            
            if (cartAfter.length > cartBefore.length) {
              addedItems++;
              // Don't show toast during voice processing
              console.log(`🎤 Verified: Added ${voiceItem.quantity}x ${menuItem.name} to cart (${cartBefore.length} → ${cartAfter.length})`);
            } else {
              console.error(`❌ Failed to add ${menuItem.name} to cart - orderState: ${orderState}`);
              console.error(`❌ Cart verification: before=${cartBefore.length}, after=${cartAfter.length}`);
              
              // Try direct cart manipulation as fallback
              if (restaurant && tableId) {
                console.log(`🎤 Attempting direct cart addition as fallback`);
                const cartItem: CartItem = {
                  menuItemId: menuItem.id,
                  name: menuItem.name,
                  price: menuItem.price,
                  quantity: voiceItem.quantity,
                  total: menuItem.price * voiceItem.quantity,
                };
                
                const directCart = CartManager.addToCart(restaurant.id, cartItem, tableId);
                setCartItems(directCart);
                
                // Verify direct addition
                const finalCart = CartManager.getCartItems(restaurant.id, tableId);
                if (finalCart.length > cartBefore.length) {
                  addedItems++;
                  toast.success(`🎤 Added ${voiceItem.quantity}x ${menuItem.name} to order (direct)`);
                  console.log(`🎤 Direct addition successful: ${cartBefore.length} → ${finalCart.length}`);
                } else {
                  toast.error(`🎤 Failed to add ${menuItem.name} to cart`);
                  console.error(`❌ Direct addition also failed`);
                }
              }
            }
          } else {
            toast.error(`🎤 Menu item "${voiceItem.name}" not found`);
            console.log(`🎤 Menu item not found: "${voiceItem.name}"`);
            
            // Suggest similar items
            const suggestions = menuItems
              .filter(item => {
                const itemName = item.name.toLowerCase();
                const searchTerm = voiceItem.name.toLowerCase();
                const words1 = itemName.split(' ');
                const words2 = searchTerm.split(' ');
                return words1.some(w1 => words2.some(w2 => w1.includes(w2) || w2.includes(w1)));
              })
              .slice(0, 3)
              .map(item => item.name);
            
            if (suggestions.length > 0) {
              console.log(`🎤 Did you mean: ${suggestions.join(', ')}?`);
              toast(`🎤 Did you mean: ${suggestions.join(', ')}?`, { duration: 4000 });
            }
          }
        }
        
        return addedItems;
      };
      
      // Process items asynchronously
      await processVoiceItems();

      // If items were added successfully, place the order immediately
      if (addedItems > 0) {
        console.log(`🎤 Voice cart update complete. Added ${addedItems} items.`);
        
        // Move to placing stage
        setVoiceLoadingStage('placing');
        setVoiceLoadingMessage('Creating your order...');
        
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
                  // Call handlePlaceOrderWithCart to bypass state synchronization issues
                  await handlePlaceOrderWithCart(finalCart, { 
                    orderNotes: `Voice order: ${command.menuItems?.map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}` 
                  });

                  // Move to completed stage
                  setVoiceLoadingStage('completed');
                  setVoiceLoadingMessage('Order placed successfully!');
                  
                  // Prepare order details for KOT dialog
                  if (table && command.menuItems) {
                    setVoiceOrderDetails({
                      orderNumber: `ORD-${Date.now()}`, // This will be updated in handlePlaceOrderWithCart
                      tableNumber: table.number,
                      items: command.menuItems.map(item => ({
                        name: item.name,
                        quantity: item.quantity
                      }))
                    });
                  }

                  // Hide loading after a brief delay and trigger print directly
                  setTimeout(() => {
                    setIsVoiceProcessing(false);
                    // Trigger print directly without showing modal
                    handlePrintKOT();
                  }, 1000);

                } catch (error) {
                  console.error(`❌ Voice order placement failed:`, error);
                  setIsVoiceProcessing(false);
                  toast.error(`🎤 Failed to place order. Please try manually.`);
                }
              } else {
                console.error(`❌ Cart is empty during auto-place, cannot proceed`);
                setIsVoiceProcessing(false);
                toast.error(`🎤 Failed to place order - cart appears to be empty`);
              }
            }, 500);
          } else {
            console.error(`❌ No items in cart after voice command processing`);
            setIsVoiceProcessing(false);
            toast.error(`🎤 Failed to add items to cart`);
          }
        }
      } else {
        // No items were added, end voice processing
        setIsVoiceProcessing(false);
        toast.error(`🎤 Please specify menu items to add to the order`);
      }
    } else {
      toast(`🎤 Please specify menu items to add to the order`);
    }
  }, [menuItems, addToCart, handlePlaceOrder, table, restaurant, user]);

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
    const method = command.paymentMethod ? methodMap[command.paymentMethod] : 'cash';
    
    console.log('🎤 Payment method mapping:', {
      originalMethod: command.paymentMethod,
      mappedMethod: method
    });
    
    if (!method) {
      toast.error(`🎤 Invalid payment method: ${command.paymentMethod}`);
      return;
    }
    
    // Calculate total amount
    const combinedTotal = allOrders.reduce((total, order) => total + order.total, 0);
    
    console.log('🎤 Processing voice payment:', {
      method,
      combinedTotal,
      ordersCount: allOrders.length,
      tableNumber: table?.number
    });
    
    // Auto-process payment with step-by-step feedback
    try {
      // Step 1: Start processing
      toast.success(`🎤 Processing ${method.toUpperCase()} payment for table ${table?.number}...`);
      toast(`🎤 Total amount: ₹${combinedTotal.toFixed(2)}`);
      
      // Step 2: Create payment data
      const paymentData = {
        method: method,
        amountReceived: combinedTotal,
        originalTotal: combinedTotal,
        finalTotal: combinedTotal,
        tip: 0,
        reference: `Voice payment - ${new Date().toLocaleTimeString()}`,
        customerId: undefined,
        appliedCoupon: undefined,
        totalSavings: 0,
        printBill: true // Auto-print bill for voice payments
      };
      
      console.log('🎤 Payment data prepared:', paymentData);
      
      // Step 3: Process payment
      toast(`🎤 Finalizing payment and updating order status...`);
      await handlePayment(paymentData);
      
      // Provide comprehensive success feedback
      toast.success(`🎤 Payment of ₹${combinedTotal.toFixed(2)} completed via ${method.toUpperCase()}!`);
      toast.success(`🎤 Table ${table?.number} is now available for new customers`);
      console.log('🎤 Voice payment completed successfully');
      
      // Navigate back to tables view after successful payment
      setTimeout(() => {
        navigate(`/${restaurant?.slug}/tables`);
      }, 3000);
      
    } catch (error) {
      console.error('🎤 Voice payment failed:', error);
      toast.error('🎤 Voice payment failed. Please process manually.');
      
      // Fallback to opening payment modal for manual processing
      setShowPaymentModal(true);
      toast(`🎤 Opening payment window for manual processing...`);
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
    
    // Show confirmation dialog
    const confirmed = confirm(`Cancel all orders for table ${table.number}? This action cannot be undone.`);
    
    if (confirmed) {
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
    } else {
      toast('🎤 Order cancellation cancelled');
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
          toast.error(`🎤 Customer with this information already exists in CRM`);
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
      checkExistingOrder();
    }
  }, [restaurant, tableId]);

  // Set payment amount to combined order total by default
  useEffect(() => {
    if (allOrders.length > 0 && showPaymentModal) {
      const combinedTotal = allOrders.reduce((total, order) => total + order.total, 0);
      setPaymentValue('amountReceived', combinedTotal);
    }
  }, [allOrders, showPaymentModal, setPaymentValue]);

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

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
              
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Table {table.number} - {table.area}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Capacity: {table.capacity} guests</span>
                  <span className="capitalize">Status: {table.status.replace('_', ' ')}</span>
                  {orderState === 'placed' && allOrders.length > 0 && (
                    <span className="text-blue-600 font-medium">
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
                </div>
              )}
              
              {/* Mobile Action Button */}
              {orderState === 'placed' && allOrders.length > 0 && cartItems.length === 0 && (
                <div className="sm:hidden">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn bg-green-600 text-white hover:bg-green-700 text-sm px-3 py-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                  </button>
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
            {/* Order Side Panel for Adding More */}
            {showSidePanel && orderState === 'adding_more' && (
              <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 border-l border-gray-200">
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                      <button
                        onClick={() => setShowSidePanel(false)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">Existing orders on Table {table.number}</p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                    {allOrders.map((order) => (
                      <div key={order.id} className="mb-4 bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-gray-900">
                            Order #{order.orderNumber}
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="text-gray-600">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-gray-200 p-4">
                    <button
                      onClick={() => {
                        setShowSidePanel(false);
                        setOrderState('placed');
                      }}
                      className="w-full btn btn-secondary"
                    >
                      Back to Orders
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-6">
                    {filteredItems.map(item => {
                      const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                      return (
                        <MenuItemCard
                          key={item.id}
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
                      {cartItems.map(item => (
                        <OrderItemCard
                          key={item.menuItemId}
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredItems.map(item => {
                      const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                      return (
                        <MenuItemCard
                          key={item.id}
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
                            {cartItems.map(item => (
                              <OrderItemCard
                                key={item.menuItemId}
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
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Orders Placed!</h2>
                  <p className="text-gray-600">
                    {allOrders.length} active order{allOrders.length > 1 ? 's' : ''} for Table {table.number}
                  </p>
                </div>

                <div className="grid gap-6">
                  {allOrders.map((order) => (
                    <div key={order.id} className="card p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{order.orderNumber}
                        </h3>
                        <span className="text-gray-600 text-sm">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <h4 className="font-medium text-gray-900">{item.name}</h4>
                              <p className="text-sm text-gray-600">
                                {item.quantity} × {formatCurrency(item.price)}
                              </p>
                            </div>
                            <div className="font-medium text-gray-900">
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
              <span key={index}>
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





// KOT Generation Function
function generateKOTContent(order: Order, restaurant: any, table: Table): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOT - ${order.orderNumber}</title>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          margin: 0; 
          padding: 0 10px; 
          width: 100%;
          background: #fff;
        }
        .kot-container {
          width: 100%;
          padding: 15px 5px;
          min-height: 100vh;
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
        .order-notes {
          margin-top: 15px; 
          padding: 10px; 
          border: 1px solid #000;
          background: #f9f9f9;
        }
        @media print {
          body { 
            margin: 0; 
            padding: 0 8px;
            width: 100%;
          }
          .kot-container {
            padding: 10px 0;
            width: 100%;
            min-height: auto;
          }
          .no-print { display: none; }
          .header, .order-info, .items, .order-notes, .footer {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="kot-container">
      <div class="header">
        <div class="restaurant-name">${restaurant.name}</div>
        <div>KITCHEN ORDER TICKET</div>
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
        <p>Printed at: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Bill Generation Function

function generateCombinedBillContent(orders: Order[], restaurant: any, table: Table, paymentData: any): string {
  const combinedSubtotal = orders.reduce((total, order) => total + order.subtotal, 0);
  let discountAmount = 0;
  let couponInfo = null;
  
  // Check for merged tables information from order notes
  const mergedTableNotes = orders.find(order => order.notes?.includes('Merged tables:'));
  const isMergedTable = mergedTableNotes !== undefined;
  const mergedTableInfo = isMergedTable ? mergedTableNotes.notes : null;
  
  // Check for coupon discount from new payment data structure
  if (paymentData.appliedCoupon) {
    discountAmount = paymentData.appliedCoupon.discountAmount || 0;
    couponInfo = paymentData.appliedCoupon;
  }
  // Fallback to old discount structure
  else if (paymentData.discount) {
    if (paymentData.discount.type === 'percentage') {
      discountAmount = (combinedSubtotal * paymentData.discount.value) / 100;
    } else {
      discountAmount = paymentData.discount.value;
    }
  }
  
  const discountedSubtotal = combinedSubtotal - discountAmount;
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
          font-size: 13px;
          line-height: 1.3;
          width: 100%;
          margin: 0;
          padding: 0 10px;
          background: #fff;
          color: #000;
        }
        
        .receipt {
          width: 100%;
          padding: 15px 5px;
          background: #fff;
          min-height: 100vh;
        }
        
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        
        .restaurant-name {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: 1px;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .contact-info {
          font-size: 11px;
          line-height: 1.4;
          color: #333;
          margin-bottom: 5px;
        }
        
        .separator {
          text-align: center;
          margin: 10px 0;
          font-size: 14px;
          letter-spacing: 2px;
        }
        
        .bill-header {
          text-align: center;
          margin: 15px 0;
          padding: 10px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .bill-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        
        .bill-info {
          font-size: 12px;
          line-height: 1.5;
        }
        
        .order-details {
          margin: 15px 0;
          padding: 10px 0;
          border-bottom: 1px dashed #000;
        }
        
        .section-title {
          font-weight: bold;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .order-line {
          margin: 3px 0;
          font-size: 11px;
          color: #555;
        }
        
        .items-section {
          margin: 15px 0;
        }
        
        .items-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
          margin-bottom: 10px;
          font-weight: bold;
          font-size: 12px;
        }
        
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 3px 0;
        }
        
        .item-details {
          flex: 1;
          padding-right: 10px;
        }
        
        .item-name {
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .item-qty-price {
          font-size: 11px;
          color: #666;
        }
        
        .item-total {
          font-weight: bold;
          min-width: 60px;
          text-align: right;
        }
        
        .totals-section {
          margin-top: 20px;
          border-top: 1px solid #000;
          padding-top: 15px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          padding: 2px 0;
        }
        
        .total-row.subtotal {
          border-bottom: 1px dotted #666;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        
        .total-row.discount {
          color: #d32f2f;
          font-weight: bold;
        }
        
        .total-row.savings {
          color: #388e3c;
          font-weight: bold;
          background: #f8f8f8;
          padding: 5px;
          margin: 5px -5px;
          border-radius: 3px;
        }
        
        .total-row.final {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 8px 0;
          margin-top: 10px;
          font-size: 16px;
          font-weight: bold;
        }
        
        .coupon-section {
          background: #e8f5e8;
          margin: 10px -5px;
          padding: 8px;
          border-radius: 3px;
          border: 1px dashed #4caf50;
        }
        
        .coupon-title {
          color: #2e7d32;
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        .coupon-code {
          font-size: 11px;
          color: #666;
          font-style: italic;
        }
        
        .free-items {
          color: #ff6f00;
          font-weight: bold;
          font-size: 11px;
        }
        
        .payment-section {
          margin: 20px 0;
          padding: 15px 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
        }
        
        .payment-title {
          font-weight: bold;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .payment-details {
          font-size: 12px;
          line-height: 1.6;
        }
        
        .payment-method {
          background: #f5f5f5;
          padding: 5px;
          border-radius: 3px;
          display: inline-block;
          font-weight: bold;
        }
        
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 2px solid #000;
        }
        
        .thank-you {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          letter-spacing: 1px;
        }
        
        .footer-info {
          font-size: 10px;
          color: #666;
          line-height: 1.4;
        }
        
        .timestamp {
          text-align: center;
          margin-top: 15px;
          font-size: 10px;
          color: #888;
          font-style: italic;
        }
        
        @media print {
          body {
            padding: 0 8px;
            font-size: 12px;
            width: 100%;
            margin: 0;
          }
          .receipt {
            padding: 10px 0;
            width: 100%;
            min-height: auto;
          }
          .header, .bill-header, .items-section, .totals-section, .payment-section, .footer {
            page-break-inside: avoid;
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
              <span>-${formatCurrency(discountAmount)}</span>
            </div>
            <div class="coupon-code">Code: ${couponInfo.coupon.code}</div>
            ${couponInfo.freeItems && couponInfo.freeItems.length > 0 ? `
            <div class="free-items">
              🎁 Free: ${couponInfo.freeItems.map((item: any) => `${item.quantity}× ${item.name}`).join(', ')}
            </div>
            ` : ''}
          </div>
          ${paymentData.totalSavings > 0 ? `
          <div class="total-row savings">
            <span>💰 Total Savings</span>
            <span>-${formatCurrency(paymentData.totalSavings)}</span>
          </div>
          ` : ''}
          ` : discountAmount > 0 ? `
          <div class="total-row discount">
            <span>Discount ${paymentData.discount?.type === 'percentage' ? `(${paymentData.discount.value}%)` : ''}</span>
          <span>-${formatCurrency(discountAmount)}</span>
        </div>
        ${paymentData.discount?.reason ? `
          <div class="total-row">
            <span style="font-size: 11px; color: #666;">${paymentData.discount.reason}</span>
          <span></span>
        </div>
        ` : ''}
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
            <strong>Method:</strong> <span class="payment-method">${paymentData.method.toUpperCase()}</span><br>
        ${paymentData.method === 'cash' ? `
              <strong>Amount Received:</strong> ${formatCurrency(paymentData.amountReceived || finalAmount)}<br>
              <strong>Change Given:</strong> ${formatCurrency(Math.max(0, (paymentData.amountReceived || finalAmount) - finalAmount))}
        ` : ''}
            ${paymentData.reference ? `<strong>Reference:</strong> ${paymentData.reference}` : ''}
          </div>
      </div>

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

 