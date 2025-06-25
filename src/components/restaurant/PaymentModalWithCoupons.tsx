import { useState, useEffect } from 'react';
import { X, Tag, Gift, AlertCircle, User, Percent, DollarSign, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CouponService } from '@/services/couponService';
import { CustomerService } from '@/services/customerService';
import { Customer } from '@/types';
import toast from 'react-hot-toast';

interface EnhancedPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: any;
  table: any;
  onPayment: (data: any) => void;
  isProcessing: boolean;
  cartItems: any[];
  menuItems: any[];
}

export default function PaymentModalWithCoupons({
  isOpen,
  onClose,
  restaurant,
  table,
  onPayment,
  isProcessing,
  cartItems,
  menuItems,
}: EnhancedPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  
  // Credit functionality states
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');
  
  // Split payment functionality states
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayment, setSplitPayment] = useState({
    method1: 'cash',
    amount1: '',
    method2: 'upi',
    amount2: ''
  });
  
  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Manual discount
  const [manualDiscount, setManualDiscount] = useState<{type: 'percentage' | 'fixed', value: number, reason: string}>({
    type: 'percentage',
    value: 0,
    reason: ''
  });
  
  // Tip/Gratuity
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');

  // Load customers on mount
  useEffect(() => {
    if (restaurant?.id) {
      loadCustomers();
    }
  }, [restaurant?.id]);

  const loadCustomers = async () => {
    if (!restaurant?.id) return;
    
    try {
      const result = await CustomerService.getCustomersForRestaurant(restaurant.id);
      if (result.success && result.data) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  if (!isOpen) return null;

  const originalSubtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const originalTax = (originalSubtotal * (restaurant?.settings?.taxRate || 8.5)) / 100;
  const originalTotal = originalSubtotal + originalTax;

  // Calculate totals with coupon and manual discount applied
  let couponDiscountAmount = 0;
  let freeItemsValue = 0;
  let freeItems: any[] = [];

  if (appliedCoupon) {
    couponDiscountAmount = appliedCoupon.discountAmount || 0;
    freeItems = appliedCoupon.freeItems || [];
    freeItemsValue = freeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // Calculate manual discount
  let manualDiscountAmount = 0;
  if (manualDiscount.value > 0) {
    if (manualDiscount.type === 'percentage') {
      manualDiscountAmount = (originalSubtotal * manualDiscount.value) / 100;
    } else {
      manualDiscountAmount = manualDiscount.value;
    }
    manualDiscountAmount = Math.min(manualDiscountAmount, originalSubtotal); // Don't exceed subtotal
  }

  const totalDiscountAmount = couponDiscountAmount + manualDiscountAmount;
  const discountedSubtotal = Math.max(0, originalSubtotal - totalDiscountAmount);
  const discountedTax = (discountedSubtotal * (restaurant?.settings?.taxRate || 8.5)) / 100;
  const subtotalWithTax = discountedSubtotal + discountedTax;
  const finalTotal = subtotalWithTax + tip;
  const totalSavings = totalDiscountAmount + freeItemsValue;

  // Set default amount received to full amount if not set
  useEffect(() => {
    if (finalTotal && !amountReceived && !isSplitPayment) {
      setAmountReceived(finalTotal.toString());
    }
  }, [finalTotal, isSplitPayment]);

  // Split payment calculation
  const splitAmount1 = parseFloat(splitPayment.amount1) || 0;
  const splitAmount2 = parseFloat(splitPayment.amount2) || 0;
  const totalSplitAmount = splitAmount1 + splitAmount2;
  const isSplitAmountValid = Math.abs(totalSplitAmount - finalTotal) < 0.01; // Allow for small rounding differences
  const splitPaymentShortfall = finalTotal - totalSplitAmount;

  // Check if payment is credit (amount received is less than total)
  const actualAmountReceived = isSplitPayment ? totalSplitAmount : parseFloat(amountReceived);
  const isCredit = actualAmountReceived < finalTotal && actualAmountReceived > 0;
  const creditAmount = isCredit ? finalTotal - actualAmountReceived : 0;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsValidatingCoupon(true);
    setCouponError('');

    try {
      const result = await CouponService.validateCoupon(
        couponCode,
        restaurant.id,
        cartItems,
        menuItems,
        paymentMethod
      );

      if (result.isValid) {
        setAppliedCoupon(result);
        toast.success(`Coupon applied! You saved ${formatCurrency(result.discountAmount || 0)}`);
        setCouponCode('');
        
        // Handle BOGO - add free items to order automatically
        if (result.freeItems && result.freeItems.length > 0) {
          toast.success(`Free items added: ${result.freeItems.map(item => `${item.quantity}x ${item.name}`).join(', ')}`);
        }
      } else {
        setCouponError(result.error || 'Invalid coupon');
        toast.error(result.error || 'Invalid coupon');
      }
    } catch (error) {
      setCouponError('Failed to validate coupon');
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    toast.success('Coupon removed');
  };

  const handleCustomerSearch = (searchTerm: string) => {
    setCustomerSearchTerm(searchTerm);
    setShowCustomerDropdown(true);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchTerm(customer.name || customer.phone || '');
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setSelectedCustomerId('');
    setCustomerSearchTerm('');
    setShowCustomerDropdown(false);
  };

  const handleTipSelect = (tipAmount: number) => {
    setTip(tipAmount);
    setCustomTip('');
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTip(value);
    const tipValue = parseFloat(value) || 0;
    setTip(tipValue);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm) ||
    customer.email?.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handlePayment = () => {
    const actualAmountReceivedNum = isSplitPayment ? totalSplitAmount : (parseFloat(amountReceived) || finalTotal);
    
    const paymentData = {
      method: isSplitPayment ? 'split' : paymentMethod,
      amountReceived: actualAmountReceivedNum,
      appliedCoupon,
      manualDiscount: manualDiscount.value > 0 ? manualDiscount : null,
      customerId: selectedCustomerId || null,
      tip: tip > 0 ? tip : null,
      finalTotal,
      originalTotal,
      subtotalWithTax,
      totalSavings,
      freeItems,
      couponDiscountAmount,
      manualDiscountAmount,
      // Split payment information
      isSplitPayment,
      splitPayment: isSplitPayment ? {
        method1: splitPayment.method1,
        amount1: splitAmount1,
        method2: splitPayment.method2,
        amount2: splitAmount2,
        totalSplitAmount
      } : null,
      // Credit information
      isCredit,
      creditAmount,
      creditCustomerName: isCredit ? creditCustomerName : null,
      creditCustomerPhone: isCredit ? creditCustomerPhone : null,
    };

    onPayment(paymentData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={() => {
            setShowCustomerDropdown(false);
            onClose();
          }}
        ></div>
        
        <div className="inline-block w-full max-w-2xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl max-h-[95vh] overflow-y-auto">
          {/* Header */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Process Payment</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Table {table.number} - Enhanced with Coupon Support
            </p>
          </div>

          <div className="px-3 sm:px-6 py-3 sm:py-4 space-y-4 sm:space-y-6">
            {/* Order Summary */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Order Summary</h4>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-xs sm:text-sm">
                    <span className="truncate mr-2">{item.quantity}x {item.name}</span>
                    <span className="whitespace-nowrap">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Selection */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                <User className="w-4 h-4 mr-2 text-purple-600" />
                Customer
              </h4>
              
              <div className="relative">
                <input
                  type="text"
                  value={customerSearchTerm}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Search customer by name, phone, or email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                
                {selectedCustomer && (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-purple-900 text-sm sm:text-base">{selectedCustomer.name}</div>
                      <div className="text-xs sm:text-sm text-purple-600">
                        {selectedCustomer.phone} • {selectedCustomer.visitCount} visits • Total spent: {formatCurrency(selectedCustomer.totalSpent)}
                      </div>
                    </div>
                    <button
                      onClick={clearCustomer}
                      className="text-purple-600 hover:text-purple-800 p-1 rounded self-start sm:self-center"
                      title="Remove customer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {showCustomerDropdown && customerSearchTerm && !selectedCustomer && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 10).map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-sm">{customer.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-600">
                            {customer.phone} • {customer.visitCount} visits
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500 text-xs sm:text-sm">No customers found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Manual Discount Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                <Percent className="w-4 h-4 mr-2 text-orange-600" />
                Manual Discount
              </h4>
              
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <select
                    value={manualDiscount.type}
                    onChange={(e) => setManualDiscount(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                  
                  <input
                    type="number"
                    value={manualDiscount.value || ''}
                    onChange={(e) => setManualDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                    placeholder={manualDiscount.type === 'percentage' ? 'Enter %' : 'Enter amount'}
                    min="0"
                    max={manualDiscount.type === 'percentage' ? 100 : originalSubtotal}
                    step={manualDiscount.type === 'percentage' ? 1 : 0.01}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                </div>
                
                <input
                  type="text"
                  value={manualDiscount.reason}
                  onChange={(e) => setManualDiscount(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Discount reason (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
                
                {manualDiscountAmount > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-xs sm:text-sm text-orange-700">
                      Manual discount: {formatCurrency(manualDiscountAmount)}
                      {manualDiscount.reason && (
                        <span className="block text-orange-600">Reason: {manualDiscount.reason}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Coupon Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                <Tag className="w-4 h-4 mr-2 text-blue-600" />
                Apply Coupon
              </h4>

              {appliedCoupon ? (
                // Applied Coupon Display
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-green-800 text-sm sm:text-base">{appliedCoupon.coupon.name}</div>
                        <div className="text-xs sm:text-sm text-green-600">Code: {appliedCoupon.coupon.code}</div>
                        {couponDiscountAmount > 0 && (
                          <div className="text-xs sm:text-sm text-green-600">
                            Discount: {formatCurrency(couponDiscountAmount)}
                          </div>
                        )}
                        {freeItems.length > 0 && (
                          <div className="text-xs sm:text-sm text-green-600">
                            Free: {freeItems.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-green-600 hover:text-green-800 p-1 rounded self-start sm:self-center flex-shrink-0"
                      title="Remove coupon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                // Coupon Input
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code (e.g., SAVE20)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || isValidatingCoupon}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                    >
                      {isValidatingCoupon ? 'Validating...' : 'Apply'}
                    </button>
                  </div>

                  {couponError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-red-700">{couponError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pricing Breakdown */}
            <div className="border-t pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Subtotal:</span>
                  <span className={appliedCoupon ? 'line-through text-gray-500' : ''}>{formatCurrency(originalSubtotal)}</span>
                </div>
                
                {couponDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600">
                    <span>Coupon Discount:</span>
                    <span>-{formatCurrency(couponDiscountAmount)}</span>
                  </div>
                )}
                
                {manualDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-orange-600">
                    <span>Manual Discount ({manualDiscount.type === 'percentage' ? `${manualDiscount.value}%` : 'Fixed'}):</span>
                    <span>-{formatCurrency(manualDiscountAmount)}</span>
                  </div>
                )}
                
                {totalDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span>Discounted Subtotal:</span>
                    <span>{formatCurrency(discountedSubtotal)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Tax ({restaurant?.settings?.taxRate || 8.5}%):</span>
                  <span>{formatCurrency(discountedTax)}</span>
                </div>
                
                {freeItems.length > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600">
                    <span>Free Items Value:</span>
                    <span>{formatCurrency(freeItemsValue)} (FREE)</span>
                  </div>
                )}
                
                {tip > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-blue-600">
                    <span>Tip/Gratuity:</span>
                    <span>+{formatCurrency(tip)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-base sm:text-lg font-bold border-t pt-2">
                  <span>Final Total:</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
                
                {totalSavings > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600 font-medium">
                    <span>Total Savings:</span>
                    <span>{formatCurrency(totalSavings)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tip/Gratuity Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                Tip / Gratuity
              </h4>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2">
                  {[10, 15, 20, 25].map((percentage) => {
                    const tipAmount = (subtotalWithTax * percentage) / 100;
                    return (
                      <button
                        key={percentage}
                        onClick={() => handleTipSelect(tipAmount)}
                        className={`p-2 border rounded-lg text-center text-xs sm:text-sm ${
                          Math.abs(tip - tipAmount) < 0.01
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {percentage}%<br />
                        <span className="text-xs">{formatCurrency(tipAmount)}</span>
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <input
                    type="number"
                    value={customTip}
                    onChange={(e) => handleCustomTipChange(e.target.value)}
                    placeholder="Custom tip amount"
                    min="0"
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                  <button
                    onClick={() => handleTipSelect(0)}
                    className={`px-4 py-2 border rounded-lg text-xs sm:text-sm whitespace-nowrap ${
                      tip === 0
                        ? 'border-gray-500 bg-gray-50 text-gray-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    No Tip
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 text-sm sm:text-base">Payment Method</h4>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isSplitPayment}
                    onChange={(e) => setIsSplitPayment(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Split Payment</span>
                </label>
              </div>

              {!isSplitPayment ? (
                // Single Payment Method
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {['cash', 'upi', 'bank'].map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (amountReceived === '') {
                          setAmountReceived(finalTotal.toString());
                        }
                      }}
                      className={`p-3 border rounded-lg text-center capitalize text-sm ${
                        paymentMethod === method
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              ) : (
                // Split Payment Methods
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-medium text-blue-900 mb-3 text-sm">Split Payment Configuration</h5>
                    
                    {/* First Payment Method */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method 1
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {['cash', 'upi', 'bank'].map((method) => (
                          <button
                            key={method}
                            onClick={() => setSplitPayment(prev => ({ ...prev, method1: method }))}
                            className={`p-2 border rounded-lg text-center capitalize text-sm ${
                              splitPayment.method1 === method
                                ? 'border-blue-500 bg-blue-100 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        placeholder="Amount for method 1"
                        value={splitPayment.amount1}
                        onChange={(e) => setSplitPayment(prev => ({ ...prev, amount1: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    {/* Second Payment Method */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method 2
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {['cash', 'upi', 'bank'].map((method) => (
                          <button
                            key={method}
                            onClick={() => setSplitPayment(prev => ({ ...prev, method2: method }))}
                            className={`p-2 border rounded-lg text-center capitalize text-sm ${
                              splitPayment.method2 === method
                                ? 'border-blue-500 bg-blue-100 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        placeholder="Amount for method 2"
                        value={splitPayment.amount2}
                        onChange={(e) => setSplitPayment(prev => ({ ...prev, amount2: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    {/* Split Payment Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Total Bill:</span>
                          <span className="font-medium">{formatCurrency(finalTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{splitPayment.method1.toUpperCase()}:</span>
                          <span>{formatCurrency(splitAmount1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{splitPayment.method2.toUpperCase()}:</span>
                          <span>{formatCurrency(splitAmount2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1">
                          <span>Total Received:</span>
                          <span className="font-medium">{formatCurrency(totalSplitAmount)}</span>
                        </div>
                        {!isSplitAmountValid && (
                          <div className={`flex justify-between ${splitPaymentShortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span>
                              {splitPaymentShortfall > 0 ? 'Shortfall:' : 'Overpayment:'}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(Math.abs(splitPaymentShortfall))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Amount Received - Show for all payment methods */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Amount Received
                </label>
                <input
                  type="number"
                  value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={finalTotal.toString()}
                />
              {parseFloat(amountReceived) > finalTotal && (
                  <div className="mt-2 text-xs sm:text-sm text-gray-600">
                  Change: {formatCurrency(parseFloat(amountReceived) - finalTotal)}
                </div>
              )}
              {isCredit && (
                <div className="mt-2 text-xs sm:text-sm text-orange-600 font-medium">
                  Credit Amount: {formatCurrency(creditAmount)}
                </div>
              )}
            </div>

            {/* Credit Customer Details - Show when amount is less than total */}
            {isCredit && (
              <div className="border border-orange-200 rounded-lg p-3 sm:p-4 bg-orange-50">
                <h4 className="font-medium text-orange-900 mb-3 flex items-center text-sm sm:text-base">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Credit Customer Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-orange-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={creditCustomerName}
                      onChange={(e) => setCreditCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-orange-700 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={creditCustomerPhone}
                      onChange={(e) => setCreditCustomerPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    />
                  </div>
                  <div className="bg-orange-100 border border-orange-200 rounded p-3">
                    <p className="text-xs sm:text-sm text-orange-800">
                      <strong>Credit Summary:</strong><br />
                      Total Bill: {formatCurrency(finalTotal)}<br />
                      Amount Received: {formatCurrency(parseFloat(amountReceived))}<br />
                      Credit Amount: {formatCurrency(creditAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="text-xs sm:text-sm text-gray-600">
              {appliedCoupon && (
                <span className="text-green-600 font-medium">
                  🎉 Coupon applied! You saved {formatCurrency(totalSavings)}
                </span>
              )}
            </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={isProcessing || (isCredit && !creditCustomerName.trim()) || (isSplitPayment && (splitAmount1 <= 0 || splitAmount2 <= 0))}
                className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <span className="block sm:hidden">
                  {isProcessing ? 'Processing...' : 
                   isSplitPayment ? `Pay ${formatCurrency(totalSplitAmount)}${!isSplitAmountValid ? ` (${splitPaymentShortfall > 0 ? 'Short' : 'Over'})` : ''}` :
                   isCredit ? `Pay ${formatCurrency(parseFloat(amountReceived))}` : 
                   `Pay ${formatCurrency(finalTotal)}`}
                </span>
                <span className="hidden sm:block">
                  {isProcessing ? 'Processing...' : 
                   isSplitPayment ? `Pay ${formatCurrency(totalSplitAmount)}${!isSplitAmountValid ? ` (${splitPaymentShortfall > 0 ? 'Shortfall' : 'Overpayment'}: ${formatCurrency(Math.abs(splitPaymentShortfall))})` : ''}` :
                   isCredit ? `Pay ${formatCurrency(parseFloat(amountReceived))} (Credit: ${formatCurrency(creditAmount)})` : 
                   `Pay ${formatCurrency(finalTotal)}`}
                </span>
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 