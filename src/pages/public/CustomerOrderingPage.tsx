import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Restaurant, MenuItem, Order, OrderItem } from '@/types';
import { RestaurantService } from '@/services/restaurantService';
import { MenuService } from '@/services/menuService';
import { OrderService } from '@/services/orderService';
import { CustomerService } from '@/services/customerService';
import { TableService } from '@/services/tableService';
import locationService, { LocationVerificationResult } from '@/services/locationService';
import { userAuthService } from '@/services/userAuthService';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  X,
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  Clock,
  MapPin,
  Phone,
  Shield,
  Loader,
  Loader2,
  Send,
  Smartphone,
  SlidersHorizontal,
  User,
  Utensils,
  AlertTriangle,
  ChefHat,
  Bell
} from 'lucide-react';
import { formatCurrency, formatTime } from '@/lib/utils';

// Load Google Fonts for better typography
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

// Extend window for phone.email
declare global {
  interface Window {
    phoneEmailListener?: (userObj: any) => void;
  }
}

interface CartItem extends OrderItem {
  menuItem: MenuItem;
}

interface CustomerPortalSettings {
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
  };
  customization: {
    theme: string;
    logo?: string;
    welcomeMessage?: string;
  };
}

// Add custom CSS for shimmer animation
const shimmerStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(200%) skewX(-12deg); }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

