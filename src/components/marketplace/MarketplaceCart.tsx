import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard,
  Truck,
  AlertCircle,
  CheckCircle,
  User,
  Phone,
  Mail,
  Package,
  DollarSign,
  X
} from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { 
  createOrder, 
  getSupplier,
  MARKETPLACE_CATEGORIES,
  getBestPriceForQuantity 
} from '@/services/marketplaceService';
import { 
  MarketplaceCartItem, 
  Supplier,
  MarketplaceOrder,
  Address 
} from '@/types';
import toast from 'react-hot-toast';

interface MarketplaceCartProps {
  cartItems: MarketplaceCartItem[];
  onCartUpdate: (items: MarketplaceCartItem[]) => void;
}

interface GroupedCartItems {
  [supplierId: string]: {
    supplier: {
      id: string;
      name: string;
      businessName: string;
      minimumOrderAmount: number;
      deliveryFee: number;
      freeDeliveryThreshold: number;
    };
    items: MarketplaceCartItem[];
    subtotal: number;
    meetsMinimum: boolean;
    deliveryFee: number;
    total: number;
  };
}

const MarketplaceCart: React.FC<MarketplaceCartProps> = ({ cartItems, onCartUpdate }) => {
  const { restaurant } = useRestaurant();
  
  // State management
  const [groupedItems, setGroupedItems] = useState<GroupedCartItems>({});
  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState({
    deliveryAddress: restaurant?.address || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA'
    },
    requestedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    deliveryInstructions: '',
    paymentMethod: 'invoice'
  });

  // Group cart items by supplier
  useEffect(() => {
    const groupItems = async () => {
      if (cartItems.length === 0) {
        setGroupedItems({});
        return;
      }

      const grouped: GroupedCartItems = {};
      
      // Group items by supplier
      for (const item of cartItems) {
        const supplierId = item.product.supplierId;
        const supplierName = item.product.supplierName;
        
        if (!grouped[supplierId]) {
          // Initialize supplier group
          grouped[supplierId] = {
            supplier: {
              id: supplierId,
              name: supplierName,
              businessName: supplierName,
              minimumOrderAmount: 0,
              deliveryFee: 15,
              freeDeliveryThreshold: 500
            },
            items: [],
            subtotal: 0,
            meetsMinimum: false,
            deliveryFee: 0,
            total: 0
          };

          // Try to fetch supplier details
          try {
            const supplierDetails = await getSupplier(supplierId);
            if (supplierDetails) {
              grouped[supplierId].supplier = {
                id: supplierDetails.id,
                name: supplierDetails.name,
                businessName: supplierDetails.businessName,
                minimumOrderAmount: supplierDetails.minimumOrderAmount,
                deliveryFee: supplierDetails.deliveryFee,
                freeDeliveryThreshold: supplierDetails.freeDeliveryThreshold
              };
            }
          } catch (error) {
            console.warn('Could not fetch supplier details:', error);
          }
        }

        grouped[supplierId].items.push(item);
      }

      // Calculate totals for each supplier
      Object.keys(grouped).forEach(supplierId => {
        const group = grouped[supplierId];
        group.subtotal = group.items.reduce((sum, item) => sum + item.totalPrice, 0);
        group.meetsMinimum = group.subtotal >= group.supplier.minimumOrderAmount;
        
        // Calculate delivery fee
        if (group.subtotal >= group.supplier.freeDeliveryThreshold) {
          group.deliveryFee = 0;
        } else {
          group.deliveryFee = group.supplier.deliveryFee;
        }
        
        group.total = group.subtotal + group.deliveryFee;
      });

      setGroupedItems(grouped);
    };

    groupItems();
  }, [cartItems]);

  // Update item quantity
  const updateQuantity = (productId: string, supplierId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId, supplierId);
      return;
    }

    const updatedItems = cartItems.map(item => {
      if (item.productId === productId && item.product.supplierId === supplierId) {
        // Recalculate price based on new quantity
        const bestPrice = getBestPriceForQuantity(item.product.pricingTiers, newQuantity);
        return {
          ...item,
          quantity: newQuantity,
          unitPrice: bestPrice.pricePerUnit,
          totalPrice: bestPrice.pricePerUnit * newQuantity
        };
      }
      return item;
    });

    onCartUpdate(updatedItems);
  };

  // Remove item
  const removeItem = (productId: string, supplierId: string) => {
    const updatedItems = cartItems.filter(
      item => !(item.productId === productId && item.product.supplierId === supplierId)
    );
    onCartUpdate(updatedItems);
  };

  // Clear entire cart
  const clearCart = () => {
    onCartUpdate([]);
  };

  // Clear supplier cart
  const clearSupplierCart = (supplierId: string) => {
    const updatedItems = cartItems.filter(item => item.product.supplierId !== supplierId);
    onCartUpdate(updatedItems);
  };

  // Start checkout for specific supplier
  const startCheckout = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setShowCheckout(true);
  };

  // Process order
  const processOrder = async () => {
    if (!selectedSupplierId || !restaurant) {
      toast.error('Missing required information');
      return;
    }

    const supplierGroup = groupedItems[selectedSupplierId];
    if (!supplierGroup) {
      toast.error('Supplier not found');
      return;
    }

    if (!supplierGroup.meetsMinimum) {
      toast.error(`Minimum order amount of $${supplierGroup.supplier.minimumOrderAmount} not met`);
      return;
    }

    setLoading(true);
    try {
      const orderData: Omit<MarketplaceOrder, 'id' | 'createdAt' | 'updatedAt'> = {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        supplierId: selectedSupplierId,
        supplierName: supplierGroup.supplier.businessName,
        orderNumber: `MP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'draft',
        items: supplierGroup.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          appliedDiscount: item.appliedDiscount,
          productImage: item.productImage
        })),
        subtotal: supplierGroup.subtotal,
        tax: supplierGroup.subtotal * 0.08, // 8% tax
        deliveryFee: supplierGroup.deliveryFee,
        discount: 0,
        total: supplierGroup.total + (supplierGroup.subtotal * 0.08),
        deliveryAddress: checkoutData.deliveryAddress,
        requestedDeliveryDate: checkoutData.requestedDeliveryDate,
        deliveryInstructions: checkoutData.deliveryInstructions,
        paymentMethod: checkoutData.paymentMethod as 'credit_card' | 'invoice' | 'bank_transfer',
        statusHistory: [{
          status: 'draft',
          timestamp: new Date(),
          notes: 'Order created'
        }]
      };

      const orderId = await createOrder(orderData);
      
      if (orderId) {
        toast.success('Order placed successfully!');
        
        // Remove ordered items from cart
        clearSupplierCart(selectedSupplierId);
        
        // Close checkout
        setShowCheckout(false);
        setSelectedSupplierId(null);
        
        // Optionally redirect to orders page
        // router.push('/restaurant/marketplace?tab=orders');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 mb-2">Your cart is empty</h3>
        <p className="text-gray-600 mb-6">
          Browse the marketplace to find products for your restaurant
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shopping Cart</h2>
          <p className="text-gray-600">
            {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} from {Object.keys(groupedItems).length} supplier{Object.keys(groupedItems).length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={clearCart}
          className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          Clear Cart
        </button>
      </div>

      {/* Grouped Cart Items */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([supplierId, group]) => (
          <div key={supplierId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Supplier Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{group.supplier.businessName}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>Min. Order: ${group.supplier.minimumOrderAmount}</span>
                    <span>Delivery: ${group.supplier.deliveryFee} (Free over ${group.supplier.freeDeliveryThreshold})</span>
                  </div>
                </div>
                
                <button
                  onClick={() => clearSupplierCart(supplierId)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Minimum Order Warning */}
              {!group.meetsMinimum && (
                <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Add ${(group.supplier.minimumOrderAmount - group.subtotal).toFixed(2)} more to meet minimum order
                  </span>
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="p-6">
              <div className="space-y-4">
                {group.items.map((item) => (
                  <div key={`${item.productId}-${item.supplierId}`} className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0">
                    {/* Product Image */}
                    {item.productImage && (
                      <img 
                        src={item.productImage} 
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{item.productName}</h4>
                      <p className="text-sm text-gray-600">
                        {MARKETPLACE_CATEGORIES.find(cat => cat.id === item.category)?.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-gray-900">${item.unitPrice.toFixed(2)}</span>
                        <span className="text-sm text-gray-500">per {item.unit}</span>
                        {item.appliedDiscount > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            {item.appliedDiscount}% off
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.productId, item.supplierId, item.quantity - 1)}
                        className="p-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      
                      <button
                        onClick={() => updateQuantity(item.productId, item.supplierId, item.quantity + 1)}
                        className="p-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Total Price */}
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${item.totalPrice.toFixed(2)}</p>
                    </div>
                    
                    {/* Remove Item */}
                    <button
                      onClick={() => removeItem(item.productId, item.supplierId)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier Total */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${group.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee:</span>
                  <span>
                    {group.deliveryFee === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      `$${group.deliveryFee.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${group.total.toFixed(2)}</span>
                </div>
              </div>
              
              <button
                onClick={() => startCheckout(supplierId)}
                disabled={!group.meetsMinimum}
                className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {group.meetsMinimum ? 'Checkout' : `Minimum $${group.supplier.minimumOrderAmount} Required`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedSupplierId && groupedItems[selectedSupplierId] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Checkout</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Supplier Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Supplier</h3>
                <p className="text-gray-700">{groupedItems[selectedSupplierId].supplier.businessName}</p>
              </div>

              {/* Delivery Address */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Delivery Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={checkoutData.deliveryAddress.street}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        deliveryAddress: { ...checkoutData.deliveryAddress, street: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={checkoutData.deliveryAddress.city}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        deliveryAddress: { ...checkoutData.deliveryAddress, city: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={checkoutData.deliveryAddress.state}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        deliveryAddress: { ...checkoutData.deliveryAddress, state: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={checkoutData.deliveryAddress.zipCode}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        deliveryAddress: { ...checkoutData.deliveryAddress, zipCode: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requested Delivery Date
                </label>
                <input
                  type="date"
                  value={formatDateForInput(checkoutData.requestedDeliveryDate)}
                  onChange={(e) => setCheckoutData({
                    ...checkoutData,
                    requestedDeliveryDate: new Date(e.target.value)
                  })}
                  min={formatDateForInput(new Date())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Delivery Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  value={checkoutData.deliveryInstructions}
                  onChange={(e) => setCheckoutData({
                    ...checkoutData,
                    deliveryInstructions: e.target.value
                  })}
                  placeholder="Special delivery instructions, loading dock location, etc."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Payment Method
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="invoice"
                      checked={checkoutData.paymentMethod === 'invoice'}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        paymentMethod: e.target.value
                      })}
                      className="mr-3"
                    />
                    <span>Invoice (Net 30)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="credit_card"
                      checked={checkoutData.paymentMethod === 'credit_card'}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        paymentMethod: e.target.value
                      })}
                      className="mr-3"
                    />
                    <span>Credit Card</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="bank_transfer"
                      checked={checkoutData.paymentMethod === 'bank_transfer'}
                      onChange={(e) => setCheckoutData({
                        ...checkoutData,
                        paymentMethod: e.target.value
                      })}
                      className="mr-3"
                    />
                    <span>Bank Transfer</span>
                  </label>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${groupedItems[selectedSupplierId].subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (8%):</span>
                    <span>${(groupedItems[selectedSupplierId].subtotal * 0.08).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee:</span>
                    <span>
                      {groupedItems[selectedSupplierId].deliveryFee === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        `$${groupedItems[selectedSupplierId].deliveryFee.toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${(groupedItems[selectedSupplierId].total + (groupedItems[selectedSupplierId].subtotal * 0.08)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCheckout(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={processOrder}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceCart;