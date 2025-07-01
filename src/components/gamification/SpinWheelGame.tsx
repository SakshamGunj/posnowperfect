import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Gift,
  User,
  XCircle,
  RotateCcw,
  Star,
  Trophy,
  Ticket,
  Copy,
  Zap,
  X,
  Lock,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  Phone,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';

import { SpinWheelConfig, SpinWheelSegment, CustomerSpin, GamificationUser, LoginCredentials, RegisterData } from '@/types';
import { GamificationService } from '@/services/gamificationService';
import { userAuthService } from '@/services/userAuthService';
import { GamificationIntegrationService } from '@/services/gamificationIntegrationService';
import { CustomerService } from '@/services/customerService';

// Extend window for phone.email
declare global {
  interface Window {
    phoneEmailListener?: (userObj: any) => void;
  }
}

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
      document.head.removeChild(script);
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

interface LoginForm {
  phoneOrEmail: string;
  password: string;
}

interface RegisterForm {
  name: string;
  phone: string;
  email?: string;
  password: string;
  confirmPassword: string;
}

interface VerificationForm {
  code: string;
}

interface RewardClaimForm {
  name: string;
}

interface SpinWheelGameProps {
  wheelConfig: SpinWheelConfig;
  restaurantName: string;
  onSpinComplete?: (result: CustomerSpin) => void;
  currentSlug?: string; // Add current slug prop
}

