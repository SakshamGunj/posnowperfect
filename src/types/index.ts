// Core Types for Multi-Tenant POS System

export type BusinessType = 'restaurant' | 'cafe' | 'bar';

export interface Restaurant {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  businessType: BusinessType;
  ownerId: string;
  isActive: boolean;
  settings: RestaurantSettings;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Admin who created this restaurant
}

export interface RestaurantSettings {
  address?: string;
  phone?: string;
  email?: string;
  taxRate: number;
  currency: string;
  timezone: string;
  
  // Additional settings for compatibility
  allowOnlineOrdering: boolean;
  allowTableReservation: boolean;
  autoAcceptOrders: boolean;
  requireCustomerPhone: boolean;
  enableLoyaltyProgram: boolean;
  defaultTax: number;
  defaultDiscount: number;
  
  // Business registration details for bills/receipts
  businessInfo?: {
    gstin?: string; // GST Identification Number (India)
    fssaiNumber?: string; // Food Safety and Standards Authority of India License
    businessAddress?: string; // Full business address for bills
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    website?: string;
  };
  
  // UPI Payment settings
  upiSettings?: {
    upiId?: string; // UPI ID for payments (e.g., restaurant@paytm)
    enableQRCode: boolean; // Whether to show QR code in bills
  };
  
  theme: {
    primaryColor: string;
    secondaryColor: string;
    logo?: string;
  };
  features: {
    tableManagement: boolean;
    inventoryTracking: boolean;
    kitchenDisplay: boolean;
    customerManagement: boolean;
    reporting: boolean;
  };
}

export type UserRole = 'super_admin' | 'owner' | 'manager' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: string; // null for super_admin, set for restaurant users
  pin?: string; // 4-digit PIN for quick login
  permissions: Permission[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Admin who created this user
}

// Employee Management Types
export interface Employee {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  pin: string; // 4-digit PIN for quick login
  role: 'manager' | 'staff';
  permissions: EmployeePermission[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Owner who created this employee
}

export interface EmployeePermission {
  module: string;
  access: boolean;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  pin: string;
  role: 'manager' | 'staff';
  permissions: EmployeePermission[];
}

export interface UpdateEmployeeRequest {
  name?: string;
  email?: string;
  password?: string;
  pin?: string;
  role?: 'manager' | 'staff';
  permissions?: EmployeePermission[];
  isActive?: boolean;
}

// Available modules for permission assignment
export interface ModulePermission {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'management' | 'reports' | 'settings';
  icon: string;
  defaultAccess: boolean; // Default access for new employees
}

// Admin-specific types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface CreateRestaurantRequest {
  name: string;
  businessType: BusinessType;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPin: string;
  address?: string;
  phone?: string;
  settings?: Partial<RestaurantSettings>;
}

