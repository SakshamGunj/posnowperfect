export type CouponType = 
  | 'percentage_discount'
  | 'fixed_amount'
  | 'buy_x_get_y'
  | 'free_item'
  | 'combo_deal'
  | 'minimum_order'
  | 'category_specific';

export type CustomerSegment = 'all' | 'new' | 'returning' | 'vip';
export type PaymentMethodRestriction = 'all' | 'cash_only' | 'upi_only' | 'bank_only' | 'exclude_cash';
export type CouponStatus = 'draft' | 'active' | 'paused' | 'expired' | 'disabled';

export interface CouponValiditySettings {
  startDate: Date;
  endDate: Date;
  startTime?: string; // Format: "HH:MM"
  endTime?: string;   // Format: "HH:MM"
  validDays: string[]; // ['monday', 'tuesday', etc.]
  usageLimit?: number; // Total redemptions allowed
  perCustomerLimit?: number; // Per customer usage limit
}

export interface CouponTargeting {
  customerSegments: CustomerSegment[];
  minOrderValue?: number;
  applicableMenuItems?: string[]; // Menu item IDs
  applicableCategories?: string[]; // Category IDs
  excludedMenuItems?: string[]; // Menu item IDs to exclude
  excludedCategories?: string[]; // Category IDs to exclude
  paymentMethodRestriction: PaymentMethodRestriction;
}

export interface BuyXGetYConfig {
  buyQuantity: number;
  getQuantity: number;
  buyItemId?: string; // Specific item to buy
  getItemId?: string; // Specific item to get (if different)
  buyCategoryId?: string; // Category to buy from
  getCategoryId?: string; // Category to get from
  getDiscountPercentage?: number; // 0-100, for "Buy 1 Get 1 50% off"
}

export interface ComboConfig {
  name: string;
  description: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
  }>;
  comboPrice: number;
}

export interface CouponConfig {
  // For percentage_discount
  percentage?: number; // 0-100

  // For fixed_amount and minimum_order
  discountAmount?: number;
  minimumOrderValue?: number;

  // For buy_x_get_y
  buyXGetY?: BuyXGetYConfig;

  // For free_item
  freeItemId?: string;
  freeItemCategoryId?: string;

  // For combo_deal
  combo?: ComboConfig;

  // For category_specific
  categoryDiscountPercentage?: number;
  targetCategoryId?: string;
}

export interface Coupon {
  id: string;
  restaurantId: string;
  
  // Basic Settings
  name: string;
  description: string;
  code: string;
  type: CouponType;
  config: CouponConfig;
  termsAndConditions: string;
  
  // Validity & Usage
  validity: CouponValiditySettings;
  targeting: CouponTargeting;
  
  // Status & Stats
  status: CouponStatus;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Optional metadata for integration purposes
  metadata?: {
    source?: string;
    userName?: string;
    userPhone?: string;
    userId?: string;
    spinId?: string;
    [key: string]: any;
  };
}

export interface CouponUsage {
  id: string;
  couponId: string;
  restaurantId: string;
  customerId?: string;
  orderId: string;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  usedAt: Date;
}

// Gift Card Types
export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'cancelled';

export interface GiftCard {
  id: string;
  restaurantId: string;
  code: string;
  
  // Value & Usage
  originalValue: number;
  currentBalance: number;
  
  // Recipient & Purchaser
  purchasedBy?: string; // Customer ID
  purchasedFor?: string; // Recipient name/email
  recipientPhone?: string;
  recipientEmail?: string;
  
  // Validity
  expiryDate?: Date;
  status: GiftCardStatus;
  
  // Usage History
  usageHistory: Array<{
    orderId: string;
    amountUsed: number;
    usedAt: Date;
    remainingBalance: number;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

// Validation & Application Types
export interface CouponValidationResult {
  isValid: boolean;
  error?: string;
  coupon?: Coupon;
  applicableItems?: string[]; // Menu item IDs that qualify
  discountAmount?: number;
  freeItems?: Array<{
    menuItemId: string;
    quantity: number;
    name: string;
  }>;
}

export interface CouponApplication {
  coupon: Coupon;
  discountAmount: number;
  freeItems: Array<{
    menuItemId: string;
    quantity: number;
    name: string;
    price: number;
  }>;
  applicableItems: string[]; // Menu item IDs that got the discount
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 