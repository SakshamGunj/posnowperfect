import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  Check,
  Receipt,
  Search,
  Filter,
  ShoppingCart,
  User,
  Phone,
  Mail,
  Package,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { MenuService } from '@/services/menuService';
import { OrderService, CartManager, CartItem } from '@/services/orderService';
import { CustomerService } from '@/services/customerService';
import { MenuItem, Category, Order, SelectedVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VariantSelectionModal from '@/components/restaurant/VariantSelectionModal';
import PaymentModalWithCoupons from '@/components/restaurant/PaymentModalWithCoupons';

interface CustomerForm {
  name: string;
  phone?: string;
  email?: string;
  orderNotes?: string;
}

export default function NewTakeawayOrder() {
  const navigate = useNavigate();
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  
  const { register, handleSubmit, reset } = useForm<CustomerForm>();

  // Load menu data
  const loadData = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);

      // Initialize menu if needed
      const initResult = await MenuService.initializeDefaultMenu(restaurant.id);
      if (initResult.success) {
        console.log('✅ Default menu initialization successful');
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
    if (restaurant) {
      const items = CartManager.getCartItems(restaurant.id, 'takeaway');
      setCartItems(items);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurant]);

  useEffect(() => {
    loadCart();
  }, [restaurant]);

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    let filtered = menuItems;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.categoryId === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [menuItems, selectedCategory, searchTerm]);

  // Add item to cart
  const addToCart = (menuItem: MenuItem, quantity: number = 1, forceAdd: boolean = false) => {
    if (!restaurant) return;

    // Check if item has variants
    if (menuItem.variants && menuItem.variants.length > 0 && !forceAdd) {
      setSelectedMenuItem(menuItem);
      setShowVariantModal(true);
      return;
    }

    const cartItem: CartItem = {
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      total: menuItem.price * quantity,
      variants: [],
      customizations: [],
      notes: '',
    };

    const updatedCart = CartManager.addToCart(restaurant.id, cartItem, 'takeaway');
    setCartItems(updatedCart);
    
    toast.success(`${menuItem.name} added to cart`);
  };

  // Handle variant confirmation
  const handleVariantConfirm = (variants: SelectedVariant[], finalPrice: number) => {
    if (!selectedMenuItem || !restaurant) return;

    const cartItem: CartItem = {
      menuItemId: selectedMenuItem.id,
      name: selectedMenuItem.name,
      price: finalPrice,
      quantity: 1,
      total: finalPrice,
      variants,
      customizations: [],
      notes: '',
    };

    const updatedCart = CartManager.addToCart(restaurant.id, cartItem, 'takeaway');
    setCartItems(updatedCart);
    
    setShowVariantModal(false);
    setSelectedMenuItem(null);
    toast.success(`${selectedMenuItem.name} added to cart`);
  };

  // Update cart item quantity
  const updateCartItemQuantity = (menuItemId: string, quantity: number) => {
    if (!restaurant) return;

    const updatedCart = CartManager.updateCartItemQuantity(restaurant.id, menuItemId, quantity, 'takeaway');
    setCartItems(updatedCart);
  };

  // Remove from cart
  const removeFromCart = (menuItemId: string) => {
    if (!restaurant) return;

    const updatedCart = CartManager.removeFromCart(restaurant.id, menuItemId, 'takeaway');
    setCartItems(updatedCart);
    toast.success('Item removed from cart');
  };

  // Calculate cart totals
  const cartTotal = useMemo(() => {
    const subtotal = cartItems.reduce((total, item) => total + item.total, 0);
    const tax = subtotal * (restaurant?.settings.taxRate || 8.5) / 100;
    const total = subtotal + tax;

    return {
      subtotal,
      tax,
      total,
      itemCount: cartItems.reduce((count, item) => count + item.quantity, 0),
    };
  }, [cartItems, restaurant]);

  // Handle place order
  const handlePlaceOrder = async (data: CustomerForm) => {
    if (!restaurant || !user || cartItems.length === 0) {
      toast.error('Cannot place order: missing required data');
      return;
    }

    try {
      setIsPlacingOrder(true);

      // Create order with takeaway type
      const result = await OrderService.createOrder(
        restaurant.id,
        'takeaway-order', // Use special ID for takeaway
        user.id,
        cartItems,
        restaurant.settings.taxRate || 8.5,
        data.orderNotes
      );

      if (result.success && result.data) {
        // Update order with customer info and set type to takeaway
        const updateData = {
          type: 'takeaway' as const,
          customerName: data.name,
          ...(data.phone && { customerPhone: data.phone }),
          ...(data.email && { customerEmail: data.email }),
        };

        await OrderService.updateOrderStatus(
          result.data.id,
          restaurant.id,
          'placed',
          updateData
        );

        // Clear cart
        CartManager.clearCart(restaurant.id, 'takeaway');
        setCartItems([]);
        
        // Update local order object
        const updatedOrder = { ...result.data, ...updateData };
        setCurrentOrder(updatedOrder);
        
        toast.success(`Takeaway order #${result.data.orderNumber} placed successfully!`);
        
        // Show payment modal
        setShowPaymentModal(true);
        
        // Reset form
        reset();
        
      } else {
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Handle payment
  const handlePayment = async (paymentData: any) => {
    if (!currentOrder || !restaurant) return;

    setIsProcessingPayment(true);
    
    try {
      // Update order status to completed and mark as paid
      const result = await OrderService.updateOrderStatus(
        currentOrder.id, 
        restaurant.id, 
        'completed',
        {
          paymentStatus: 'paid',
          paymentMethod: paymentData.method,
        }
      );

      if (result.success) {
        toast.success('Payment processed successfully!');
        setShowPaymentModal(false);
        setCurrentOrder(null);
        
        // Navigate back to takeaway orders list
        navigate(`/${restaurant?.slug}/takeaway`);
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

  // Clear cart
  const clearCart = () => {
    if (!restaurant) return;
    
    CartManager.clearCart(restaurant.id, 'takeaway');
    setCartItems([]);
    toast.success('Cart cleared');
  };

  if (!restaurant) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
                                onClick={() => navigate(`/${restaurant?.slug}/takeaway`)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Takeaway Order</h1>
              <p className="text-gray-600">Create a new takeaway order</p>
            </div>
          </div>

          {/* Cart Summary */}
          {cartItems.length > 0 && (
            <div className="card p-4 bg-orange-50 border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-orange-900">
                    {cartTotal.itemCount} items in cart
                  </span>
                </div>
                <div className="text-lg font-bold text-orange-900">
                  {formatCurrency(cartTotal.total)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            {/* Search and Filters */}
            <div className="card p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                
                <div className="sm:w-48">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
                <p className="text-gray-600">Loading menu...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
                <p className="text-gray-600">Try adjusting your search or filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredMenuItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onAddToCart={addToCart}
                    cartQuantity={cartItems.find(ci => ci.menuItemId === item.id)?.quantity || 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart & Order Section */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              {/* Cart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                  {cartItems.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No items in cart</p>
                    <p className="text-sm text-gray-500">Add items from the menu</p>
                  </div>
                ) : (
                  <>
                    {/* Cart Items */}
                    <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {cartItems.map((item) => (
                        <CartItemCard
                          key={item.menuItemId}
                          item={item}
                          onUpdateQuantity={updateCartItemQuantity}
                          onRemove={removeFromCart}
                        />
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(cartTotal.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({restaurant.settings.taxRate || 8.5}%):</span>
                        <span>{formatCurrency(cartTotal.tax)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(cartTotal.total)}</span>
                      </div>
                    </div>

                    {/* Customer Form */}
                    <form onSubmit={handleSubmit(handlePlaceOrder)} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Customer Name *
                        </label>
                        <input
                          {...register('name', { required: true })}
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Enter customer name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          {...register('phone')}
                          type="tel"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Enter phone number"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Special Instructions
                        </label>
                        <textarea
                          {...register('orderNotes')}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Any special requests..."
                        />
                      </div>

                      {/* Place Order Button */}
                      <button
                        type="submit"
                        disabled={isPlacingOrder || cartItems.length === 0}
                        className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPlacingOrder ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Placing Order...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Place Takeaway Order
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Variant Selection Modal */}
        {showVariantModal && selectedMenuItem && (
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

        {/* Payment Modal */}
        {showPaymentModal && currentOrder && (
          <PaymentModalWithCoupons
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setCurrentOrder(null);
            }}
            restaurant={restaurant}
            table={{ id: 'takeaway', number: 'Takeaway', area: 'Takeaway' }}
            onPayment={handlePayment}
            isProcessing={isProcessingPayment}
            cartItems={currentOrder.items.map(item => ({
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
              variants: item.variants
            }))}
            orders={[currentOrder]}
            menuItems={menuItems}
          />
        )}
      </main>
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
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
          )}
        </div>
        <div className="text-lg font-bold text-gray-900 ml-4">
          {formatCurrency(item.price)}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          {item.isVegetarian && <span className="text-green-600">🥬 Veg</span>}
          {item.spiceLevel && (
            <span className={`${
              item.spiceLevel === 'mild' ? 'text-yellow-600' :
              item.spiceLevel === 'medium' ? 'text-orange-600' :
              item.spiceLevel === 'hot' ? 'text-red-600' :
              'text-red-700'
            }`}>
              🌶️ {item.spiceLevel}
            </span>
          )}
        </div>
        
        <button
          onClick={() => onAddToCart(item, 1)}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add {cartQuantity > 0 && `(${cartQuantity})`}
        </button>
      </div>
    </div>
  );
}

// Cart Item Card Component
interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemove: (menuItemId: string) => void;
}

function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <h5 className="font-medium text-gray-900 text-sm">{item.name}</h5>
        <p className="text-xs text-gray-600">{formatCurrency(item.price)} each</p>
        {item.variants && item.variants.length > 0 && (
          <p className="text-xs text-gray-500">
            {item.variants.map(v => v.optionName).join(', ')}
          </p>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onUpdateQuantity(item.menuItemId, item.quantity - 1)}
          className="p-1 text-gray-600 hover:text-gray-800"
        >
          <Minus className="w-3 h-3" />
        </button>
        
        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
        
        <button
          onClick={() => onUpdateQuantity(item.menuItemId, item.quantity + 1)}
          className="p-1 text-gray-600 hover:text-gray-800"
        >
          <Plus className="w-3 h-3" />
        </button>
        
        <button
          onClick={() => onRemove(item.menuItemId)}
          className="p-1 text-red-600 hover:text-red-800"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
} 