export default function SpinWheelGame({ wheelConfig, restaurantName, onSpinComplete, currentSlug }: SpinWheelGameProps) {
  // Game state
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinWheelSegment | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [canSpin, setCanSpin] = useState(true);
  const [remainingSpins, setRemainingSpins] = useState(wheelConfig.maxSpinsPerCustomer);
  const [rotation, setRotation] = useState(0);
  const [isClaimed, setIsClaimed] = useState(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [currentSpinRecord, setCurrentSpinRecord] = useState<CustomerSpin | null>(null);
  const [showFireworks, setShowFireworks] = useState(false);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<GamificationUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'verify'>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [deviceFingerprint] = useState<string>('');

  // Phone authentication state (new)
  const [showPhoneAuthModal, setShowPhoneAuthModal] = useState(false);
  const [phoneAuthUser, setPhoneAuthUser] = useState<any>(null);
  const [isPhoneAuthenticated, setIsPhoneAuthenticated] = useState(false);

  // Reward claim state (new)
  const [showRewardClaimModal, setShowRewardClaimModal] = useState(false);
  const [rewardClaimData, setRewardClaimData] = useState<any>(null);
  const [isClaimingReward, setIsClaimingReward] = useState(false);

  // User Dashboard state
  const [showUserDashboard, setShowUserDashboard] = useState(false);
  const [userSpinHistory, setUserSpinHistory] = useState<any[]>([]);
  const [userLoyaltyInfo, setUserLoyaltyInfo] = useState<any>(null);
  const [userCoupons, setUserCoupons] = useState<any[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [selectedSpin, setSelectedSpin] = useState<any>(null);

  const wheelRef = useRef<HTMLDivElement>(null);
  const { register: registerLogin, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors }, reset: resetLogin } = useForm<LoginForm>();
  const { register: registerSignup, handleSubmit: handleSignupSubmit, formState: { errors: signupErrors }, reset: resetSignup } = useForm<RegisterForm>();
  const { register: registerVerify, handleSubmit: handleVerifySubmit, formState: { errors: verifyErrors }, reset: resetVerify } = useForm<VerificationForm>();
  const { register: registerRewardClaim, handleSubmit: handleRewardClaimSubmit, formState: { errors: rewardClaimErrors }, reset: resetRewardClaim } = useForm<RewardClaimForm>();

  // Initialize authentication and check spin limits
  useEffect(() => {
    initializePhoneAuth();
    
    // Set up global phone email listener
    window.phoneEmailListener = handlePhoneAuthSuccess;
    
    // Add detailed logging for wheel configuration
    console.log('🎯 Spin Wheel Configuration Loaded:', {
      wheelId: wheelConfig.id,
      wheelName: wheelConfig.name,
      maxSpinsPerCustomer: wheelConfig.maxSpinsPerCustomer,
      maxSpinsType: typeof wheelConfig.maxSpinsPerCustomer,
      maxSpinsConverted: Number(wheelConfig.maxSpinsPerCustomer),
      isUnlimited: Number(wheelConfig.maxSpinsPerCustomer) === 0,
      isActive: wheelConfig.isActive,
      restaurantId: wheelConfig.restaurantId
    });
    
    return () => {
      // Cleanup
      if (window.phoneEmailListener) {
        delete window.phoneEmailListener;
      }
    };
  }, [wheelConfig]);

  useEffect(() => {
    if ((isAuthenticated && currentUser) || (isPhoneAuthenticated && phoneAuthUser)) {
      checkSpinLimit();
      loadInitialLoyaltyInfo();
      // Load dashboard data immediately when user is authenticated
      loadUserDashboard();
    }
  }, [isAuthenticated, currentUser, isPhoneAuthenticated, phoneAuthUser]);

  // Track spin history changes for debugging
  useEffect(() => {
    console.log('🎯 User spin history changed:', {
      count: userSpinHistory.length,
      history: userSpinHistory.map(spin => ({ id: spin.id, timestamp: spin.timestamp }))
    });
  }, [userSpinHistory]);

  const loadInitialLoyaltyInfo = async () => {
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    const authenticated = isPhoneAuthenticated || isAuthenticated;
    
    if (!user || !authenticated || !wheelConfig.pointsConfig?.enabled) return;

    try {
      const userPhone = phoneAuthUser ? phoneAuthUser.phone : currentUser?.phone;
      if (!userPhone) return;
      
      const loyaltyResult = await GamificationIntegrationService.getCustomerLoyaltyInfo(
        wheelConfig.restaurantId,
        userPhone
      );

      if (loyaltyResult.success && loyaltyResult.data) {
        setUserLoyaltyInfo(loyaltyResult.data.loyaltyInfo);
      }
    } catch (error) {
      console.error('Error loading initial loyalty info:', error);
    }
  };

  // Initialize phone authentication (new)
  const initializePhoneAuth = async () => {
    // Check if user is already phone authenticated (stored in localStorage)
    const storedPhoneUser = localStorage.getItem('spinWheelPhoneUser');
    
    if (storedPhoneUser) {
      try {
        const userData = JSON.parse(storedPhoneUser);
        // Check if the data is still valid (less than 24 hours old)
        const lastAuth = new Date(userData.lastAuthenticated);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastAuth.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          setPhoneAuthUser(userData);
          setIsPhoneAuthenticated(true);
          return;
        }
      } catch (error) {
        console.error('Error restoring phone auth session:', error);
      }
    }

    // Clear invalid stored data and show phone auth modal
    localStorage.removeItem('spinWheelPhoneUser');
    setShowPhoneAuthModal(true);
  };

  // Phone authentication success handler (new)
  const handlePhoneAuthSuccess = async (userObj: any) => {
    try {
      const response = await fetch(userObj.user_json_url);
      const data = await response.json();

      let phoneUserData = {
        country_code: data.user_country_code,
        phone: data.user_phone_number,
        firstName: data.user_first_name,
        lastName: data.user_last_name,
        fullName: `${data.user_first_name || ''} ${data.user_last_name || ''}`.trim(),
        lastAuthenticated: new Date().toISOString()
      };

      // Check if user already exists in database and get their saved name
      try {
        // First check CRM for existing customer with better name
        const existingCustomers = await CustomerService.searchCustomers(wheelConfig.restaurantId, phoneUserData.phone);
        if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
          const customer = existingCustomers.data[0];
          if (customer.name && customer.name !== 'Spin Wheel User' && customer.name.trim() !== '') {
            console.log('Found existing customer with name:', customer.name);
            phoneUserData.fullName = customer.name;
            const nameParts = customer.name.split(' ');
            phoneUserData.firstName = nameParts[0] || phoneUserData.firstName;
            phoneUserData.lastName = nameParts.slice(1).join(' ') || phoneUserData.lastName;
          }
        }

        // Also check Gamification Users collection
        const existingGamUser = await userAuthService.getUserByPhone(wheelConfig.restaurantId, phoneUserData.phone);
        if (existingGamUser && existingGamUser.name && existingGamUser.name !== 'Spin Wheel User' && existingGamUser.name.trim() !== '') {
          console.log('Found existing gamification user with name:', existingGamUser.name);
          phoneUserData.fullName = existingGamUser.name;
          const nameParts = existingGamUser.name.split(' ');
          phoneUserData.firstName = nameParts[0] || phoneUserData.firstName;
          phoneUserData.lastName = nameParts.slice(1).join(' ') || phoneUserData.lastName;
        }
      } catch (dbError) {
        console.log('Could not fetch existing user data:', dbError);
        // Continue with phone.email data if database lookup fails
      }

      // If still no proper name, set a default
      if (!phoneUserData.fullName || phoneUserData.fullName.trim() === '') {
        phoneUserData.fullName = 'Spin Wheel User';
      }

      // Save to localStorage
      localStorage.setItem('spinWheelPhoneUser', JSON.stringify(phoneUserData));
      
      // Save to CRM (this will handle existing users appropriately)
      await saveUserToCRM(phoneUserData);
      
      setPhoneAuthUser(phoneUserData);
      setIsPhoneAuthenticated(true);
      setShowPhoneAuthModal(false);
      
      console.log("Phone verified successfully:", phoneUserData);
      toast.success(`Welcome back ${phoneUserData.fullName}! 🎉`);
      
    } catch (error) {
      console.error("Phone verification failed:", error);
      toast.error("Phone verification failed. Please try again.");
    }
  };

  // Save user to CRM and Gamification Users (new)
  const saveUserToCRM = async (phoneUserData: any) => {
    try {
      const customerData = {
        name: phoneUserData.fullName || 'Spin Wheel User',
        phone: phoneUserData.phone,
        email: '', // Email not provided by phone.email initially
        address: '',
        preferences: ['spin_wheel_user'],
        totalSpent: 0,
        visitCount: 1,
        lastVisit: new Date()
      };

      // Check if customer already exists in CRM
      const existingCustomers = await CustomerService.searchCustomers(wheelConfig.restaurantId, phoneUserData.phone);
      
      if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
        const existingCustomer = existingCustomers.data[0];
        console.log('Customer already exists in CRM:', existingCustomer);
        
        // Update last visit and visit count
        const updatedData = {
          ...existingCustomer,
          lastVisit: new Date(),
          visitCount: (existingCustomer.visitCount || 0) + 1,
          // Only update name if the new name is better (not default)
          name: (phoneUserData.fullName && phoneUserData.fullName !== 'Spin Wheel User') 
                ? phoneUserData.fullName 
                : existingCustomer.name
        };
        
        const updateResult = await CustomerService.updateCustomer(existingCustomer.id, wheelConfig.restaurantId, updatedData);
        if (updateResult.success) {
          console.log('Customer updated in CRM:', updateResult.data);
        }
      } else {
        // Create new customer in CRM
        const result = await CustomerService.createCustomer(wheelConfig.restaurantId, customerData);
        if (result.success) {
          console.log('User saved to CRM successfully:', result.data);
        } else {
          console.error('Failed to save user to CRM:', result.error);
        }
      }

      // Also save to Gamification Users collection
      await saveToGamificationUsers(phoneUserData);
      
    } catch (error) {
      console.error('Error saving user to CRM:', error);
    }
  };

  // Save user to Gamification Users collection (new)
  const saveToGamificationUsers = async (phoneUserData: any) => {
    try {
      // Check if gamification user already exists
      const existingGamUser = await userAuthService.getUserByPhone(wheelConfig.restaurantId, phoneUserData.phone);
      
      if (existingGamUser) {
        console.log('Gamification user already exists:', existingGamUser);
        
        // Update last login time and name if we have a better one
        try {
          const updateData = {
            lastLoginAt: new Date(),
            // Only update name if the new name is better (not default)
            name: (phoneUserData.fullName && phoneUserData.fullName !== 'Spin Wheel User') 
                  ? phoneUserData.fullName 
                  : existingGamUser.name
          };
          
          // Update the existing user (assuming there's an update method)
          if (userAuthService.updateUser) {
            await userAuthService.updateUser(wheelConfig.restaurantId, existingGamUser.id, updateData);
            console.log('Updated existing gamification user login time and name');
          }
        } catch (updateError) {
          console.log('Could not update existing gamification user:', updateError);
        }
        
          return;
        }

      // Create new gamification user with phone authentication
      const gamUserData: Partial<GamificationUser> = {
        restaurantId: wheelConfig.restaurantId,
        name: phoneUserData.fullName || 'Spin Wheel User',
        phone: phoneUserData.phone,
        email: '',
        passwordHash: 'phone_auth_user', // Special marker for phone-authenticated users
        isVerified: true,
        phoneVerified: true,
        emailVerified: false,
        isBlocked: false,
        totalSpins: 0,
        totalWins: 0,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        deviceFingerprint: `phone_${phoneUserData.phone}`,
        ipAddress: 'unknown'
      };

      const result = await userAuthService.createPhoneAuthUser(wheelConfig.restaurantId, gamUserData);
      if (result.success) {
        console.log('User saved to Gamification Users successfully:', result.user);
      } else {
        console.error('Failed to save user to Gamification Users:', result.message);
        }
      } catch (error) {
      console.error('Error saving user to Gamification Users:', error);
      }
  };

  // Handle claim reward
  const handleClaimReward = async () => {
    console.log('🎁 Claim Reward clicked! Debug info:', {
      spinResult,
      currentSpinRecord,
      phoneAuthUser,
      currentUser,
      isClaimingReward,
      isClaimed
    });
    
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    
    if (!spinResult || !currentSpinRecord || !user) {
      console.log('❌ Early return - missing required data:', {
        hasSpinResult: !!spinResult,
        hasCurrentSpinRecord: !!currentSpinRecord,
        hasUser: !!user
      });
      return;
    }
    
    // Check if it's a "Better Luck" or losing segment
    const isWinning = !(spinResult.rewardType === 'custom' && spinResult.label.toLowerCase().includes('luck'));
    
    console.log('🎯 Reward claim check:', {
      isWinning,
      rewardType: spinResult.rewardType,
      label: spinResult.label,
      labelLowerCase: spinResult.label.toLowerCase(),
      includesLuck: spinResult.label.toLowerCase().includes('luck')
    });
    
    if (!isWinning) {
      console.log('❌ Not a winning segment');
      toast.error('No reward to claim. Better luck next time!');
      return;
    }

    console.log('✅ Starting reward claim process...');
    
    // Loading animation is already started by button click
    
    // Force a render cycle to ensure the loading state is shown
    await new Promise(resolve => {
      // Use requestAnimationFrame to ensure the DOM is updated
      requestAnimationFrame(() => {
        // Wait another frame to be absolutely sure
        requestAnimationFrame(() => {
          setTimeout(resolve, 1000); // 1 second to let users see the animation
        });
      });
    });

    try {
      // Generate coupon code for instant feedback
      const newCouponCode = generateCouponCode();
      
      // Set the coupon code and claimed state after animation
      setCouponCode(newCouponCode);
      setIsClaimed(true);
      
      // Show immediate success feedback
      toast.success('🎉 Reward claimed! Processing...');

      // For phone auth users without a name, use a default name or phone number
      let customerName = '';
      if (phoneAuthUser) {
        customerName = phoneAuthUser.fullName || phoneAuthUser.firstName || `Customer ${phoneAuthUser.phone.slice(-4)}`;
      } else if (currentUser) {
        customerName = currentUser.name || 'User';
      }

      // Process the reward claim in the background
      await processRewardClaim(customerName, newCouponCode);

    } catch (error) {
      console.error('Error in claim process:', error);
      // If there's an error, revert the state
      setIsClaimed(false);
      setCouponCode('');
      toast.error('Failed to claim reward. Please try again.');
    } finally {
      setIsClaimingReward(false);
    }
  };

  // Update customer name in CRM (new)
  const updateCustomerName = async (phone: string, name: string) => {
    try {
      const existingCustomers = await CustomerService.searchCustomers(wheelConfig.restaurantId, phone);
      
      if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];
        const updatedData = {
          ...customer,
          name: name
        };
        
        const result = await CustomerService.updateCustomer(customer.id, wheelConfig.restaurantId, updatedData);
        if (result.success) {
          console.log('Customer name updated in CRM:', result.data);
        }
      }
    } catch (error) {
      console.error('Error updating customer name:', error);
    }
  };

  const checkSpinLimit = async () => {
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    const authenticated = isPhoneAuthenticated || isAuthenticated;
    
    if (!user || !authenticated) return;
    
    // Handle unlimited spins properly - check for both string "0" and number 0
    const maxSpins = Number(wheelConfig.maxSpinsPerCustomer);
    if (maxSpins === 0) {
      setCanSpin(true);
      setRemainingSpins(999); // Set a high number for unlimited display
      console.log('📊 Unlimited spins enabled for wheel:', wheelConfig.id);
      return;
    }

    try {
      const userPhone = phoneAuthUser ? phoneAuthUser.phone : currentUser?.phone;
      if (!userPhone) return;
      
      // Use the new simpler method with specific spin wheel ID to avoid counting old wheel spins
      const result = await GamificationService.getCustomerSpinsCountToday(wheelConfig.restaurantId, userPhone, wheelConfig.id);
      if (result.success && typeof result.data === 'number') {
        const spinsToday = result.data;
        const remaining = Math.max(0, maxSpins - spinsToday);
        setRemainingSpins(remaining);
        setCanSpin(remaining > 0);
        
        console.log('📊 Spin limit check:', {
          userPhone,
          spinWheelId: wheelConfig.id,
          spinsToday,
          maxAllowed: maxSpins,
          maxAllowedOriginal: wheelConfig.maxSpinsPerCustomer,
          maxAllowedType: typeof wheelConfig.maxSpinsPerCustomer,
          remaining,
          canSpin: remaining > 0
        });
      }
    } catch (error) {
      console.error('Error checking spin limit:', error);
      // Fallback to unlimited spins on error
      setRemainingSpins(maxSpins || 999);
      setCanSpin(true);
    }
  };

  const selectRandomSegment = (): SpinWheelSegment => {
    const totalWeight = wheelConfig.segments.reduce((sum, segment) => sum + segment.probability, 0);
    let random = Math.random() * totalWeight;
    
    for (const segment of wheelConfig.segments) {
      random -= segment.probability;
      if (random <= 0) {
        return segment;
      }
    }
    
    return wheelConfig.segments[0]; // Fallback
  };

  const calculateRotation = (targetSegment: SpinWheelSegment): number => {
    const segmentIndex = wheelConfig.segments.findIndex(s => s.id === targetSegment.id);
    const segmentAngle = 360 / wheelConfig.segments.length;
    const targetAngle = segmentIndex * segmentAngle;
    
    // Add multiple full rotations for dramatic effect
    const fullRotations = 8 + Math.random() * 5; // 8-13 full rotations for more excitement
    const finalRotation = (fullRotations * 360) + (360 - targetAngle);
    
    return finalRotation;
  };

  const generateCouponCode = (): string => {
    const prefix = wheelConfig.name.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  // Authentication handlers
  const handleLogin = async (data: LoginForm) => {
    if (!isAuthenticated) {
      setIsAuthLoading(true);
      try {
        const credentials: LoginCredentials = {
          phoneOrEmail: data.phoneOrEmail,
          password: data.password,
          deviceFingerprint
        };

        const result = await userAuthService.loginUser(wheelConfig.restaurantId, credentials);
        
        if (result.success && result.user) {
          if (result.requiresVerification) {
            setCurrentUser(result.user);
            setAuthMode('verify');
            toast.error(result.message || 'Please verify your account');
          } else {
            setCurrentUser(result.user);
            setIsAuthenticated(true);
            setShowAuthModal(false);
            
            // Store session
            localStorage.setItem('gamificationUserId', result.user.id);
            localStorage.setItem('gamificationToken', result.token || 'logged-in');
            
            toast.success('Welcome back! 🎉');
            resetLogin();
          }
        } else {
          toast.error(result.message || 'Login failed');
        }
      } catch (error) {
        toast.error('Login failed. Please try again.');
      } finally {
        setIsAuthLoading(false);
      }
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsAuthLoading(true);
    try {
      const registerData: RegisterData = {
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        deviceFingerprint
      };

      const result = await userAuthService.registerUser(wheelConfig.restaurantId, registerData);
      
      if (result.success && result.user) {
        setCurrentUser(result.user);
        
        if (result.requiresVerification) {
          setAuthMode('verify');
          toast.success('Account created! Please verify your phone number.');
        } else {
          setIsAuthenticated(true);
          setShowAuthModal(false);
          
          // Store session
          localStorage.setItem('gamificationUserId', result.user.id);
          localStorage.setItem('gamificationToken', result.token || 'logged-in');
          
          toast.success('Account created successfully! 🎉');
          resetSignup();
        }
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerify = async (data: VerificationForm) => {
    if (!currentUser) return;
    
    setIsAuthLoading(true);
    try {
      const result = await userAuthService.verifyUser({
        userId: currentUser.id,
        restaurantId: wheelConfig.restaurantId,
        code: data.code,
        type: 'phone'
      });
      
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        setShowAuthModal(false);
        
        // Store session
        localStorage.setItem('gamificationUserId', result.user.id);
        localStorage.setItem('gamificationToken', 'verified');
        
        toast.success('Phone verified successfully! 🎉');
        resetVerify();
      } else {
        toast.error(result.message || 'Verification failed');
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!currentUser) return;
    
    try {
      const result = await userAuthService.resendVerificationCode(wheelConfig.restaurantId, currentUser.id, 'phone');
      if (result.success) {
        toast.success(result.message || 'Verification code sent successfully');
      } else {
        toast.error(result.message || 'Failed to send verification code');
      }
    } catch (error) {
      toast.error('Failed to resend code');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowAuthModal(true);
    
    // Clear session
    localStorage.removeItem('gamificationUserId');
    localStorage.removeItem('gamificationToken');
    
    // Reset game state
    setHasSpun(false);
    setSpinResult(null);
    setIsClaimed(false);
    setCouponCode('');
    setCurrentSpinRecord(null);
    setShowFireworks(false);
    setShowResultModal(false);
    
    toast.success('Logged out successfully');
  };

  const handleSpin = () => {
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    const authenticated = isPhoneAuthenticated || isAuthenticated;
    
    if (!canSpin || isSpinning || !authenticated || !user) return;

    const selectedSegment = selectRandomSegment();
    const finalRotation = rotation + calculateRotation(selectedSegment);
    
    setIsSpinning(true);
    setRotation(finalRotation);

    // Simulate spin duration with excitement buildup
    setTimeout(async () => {
      setIsSpinning(false);
      setHasSpun(true);
      setSpinResult(selectedSegment);
      setShowResultModal(true); // Show result modal immediately

      // Show fireworks for winning spins
      const isWinning = !(selectedSegment.rewardType === 'custom' && selectedSegment.label.toLowerCase().includes('luck'));
      if (isWinning) {
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 3000);
      }

      // Record the spin with user information
      try {
        const spinData = {
          restaurantId: wheelConfig.restaurantId,
          spinWheelId: wheelConfig.id,
          customerId: phoneAuthUser ? `phone_user_${phoneAuthUser.phone}` : currentUser?.id || 'unknown',
          customerName: phoneAuthUser ? (phoneAuthUser.fullName || 'Spin Wheel User') : (currentUser?.name || 'User'),
          customerPhone: phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || ''),
          customerEmail: phoneAuthUser ? '' : (currentUser?.email || ''),
          resultSegmentId: selectedSegment.id,
          resultMessage: selectedSegment.value,
          isRedeemed: false,
          ipAddress: 'unknown',
        };

        const result = await GamificationService.recordCustomerSpin(spinData);
        if (result.success && result.data) {
          setCurrentSpinRecord(result.data);
          onSpinComplete?.(result.data);
          setRemainingSpins(prev => Math.max(0, prev - 1));
          setCanSpin(remainingSpins - 1 > 0);
          
          // 🔄 IMMEDIATE DASHBOARD REFRESH - Update spin count in header immediately
          setTimeout(() => {
            loadUserDashboard();
          }, 100); // Very quick refresh to update the header stats
          
          // 🎯 AUTO-CLAIM WINNING REWARDS - Process reward automatically for winning spins
          if (isWinning) {
            // Check if user needs to provide name for phone auth
            if (phoneAuthUser && !phoneAuthUser.fullName) {
              setRewardClaimData({
                spinResult: selectedSegment,
                spinRecord: result.data,
                couponCode: generateCouponCode()
              });
              setShowRewardClaimModal(true);
            } else {
              // Auto-process the reward claim with loading animation
              // Start loading animation immediately, then process after delay
              setTimeout(() => {
                setIsClaimingReward(true);
                console.log('🎯 Auto-processing reward claim after spin...');
              }, 100); // Start loading animation almost immediately
              
              // Capture the required data at this moment to avoid null references later
              setTimeout(async () => {
                await handleAutoClaimReward(selectedSegment, result.data);
              }, 1000); // 1 second delay to let user see the result modal
            }
          }
          
          // Refresh loyalty info if points were earned
          if (wheelConfig.pointsConfig?.enabled) {
            setTimeout(() => loadInitialLoyaltyInfo(), 500); // Reduced delay to ensure points are processed
          }
          
          // Refresh dashboard data if dashboard is open
          if (showUserDashboard) {
            setTimeout(() => {
          console.log('🔄 Triggering dashboard refresh after spin...');
          loadUserDashboard();
        }, 200); // Faster refresh after spin
          }
        }
      } catch (error) {
        console.error('Error recording spin:', error);
      }
    }, 2500); // 2.5 second spin duration for optimal balance of excitement and speed
  };

  // Auto-claim reward function (called automatically after winning spins)
  const handleAutoClaimReward = async (capturedSpinResult?: SpinWheelSegment, capturedSpinRecord?: CustomerSpin) => {
    // Use captured data or fallback to state
    const finalSpinResult = capturedSpinResult || spinResult;
    const finalSpinRecord = capturedSpinRecord || currentSpinRecord;
    
    console.log('🎁 Auto-claim reward triggered! Debug info:', {
      capturedSpinResult,
      capturedSpinRecord,
      finalSpinResult,
      finalSpinRecord,
      phoneAuthUser,
      currentUser,
      isClaimingReward,
      isClaimed
    });
    
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    
    if (!finalSpinResult || !finalSpinRecord || !user) {
      console.log('❌ Early return - missing required data:', {
        hasFinalSpinResult: !!finalSpinResult,
        hasFinalSpinRecord: !!finalSpinRecord,
        hasUser: !!user
      });
      return;
    }
    
    // Check if it's a "Better Luck" or losing segment
    const isWinning = !(finalSpinResult.rewardType === 'custom' && finalSpinResult.label.toLowerCase().includes('luck'));
    
    console.log('🎯 Auto reward claim check:', {
      isWinning,
      rewardType: finalSpinResult.rewardType,
      label: finalSpinResult.label,
      labelLowerCase: finalSpinResult.label.toLowerCase(),
      includesLuck: finalSpinResult.label.toLowerCase().includes('luck')
    });
    
    if (!isWinning) {
      console.log('❌ Not a winning segment');
      return;
    }

    console.log('✅ Starting auto reward claim process...');
    
    // Update state to reflect the captured data
    if (capturedSpinResult) setSpinResult(capturedSpinResult);
    if (capturedSpinRecord) setCurrentSpinRecord(capturedSpinRecord);
    
    // Loading animation is already started, just add a processing delay
    // Force a render cycle to ensure the loading state is shown
    await new Promise(resolve => {
      // Use requestAnimationFrame to ensure the DOM is updated
      requestAnimationFrame(() => {
        // Wait another frame to be absolutely sure
        requestAnimationFrame(() => {
          setTimeout(resolve, 1000); // 1 second processing animation (reduced since loading already started)
        });
      });
    });

    try {
      // Generate coupon code for instant feedback
      const newCouponCode = generateCouponCode();
      
      // Set the coupon code and claimed state after animation
      setCouponCode(newCouponCode);
      setIsClaimed(true);
      
      // Show immediate success feedback
      toast.success('🎉 Reward claimed! Processing...');

      // For phone auth users without a name, use a default name or phone number
      let customerName = '';
      if (phoneAuthUser) {
        customerName = phoneAuthUser.fullName || phoneAuthUser.firstName || `Customer ${phoneAuthUser.phone.slice(-4)}`;
      } else if (currentUser) {
        customerName = currentUser.name || 'User';
      }

      // Process the reward claim in the background using the captured data
      await processRewardClaimWithData(customerName, newCouponCode, finalSpinResult, finalSpinRecord);

    } catch (error) {
      console.error('Error in auto-claim process:', error);
      // If there's an error, revert the state
      setIsClaimed(false);
      setCouponCode('');
      toast.error('Failed to claim reward. Please try again.');
    } finally {
      setIsClaimingReward(false);
      // Force dashboard refresh to update spin count
      console.log('🔄 Auto-claim complete, refreshing dashboard...');
      setTimeout(() => loadUserDashboard(), 100);
    }
  };

  // Handle reward claim form submission (for the modal)
  const handleRewardClaim = async (data: RewardClaimForm) => {
    if (!rewardClaimData || !phoneAuthUser) return;

    try {
      // Close the modal first
      setShowRewardClaimModal(false);
      resetRewardClaim();

      // Process the reward claim with the provided name
      await processRewardClaim(data.name);

    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward. Please try again.');
    }
  };

  // Process reward claim with explicit data (for auto-claim)
  const processRewardClaimWithData = async (customerName?: string, providedCouponCode?: string, finalSpinResult?: SpinWheelSegment, finalSpinRecord?: CustomerSpin) => {
    const user = phoneAuthUser || currentUser;
    if (!finalSpinResult || !finalSpinRecord || !user) return;

    try {
      // Use provided coupon code or generate a new one
      const newCouponCode = providedCouponCode || generateCouponCode();
      
      // Use provided name or existing user name
      const finalCustomerName = customerName || 
        (phoneAuthUser ? phoneAuthUser.fullName : currentUser?.name) || 'User';
      
      // Step 1: Update the spin record with coupon code
      const claimResult = await GamificationService.claimSpinReward(
        wheelConfig.restaurantId,
        finalSpinRecord.id,
        {
          customerName: finalCustomerName,
          customerPhone: phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || ''),
          customerEmail: phoneAuthUser ? '' : (currentUser?.email || ''),
          couponCode: newCouponCode,
        }
      );

      if (claimResult.success) {
        // Step 2: For phone users, create a simplified user object for integration
        let userForIntegration: GamificationUser;
        
        if (phoneAuthUser) {
          userForIntegration = {
            id: `phone_user_${phoneAuthUser.phone}`,
            restaurantId: wheelConfig.restaurantId,
            name: finalCustomerName,
            phone: phoneAuthUser.phone,
            email: '',
            passwordHash: '',
            isVerified: true,
            phoneVerified: true,
            emailVerified: false,
            isBlocked: false,
            totalSpins: 0,
            totalWins: 0,
            createdAt: new Date(),
            lastLoginAt: new Date()
          } as GamificationUser;
        } else if (currentUser) {
          userForIntegration = currentUser;
        } else {
          toast.error('User information not available');
          return;
        }
        
        // Step 3: Integrate with CRM and Coupon systems
        const integrationResult = await GamificationIntegrationService.integrateSpinReward(
          wheelConfig.restaurantId,
          userForIntegration,
          finalSpinResult,
          newCouponCode,
          finalSpinRecord
        );

        if (integrationResult.success) {
          toast.success('🎉 Reward processed and added to systems!');
          console.log('✅ Customer added to CRM and coupon created in coupon dashboard');
        } else {
          // Claim succeeded but integration failed - still show success to user
          toast.success('🎉 Reward processed successfully!');
          console.warn('⚠️ Integration with CRM/Coupon system failed:', integrationResult.error);
        }

        // If customer name was provided, update the phone user data
        if (customerName && phoneAuthUser) {
          const updatedPhoneUser = {
            ...phoneAuthUser,
            fullName: customerName,
            firstName: customerName.split(' ')[0] || '',
            lastName: customerName.split(' ').slice(1).join(' ') || ''
          };
          localStorage.setItem('spinWheelPhoneUser', JSON.stringify(updatedPhoneUser));
          setPhoneAuthUser(updatedPhoneUser);
          
          // Update CRM with name
          await updateCustomerName(phoneAuthUser.phone, customerName);
        }
      } else {
        toast.error('Failed to claim reward. Please try again.');
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Something went wrong. Please try again.');
      throw error; // Re-throw so handleClaimReward can handle it
    }
  };

  const processRewardClaim = async (customerName?: string, providedCouponCode?: string) => {
    const user = phoneAuthUser || currentUser;
    if (!spinResult || !currentSpinRecord || !user) return;

    try {
      // Use provided coupon code or generate a new one
      const newCouponCode = providedCouponCode || generateCouponCode();
      
      // Use provided name or existing user name
      const finalCustomerName = customerName || 
        (phoneAuthUser ? phoneAuthUser.fullName : currentUser?.name) || 'User';
      
      // Step 1: Update the spin record with coupon code
      const claimResult = await GamificationService.claimSpinReward(
        wheelConfig.restaurantId,
        currentSpinRecord.id,
        {
          customerName: finalCustomerName,
          customerPhone: phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || ''),
          customerEmail: phoneAuthUser ? '' : (currentUser?.email || ''),
          couponCode: newCouponCode,
        }
      );

      if (claimResult.success) {
        // Step 2: For phone users, create a simplified user object for integration
        let userForIntegration: GamificationUser;
        
        if (phoneAuthUser) {
          userForIntegration = {
            id: `phone_user_${phoneAuthUser.phone}`,
            restaurantId: wheelConfig.restaurantId,
            name: finalCustomerName,
            phone: phoneAuthUser.phone,
            email: '',
            passwordHash: '',
            isVerified: true,
            phoneVerified: true,
            emailVerified: false,
            isBlocked: false,
            totalSpins: 0,
            totalWins: 0,
            createdAt: new Date(),
            lastLoginAt: new Date()
          } as GamificationUser;
        } else if (currentUser) {
          userForIntegration = currentUser;
        } else {
          toast.error('User information not available');
          return;
        }
        
        // Step 3: Integrate with CRM and Coupon systems
        const integrationResult = await GamificationIntegrationService.integrateSpinReward(
          wheelConfig.restaurantId,
          userForIntegration,
          spinResult,
          newCouponCode,
          currentSpinRecord
        );

        if (integrationResult.success) {
          toast.success('🎉 Reward processed and added to systems!');
          console.log('✅ Customer added to CRM and coupon created in coupon dashboard');
        } else {
          // Claim succeeded but integration failed - still show success to user
          toast.success('🎉 Reward processed successfully!');
          console.warn('⚠️ Integration with CRM/Coupon system failed:', integrationResult.error);
        }

        // If customer name was provided, update the phone user data
        if (customerName && phoneAuthUser) {
          const updatedPhoneUser = {
            ...phoneAuthUser,
            fullName: customerName,
            firstName: customerName.split(' ')[0] || '',
            lastName: customerName.split(' ').slice(1).join(' ') || ''
          };
          localStorage.setItem('spinWheelPhoneUser', JSON.stringify(updatedPhoneUser));
          setPhoneAuthUser(updatedPhoneUser);
          
          // Update CRM with name
          await updateCustomerName(phoneAuthUser.phone, customerName);
        }
      } else {
        toast.error('Failed to claim reward. Please try again.');
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Something went wrong. Please try again.');
      throw error; // Re-throw so handleClaimReward can handle it
    }
  };

  const copyCouponCode = () => {
    navigator.clipboard.writeText(couponCode);
    toast.success('Coupon code copied! 📋');
  };

  const resetSpin = () => {
    setHasSpun(false);
    setSpinResult(null);
    setIsClaimed(false);
    setCouponCode('');
    setCurrentSpinRecord(null);
    setShowFireworks(false);
    setShowResultModal(false);
    checkSpinLimit();
    
    // Refresh dashboard data if dashboard is open
    if (showUserDashboard) {
      loadUserDashboard();
    }
  };

  // Load user dashboard data
  const loadUserDashboard = async () => {
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    const authenticated = isPhoneAuthenticated || isAuthenticated;
    
    if (!user || !authenticated) return;

    setLoadingDashboard(true);
    try {
      const userPhone = phoneAuthUser ? phoneAuthUser.phone : currentUser?.phone;
      
      console.log('🔍 Loading dashboard for user:', {
        phone: userPhone,
        restaurantId: wheelConfig.restaurantId,
        authType: phoneAuthUser ? 'phone' : 'regular'
      });

      // Load spin history
      const spinHistoryResult = await GamificationService.getCustomerSpinsFromRestaurant(
        wheelConfig.restaurantId,
        userPhone
      );

      console.log('🎰 Spin history result:', {
        success: spinHistoryResult.success,
        dataLength: spinHistoryResult.data?.length || 0,
        error: spinHistoryResult.error
      });

      if (spinHistoryResult.success && spinHistoryResult.data) {
        console.log('✅ Setting spin history:', spinHistoryResult.data);
        setUserSpinHistory(spinHistoryResult.data);
        console.log('📊 User spin history updated, count:', spinHistoryResult.data.length);
      } else {
        console.log('❌ No spin history or error:', spinHistoryResult.error);
        setUserSpinHistory([]); // Ensure it's set to empty array
        console.log('📊 User spin history set to empty array');
      }

      // Load loyalty information if points are enabled
      if (wheelConfig.pointsConfig?.enabled) {
        const loyaltyResult = await GamificationIntegrationService.getCustomerLoyaltyInfo(
          wheelConfig.restaurantId,
          userPhone
        );

        if (loyaltyResult.success && loyaltyResult.data) {
          setUserLoyaltyInfo(loyaltyResult.data.loyaltyInfo);
        }
      }

      // Load gamification coupons
      const gamificationResult = await GamificationIntegrationService.getCustomerGamificationHistory(
        wheelConfig.restaurantId,
        userPhone
      );

      console.log('🎟️ Gamification history result:', {
        success: gamificationResult.success,
        dataExists: !!gamificationResult.data,
        spinsCount: gamificationResult.data?.spins?.length || 0,
        couponsCount: gamificationResult.data?.coupons?.length || 0
      });

      if (gamificationResult.success && gamificationResult.data) {
        setUserCoupons(gamificationResult.data.coupons || []);
        
        // Use gamification history as primary source for spins since it's more comprehensive
        if (gamificationResult.data.spins && gamificationResult.data.spins.length > 0) {
          console.log('📝 Using comprehensive gamification history spins');
          setUserSpinHistory(gamificationResult.data.spins);
        } else if (spinHistoryResult.success && spinHistoryResult.data?.length && spinHistoryResult.data.length > 0) {
          console.log('📝 Using direct spin history as fallback');
          setUserSpinHistory(spinHistoryResult.data);
        } else {
          // If no history found but user has spun in current session, show that
          if (currentSpinRecord) {
            console.log('📝 Using current session spin as fallback');
            setUserSpinHistory([currentSpinRecord]);
          } else {
            console.log('📝 No spin history found anywhere');
            setUserSpinHistory([]);
          }
        }
      } else if (spinHistoryResult.success && spinHistoryResult.data?.length && spinHistoryResult.data.length > 0) {
        console.log('📝 Using direct spin history only');
        setUserSpinHistory(spinHistoryResult.data);
      } else {
        // Final fallback - if user has spun in current session
        if (currentSpinRecord) {
          console.log('📝 Final fallback: current session spin');
          setUserSpinHistory([currentSpinRecord]);
        } else {
          console.log('📝 No spin data available');
          setUserSpinHistory([]);
        }
      }

      // Force a re-render by logging final state
      console.log('🎯 Dashboard load complete, final spin count will be:', userSpinHistory.length);

    } catch (error) {
      console.error('Error loading user dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleOpenDashboard = async () => {
    setShowUserDashboard(true);
    await loadUserDashboard();
  };

  // Calculate segment paths for SVG wheel
  const createSegmentPath = (index: number, total: number) => {
    const angle = (2 * Math.PI) / total;
    const startAngle = index * angle - Math.PI / 2;
    const endAngle = (index + 1) * angle - Math.PI / 2;
    
    const radius = 280;
    const centerX = 300;
    const centerY = 300;
    
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);
    
    const largeArcFlag = angle > Math.PI ? 1 : 0;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // Calculate text position and rotation for better readability
  const getTextPosition = (index: number, total: number) => {
    const angle = (2 * Math.PI * index) / total + Math.PI / total - Math.PI / 2;
    const textRadius = 180; // Optimal distance from center for readability
    const x = 300 + textRadius * Math.cos(angle);
    const y = 300 + textRadius * Math.sin(angle);
    const rotation = (360 / total) * index + (360 / total) / 2;
    
    return { x, y, rotation };
  };

  // Format reward text for better display with smart truncation
  const formatRewardText = (segment: SpinWheelSegment) => {
    // Smart text formatting based on reward type
    let displayText = segment.label;
    
    // Remove common unnecessary words for better display
    displayText = displayText
      .replace(/\b(Discount|Off|Free|Get|Win|Prize)\b/gi, '')
      .trim();
    
    // Handle different reward types
    if (segment.rewardType === 'discount_percentage') {
      // Extract percentage from value and use it
      const percentMatch = segment.value.match(/(\d+)%/);
      if (percentMatch) {
        return `${percentMatch[1]}% OFF`;
      }
    } else if (segment.rewardType === 'discount_fixed') {
      // Extract amount from value
      const amountMatch = segment.value.match(/(\d+)/);
      if (amountMatch) {
        return `₹${amountMatch[1]} OFF`;
      }
    } else if (segment.rewardType === 'free_item') {
      return 'FREE ITEM';
    } else if (segment.rewardType === 'points') {
      const pointsMatch = segment.value.match(/(\d+)/);
      if (pointsMatch) {
        return `${pointsMatch[1]} PTS`;
      }
    }
    
    // For custom or other types, use smart truncation
    const maxLength = 10;
    if (displayText.length > maxLength) {
      return displayText.substring(0, maxLength - 1) + '…';
    }
    
    return displayText.toUpperCase();
  };

  // Get optimal font size based on text length and segment count
  const getOptimalFontSize = (text: string, segmentCount: number) => {
    const baseSize = segmentCount <= 6 ? 16 : segmentCount <= 8 ? 14 : 12;
    const lengthModifier = text.length > 8 ? -2 : text.length < 5 ? 2 : 0;
    return Math.max(10, baseSize + lengthModifier);
  };

  // Format subtitle text (reward value) for better display
  const formatSubtitleText = (segment: SpinWheelSegment) => {
    let subtitle = segment.value;
    
    // Clean up common phrases
    subtitle = subtitle
      .replace(/\b(You get|You win|Prize:|Reward:)\b/gi, '')
      .trim();
    
    // Truncate if too long
    const maxLength = 12;
    if (subtitle.length > maxLength) {
      return subtitle.substring(0, maxLength - 1) + '…';
    }
    
    return subtitle;
  };

  const isWinningSegment = spinResult && 
    !(spinResult.rewardType === 'custom' && spinResult.label.toLowerCase().includes('luck')) &&
    !spinResult.noCoupon;

  console.log('🎯 Result Modal Debug:', {
    showResultModal,
    spinResult,
    isWinningSegment,
    isClaimed,
    isClaimingReward,
    spinResultDetails: spinResult ? {
      rewardType: spinResult.rewardType,
      label: spinResult.label,
      labelLowerCase: spinResult.label.toLowerCase(),
      includesLuck: spinResult.label.toLowerCase().includes('luck'),
      isCustom: spinResult.rewardType === 'custom'
    } : null
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-500 to-indigo-600 relative overflow-hidden">
      {/* Animated Background Elements - Modern Style */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-10 w-8 h-8 bg-white/10 rounded-full animate-float"></div>
        <div className="absolute top-40 right-20 w-12 h-12 bg-yellow-400/20 rounded-lg rotate-45 animate-float-delay-1"></div>
        <div className="absolute bottom-32 left-32 w-6 h-6 bg-pink-400/20 rounded-full animate-float-delay-2"></div>
        <div className="absolute bottom-60 right-40 w-10 h-10 bg-blue-300/20 rounded-lg rotate-12 animate-float-delay-3"></div>
        
        {/* Additional decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>

      {/* Fireworks Effect */}
      {showFireworks && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-yellow-400 rounded-full animate-ping"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${20 + Math.random() * 60}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `1.5s`
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 md:py-6">
        {/* Header - Mobile Optimized */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          {/* User Info & Controls (when authenticated) - Enhanced */}
          {((isAuthenticated && currentUser) || (isPhoneAuthenticated && phoneAuthUser)) && (
            <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-4 sm:p-6 mb-6 border border-white/30 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center space-x-4 sm:space-x-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/20">
                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-sm" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-bold text-lg sm:text-xl md:text-2xl mb-1 text-shadow-sm">
                      {phoneAuthUser ? (phoneAuthUser.fullName || 'Spin Wheel User') : (currentUser?.name || 'User')}
                    </div>
                    <div className="text-white/80 text-sm sm:text-base md:text-lg font-medium mb-2">
                      {phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || '')}
                    </div>
                    <div className="bg-gradient-to-r from-green-400/20 to-blue-400/20 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-green-400/30">
                      <div className="text-green-300 text-sm sm:text-base font-semibold flex items-center space-x-2">
                        <span>🏆 {(userLoyaltyInfo?.currentThreshold?.name || 'Bronze').replace(/\s*Member$/i, '')}</span>
                        <span className="text-white/60">•</span>
                        <span>🎯 {userSpinHistory.length} spins</span>
                        <span className="text-white/60">•</span>
                        <span>🎟️ {userCoupons.filter(c => c.usageCount === 0).length} coupons</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 w-full sm:w-auto">
                  {Number(wheelConfig.maxSpinsPerCustomer) > 0 && (
                    <div className="bg-gradient-to-r from-blue-500/40 to-cyan-500/40 backdrop-blur-sm px-4 py-2 sm:px-5 sm:py-3 rounded-2xl border border-blue-400/60 shadow-xl">
                      <span className="text-white text-sm sm:text-base md:text-lg font-bold text-shadow-sm">
                        🎯 {remainingSpins} spins left
                      </span>
                    </div>
                  )}
                  
                  {Number(wheelConfig.maxSpinsPerCustomer) === 0 && (
                    <div className="bg-gradient-to-r from-green-500/40 to-emerald-500/40 backdrop-blur-sm px-4 py-2 sm:px-5 sm:py-3 rounded-2xl border border-green-400/60 shadow-xl">
                      <span className="text-white text-sm sm:text-base md:text-lg font-bold text-shadow-sm">
                        ♾️ Unlimited Spins
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <button
                      onClick={handleOpenDashboard}
                      className="bg-white/25 hover:bg-white/35 px-4 py-2 sm:px-5 sm:py-3 rounded-xl text-white font-semibold transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base shadow-lg hover:shadow-xl backdrop-blur-sm border border-white/20"
                    >
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Dashboard</span>
                      <span className="sm:hidden">Stats</span>
                    </button>
                    
                    {/* Enhanced Dashboard Link */}
                    <button
                      onClick={() => {
                        if (phoneAuthUser) {
                          // Navigate to the enhanced customer dashboard using current slug/ID
                          const urlSlug = currentSlug || wheelConfig.restaurantId; // Use current slug from URL or fallback
                          window.open(`/${urlSlug}/customer-dashboard?phone=${phoneAuthUser.phone}`, '_blank');
                        }
                      }}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-4 py-2 sm:px-5 sm:py-3 rounded-xl text-white font-semibold transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base shadow-lg hover:shadow-xl"
                    >
                      <User className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Full Dashboard</span>
                      <span className="sm:hidden">Profile</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        // Handle logout for both auth types
                        if (phoneAuthUser) {
                          localStorage.removeItem('spinWheelPhoneUser');
                          setPhoneAuthUser(null);
                          setIsPhoneAuthenticated(false);
                          setShowPhoneAuthModal(true);
                          toast.success('Logged out successfully');
                        } else {
                          handleLogout();
                        }
                      }}
                      className="bg-red-500/30 hover:bg-red-500/40 px-4 py-2 sm:px-5 sm:py-3 rounded-xl text-white font-semibold transition-all duration-200 text-sm sm:text-base shadow-lg hover:shadow-xl backdrop-blur-sm border border-red-400/30"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Title - Mobile Optimized */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 px-2 leading-tight">
              {restaurantName}
            </h1>
            <div className="h-1 w-12 sm:w-16 md:w-20 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-3 sm:mb-4"></div>
            <h2 className="text-base sm:text-lg md:text-xl text-white/90 font-medium px-2">
              {wheelConfig.name}
            </h2>
          </div>
        </div>

        {/* Main Content Container - Mobile Optimized */}
        <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 md:space-y-8 px-2">

          {/* Spin Wheel Section - Extra Large on Mobile */}
          <div className="w-full flex justify-center">
                          <div className="relative max-w-[450px] sm:max-w-[490px] md:max-w-[530px] lg:max-w-[580px] w-full">
              {/* Wheel Container - Mobile Optimized */}
              <div className="relative mb-6 sm:mb-8">
                {/* Enhanced Background glow for mobile */}
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/30 via-orange-500/30 to-yellow-400/30 rounded-full blur-xl sm:blur-2xl animate-pulse scale-105"></div>
                
                {/* Bigger Pointer for mobile */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 sm:-translate-y-3 z-20">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 sm:border-l-5 sm:border-r-5 sm:border-b-12 md:border-l-6 md:border-r-6 md:border-b-14 border-transparent border-b-white drop-shadow-xl"></div>
                  {/* Pointer glow effect */}
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full blur-sm opacity-70"></div>
                </div>
                
                {/* Main Wheel */}
                <div
                  ref={wheelRef}
                  className="relative transition-transform ease-out rounded-full border-2 sm:border-4 border-white shadow-2xl overflow-hidden w-full aspect-square"
                  style={{ 
                    transform: `rotate(${rotation}deg)`,
                    transitionDuration: isSpinning ? '4s' : '0.5s',
                    transitionTimingFunction: isSpinning ? 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'ease'
                  }}
                >
                <svg viewBox="0 0 600 600" className="w-full h-full block">
                  {/* Wheel segments */}
                  {wheelConfig.segments.map((segment, index) => {
                    const textPos = getTextPosition(index, wheelConfig.segments.length);
                    
                    return (
                      <g key={segment.id}>
                        {/* Segment background */}
                        <path
                          d={createSegmentPath(index, wheelConfig.segments.length)}
                          fill={segment.color}
                          stroke="#ffffff"
                          strokeWidth="3"
                          className="drop-shadow-sm"
                        />
                        
                        {/* Segment text - Clean & Bold */}
                        <g transform={`translate(${textPos.x}, ${textPos.y}) rotate(${textPos.rotation})`}>
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.max(22, getOptimalFontSize(segment.label, wheelConfig.segments.length) + 8)}
                            fontWeight="bold"
                            fill="black"
                            style={{ 
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {formatRewardText(segment)}
                          </text>
                        </g>
                        
                        {/* Reward icon - Bigger for mobile */}
                        <g transform={`translate(${300 + 240 * Math.cos((2 * Math.PI * index) / wheelConfig.segments.length + Math.PI / wheelConfig.segments.length - Math.PI / 2)}, ${300 + 240 * Math.sin((2 * Math.PI * index) / wheelConfig.segments.length + Math.PI / wheelConfig.segments.length - Math.PI / 2)})`}>
                          <circle
                            r="18"
                            fill="rgba(255,255,255,0.95)"
                            stroke={segment.color}
                            strokeWidth="3"
                            className="drop-shadow-lg"
                          />
                          <text
                            x="0"
                            y="6"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="20"
                          >
                            {segment.rewardType === 'discount_percentage' ? '💯' :
                             segment.rewardType === 'discount_fixed' ? '💰' :
                             segment.rewardType === 'free_item' ? '🎁' : 
                             segment.rewardType === 'points' ? '⭐' : 
                             segment.label.toLowerCase().includes('luck') ? '😔' : '🎊'}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                  
                  {/* Center circle */}
                  <defs>
                    <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </radialGradient>
                  </defs>
                  
                  <circle 
                    cx="300" 
                    cy="300" 
                    r="55" 
                    fill="url(#centerGradient)" 
                    stroke="#ffffff" 
                    strokeWidth="5" 
                    className="drop-shadow-xl" 
                  />
                  
                  {/* Center content - Enhanced for mobile */}
                  <g transform="translate(300, 300)">
                    <text 
                      x="0" 
                      y="-8" 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontSize="28"
                    >
                      🎰
                    </text>
                    
                    <text 
                      x="0" 
                      y="15" 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontSize="12" 
                      fontWeight="bold"
                      fill="white"
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="0.5"
                      style={{ 
                        fontFamily: 'Inter, sans-serif',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                      }}
                    >
                      SPIN
                    </text>
                  </g>
                </svg>
              </div>
                
                {/* Spin Button - Mobile Optimized */}
                <div className="mb-6 sm:mb-8 w-full flex justify-center mt-8 sm:mt-12 px-4">
                  <div className="relative w-full max-w-sm">
                    {/* Enhanced glowing ring effect for mobile */}
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl blur-xl opacity-80 animate-pulse scale-110"></div>
                    
                    {/* Enhanced gaming-style decorative corners */}
                    <div className="absolute -top-3 -left-3 w-5 h-5 border-l-3 border-t-3 border-yellow-400 sm:w-6 sm:h-6"></div>
                    <div className="absolute -top-3 -right-3 w-5 h-5 border-r-3 border-t-3 border-yellow-400 sm:w-6 sm:h-6"></div>
                    <div className="absolute -bottom-3 -left-3 w-5 h-5 border-l-3 border-b-3 border-yellow-400 sm:w-6 sm:h-6"></div>
                    <div className="absolute -bottom-3 -right-3 w-5 h-5 border-r-3 border-b-3 border-yellow-400 sm:w-6 sm:h-6"></div>
                    
                    <button
                      onClick={handleSpin}
                      disabled={!canSpin || isSpinning || !(isAuthenticated || isPhoneAuthenticated)}
                      className={`relative px-6 sm:px-8 md:px-10 py-4 sm:py-5 text-xl sm:text-2xl md:text-3xl font-bold rounded-2xl transition-all duration-300 transform w-full ${
                        canSpin && !isSpinning && (isAuthenticated || isPhoneAuthenticated)
                          ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 text-white hover:scale-105 hover:shadow-2xl shadow-xl active:scale-95 hover:from-yellow-300 hover:via-orange-400 hover:to-yellow-300'
                          : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                      } border-3 border-white/40 backdrop-blur-sm`}
                      style={{
                        boxShadow: canSpin && !isSpinning && (isAuthenticated || isPhoneAuthenticated) 
                          ? '0 0 40px rgba(251, 191, 36, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.4)' 
                          : 'none'
                      }}
                    >
                      {/* Inner glow effect */}
                      {canSpin && !isSpinning && (isAuthenticated || isPhoneAuthenticated) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-2xl animate-pulse"></div>
                      )}
                      
                      <div className="relative flex items-center justify-center space-x-3 sm:space-x-4">
                        {isSpinning ? (
                          <>
                            <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin" />
                            <span className="font-extrabold tracking-wide text-shadow-sm">SPINNING...</span>
                            <div className="absolute -right-10 sm:-right-12 text-2xl animate-bounce">🎰</div>
                          </>
                        ) : !(isAuthenticated || isPhoneAuthenticated) ? (
                          <>
                            <Lock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                            <span className="font-extrabold tracking-wide text-shadow-sm">🔐 VERIFY TO PLAY</span>
                          </>
                        ) : !canSpin ? (
                          <>
                            <XCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                            <span className="font-extrabold tracking-wide text-shadow-sm">❌ NO SPINS LEFT</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-pulse" />
                            <span className="font-extrabold tracking-wide text-shadow-sm">🎯 SPIN TO WIN!</span>
                            <div className="absolute -right-10 sm:-right-12 text-2xl animate-bounce delay-300">⚡</div>
                          </>
                        )}
                      </div>
                      
                      {/* Gaming-style scanning line effect */}
                      {canSpin && !isSpinning && (isAuthenticated || isPhoneAuthenticated) && (
                        <div className="absolute inset-0 overflow-hidden rounded-2xl">
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent animate-scanning"></div>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Preview */}
          {!hasSpun && (
            <div className="w-full max-w-4xl px-4">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-white/20">
                <div className="text-center mb-4 sm:mb-6">
                  <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    Amazing Rewards Await!
                  </h3>
                  <p className="text-white/80 text-sm sm:text-base">
                    Spin the wheel get rewards
                  </p>
                </div>
                
                {/* Rewards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {wheelConfig.segments.slice(0, 4).map((segment, index) => (
                    <div
                      key={segment.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-center border border-white/10"
                    >
                      <div 
                        className="w-6 h-6 sm:w-8 sm:h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-xs sm:text-sm"
                        style={{ backgroundColor: segment.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="text-white font-medium text-xs sm:text-sm mb-1">
                        {segment.label}
                      </div>
                      <div className="text-white/70 text-xs">
                        {formatSubtitleText(segment)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {wheelConfig.segments.length > 4 && (
                  <div className="text-center mt-3 sm:mt-4">
                    <span className="text-white/70 text-xs sm:text-sm">
                      + {wheelConfig.segments.length - 4} more amazing rewards!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && spinResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            {/* Loading Overlay */}
            {isClaimingReward && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Processing your reward...</p>
                  <p className="text-gray-500 text-sm mt-2">Please wait while we generate your coupon</p>
                </div>
              </div>
            )}
            <div className="text-center">
              {/* Result Icon and Title */}
              <div className="mb-6">
                {isWinningSegment ? (
                  <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-10 h-10 text-white" />
                  </div>
                )}
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isWinningSegment ? '🎉 Congratulations!' : '😔 Better Luck Next Time!'}
                </h2>
                
                <div className="text-lg font-semibold text-gray-700 mb-2">
                  {spinResult.label}
                </div>
                
                <div className="text-gray-600">
                  {spinResult.value}
                </div>
              </div>

              {/* Coupon Code Display - Enhanced Success State */}
              {isClaimed && couponCode && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-6 animate-fadeIn">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-800 mb-2">🎉 Reward Claimed Successfully!</div>
                    <div className="text-sm text-gray-600 mb-3">Your Coupon Code</div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xl font-bold text-green-600 bg-white px-4 py-2 rounded-lg border-2 border-green-200 font-mono">
                        {couponCode}
                      </span>
                      <button
                        onClick={copyCouponCode}
                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      ✅ Code saved to CRM & Coupon Dashboard • Show this code to redeem your reward
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Claim Reward Button - Auto-processing or Manual Claim */}
                {!isClaimed && isWinningSegment && (
                  <button
                    onClick={() => {
                      // Start loading animation immediately
                      setIsClaimingReward(true);
                      // Then call the actual claim handler
                      handleClaimReward();
                    }}
                    disabled={isClaimingReward}
                    className={`w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 transform ${
                      isClaimingReward 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse scale-95' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-xl hover:scale-105 hover:from-green-600 hover:to-emerald-700 active:scale-95 shadow-lg'
                    } text-white`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {isClaimingReward ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>🎯 Processing Your Reward...</span>
                          <div className="flex space-x-1 ml-2">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-100"></div>
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-200"></div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="animate-bounce">
                            <Ticket className="w-5 h-5" />
                          </div>
                          <span>🎁 Claim Your Reward!</span>
                        </>
                      )}
                    </div>
                  </button>
                )}

                {/* Spin Again Button */}
                <button
                  onClick={resetSpin}
                  disabled={isClaimingReward}
                  className={`w-full font-bold py-4 px-6 rounded-xl transition-all duration-200 ${
                    isClaimingReward 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <RotateCcw className="w-5 h-5" />
                    <span>Spin Again!</span>
                  </div>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setShowResultModal(false)}
                  disabled={isClaimingReward}
                  className={`w-full font-medium py-3 px-6 rounded-xl transition-colors ${
                    isClaimingReward 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {authMode === 'login' ? 'Welcome Back!' : 
                 authMode === 'register' ? 'Create Account' : 
                 'Verify Your Phone'}
              </h2>
              <p className="text-gray-600 mt-2">
                {authMode === 'login' ? 'Sign in to start spinning' : 
                 authMode === 'register' ? 'Join the fun and win amazing rewards' : 
                 'Enter the verification code sent to your phone'}
              </p>
            </div>

            {/* Login Form */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit(handleLogin)} className="space-y-4">
                <div>
                  <input
                    {...registerLogin('phoneOrEmail', { required: 'Phone or email is required' })}
                    type="text"
                    placeholder="Phone number or email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {loginErrors.phoneOrEmail && (
                    <p className="text-red-500 text-sm mt-1">{loginErrors.phoneOrEmail.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    {...registerLogin('password', { required: 'Password is required' })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  {loginErrors.password && (
                    <p className="text-red-500 text-sm mt-1">{loginErrors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isAuthLoading ? 'Signing In...' : 'Sign In'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Don't have an account? Sign up
                  </button>
                </div>
              </form>
            )}

            {/* Register Form */}
            {authMode === 'register' && (
              <form onSubmit={handleSignupSubmit(handleRegister)} className="space-y-4">
                <div>
                  <input
                    {...registerSignup('name', { required: 'Name is required' })}
                    type="text"
                    placeholder="Full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {signupErrors.name && (
                    <p className="text-red-500 text-sm mt-1">{signupErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <input
                    {...registerSignup('phone', { required: 'Phone number is required' })}
                    type="tel"
                    placeholder="Phone number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {signupErrors.phone && (
                    <p className="text-red-500 text-sm mt-1">{signupErrors.phone.message}</p>
                  )}
                </div>

                <div>
                  <input
                    {...registerSignup('email')}
                    type="email"
                    placeholder="Email (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="relative">
                  <input
                    {...registerSignup('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  {signupErrors.password && (
                    <p className="text-red-500 text-sm mt-1">{signupErrors.password.message}</p>
                  )}
                </div>

                <div>
                  <input
                    {...registerSignup('confirmPassword', { 
                      required: 'Please confirm your password',
                      validate: (value, formValues) => value === formValues.password || 'Passwords do not match'
                    })}
                    type="password"
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {signupErrors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{signupErrors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isAuthLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            )}

            {/* Verification Form */}
            {authMode === 'verify' && (
              <form onSubmit={handleVerifySubmit(handleVerify)} className="space-y-4">
                <div>
                  <input
                    {...registerVerify('code', { required: 'Verification code is required' })}
                    type="text"
                    placeholder="Enter verification code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  {verifyErrors.code && (
                    <p className="text-red-500 text-sm mt-1">{verifyErrors.code.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isAuthLoading ? 'Verifying...' : 'Verify'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Didn't receive code? Resend
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* User Dashboard Modal */}
      {showUserDashboard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">🎯 Your Rewards Dashboard</h2>
                <p className="text-gray-600 mt-1">Track your spins, rewards, and loyalty points</p>
                {phoneAuthUser && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        const urlSlug = currentSlug || wheelConfig.restaurantId;
                        window.open(`/${urlSlug}/customer-dashboard?phone=${phoneAuthUser.phone}`, '_blank');
                      }}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center space-x-1"
                    >
                      <User className="w-4 h-4" />
                      <span>View Full Customer Dashboard with Orders & More →</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadUserDashboard}
                  disabled={loadingDashboard}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50 flex items-center space-x-2"
                  title="Refresh Data"
                >
                  <RotateCcw className={`w-5 h-5 ${loadingDashboard ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={() => setShowUserDashboard(false)}
                  className="bg-gray-200 hover:bg-gray-300 p-3 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDashboard ? (
              <div className="text-center py-16">
                <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
                <p className="text-gray-600 text-lg">Loading your rewards data...</p>
                <p className="text-gray-500 text-sm mt-2">Please wait while we fetch your latest activity</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* User Profile Card */}
                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-purple-200">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                    <div className="flex items-center space-x-4 mb-4 md:mb-0">
                      <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {phoneAuthUser ? (phoneAuthUser.fullName || 'Spin Wheel User') : (currentUser?.name || 'User')}
                        </h3>
                        <p className="text-gray-600 text-lg">
                          {phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || '')}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          {userLoyaltyInfo && (
                            <div className="text-purple-600 font-bold text-lg">
                              ⭐ {userLoyaltyInfo.currentPoints || 0} points
                            </div>
                          )}
                          <div className="text-blue-600 font-medium">
                            🏆 {userLoyaltyInfo?.currentThreshold?.name || 'Bronze Member'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                      <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-purple-600">{userSpinHistory.length}</div>
                        <div className="text-sm text-gray-600">Total Spins</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-green-600">
                          {userCoupons.filter(c => c.usageCount === 0).length}
                        </div>
                        <div className="text-sm text-gray-600">Active Coupons</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loyalty Points Section */}
                {userLoyaltyInfo && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                      <Trophy className="w-6 h-6 text-purple-500 mr-3" />
                      Loyalty Points & Status
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Current Status */}
                      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="text-4xl">
                            {userLoyaltyInfo.currentThreshold?.badgeIcon || '🥉'}
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-gray-900">
                              {userLoyaltyInfo.currentThreshold?.name || 'Bronze Member'}
                            </h4>
                            <p className="text-gray-600">Current Status</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Current Points</span>
                            <span className="font-bold text-purple-600">{userLoyaltyInfo.currentPoints || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Earned</span>
                            <span className="font-bold text-blue-600">{userLoyaltyInfo.totalPointsEarned || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">From Spins</span>
                            <span className="font-bold text-green-600">{userLoyaltyInfo.totalSpins || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress to Next Level */}
                      {userLoyaltyInfo.nextThreshold && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">Next Level Progress</h4>
                          
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="text-3xl">{userLoyaltyInfo.nextThreshold.badgeIcon}</div>
                            <div>
                              <div className="font-bold text-gray-900">{userLoyaltyInfo.nextThreshold.name}</div>
                              <div className="text-sm text-gray-600">
                                {userLoyaltyInfo.pointsToNext} points to go
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-500"
                              style={{ width: `${userLoyaltyInfo.progressToNext || 0}%` }}
                            />
                          </div>
                          <div className="text-center text-sm text-gray-600">
                            {(userLoyaltyInfo.progressToNext || 0).toFixed(1)}% complete
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comprehensive Spin History */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <TrendingUp className="w-6 h-6 text-purple-500 mr-3" />
                      Complete Spin History
                    </h3>
                    <div className="text-sm text-gray-500">
                      {userSpinHistory.length} total spins
                    </div>
                  </div>
                  
                  {userSpinHistory.length > 0 ? (
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                      {userSpinHistory.map((spin, index) => {
                        const isWinning = !spin.resultMessage.toLowerCase().includes('luck');
                        const spinDate = new Date(spin.spinDate);
                        
                        return (
                          <div key={spin.id || index} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setSelectedSpin(spin)}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-4 flex-1">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  isWinning 
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                    : 'bg-gray-400'
                                }`}>
                                  {isWinning ? (
                                    <Gift className="w-6 h-6 text-white" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-white" />
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  <div className="font-bold text-gray-900 text-lg">{spin.resultMessage}</div>
                                  <div className="text-gray-600 text-sm mb-2">
                                    {spinDate.toLocaleDateString()} at {spinDate.toLocaleTimeString()}
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-2">
                                    {spin.pointsEarned > 0 && (
                                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                        +{spin.pointsEarned} points
                                      </span>
                                    )}
                                    {spin.couponCode && (
                                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-mono">
                                        {spin.couponCode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end space-y-2">
                                {spin.isClaimed && (
                                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                    ✅ Claimed
                                  </span>
                                )}
                                {spin.isRedeemed && (
                                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                    🎯 Redeemed
                                  </span>
                                )}
                                {!spin.isClaimed && isWinning && (
                                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                    ⏳ Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-600 mb-2">No spins yet!</h4>
                      <p className="text-gray-500">Start spinning the wheel to see your history here</p>
                    </div>
                  )}
                </div>

                {/* Enhanced Coupons Section */}
                {userCoupons.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <Ticket className="w-6 h-6 text-orange-500 mr-3" />
                        Your Reward Coupons
                      </h3>
                      <div className="text-sm text-gray-500">
                        {userCoupons.filter(c => c.usageCount === 0).length} active • {userCoupons.length} total
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userCoupons.map((coupon, index) => {
                        const isExpired = new Date(coupon.validity?.endDate || coupon.expiryDate) < new Date();
                        const isUsed = coupon.usageCount > 0;
                        const isActive = !isExpired && !isUsed;
                        
                        return (
                          <div key={coupon.id || index} className={`rounded-xl p-5 border-2 transition-all hover:shadow-md ${
                            isActive ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
                            isUsed ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' :
                            'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="text-2xl">
                                {coupon.type === 'percentage' ? '💯' : 
                                 coupon.type === 'fixed_amount' ? '💰' : 
                                 coupon.type === 'free_item' ? '🎁' : '🎟️'}
                              </div>
                              <span className={`px-2 py-1 text-xs rounded-full font-bold ${
                                isActive ? 'bg-green-100 text-green-800' :
                                isUsed ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {isUsed ? 'USED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="font-bold text-gray-900">{coupon.name}</h4>
                              <div className="text-sm text-gray-600">{coupon.description}</div>
                              
                              <div className="bg-white rounded-lg p-3 border">
                                <div className="text-xs text-gray-500 mb-1">Coupon Code</div>
                                <div className="font-mono font-bold text-lg text-gray-900">{coupon.code}</div>
                              </div>
                              
                              <div className="text-xs text-gray-500 space-y-1">
                                <div>
                                  Expires: <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                    {new Date(coupon.validity?.endDate || coupon.expiryDate).toLocaleDateString()}
                                  </span>
                                </div>
                                {isUsed && coupon.usedAt && (
                                  <div>
                                    Used on: {new Date(coupon.usedAt).toLocaleDateString()}
                                  </div>
                                )}
                                {coupon.metadata?.spinWheelName && (
                                  <div className="text-purple-600">
                                    From: {coupon.metadata.spinWheelName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Redeemed Rewards Section */}
                {userSpinHistory.filter(spin => spin.isRedeemed).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                        Redeemed Rewards
                      </h3>
                      <div className="text-sm text-gray-500">
                        {userSpinHistory.filter(spin => spin.isRedeemed).length} redeemed
                      </div>
                    </div>
                    
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                      {userSpinHistory
                        .filter(spin => spin.isRedeemed)
                        .sort((a, b) => new Date(b.redeemedDate || b.spinDate).getTime() - new Date(a.redeemedDate || a.spinDate).getTime())
                        .map((spin, index) => {
                          const spinDate = new Date(spin.spinDate);
                          const redeemedDate = spin.redeemedDate ? new Date(spin.redeemedDate) : null;
                          
                          return (
                            <div key={spin.id || index} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4 flex-1">
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-r from-green-400 to-emerald-500">
                                    <Gift className="w-6 h-6 text-white" />
                                  </div>
                                  
                                  <div className="flex-1">
                                    <div className="font-bold text-gray-900 text-lg">{spin.resultMessage}</div>
                                    <div className="text-gray-600 text-sm mb-2">
                                      Won on: {spinDate.toLocaleDateString()} at {spinDate.toLocaleTimeString()}
                                    </div>
                                    {redeemedDate && (
                                      <div className="text-green-600 text-sm mb-2 font-medium">
                                        Redeemed on: {redeemedDate.toLocaleDateString()} at {redeemedDate.toLocaleTimeString()}
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-2">
                                      {spin.pointsEarned > 0 && (
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                          +{spin.pointsEarned} points
                                        </span>
                                      )}
                                      {spin.couponCode && (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-mono">
                                          {spin.couponCode}
                                        </span>
                                      )}
                                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                        ✅ Successfully Redeemed
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end space-y-2">
                                  <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                                    🎯 REDEEMED
                                  </span>
                                  <button
                                    onClick={() => setSelectedSpin(spin)}
                                    className="text-green-600 hover:text-green-700 text-xs font-medium underline"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* Redeemed Rewards Summary */}
                    <div className="mt-6 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-green-900">Redemption Summary</h4>
                          <p className="text-green-700 text-sm">Your total rewards used</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {userSpinHistory.filter(spin => spin.isRedeemed).length}
                          </div>
                          <div className="text-green-700 text-sm">Rewards Used</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* No Data State */}
                {userSpinHistory.length === 0 && userCoupons.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Gift className="w-12 h-12 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Start Your Rewards Journey!</h3>
                    <p className="text-gray-600 text-lg mb-6">
                      Spin the wheel to earn points, win coupons, and unlock amazing rewards
                    </p>
                    <button
                      onClick={() => setShowUserDashboard(false)}
                      className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-all"
                    >
                      Start Spinning! 🎰
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phone Authentication Modal */}
      {showPhoneAuthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h2>
              <p className="text-gray-600">Please verify your phone number to start spinning</p>
            </div>
            
            <div className="space-y-4">
              <PhoneEmailButton />
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              By continuing, you agree to our terms and privacy policy
            </p>
          </div>
        </div>
      )}

      {/* Reward Claim Modal */}
      {showRewardClaimModal && rewardClaimData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 Congratulations!</h2>
              <p className="text-gray-600 mb-4">You won: <span className="font-semibold text-green-600">{rewardClaimData.spinResult?.label}</span></p>
              <p className="text-sm text-gray-500">Please enter your name to claim your reward</p>
            </div>
            
            <form onSubmit={handleRewardClaimSubmit(handleRewardClaim)} className="space-y-4">
              <div>
                <label htmlFor="rewardName" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  {...registerRewardClaim('name', { 
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Name must be at least 2 characters' }
                  })}
                  type="text"
                  id="rewardName"
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {rewardClaimErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{rewardClaimErrors.name.message}</p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRewardClaimModal(false);
                    resetRewardClaim();
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200"
                >
                  Claim Reward
                </button>
              </div>
            </form>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Your name will be saved for future rewards
            </p>
          </div>
        </div>
      )}

      {/* Spin Details Modal */}
      {selectedSpin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Spin Details</h2>
                <button
                  onClick={() => setSelectedSpin(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Spin Result */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedSpin.resultMessage}</h3>
                <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium ${
                  selectedSpin.isClaimed ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${selectedSpin.isClaimed ? 'bg-green-600' : 'bg-orange-600'}`}></div>
                  <span>{selectedSpin.isClaimed ? 'Claimed' : 'Available'}</span>
                </div>
              </div>

              {/* Spin Information */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Spin Date</span>
                    <span className="text-sm text-gray-900">{new Date(selectedSpin.spinDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Spin Time</span>
                    <span className="text-sm text-gray-900">{new Date(selectedSpin.spinDate).toLocaleTimeString()}</span>
                  </div>
                  {selectedSpin.couponCode && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Coupon Code</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono bg-gray-200 px-2 py-1 rounded">{selectedSpin.couponCode}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedSpin.couponCode);
                            toast.success('Coupon code copied!');
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedSpin.pointsEarned > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Points Earned</span>
                      <span className="text-sm text-purple-600 font-medium">+{selectedSpin.pointsEarned} points</span>
                    </div>
                  )}
                </div>

                {/* Redemption Info */}
                {selectedSpin.isClaimed ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Reward Claimed</span>
                    </div>
                    <div className="text-sm text-green-700">
                      This reward has been successfully claimed and is ready to use.
                    </div>
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-900">Ready to Claim</span>
                    </div>
                    <div className="text-sm text-orange-700 mb-3">
                      This reward is available and ready to be claimed.
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  {!selectedSpin.isClaimed && (
                    <button
                      onClick={() => {
                        setSelectedSpin(null);
                        // You can add claim functionality here
                        toast.success('Reward is ready to use!');
                      }}
                      className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-xl hover:bg-purple-700 transition-colors font-medium"
                    >
                      Claim Now
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSpin(null)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add floating animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes float-delay-1 {
          0%, 100% { transform: translateY(0px) rotate(45deg); }
          50% { transform: translateY(-15px) rotate(55deg); }
        }
        @keyframes float-delay-2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(-10deg); }
        }
        @keyframes float-delay-3 {
          0%, 100% { transform: translateY(0px) rotate(12deg); }
          50% { transform: translateY(-18px) rotate(22deg); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delay-1 {
          animation: float-delay-1 8s ease-in-out infinite;
        }
        .animate-float-delay-2 {
          animation: float-delay-2 7s ease-in-out infinite;
        }
        .animate-float-delay-3 {
          animation: float-delay-3 9s ease-in-out infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        /* Mobile optimizations */
        .text-shadow-sm {
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        /* Enhanced mobile touch targets */
        @media (max-width: 640px) {
          .touch-target {
            min-height: 44px;
            min-width: 44px;
          }
        }
      `}</style>
    </div>
  );
} 