export interface RestaurantCredentials {
  restaurantUrl: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPin: string;
  loginInstructions: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'orders' | 'kitchen' | 'tables' | 'inventory' | 'reports' | 'settings';
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service';

export interface TableArea {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Table {
  id: string;
  restaurantId: string;
  number: string;
  area: string; // Links to TableArea.name
  areaId: string; // Links to TableArea.id
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  reservedAt?: Date;
  reservedFor?: string;
  description?: string; // Optional table description
  isActive: boolean;
  createdBy?: string; // User who created this table
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'draft' | 'placed' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  restaurantId: string;
  orderNumber: string;
  tableId?: string;
  customerId?: string;
  customerName?: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentMethod?: string;
  notes?: string;
  staffId: string;
  preparation?: {
    estimatedTime?: number;
    actualTime?: number;
    startedAt?: Date;
    completedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectedVariant {
  variantId: string;
  variantName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
  pricingType?: 'additive' | 'standalone';
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number; // Base price
  quantity: number;
  customizations?: string[];
  variants?: SelectedVariant[]; // Selected variants
  notes?: string;
  total: number; // Final price including variant modifiers
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  categoryId: string;
  categoryName: string;
  image?: string;
  isAvailable: boolean;
  ingredients?: string[];
  allergens?: string[];
  nutritionInfo?: NutritionInfo;
  customizations?: CustomizationOption[];
  variants?: MenuItemVariant[]; // New variant system
  inventory?: InventoryItem;
  preparationTime?: number;
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot' | 'very_hot';
  isVeg?: boolean; // Alternative name used in seedDataService
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  options: string[];
  required: boolean;
  maxSelections?: number;
}

export interface MenuItemVariantOption {
  id: string;
  name: string;
  priceModifier: number; // Price difference from base price (can be negative)
  isDefault?: boolean;
  pricingType?: 'additive' | 'standalone'; // Whether to add to base price or replace it
}

export interface MenuItemVariant {
  id: string;
  name: string; // e.g., "Size", "Spice Level", "Toppings"
  type: 'single' | 'multiple'; // single choice or multiple selection
  required: boolean;
  options: MenuItemVariantOption[];
  maxSelections?: number; // Only for 'multiple' type
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  restaurantId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  orderHistory: string[]; // Order IDs
  totalSpent: number;
  visitCount: number;
  lastVisit?: Date;
  preferences?: string[];
  // Points system fields
  loyaltyPoints?: number; // Total loyalty points accumulated
  currentThresholdId?: string; // Current loyalty level
  pointsHistory?: PointsTransaction[]; // History of points earned/spent
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentMethod = 'cash' | 'upi' | 'bank';

export interface Discount {
  type: 'amount' | 'percentage';
  value: number;
  reason?: string;
}

export interface Payment {
  id: string;
  restaurantId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tip?: number;
  reference?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processedAt?: Date;
  createdAt: Date;
}

// Theme configuration based on business type
export interface ThemeConfig {
  businessType: BusinessType;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  gradients: {
    primary: string;
    secondary: string;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface CreateRestaurantForm {
  name: string;
  businessType: BusinessType;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  address?: string;
  phone?: string;
}

export interface LoginForm {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface PinLoginForm {
  pin: string;
  restaurantSlug: string;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface FilterOptions {
  [key: string]: any;
}

// Context types
export interface RestaurantContextType {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  switchRestaurant: (slug: string) => Promise<void>;
  updateRestaurant: (updates: Partial<Restaurant>) => Promise<void>;
  refreshRestaurant: () => Promise<void>;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithPin: (pin: string, restaurantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

// Admin types
export interface AdminLoginResult {
  success: boolean;
  error?: string;
  user?: {
    uid: string;
    email: string;
    role: string;
  };
}

export interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  status: 'active' | 'inactive' | 'deleted';
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  lastActivity: Date;
  settings: RestaurantSettings;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    activeUsers: number;
  };
}

export interface AdminDashboardStats {
  totalRestaurants: number;
  activeRestaurants: number;
  inactiveRestaurants: number;
  businessTypes: {
    restaurants: number;
    cafes: number;
    bars: number;
  };
  totalRevenue: number;
  totalOrders: number;
}

// Inventory Management Types
export type InventoryUnit = 'pieces' | 'ml' | 'liters' | 'grams' | 'kg' | 'cups' | 'portions' | 'bottles' | 'cans' | 'custom';

export interface InventoryItem {
  id: string;
  menuItemId: string;
  restaurantId: string;
  currentQuantity: number;
  unit: InventoryUnit;
  customUnit?: string; // For custom unit types
  minimumThreshold: number; // Alert when below this level
  consumptionPerOrder: number; // How much inventory is used per order
  maxCapacity?: number; // Maximum storage capacity
  costPerUnit?: number; // Cost price per unit
  supplier?: string;
  lastRestockedAt?: Date;
  lastRestockedQuantity?: number;
  isTracked: boolean; // Whether to track inventory for this item
  autoDeduct: boolean; // Whether to automatically deduct on orders
  
  // Inventory Linking System
  linkedItems?: InventoryLinkedItem[]; // Items linked to this inventory
  baseInventoryId?: string; // If this item is linked to another base inventory
  baseRatio?: number; // Ratio to base inventory (e.g., 0.5 for 30ml when base is 60ml)
  isBaseInventory?: boolean; // Whether this is a base inventory that others link to
  reverseLinksEnabled?: boolean; // Whether reverse linking is enabled for this item
  
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLinkedItem {
  id: string;
  linkedInventoryId: string; // The inventory item being linked
  linkedMenuItemId: string; // The menu item of linked inventory
  linkedMenuItemName: string; // Name for display
  ratio: number; // Consumption ratio (e.g., 2.0 means when 1 of base is consumed, 2 of this is consumed)
  reverseRatio?: number; // Reverse ratio for reverse linking
  enableReverseLink: boolean; // Whether this link works in reverse
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryTransactionType = 'restock' | 'order_deduction' | 'manual_adjustment' | 'waste' | 'return';

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  menuItemId: string;
  restaurantId: string;
  type: InventoryTransactionType;
  quantityChanged: number; // Positive for additions, negative for deductions
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  notes?: string;
  orderId?: string; // If related to an order
  staffId: string;
  createdAt: Date;
}

export interface InventoryAlert {
  id: string;
  inventoryItemId: string;
  menuItemId: string;
  restaurantId: string;
  type: 'low_stock' | 'out_of_stock' | 'overstocked';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  createdAt: Date;
}

// Re-export coupon types
export * from './coupon';

// Gamification Types
export interface SpinWheelSegment {
  id: string;
  label: string;
  value: string; // Reward description
  color: string; // Hex color for the segment
  probability: number; // Weight for this segment (1-100)
  rewardType: 'discount_percentage' | 'discount_fixed' | 'free_item' | 'points' | 'custom';
  rewardValue?: number; // For discount percentages or fixed amounts
  menuItemId?: string; // For free item rewards
  customMessage?: string; // For custom rewards
}

export interface PointsThreshold {
  id: string;
  name: string;
  pointsRequired: number;
  benefits: string[];
  color: string;
  badgeIcon: string; // Emoji or icon for the threshold level
  description: string;
}

export interface PointsConfig {
  enabled: boolean;
  pointsPerSpin: number;
  thresholds: PointsThreshold[];
  resetPeriod: 'never' | 'monthly' | 'yearly'; // When to reset customer points
}

export interface SpinWheelConfig {
  id: string;
  restaurantId: string;
  name: string;
  isActive: boolean;
  segments: SpinWheelSegment[];
  maxSpinsPerCustomer: number; // Daily limit
  requiresContactInfo: boolean; // Collect phone/email before spin
  termsAndConditions: string;
  pointsConfig?: PointsConfig; // Points and threshold configuration
  createdAt: Date;
  updatedAt: Date;
  shareableLink: string;
  totalSpins: number;
  totalRedemptions: number;
}

export interface CustomerSpin {
  id: string;
  restaurantId: string;
  spinWheelId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  resultSegmentId: string;
  resultMessage: string;
  couponCode?: string;
  pointsEarned?: number; // Points earned from this spin
  isRedeemed: boolean;
  redeemedAt?: Date;
  spinDate: Date;
  ipAddress?: string;
}

export interface SpinWheelStats {
  totalSpins: number;
  totalRedemptions: number;
  redemptionRate: number;
  popularSegments: { segmentId: string; count: number; label: string }[];
  dailySpins: { date: string; count: number }[];
  customerEngagement: number;
}

// Add new user authentication types
export interface GamificationUser {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  passwordHash: string;
  isVerified: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  totalSpins: number;
  totalWins: number;
  isBlocked: boolean;
  verificationCode?: string;
  verificationCodeExpiry?: Date;
  deviceFingerprint?: string;
  ipAddress?: string;
}

export interface LoginCredentials {
  phoneOrEmail: string;
  password: string;
  deviceFingerprint?: string;
}

export interface RegisterData {
  name: string;
  phone: string;
  email?: string;
  password: string;
  confirmPassword: string;
  deviceFingerprint?: string;
}

export interface VerificationRequest {
  userId: string;
  restaurantId: string;
  code: string;
  type: 'phone' | 'email';
}

export interface AuthResponse {
  success: boolean;
  user?: GamificationUser;
  token?: string;
  message?: string;
  requiresVerification?: boolean;
}

export interface PointsTransaction {
  id: string;
  customerId: string;
  restaurantId: string;
  type: 'earned' | 'spent' | 'expired' | 'bonus';
  points: number;
  source: 'spin_wheel' | 'purchase' | 'bonus' | 'manual';
  sourceId?: string; // Reference to spin ID, order ID, etc.
  description: string;
  createdAt: Date;
}

export interface CustomerLoyaltyInfo {
  currentPoints: number;
  currentThreshold: PointsThreshold | null;
  nextThreshold: PointsThreshold | null;
  progressToNext: number; // Percentage to next level (0-100)
  pointsToNext: number; // Points needed to reach next threshold
  totalSpins: number;
  totalPointsEarned: number;
  memberSince: Date;
}

// Marketplace Module Types
export type MarketplaceCategory = 'meat' | 'vegetables' | 'dairy' | 'grains' | 'spices' | 'equipment' | 'packaging' | 'cleaning' | 'beverages' | 'frozen';

export type MarketplaceOrderStatus = 'draft' | 'submitted' | 'confirmed' | 'processing' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled' | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'failed' | 'refunded';

export interface Supplier {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  logo?: string;
  description: string;
  categories: MarketplaceCategory[];
  rating: number; // 0-5
  totalReviews: number;
  isVerified: boolean;
  certifications: string[]; // Food safety, organic, etc.
  minimumOrderAmount: number;
  deliveryAreas: string[]; // Cities they deliver to
  deliveryFee: number;
  freeDeliveryThreshold: number;
  businessLicense?: string;
  taxId?: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
  isActive: boolean;
  joinedAt: Date;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  subcategory?: string;
  images: string[];
  unit: string; // kg, lb, piece, box, case, etc.
  minimumOrderQuantity: number;
  maximumOrderQuantity?: number;
  
  // Pricing tiers for bulk orders
  pricingTiers: PricingTier[];
  
  // Product specifications
  specifications: {
    origin?: string;
    brand?: string;
    weight?: string;
    dimensions?: string;
    shelfLife?: string;
    storageRequirements?: string;
    certifications?: string[];
  };
  
  // Availability
  isAvailable: boolean;
  stockQuantity?: number;
  seasonalAvailability?: {
    startMonth: number; // 1-12
    endMonth: number; // 1-12
  };
  
  // Quality & compliance
  qualityGrade?: string; // A, B, C or Premium, Standard, Economy
  certifications: string[]; // Organic, Halal, Kosher, etc.
  
  tags: string[]; // fresh, local, imported, etc.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingTier {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;
  discountPercentage?: number;
}

export interface MarketplaceCartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  category: MarketplaceCategory;
  supplierId: string;
  supplierName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  appliedDiscount: number;
  totalPrice: number;
  product: MarketplaceProduct;
}

export interface MarketplaceOrder {
  id: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  supplierId: string;
  supplierName: string;
  
  // Order details
  items: MarketplaceOrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  
  // Order status
  status: MarketplaceOrderStatus;
  paymentStatus: PaymentStatus;
  
  // Delivery information
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  
  // Scheduling
  requestedDeliveryDate: Date;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  deliveryTimeSlot?: string; // "9:00 AM - 12:00 PM"
  
  // Tracking
  trackingNumber?: string;
  trackingUrl?: string;
  
  // Communication
  orderNotes?: string;
  supplierNotes?: string;
  deliveryInstructions?: string;
  
  // Payment
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: Date;
  
  // Contract & invoicing
  isContractOrder: boolean;
  contractId?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  
  // Metadata
  placedBy: string; // User ID who placed the order
  createdAt: Date;
  updatedAt: Date;
  
  // Status history
  statusHistory?: OrderStatusHistory[];
}

export interface MarketplaceOrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  category: MarketplaceCategory;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: Record<string, string>;
  notes?: string;
}

export interface OrderStatusHistory {
  status: MarketplaceOrderStatus;
  timestamp: Date;
  notes?: string;
  updatedBy?: string;
  location?: string;
}

export interface SupplierReview {
  id: string;
  supplierId: string;
  restaurantId: string;
  restaurantName: string;
  orderId: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  pros?: string[];
  cons?: string[];
  
  // Review categories
  qualityRating: number;
  deliveryRating: number;
  serviceRating: number;
  valueRating: number;
  
  isVerified: boolean; // Only customers who actually ordered can review
  isPublic: boolean;
  supplierResponse?: {
    message: string;
    respondedAt: Date;
    respondedBy: string;
  };
  
  helpfulVotes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceContract {
  id: string;
  restaurantId: string;
  supplierId: string;
  name: string;
  description: string;
  
  // Contract terms
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  renewalPeriod?: number; // months
  
  // Pricing
  products: ContractProduct[];
  minimumMonthlyOrder?: number;
  paymentTerms: string; // "Net 30", "COD", etc.
  
  // Delivery
  deliveryFrequency: string; // "weekly", "bi-weekly", "monthly"
  deliveryDays: number[]; // [1, 3, 5] for Mon, Wed, Fri
  
  status: 'draft' | 'pending' | 'active' | 'expired' | 'cancelled';
  
  // Legal
  termsAndConditions: string;
  cancellationPolicy: string;
  
  // Signatures
  restaurantSignature?: {
    signedBy: string;
    signedAt: Date;
    ipAddress: string;
  };
  supplierSignature?: {
    signedBy: string;
    signedAt: Date;
    ipAddress: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractProduct {
  productId: string;
  productName: string;
  contractPrice: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
}

export interface MarketplaceNotification {
  id: string;
  userId: string;
  type: 'order_confirmed' | 'order_dispatched' | 'order_delivered' | 'price_change' | 'new_product' | 'contract_expiring';
  title: string;
  message: string;
  orderId?: string;
  productId?: string;
  supplierId?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export interface MarketplaceAnalytics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  topSuppliers: { supplierId: string; supplierName: string; totalSpent: number; orderCount: number; }[];
  topCategories: { category: MarketplaceCategory; totalSpent: number; orderCount: number; }[];
  monthlySpending: { month: string; amount: number; orderCount: number; }[];
  deliveryPerformance: {
    onTimeDeliveries: number;
    totalDeliveries: number;
    averageDeliveryDays: number;
  };
  costSavings: {
    totalSavings: number;
    savingsPercentage: number;
    bulkDiscountSavings: number;
    contractSavings: number;
  };
}

// Add the missing Address type
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  isActive: boolean;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  createdAt: Date;
}

export interface CustomerPortalSettings {
  isEnabled: boolean;
  allowedCategories: string[];
  security: {
    phoneVerification: boolean;
    locationVerification: boolean;
    operatingHours: {
      enabled: boolean;
      open: string;
      close: string;
    };
    maxOrderValue?: number;
  };
  customization: {
    theme: string;
    logo?: string;
    welcomeMessage?: string;
    orderingInstructions?: string;
    primaryColor?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address: string;
    radius: number;
  };
} 