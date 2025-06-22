import { useState } from 'react';
import { Tag, X, Check, AlertCircle } from 'lucide-react';
import { CouponService } from '@/services/couponService';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface CouponSectionProps {
  restaurantId: string;
  cartItems: any[];
  menuItems: any[];
  paymentMethod?: string;
  onCouponApplied: (couponData: {
    coupon: any;
    discountAmount: number;
    freeItems: any[];
    applicableItems: string[];
  }) => void;
  onCouponRemoved: () => void;
  appliedCoupon?: any;
}

export default function CouponSection({
  restaurantId,
  cartItems,
  menuItems,
  paymentMethod,
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon,
}: CouponSectionProps) {
  const [couponCode, setCouponCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsValidating(true);
    setValidationError('');

    try {
      const result = await CouponService.validateCoupon(
        couponCode,
        restaurantId,
        cartItems,
        menuItems,
        paymentMethod
      );

      if (result.isValid) {
        onCouponApplied({
          coupon: result.coupon,
          discountAmount: result.discountAmount || 0,
          freeItems: result.freeItems || [],
          applicableItems: result.applicableItems || [],
        });
        toast.success('Coupon applied successfully!');
        setCouponCode('');
      } else {
        setValidationError(result.error || 'Invalid coupon');
        toast.error(result.error || 'Invalid coupon');
      }
    } catch (error) {
      setValidationError('Failed to validate coupon');
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onCouponRemoved();
    setValidationError('');
    toast.success('Coupon removed');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyCoupon();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Apply Coupon (Optional)
      </label>

      {appliedCoupon ? (
        // Applied Coupon Display
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start space-x-2 min-w-0 flex-1">
              <Tag className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-green-800 text-sm sm:text-base">{appliedCoupon.coupon.name}</div>
                <div className="text-xs sm:text-sm text-green-600">
                  Code: {appliedCoupon.coupon.code}
                </div>
                {appliedCoupon.discountAmount > 0 && (
                  <div className="text-xs sm:text-sm text-green-600">
                    Discount: {formatCurrency(appliedCoupon.discountAmount)}
                  </div>
                )}
                {appliedCoupon.freeItems.length > 0 && (
                  <div className="text-xs sm:text-sm text-green-600">
                    Free items: {appliedCoupon.freeItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleRemoveCoupon}
              className="text-green-600 hover:text-green-800 p-1 self-start sm:self-center flex-shrink-0"
              title="Remove coupon"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Coupon Input
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="Enter coupon code (e.g., SAVE20)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase text-sm sm:text-base"
                disabled={isValidating}
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={!couponCode.trim() || isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base whitespace-nowrap"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply</span>
                </>
              )}
            </button>
          </div>

          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-red-700">{validationError}</span>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Enter a valid coupon code to get discounts or free items
          </div>
        </div>
      )}
    </div>
  );
} 