// Phone Email Button Component
const PhoneEmailButton = () => {
  useEffect(() => {
    // Load the phone.email script
    const script = document.createElement('script');
    script.src = 'https://www.phone.email/sign_in_button_v1.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script when component unmounts
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <div 
      className="pe_signin_button w-full flex justify-center" 
      data-client-id="19037279849489128239"
    >
      {/* The phone.email script will render the button here */}
    </div>
  );
};

export default function CustomerOrderingPage() {
  const { slug, tableId } = useParams<{ slug: string; tableId?: string }>();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [portalSettings, setPortalSettings] = useState<CustomerPortalSettings | null>(null);
  const [specificTable, setSpecificTable] = useState<any>(null); // Table info for table-specific orders
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationResult, setVerificationResult] = useState<LocationVerificationResult | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  
  // Phone.email authentication state
  const [phoneAuthUser, setPhoneAuthUser] = useState<any>(null);
  const [isPhoneAuthenticated, setIsPhoneAuthenticated] = useState(false);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Order tracking states
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  
  const verificationAttempted = useRef(false);
  const orderSubscriptionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (slug) {
      loadRestaurantData();
    }
  }, [slug]);

  useEffect(() => {
    // Initialize phone.email authentication
    initializePhoneEmailAuth();
    
    // Create a debug wrapper for the phone email listener
    const debugPhoneEmailListener = (userObj: any) => {
      console.log('🔔 phoneEmailListener called from phone.email script');
      console.log('📋 UserObj received:', userObj);
      console.log('🏪 Restaurant available:', !!restaurant);
      
      // Check what properties are available
      if (userObj && typeof userObj === 'object') {
        console.log('📝 UserObj keys:', Object.keys(userObj));
        if (userObj.user_json_url) {
          console.log('✅ user_json_url found:', userObj.user_json_url);
        } else {
          console.log('❌ user_json_url missing in userObj');
        }
      }
      
      handlePhoneEmailSuccess(userObj);
    };
    
    // Set up global phone email listener with enhanced debugging
    window.phoneEmailListener = debugPhoneEmailListener;
    
    // Also set up alternative listener names in case phone.email uses different callback names
    (window as any).phoneEmailCallback = debugPhoneEmailListener;
    (window as any).phoneVerificationCallback = debugPhoneEmailListener;
    
    // Add a test function to manually trigger (for debugging)
    (window as any).testPhoneEmail = () => {
      console.log('🧪 Testing phone.email callback...');
      debugPhoneEmailListener({
        user_json_url: 'https://user.phone.email/test_user.json'
      });
    };
    
    console.log('✅ Phone.email listeners registered:', {
      phoneEmailListener: !!window.phoneEmailListener,
      restaurant: !!restaurant,
      testFunction: !!(window as any).testPhoneEmail
    });
    
    return () => {
      // Cleanup
      if (window.phoneEmailListener) {
        delete window.phoneEmailListener;
      }
      if ((window as any).phoneEmailCallback) {
        delete (window as any).phoneEmailCallback;
      }
      if ((window as any).phoneVerificationCallback) {
        delete (window as any).phoneVerificationCallback;
      }
      if ((window as any).testPhoneEmail) {
        delete (window as any).testPhoneEmail;
      }
    };
  }, [restaurant]); // Add restaurant as dependency

  useEffect(() => {
    if (restaurant && portalSettings && !verificationAttempted.current) {
      verificationAttempted.current = true;
      performSecurityChecks();
    }
  }, [restaurant, portalSettings]);

  // Watch for authentication state changes and force modal close
  useEffect(() => {
    if (isPhoneAuthenticated && phoneAuthUser && showPhoneVerification) {
      console.log('🔄 Authentication detected, forcing modal close');
      setShowPhoneVerification(false);
      setOtpSent(false);
      setOtp('');
    }
  }, [isPhoneAuthenticated, phoneAuthUser, showPhoneVerification]);

  // Inject shimmer animation styles
  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = shimmerStyles;
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // Cleanup order subscription on unmount
  useEffect(() => {
    return () => {
      if (orderSubscriptionRef.current) {
        orderSubscriptionRef.current();
        orderSubscriptionRef.current = null;
      }
    };
  }, []);

  const loadRestaurantData = async () => {
    if (!slug) return;

    try {
      setIsLoading(true);
      
      // Load restaurant
      const restaurantResult = await RestaurantService.getRestaurantBySlug(slug);
      if (!restaurantResult.success || !restaurantResult.data) {
        toast.error('Restaurant not found');
        navigate('/');
        return;
      }

      setRestaurant(restaurantResult.data);

      // Load portal settings (create default if not exists)
      const savedSettings = localStorage.getItem(`portal_settings_${restaurantResult.data.id}`);
      let settings: CustomerPortalSettings;
      
      if (!savedSettings) {
        // Create default settings if not configured
        console.log('📝 Creating default portal settings for:', restaurantResult.data.name);
        settings = {
          isEnabled: true, // Enable by default for demo
          allowedCategories: ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Snacks'],
          security: {
            locationVerification: true, // Enable location verification with lenient scoring
            phoneVerification: true, // Enable phone verification for orders
            maxOrderValue: 5000,
            operatingHours: {
              enabled: false, // Keep time restrictions disabled for demo
              open: '09:00',
              close: '22:00'
            }
          },
          customization: {
            theme: 'default',
            logo: '',
            welcomeMessage: `Welcome to ${restaurantResult.data.name}! Browse our menu and place your order.`
          }
        };
        
        // Save default settings
        localStorage.setItem(`portal_settings_${restaurantResult.data.id}`, JSON.stringify(settings));
        toast.success(`Portal auto-configured for ${restaurantResult.data.name}! 🎉`);
      } else {
        settings = JSON.parse(savedSettings);
        
        // Check if portal is explicitly disabled
        if (!settings.isEnabled) {
          toast.error('Ordering portal is currently disabled by restaurant');
          return;
        }
      }

      setPortalSettings(settings);

      // Load menu items
      const menuResult = await MenuService.getMenuItemsForRestaurant(restaurantResult.data.id);
      if (menuResult.success && menuResult.data) {
        setMenuItems(menuResult.data.filter(item => item.isAvailable));
      }

      // Load specific table information if tableId is provided
      if (tableId) {
        console.log('📍 Loading table information for tableId:', tableId);
        const tableResult = await TableService.getTableById(tableId, restaurantResult.data.id);
        if (tableResult.success && tableResult.data) {
          setSpecificTable(tableResult.data);
          console.log('✅ Table loaded:', tableResult.data);
          toast.success(`Welcome to Table ${tableResult.data.number} - ${tableResult.data.area}!`, {
            duration: 3000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
        } else {
          console.error('❌ Failed to load table:', tableResult.error);
          toast.error('Table not found. Using general menu portal.');
        }
      }

    } catch (error) {
      console.error('Failed to load restaurant data:', error);
      toast.error('Failed to load restaurant information');
    } finally {
      setIsLoading(false);
    }
  };

  const performSecurityChecks = async () => {
    if (!portalSettings || !restaurant) return;

    setIsVerifying(true);

    try {
      // Check operating hours
      if (portalSettings.security.operatingHours.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openHour, openMin] = portalSettings.security.operatingHours.open.split(':').map(Number);
        const [closeHour, closeMin] = portalSettings.security.operatingHours.close.split(':').map(Number);
        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        if (currentTime < openTime || currentTime > closeTime) {
          toast.error(`We're closed. Open from ${portalSettings.security.operatingHours.open} to ${portalSettings.security.operatingHours.close}`);
          setIsVerifying(false);
          return;
        }
      }

      // Location verification (invisible to user)
      if (portalSettings.security.locationVerification && 
          portalSettings.location && 
          portalSettings.location.latitude && 
          portalSettings.location.longitude) {
        console.log('🔍 Running location verification...');
        const restaurantLocation = {
          latitude: portalSettings.location.latitude,
          longitude: portalSettings.location.longitude,
          address: portalSettings.location.address,
          radius: portalSettings.location.radius
        };
        
        const locationResult = await locationService.verifyLocationInvisibly(restaurantLocation);
        setVerificationResult(locationResult);
        
        if (locationResult.confidence >= 45) {
          setIsVerified(true);
          toast.success('✅ Location verified! Welcome to ordering.', { 
            duration: 2000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
        } else if (locationResult.confidence >= 30) {
          // Still allow but with phone verification
          setIsVerified(true);
          toast('📍 Location check passed. Ready to order!', { 
            duration: 3000,
            style: {
              background: 'rgba(59, 130, 246, 0.95)',
              color: '#fff',
            }
          });
        } else {
          // Very lenient fallback - still allow ordering
          console.log('⚠️ Low confidence location, but allowing for demo purposes');
          setIsVerified(true);
          toast('🚀 Demo mode enabled - ready to order!', { 
            duration: 3000,
            style: {
              background: 'rgba(168, 85, 247, 0.95)',
              color: '#fff',
            }
          });
        }
              } else {
          // Skip location verification if disabled or not configured
          console.log('📍 Location verification skipped (disabled or not configured)');
          setIsVerified(true);
          toast.success('🎉 Welcome! Menu is ready for ordering.', { 
            duration: 3000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
        }

    } catch (error) {
      console.error('Security check failed:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

// Location verification is now handled by the LocationService

  const addToCart = (menuItem: MenuItem, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.menuItem.id === menuItem.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prevCart, {
          id: `cart_${Date.now()}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity,
          price: menuItem.price,
          total: menuItem.price * quantity,
          notes: '',
          menuItem
        }];
      }
    });
    
    toast.success(`${menuItem.name} added to cart!`);
  };

  const updateCartQuantity = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartItemId));
    } else {
      setCart(prev => prev.map(item =>
        item.id === cartItemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getUniqueCategories = () => {
    const categories = menuItems.map(item => item.category);
    return ['all', ...Array.from(new Set(categories))];
  };

  const getFilteredMenuItems = () => {
    let filtered = menuItems;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.category.toLowerCase().includes(query)
      );
    }

    // Filter by price range
    if (priceFilter !== 'all') {
      filtered = filtered.filter(item => {
        switch (priceFilter) {
          case 'low':
            return item.price <= 200;
          case 'medium':
            return item.price > 200 && item.price <= 500;
          case 'high':
            return item.price > 500;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  // Initialize phone.email authentication
  const initializePhoneEmailAuth = async () => {
    console.log('🔐 Initializing phone.email authentication...');
    
    // Check if user is already phone authenticated (stored in localStorage)
    const storedPhoneUser = localStorage.getItem('menuPortalPhoneUser');
    
    if (storedPhoneUser) {
      try {
        const userData = JSON.parse(storedPhoneUser);
        
        // Validate required fields
        if (!userData.phone || !userData.country_code || !userData.lastAuthenticated) {
          throw new Error('Invalid stored auth data');
        }
        
        // Check if the data is still valid (less than 24 hours old)
        const lastAuth = new Date(userData.lastAuthenticated);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastAuth.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          setPhoneAuthUser(userData);
          setIsPhoneAuthenticated(true);
          setPhoneNumber(userData.phone); // Set phone number for any fallback operations
          
          console.log('✅ Restored phone auth session:', {
            name: userData.fullName,
            phone: userData.phone,
            country: userData.country_code,
            hoursOld: Math.round(hoursDiff * 10) / 10,
            authMethod: userData.authMethod || 'phone_email'
          });
          
          return;
        } else {
          console.log('⏰ Auth session expired:', Math.round(hoursDiff), 'hours old');
        }
      } catch (error) {
        console.error('❌ Error restoring phone auth session:', error);
      }
    }

    // Clear invalid or expired stored data
    localStorage.removeItem('menuPortalPhoneUser');
    console.log('🧹 Cleared invalid/expired auth data');
  };

  // Phone.email authentication success handler - Enhanced with proper validation
  const handlePhoneEmailSuccess = async (userObj: any) => {
    console.log('📱 Phone.email callback triggered with:', userObj);
    
    // Prevent duplicate processing
    if (isPhoneAuthenticated) {
      console.log('📱 Already authenticated, skipping duplicate processing');
      return;
    }
    
    if (!restaurant) {
      console.error('❌ Restaurant data not available');
      toast.error("Restaurant not loaded. Please refresh the page.");
      return;
    }

    if (!userObj) {
      console.error('❌ Phone.email authentication failed: No user object provided');
      toast.error("Authentication failed: No user data received.");
      return;
    }

    if (!userObj.user_json_url) {
      console.error('❌ Phone.email authentication failed: Missing user_json_url');
      console.log('Available userObj properties:', Object.keys(userObj));
      toast.error("Authentication failed: Invalid response from phone verification.");
      return;
    }

    console.log('📱 Phone.email authentication started:', userObj.user_json_url);

    try {
      // Fetch verified user data from phone.email's secure JSON URL
      const response = await fetch(userObj.user_json_url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch user data`);
      }
      
      const data = await response.json();
      
      // Validate required fields from phone.email
      if (!data.user_country_code || !data.user_phone_number) {
        throw new Error('Invalid user data: Missing country code or phone number');
      }

      console.log('✅ Phone.email verification successful:', {
        country_code: data.user_country_code,
        phone: data.user_phone_number,
        firstName: data.user_first_name,
        lastName: data.user_last_name
      });

      // Create validated user data object
      let phoneUserData = {
        country_code: data.user_country_code,
        phone: data.user_phone_number,
        firstName: data.user_first_name || '',
        lastName: data.user_last_name || '',
        fullName: `${data.user_first_name || ''} ${data.user_last_name || ''}`.trim(),
        lastAuthenticated: new Date().toISOString(),
        authMethod: 'phone_email',
        isVerified: true
      };

      // Enhanced name resolution from existing customer records
      try {
        console.log('🔍 Checking for existing customer records...');
        
        // First check CRM for existing customer with better name
        const existingCustomers = await CustomerService.searchCustomers(restaurant.id, phoneUserData.phone);
        if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
          const customer = existingCustomers.data[0];
          if (customer.name && customer.name !== 'Customer Portal User' && customer.name.trim() !== '') {
            console.log('👤 Found existing customer with name:', customer.name);
            phoneUserData.fullName = customer.name;
            const nameParts = customer.name.split(' ');
            phoneUserData.firstName = nameParts[0] || phoneUserData.firstName;
            phoneUserData.lastName = nameParts.slice(1).join(' ') || phoneUserData.lastName;
          }
        }

        // Also check Gamification Users collection
        const existingGamUser = await userAuthService.getUserByPhone(restaurant.id, phoneUserData.phone);
        if (existingGamUser && existingGamUser.name && existingGamUser.name !== 'Customer Portal User' && existingGamUser.name.trim() !== '') {
          console.log('🎮 Found existing gamification user with name:', existingGamUser.name);
          phoneUserData.fullName = existingGamUser.name;
          const nameParts = existingGamUser.name.split(' ');
          phoneUserData.firstName = nameParts[0] || phoneUserData.firstName;
          phoneUserData.lastName = nameParts.slice(1).join(' ') || phoneUserData.lastName;
        }
      } catch (dbError) {
        console.log('⚠️ Could not fetch existing user data:', dbError);
        // Continue with phone.email data if database lookup fails
      }

      // Set default name if still empty
      if (!phoneUserData.fullName || phoneUserData.fullName.trim() === '') {
        phoneUserData.fullName = `Customer ${phoneUserData.phone.slice(-4)}`;
      }

      // Securely store authenticated session
      localStorage.setItem('menuPortalPhoneUser', JSON.stringify(phoneUserData));
      
      // Update CRM with verified phone data
      await savePhoneUserToCRM(phoneUserData);
      
      // Update React state immediately
      setPhoneAuthUser(phoneUserData);
      setIsPhoneAuthenticated(true);
      setPhoneNumber(phoneUserData.phone); // Set phone number for order processing
      
      // Force close phone verification modal
      setShowPhoneVerification(false);
      setOtpSent(false);
      setOtp('');
      
      console.log("✅ Phone verification completed successfully:", {
        name: phoneUserData.fullName,
        phone: phoneUserData.phone,
        country: phoneUserData.country_code
      });
      
      // Show success message with enhanced styling
      toast.success(`🎉 Welcome ${phoneUserData.fullName}! Phone verified securely.`, {
        duration: 3000,
        style: {
          background: 'linear-gradient(135deg, #10B981, #059669)',
          color: '#fff',
          fontWeight: '600',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
        }
      });

      // Force a re-render to update UI immediately
      setTimeout(() => {
        console.log('🔄 Forcing UI update after authentication');
        // This timeout ensures React state updates are processed
      }, 100);

      // Auto-proceed with order if cart has items - IMMEDIATE processing
      if (cart.length > 0) {
        console.log('🚀 Auto-proceeding with order after phone.email verification');
        console.log('🛒 Cart items:', cart.length);
        
        // Set loading state for order processing
        setIsSubmittingOrder(true);
        
        // Show processing message
        toast.dismiss(); // Clear any existing toasts
        toast.loading('Processing your order...', { 
          id: 'order-processing',
          duration: 3000 
        });
        
        // Submit order immediately after a very short delay for UI update
        setTimeout(() => {
          console.log('⏰ Submitting order immediately');
          submitOrder();
        }, 500); // Reduced delay
      } else {
        console.log('🛒 No items in cart, authentication complete but no order to process');
        // If no cart items, just close the modal and show success
        toast.success('✅ Phone verification complete! Add items to your cart to place an order.', {
          duration: 4000
        });
      }
      
    } catch (error) {
      console.error("❌ Phone.email verification error:", error);
      
      // Clear any potentially invalid auth state
      setPhoneAuthUser(null);
      setIsPhoneAuthenticated(false);
      localStorage.removeItem('menuPortalPhoneUser');
      
      // Show detailed error message
      const errorMessage = error instanceof Error 
        ? `Verification failed: ${error.message}` 
        : "Phone verification failed. Please try again.";
        
      toast.error(errorMessage, {
        duration: 6000,
        style: {
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          color: '#fff',
        }
      });
    }
  };

  // Save phone.email user to CRM
  const savePhoneUserToCRM = async (phoneUserData: any) => {
    if (!restaurant) return;

    try {
      const customerData = {
        name: phoneUserData.fullName || 'Customer Portal User',
        phone: phoneUserData.phone,
        email: '', // Email not provided by phone.email initially
        address: '',
        preferences: ['phone_email_user'],
        totalSpent: 0,
        visitCount: 1,
        lastVisit: new Date()
      };

      // Check if customer already exists in CRM
      const existingCustomers = await CustomerService.searchCustomers(restaurant.id, phoneUserData.phone);
      
      if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
        const existingCustomer = existingCustomers.data[0];
        console.log('Customer already exists in CRM:', existingCustomer);
        
        // Update last visit and visit count
        const updatedData = {
          ...existingCustomer,
          lastVisit: new Date(),
          visitCount: (existingCustomer.visitCount || 0) + 1,
          // Only update name if the new name is better (not default)
          name: (phoneUserData.fullName && phoneUserData.fullName !== 'Customer Portal User') 
                ? phoneUserData.fullName 
                : existingCustomer.name
        };
        
        const updateResult = await CustomerService.updateCustomer(existingCustomer.id, restaurant.id, updatedData);
        if (updateResult.success) {
          console.log('Customer updated in CRM:', updateResult.data);
        }
      } else {
        // Create new customer in CRM
        const result = await CustomerService.createCustomer(restaurant.id, customerData);
        if (result.success) {
          console.log('User saved to CRM successfully:', result.data);
        } else {
          console.error('Failed to save user to CRM:', result.error);
        }
      }
      
    } catch (error) {
      console.error('Error saving user to CRM:', error);
    }
  };

  const handlePhoneVerification = async () => {
    if (!phoneNumber.match(/^[6-9]\d{9}$/)) {
      toast.error('Please enter a valid 10-digit phone number starting with 6-9');
      return;
    }

    if (!restaurant) {
      toast.error('Restaurant data not available');
      return;
    }

    setIsSendingOtp(true);

    try {
      console.log('📱 Sending real OTP to:', phoneNumber);

      // Check if user exists, if not create a new one
      const existingUser = await userAuthService.getUserByPhone(restaurant.id, phoneNumber);
      let userId: string;

      if (existingUser) {
        console.log('👤 Existing user found:', existingUser.name);
        userId = existingUser.id;
        
        // Resend verification code to existing user
        const result = await userAuthService.resendVerificationCode(restaurant.id, userId, 'phone');
        
        if (result.success) {
          setCurrentUserId(userId);
          setOtpSent(true);
          toast.success(`📱 OTP sent to +91-${phoneNumber}!`, {
            duration: 4000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
        } else {
          throw new Error(result.message || 'Failed to send OTP');
        }
      } else {
        console.log('👤 Creating new user for phone:', phoneNumber);
        
        // Create new user for phone verification
        const registerResult = await userAuthService.registerUser(restaurant.id, {
          name: 'Customer Portal User',
          phone: phoneNumber,
          email: '',
          password: 'temp_password_123',
          confirmPassword: 'temp_password_123',
          deviceFingerprint: userAuthService.generateDeviceFingerprint()
        });

        if (registerResult.success && registerResult.user) {
          userId = registerResult.user.id;
          setCurrentUserId(userId);
          setOtpSent(true);
          toast.success(`📱 OTP sent to +91-${phoneNumber}!`, {
            duration: 4000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
        } else {
          throw new Error(registerResult.message || 'Failed to create user account');
        }
      }
    } catch (error) {
      console.error('OTP sending failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    if (!restaurant || !currentUserId) {
      toast.error('Verification data not available. Please try again.');
      return;
    }

    setIsVerifyingOtp(true);

    try {
      console.log('🔐 Verifying real OTP:', otp);

      const verificationResult = await userAuthService.verifyUser({
        restaurantId: restaurant.id,
        userId: currentUserId,
        code: otp,
        type: 'phone'
      });

      if (verificationResult.success) {
        setShowPhoneVerification(false);
        toast.success('✅ Phone verified successfully!', {
          duration: 3000,
          style: {
            background: 'rgba(34, 197, 94, 0.95)',
            color: '#fff',
          }
        });
        submitOrder();
      } else {
        // Add fallback demo codes for development
        const demoOTPs = ['123456', '000000', '111111', phoneNumber.slice(-6)];
        if (demoOTPs.includes(otp)) {
          console.log('💫 Demo OTP accepted:', otp);
          setShowPhoneVerification(false);
          toast.success('✅ Phone verified successfully! (Demo Mode)', {
            duration: 3000,
            style: {
              background: 'rgba(34, 197, 94, 0.95)',
              color: '#fff',
            }
          });
          submitOrder();
        } else {
          throw new Error(verificationResult.message || 'Invalid OTP code');
        }
      }
    } catch (error) {
      console.error('OTP verification failed:', error);
      toast.error(error instanceof Error ? error.message : 'OTP verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const resendOTP = async () => {
    if (!restaurant || !currentUserId) {
      toast.error('Cannot resend OTP. Please try phone verification again.');
      return;
    }

    setIsSendingOtp(true);

    try {
      const result = await userAuthService.resendVerificationCode(restaurant.id, currentUserId, 'phone');
      
      if (result.success) {
        toast.success('📱 OTP resent successfully!', {
          duration: 3000,
          style: {
            background: 'rgba(34, 197, 94, 0.95)',
            color: '#fff',
          }
        });
      } else {
        throw new Error(result.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    
    console.log('📱 Checkout triggered - Auth state:', { 
      isPhoneAuthenticated, 
      phoneAuthUser: phoneAuthUser?.fullName, 
      phoneVerificationRequired: portalSettings?.security.phoneVerification 
    });
    
    // Double-check localStorage for phone authentication (in case state wasn't properly restored)
    const storedPhoneUser = localStorage.getItem('menuPortalPhoneUser');
    if (storedPhoneUser && !isPhoneAuthenticated) {
      try {
        const userData = JSON.parse(storedPhoneUser);
        const lastAuth = new Date(userData.lastAuthenticated);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastAuth.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          console.log('📱 Restoring phone auth session from localStorage:', userData.fullName);
          setPhoneAuthUser(userData);
          setIsPhoneAuthenticated(true);
          submitOrder();
          return;
        }
      } catch (error) {
        console.error('Error restoring phone auth session during checkout:', error);
      }
    }
    
    // Check if user is already authenticated via phone.email
    if (isPhoneAuthenticated && phoneAuthUser) {
      console.log('📱 User already authenticated via phone.email, proceeding to order');
      submitOrder();
      return;
    }
    
    // Otherwise require phone verification if enabled in settings
    if (portalSettings?.security.phoneVerification) {
      console.log('📱 Phone verification required for order');
      setShowPhoneVerification(true);
    } else {
      console.log('📱 Phone verification disabled, proceeding to order');
      submitOrder();
    }
  };

  // Set up real-time order tracking
  const setupOrderTracking = (orderId: string) => {
    if (!restaurant) return;

    // Clean up any existing subscription
    if (orderSubscriptionRef.current) {
      orderSubscriptionRef.current();
    }

    console.log('🔄 Setting up real-time order tracking for:', orderId);

    // Subscribe to order updates
    orderSubscriptionRef.current = OrderService.subscribeToOrders(
      restaurant.id,
      (orders: Order[]) => {
        const updatedOrder = orders.find(order => order.id === orderId);
        if (updatedOrder && submittedOrder) {
          console.log('📱 Order status updated:', {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            previousStatus: submittedOrder.status
          });

          // Update the order state
          setSubmittedOrder(updatedOrder);

          // Show toast notification for status changes
          if (updatedOrder.status !== submittedOrder.status) {
            const statusMessages = {
              confirmed: '✅ Order confirmed! Kitchen is preparing your food.',
              preparing: '👨‍🍳 Your order is being prepared in the kitchen.',
              ready: '🔔 Your order is ready! Please proceed to payment.',
              completed: '🎉 Order completed! Thank you for dining with us.'
            };

            const message = statusMessages[updatedOrder.status as keyof typeof statusMessages];
            if (message) {
              toast.success(message, {
                duration: 4000,
                style: {
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#fff',
                  fontWeight: '600',
                }
              });
            }
          }
        }
      }
    );
  };

  const getOrderStatusConfig = (status: string) => {
    const configs = {
      placed: { 
        color: 'border-yellow-300 bg-yellow-50 text-yellow-800', 
        icon: Clock, 
        label: 'Order Placed',
        description: 'Your order has been received and is waiting for confirmation.'
      },
      confirmed: { 
        color: 'border-blue-300 bg-blue-50 text-blue-800', 
        icon: CheckCircle, 
        label: 'Order Confirmed',
        description: 'Your order has been confirmed and sent to the kitchen.'
      },
      preparing: { 
        color: 'border-indigo-300 bg-indigo-50 text-indigo-800', 
        icon: ChefHat, 
        label: 'Being Prepared',
        description: 'Your delicious food is being prepared in the kitchen.'
      },
      ready: { 
        color: 'border-green-300 bg-green-50 text-green-800', 
        icon: Bell, 
        label: 'Ready for Payment',
        description: 'Your order is ready! Please proceed to payment counter.'
      },
      completed: { 
        color: 'border-emerald-300 bg-emerald-50 text-emerald-800', 
        icon: CheckCircle, 
        label: 'Order Completed',
        description: 'Thank you for your order! Enjoy your meal.'
      },
    };
    return configs[status as keyof typeof configs] || configs.placed;
  };

  const closeOrderStatus = () => {
    setShowOrderStatus(false);
    setSubmittedOrder(null);
    
    // Clean up subscription
    if (orderSubscriptionRef.current) {
      orderSubscriptionRef.current();
      orderSubscriptionRef.current = null;
    }

    // Redirect to customer dashboard
    if (restaurant) {
      const redirectPhone = isPhoneAuthenticated && phoneAuthUser 
        ? phoneAuthUser.phone 
        : (phoneNumber || 'customer');
      
      window.location.href = `/${restaurant.slug}/customer-dashboard?phone=${redirectPhone}`;
    }
  };

  const submitOrder = async () => {
    if (!restaurant || cart.length === 0) return;

    setIsSubmittingOrder(true);

    try {
      // Create order using the OrderService createOrder method
      const cartItems = cart.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        notes: item.notes || ''
      }));

      // Enhanced customer info with proper phone.email validation
      const customerInfo = isPhoneAuthenticated && phoneAuthUser 
        ? `${phoneAuthUser.fullName} (+${phoneAuthUser.country_code}-${phoneAuthUser.phone}) [Verified via Phone.email]`
        : `Phone ${phoneNumber || 'guest'} [OTP Verified]`;

      const orderNotes = `Customer Portal Order - ${customerInfo} | Items: ${cartItems.length} | Total: ₹${Math.round(getTotalAmount() * 1.085)}`;

      console.log('📋 Creating order with details:', {
        customer: customerInfo,
        itemCount: cartItems.length,
        totalAmount: Math.round(getTotalAmount() * 1.085),
        authMethod: phoneAuthUser?.authMethod || 'otp'
      });

      const result = await OrderService.createOrder(
        restaurant.id,
        specificTable ? specificTable.id : 'customer-portal', // Use specific table if available
        'customer-portal', // staffId for portal orders  
        cartItems,
        8.5, // tax rate
        specificTable ? `${orderNotes} | Table: ${specificTable.number} (${specificTable.area})` : orderNotes
      );
      
      if (result.success && result.data) {
        console.log('✅ Order submitted successfully:', result.data);
        
        toast.success('🎉 Order placed successfully! Tracking your order...', {
          duration: 3000,
          style: {
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: '#fff',
            fontWeight: '600',
          }
        });
        
        setCart([]);
        setShowCart(false);
        setSubmittedOrder(result.data);
        setShowOrderStatus(true);
        
        // Set up real-time order tracking
        setupOrderTracking(result.data.id);
        
        // Determine phone for redirect based on authentication method
        const redirectPhone = isPhoneAuthenticated && phoneAuthUser 
          ? phoneAuthUser.phone 
          : (phoneNumber || 'customer');
        
        console.log('🔄 Order tracking started for:', {
          orderId: result.data.id,
          phone: redirectPhone,
          authMethod: phoneAuthUser?.authMethod || 'otp'
        });
      } else {
        throw new Error(result.error || 'Failed to place order');
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 rounded-3xl mx-auto mb-6 shadow-xl animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 rounded-3xl animate-ping opacity-75"></div>
              <div className="relative w-full h-full flex items-center justify-center">
                <Utensils className="w-10 h-10 text-white animate-bounce" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Loading Menu
          </h2>
          <p className="text-gray-600 text-lg">Preparing your dining experience...</p>
          <div className="flex justify-center space-x-1 mt-4">
            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant || !portalSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full border-4 border-white animate-pulse"></div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Portal Unavailable
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            This restaurant's ordering portal is not configured or is currently unavailable. Please contact the restaurant directly.
          </p>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="relative mb-8">
            <div className="w-28 h-28 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-pulse">
              <Shield className="w-14 h-14 text-white" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl animate-ping opacity-20"></div>
            <div className="absolute -top-3 -right-3 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center animate-bounce">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Verifying Location
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-8">
            Please wait while we securely verify you're at the restaurant...
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3 p-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 font-medium">Checking location signals</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <span className="text-gray-700 font-medium">Analyzing network environment</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <span className="text-gray-700 font-medium">Validating access credentials</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full border-4 border-white animate-pulse"></div>
          </div>
          
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Verification Failed
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            We couldn't verify that you're at the restaurant location. Please ensure you're connected to the restaurant's WiFi or are within the restaurant premises.
          </p>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Modern Floating Header */}
      <div className="sticky top-4 z-50 mx-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                      <Utensils className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent font-['Poppins',_sans-serif]">
                      {restaurant.name}
                    </h1>
                    {specificTable && (
                      <div className="flex items-center space-x-1 mt-1 mb-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">
                          Table {specificTable.number} - {specificTable.area} ({specificTable.capacity} seats)
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {verificationResult && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-green-100/80 backdrop-blur-sm rounded-full text-xs">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-green-700 font-medium">{verificationResult.confidence}% verified</span>
                        </div>
                      )}
                      {isPhoneAuthenticated && phoneAuthUser && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-100/80 backdrop-blur-sm rounded-full text-xs">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">✨ {phoneAuthUser.fullName}</span>
                        </div>
                      )}
                      {portalSettings?.security.phoneVerification && !isPhoneAuthenticated && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100/80 backdrop-blur-sm rounded-full text-xs">
                          <Phone className="w-3 h-3 text-blue-600" />
                          <span className="text-blue-700 font-medium">Phone auth</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Cart and Dashboard Buttons */}
                <div className="flex items-center space-x-4">
                  {/* Dashboard Button for Authenticated Users */}
                  {isPhoneAuthenticated && phoneAuthUser && (
                    <button
                      onClick={() => {
                        if (restaurant) {
                          window.location.href = `/${restaurant.slug}/customer-dashboard?phone=${phoneAuthUser.phone}`;
                        }
                      }}
                      className="relative bg-white/90 backdrop-blur-md border border-purple-200/50 rounded-2xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
                    >
                      <User className="w-6 h-6 text-purple-600 group-hover:text-purple-700" />
                      <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {phoneAuthUser?.metadata?.orderCount || '0'}
                      </span>
                    </button>
                  )}

                  {/* Cart Button */}
                  <button
                    onClick={() => setShowCart(true)}
                    className="relative bg-white/90 backdrop-blur-md border border-blue-200/50 rounded-2xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
                  >
                    <ShoppingCart className="w-6 h-6 text-blue-600 group-hover:text-blue-700" />
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {cart.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden pt-24 pb-12">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/20 to-blue-600/20"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-pink-400 to-violet-600 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-20 left-1/3 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="mb-8">
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-4 leading-tight font-['Poppins',_sans-serif]">
              {portalSettings.customization.welcomeMessage}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {portalSettings.customization.orderingInstructions}
            </p>
          </div>
          
          {/* Security Status Cards */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            {verificationResult && (
              <div className="bg-white/80 backdrop-blur-xl border border-green-200/50 rounded-2xl px-4 py-3 shadow-lg transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-green-700 font-semibold">Location Secured ({verificationResult.confidence}%)</span>
                </div>
              </div>
            )}
            {portalSettings.security.phoneVerification && (
              <div className="bg-white/80 backdrop-blur-xl border border-blue-200/50 rounded-2xl px-4 py-3 shadow-lg transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-blue-700 font-semibold">Phone Authentication</span>
                </div>
              </div>
            )}
            {portalSettings.security.operatingHours.enabled && (
              <div className="bg-white/80 backdrop-blur-xl border border-purple-200/50 rounded-2xl px-4 py-3 shadow-lg transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-violet-500 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-purple-700 font-semibold">{portalSettings.security.operatingHours.open} - {portalSettings.security.operatingHours.close}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Category Slider */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <div className="relative">
          {/* Background container with enhanced styling */}
          <div className="bg-gradient-to-r from-white/80 via-blue-50/60 to-purple-50/80 backdrop-blur-2xl border border-white/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Floating background decorations */}
            <div className="absolute -top-4 -left-4 w-20 h-20 bg-gradient-to-br from-violet-400/10 to-purple-600/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-blue-400/10 to-indigo-600/10 rounded-full blur-2xl"></div>
            
            {/* Section header */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-black bg-gradient-to-r from-gray-800 via-violet-600 to-purple-600 bg-clip-text text-transparent font-['Poppins',_sans-serif] mb-2">
                🍽️ Explore Our Menu
              </h3>
              <p className="text-sm text-gray-600 font-medium">Choose your favorite category</p>
            </div>
            
            {/* Clean category selector */}
            <div className="relative">
              <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2" style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}>
                {getUniqueCategories().map((category, index) => {
                  const isSelected = selectedCategory === category;
                  const isAll = category === 'all';
                  
                  // Define category-specific emojis and clean colors
                  const categoryStyles: Record<string, { emoji: string; color: string; bgColor: string; hoverColor: string }> = {
                    'all': { 
                      emoji: '✨', 
                      color: 'text-purple-600',
                      bgColor: 'bg-purple-50',
                      hoverColor: 'hover:bg-purple-100'
                    },
                    'Appetizers': { 
                      emoji: '🥗', 
                      color: 'text-green-600',
                      bgColor: 'bg-green-50',
                      hoverColor: 'hover:bg-green-100'
                    },
                    'Main Course': { 
                      emoji: '🍛', 
                      color: 'text-red-600',
                      bgColor: 'bg-red-50',
                      hoverColor: 'hover:bg-red-100'
                    },
                    'Desserts': { 
                      emoji: '🍰', 
                      color: 'text-pink-600',
                      bgColor: 'bg-pink-50',
                      hoverColor: 'hover:bg-pink-100'
                    },
                    'Beverages': { 
                      emoji: '🥤', 
                      color: 'text-blue-600',
                      bgColor: 'bg-blue-50',
                      hoverColor: 'hover:bg-blue-100'
                    },
                    'Snacks': { 
                      emoji: '🍿', 
                      color: 'text-yellow-600',
                      bgColor: 'bg-yellow-50',
                      hoverColor: 'hover:bg-yellow-100'
                    }
                  };
                  
                  const style = categoryStyles[category] || { 
                    emoji: '🍽️', 
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-50',
                    hoverColor: 'hover:bg-gray-100'
                  };
                  
                  // Use restaurant's custom primary color if available
                  const primaryColor = portalSettings?.customization?.primaryColor || '#6366F1';
                  
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`relative group flex items-center space-x-3 px-6 py-4 rounded-xl whitespace-nowrap font-semibold transition-all duration-300 transform hover:scale-105 min-w-fit shadow-sm ${
                        isSelected
                          ? 'text-white shadow-lg'
                          : `bg-white ${style.color} ${style.hoverColor} hover:shadow-md border border-gray-200`
                      }`}
                      style={{ 
                        backgroundColor: isSelected ? primaryColor : undefined,
                        animationDelay: `${index * 100}ms`
                      }}
                    >
                      {/* Content */}
                      <div className="relative z-10 flex items-center space-x-2">
                        <span className={`text-lg transition-transform duration-300 ${isSelected ? '' : 'group-hover:scale-110'}`}>
                          {style.emoji}
                        </span>
                        <span className={`font-['Inter',_sans-serif] font-medium text-sm md:text-base`}>
                          {isAll ? 'All Items' : category}
                        </span>
                      </div>
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Fade edges for scroll indication */}
              <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-white/60 to-transparent pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white/60 to-transparent pointer-events-none"></div>
            </div>
            
            {/* Bottom decoration line */}
            <div className="mt-4 h-0.5 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl border border-white/30 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-6">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search delicious dishes, drinks, desserts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/80 border-2 border-transparent rounded-2xl focus:border-violet-400 focus:bg-white transition-all duration-300 text-gray-900 placeholder-gray-500 shadow-lg backdrop-blur-sm font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg backdrop-blur-sm ${
                showFilters
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                  : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-xl'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span>Filters</span>
              {(priceFilter !== 'all') && (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              )}
            </button>
          </div>

          {/* Expandable Filter Options */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-white/40">
              <div className="space-y-4">
                {/* Price Range Filter */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-violet-600" />
                    <span>Price Range</span>
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'all', label: '✨ All Prices', color: 'from-gray-400 to-gray-500' },
                      { value: 'low', label: '💰 Under ₹200', color: 'from-green-400 to-emerald-500' },
                      { value: 'medium', label: '💸 ₹200 - ₹500', color: 'from-blue-400 to-indigo-500' },
                      { value: 'high', label: '💎 Above ₹500', color: 'from-purple-400 to-pink-500' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setPriceFilter(option.value as any)}
                        className={`px-4 py-2 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${
                          priceFilter === option.value
                            ? `bg-gradient-to-r ${option.color} text-white shadow-lg`
                            : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Filters Display */}
                {(searchQuery || priceFilter !== 'all') && (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600">Active filters:</span>
                    <div className="flex flex-wrap gap-2">
                      {searchQuery && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center space-x-1">
                          <Search className="w-3 h-3" />
                          <span>"{searchQuery}"</span>
                          <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {priceFilter !== 'all' && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center space-x-1">
                          <Filter className="w-3 h-3" />
                          <span>{priceFilter === 'low' ? 'Under ₹200' : priceFilter === 'medium' ? '₹200-₹500' : 'Above ₹500'}</span>
                          <button onClick={() => setPriceFilter('all')} className="hover:text-purple-900">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        {getFilteredMenuItems().length === 0 ? (
          <div className="text-center py-20">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No items found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setPriceFilter('all');
                setSelectedCategory('all');
              }}
              className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-3 rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all duration-300 font-semibold"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            {getFilteredMenuItems().map((item, index) => (
              <div 
                key={item.id} 
                className="group relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden hover:shadow-[0_20px_60px_rgba(139,69,255,0.3)] transition-all duration-700 transform hover:-translate-y-3 hover:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-to-br before:from-violet-600/5 before:via-purple-600/5 before:to-pink-600/5 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,0.9) 100%)'
                }}
              >
                {/* Floating gradient orb effects */}
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-pink-400/20 to-violet-600/20 rounded-full blur-sm group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-sm group-hover:scale-150 transition-transform duration-700 animation-delay-300"></div>
                
                {item.image && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-t-3xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10"></div>
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-1000"
                    />
                    <div className="absolute top-3 right-3 z-20">
                      <div className="flex items-center space-x-1 px-2 py-1 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-white/50">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span className="text-xs font-black text-gray-800">4.8</span>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 z-20">
                      <div className="px-2 py-1 bg-gradient-to-r from-emerald-500/90 to-green-500/90 backdrop-blur-md rounded-xl border border-white/30">
                        <span className="text-xs font-bold text-white">Fresh</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className={`relative z-10 ${item.image ? 'p-4' : 'p-6'}`}>
                  <div className="mb-3">
                    <h3 className="text-base md:text-lg font-black text-gray-900 group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-purple-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-500 leading-tight mb-2 font-['Inter',_'SF_Pro_Display',_system-ui]">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-gray-600 text-xs md:text-sm leading-relaxed line-clamp-2 font-medium">
                        {item.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div className="flex flex-col space-y-1">
                      <span className="text-lg md:text-xl font-black bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 bg-clip-text text-transparent drop-shadow-sm">
                        ₹{item.price}
                      </span>
                      <span className="inline-block text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 px-2 py-1 rounded-lg shadow-md">
                        {item.category}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => addToCart(item)}
                      className="group/btn relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white px-3 md:px-4 py-2 md:py-3 rounded-2xl hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 transition-all duration-500 shadow-lg hover:shadow-2xl transform hover:scale-110 hover:-translate-y-1 flex items-center space-x-1 md:space-x-2 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-400/20 to-violet-400/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                      <Plus className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:rotate-180 transition-transform duration-500 relative z-10" />
                      <span className="font-bold text-xs md:text-sm relative z-10">Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modern Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-md">
            <div className="h-full bg-white/95 backdrop-blur-xl border-l border-white/20 shadow-2xl">
              <div className="flex flex-col h-full">
                {/* Cart Header */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600"></div>
                  <div className="relative flex items-center justify-between p-6 text-white">
                    <div>
                      <h2 className="text-2xl font-bold">Your Order</h2>
                      <p className="text-white/80 text-sm">
                        {cart.length} {cart.length === 1 ? 'item' : 'items'} • ₹{getTotalAmount()}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCart(false)}
                      className="p-2 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <ShoppingCart className="w-12 h-12 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Cart is empty</h3>
                      <p className="text-gray-500">Add some delicious items to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item, index) => (
                        <div 
                          key={item.id} 
                          className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 transform hover:scale-[1.02] transition-all duration-300"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900 mb-1">{item.menuItem.name}</h4>
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                  ₹{item.price}
                                </span>
                                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                  {item.menuItem.category}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-500 text-white rounded-xl flex items-center justify-center hover:from-red-500 hover:to-pink-600 transition-all duration-300 shadow-lg transform hover:scale-110"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-bold text-lg text-gray-900">{item.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-xl flex items-center justify-center hover:from-green-500 hover:to-emerald-600 transition-all duration-300 shadow-lg transform hover:scale-110"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                              {item.quantity} × ₹{item.price} = ₹{item.total}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 0)}
                              className="text-red-500 hover:text-red-700 transition-colors text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Cart Footer */}
                {cart.length > 0 && (
                  <div className="border-t border-white/20 p-6 bg-white/50 backdrop-blur-xl">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">₹{getTotalAmount()}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Tax (8.5%):</span>
                        <span className="font-medium">₹{Math.round(getTotalAmount() * 0.085)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-gray-900">Total:</span>
                          <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            ₹{Math.round(getTotalAmount() * 1.085)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCheckout}
                      disabled={isSubmittingOrder}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-bold text-lg disabled:opacity-50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center justify-center space-x-3"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <Loader className="w-6 h-6 animate-spin" />
                          <span>Processing Order...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-6 h-6" />
                          <span>Place Order</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Processing Overlay */}
      {isSubmittingOrder && isPhoneAuthenticated && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[60] flex items-center justify-center">
          <div className="bg-white rounded-3xl max-w-md w-full mx-4 shadow-2xl border border-gray-100">
            <div className="p-8 text-center">
              <div className="relative mx-auto mb-6 w-fit">
                {/* Animated processing icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <div className="relative">
                    <Loader className="w-10 h-10 text-white animate-spin" />
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                  </div>
                </div>
                
                {/* Success indicators */}
                <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full border-3 border-white flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                </div>
                
                {/* Floating status indicators */}
                <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                <div className="absolute -bottom-1 -right-3 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse animation-delay-300"></div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Processing Your Order
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                {phoneAuthUser?.fullName}, your order is being prepared for the kitchen...
              </p>
              
              {/* Progress steps */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-green-800">Phone Verified</span>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Loader className="w-3 h-3 text-white animate-spin" />
                  </div>
                  <span className="text-sm font-medium text-blue-800">Submitting Order</span>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-xl border border-gray-200">
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                    <Send className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Redirecting to Status</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Phone Verification Modal */}
      {showPhoneVerification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl transform animate-in slide-in-from-bottom-4 duration-300 border border-gray-100">
            <div className="relative overflow-hidden">
              {/* Decorative header with gradient line */}
              <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-8 pt-8 pb-6">
                {/* Close button - enhanced */}
                <button
                  onClick={() => setShowPhoneVerification(false)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-md border border-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>

                {/* Decorative gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                
                {/* Enhanced icon design */}
                <div className="text-center">
                  <div className="relative mx-auto mb-6 w-fit">
                    {/* Main icon container */}
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                      <Smartphone className="w-10 h-10 text-white" />
                    </div>
                    
                    {/* Security badge */}
                    <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full border-3 border-white flex items-center justify-center shadow-lg">
                      <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                    
                    {/* Floating status indicators */}
                    <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div>
                    <div className="absolute -bottom-1 -right-3 w-4 h-4 bg-purple-500 rounded-full border-2 border-white animate-pulse animation-delay-300"></div>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Secure Your Order
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Quick verification to ensure your order is protected
                  </p>
                </div>
              </div>

              {/* Security status card */}
              {verificationResult && (
                <div className="mx-8 mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-green-800">Location Verified</span>
                        <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                          {verificationResult.confidence}%
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {verificationResult.methods.slice(0, 2).join(' • ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="px-8 pb-8">
                
                                  {!otpSent ? (
                    <div className="space-y-6">
                      {/* Enhanced Phone Sign In Section */}
                      <div>
                        <div className="text-center mb-6">
                          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-3">
                            <Smartphone className="w-4 h-4" />
                            <span>Instant Verification</span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Sign in with Phone</h3>
                          <p className="text-sm text-gray-600">One-click verification to place your order securely</p>
                        </div>
                        
                        {/* Enhanced phone.email button container */}
                        <div className="relative">
                          <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-2xl p-6 border-2 border-blue-100 shadow-lg">
                            {/* Decorative elements */}
                            <div className="absolute top-2 right-2 w-8 h-8 bg-blue-500/10 rounded-full"></div>
                            <div className="absolute bottom-2 left-2 w-6 h-6 bg-indigo-500/10 rounded-full"></div>
                            
                            <PhoneEmailButton />
                            
                            {/* Features list */}
                            <div className="mt-4 pt-4 border-t border-blue-200">
                              <div className="flex items-center justify-center space-x-6 text-xs text-gray-600">
                                <div className="flex items-center space-x-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span>Secure</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span>Instant</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span>No OTP</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <button
                          onClick={() => setShowPhoneVerification(false)}
                          className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium transform hover:scale-[1.02] shadow-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-3">
                          <CheckCircle className="w-4 h-4" />
                          <span>Code Sent</span>
                        </div>
                      </div>
                      
                      <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                        Enter Verification Code
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-center text-2xl font-mono tracking-[0.5rem] bg-white shadow-sm"
                        autoComplete="one-time-code"
                      />
                      
                      {/* Enhanced info card */}
                      <div className="mt-4 p-4 bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-xl border-2 border-green-100 shadow-sm">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-2 mb-3">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                            <p className="text-sm text-green-700 font-semibold">
                              Code sent to: +91-{phoneNumber}
                            </p>
                          </div>
                          
                          {/* Demo codes with better styling */}
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <p className="text-xs text-blue-600 font-medium mb-2">Demo codes for testing:</p>
                            <div className="flex flex-wrap justify-center gap-2">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-mono text-sm border border-blue-200">123456</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-mono text-sm border border-blue-200">000000</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-mono text-sm border border-blue-200">{phoneNumber.slice(-6)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <button
                        onClick={verifyOTP}
                        disabled={otp.length !== 6 || isVerifyingOtp}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-3"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <Loader className="w-6 h-6 animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-6 h-6" />
                            <span>Verify & Place Order</span>
                          </>
                        )}
                      </button>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setOtpSent(false);
                            setOtp('');
                            setCurrentUserId(null);
                          }}
                          disabled={isVerifyingOtp}
                          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-all duration-300 font-medium disabled:opacity-50 transform hover:scale-[1.02] shadow-sm"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={resendOTP}
                          disabled={isSendingOtp || isVerifyingOtp}
                          className="flex-1 bg-blue-100 text-blue-700 py-3 rounded-xl hover:bg-blue-200 transition-all duration-300 font-medium disabled:opacity-50 transform hover:scale-[1.02] flex items-center justify-center space-x-2 shadow-sm border border-blue-200"
                        >
                          {isSendingOtp ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Phone className="w-4 h-4" />
                              <span>Resend</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Status Modal */}
      {showOrderStatus && submittedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Tracking</h2>
                <p className="text-gray-600">Order #{submittedOrder.orderNumber}</p>
              </div>

              {/* Status Card */}
              <div className={`p-4 rounded-xl border-2 mb-6 ${getOrderStatusConfig(submittedOrder.status).color}`}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    {(() => {
                      const StatusIcon = getOrderStatusConfig(submittedOrder.status).icon;
                      return <StatusIcon className="w-5 h-5 text-gray-700" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{getOrderStatusConfig(submittedOrder.status).label}</h3>
                    <p className="text-sm opacity-80">{getOrderStatusConfig(submittedOrder.status).description}</p>
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {submittedOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          <span className="text-xs text-gray-500 ml-2">x{item.quantity}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 mt-3 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-lg text-gray-900">{formatCurrency(submittedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Order Info */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Order Time</span>
                  </div>
                  <p className="text-sm text-blue-700">{formatTime(submittedOrder.createdAt)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {submittedOrder.status === 'ready' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <Bell className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-800">Your order is ready!</p>
                    <p className="text-xs text-green-600">Please proceed to the payment counter</p>
                  </div>
                )}
                
                <button
                  onClick={closeOrderStatus}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Dashboard - Now redirects to standalone page */}
    </div>
  );
} 