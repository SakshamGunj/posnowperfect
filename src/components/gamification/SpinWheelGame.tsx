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
  Phone
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
}

export default function SpinWheelGame({ wheelConfig, restaurantName, onSpinComplete }: SpinWheelGameProps) {
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
    
    return () => {
      // Cleanup
      if (window.phoneEmailListener) {
        delete window.phoneEmailListener;
      }
    };
  }, []);

  useEffect(() => {
    if ((isAuthenticated && currentUser) || (isPhoneAuthenticated && phoneAuthUser)) {
      checkSpinLimit();
      loadInitialLoyaltyInfo();
    }
  }, [isAuthenticated, currentUser, isPhoneAuthenticated, phoneAuthUser]);

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

  // Handle reward claim (new)
  const handleRewardClaim = async (data: RewardClaimForm) => {
    if (!rewardClaimData || !phoneAuthUser) return;

    try {
      const rewardData = {
        ...rewardClaimData,
        customerName: data.name,
        customerPhone: phoneAuthUser.phone,
        claimedAt: new Date().toISOString()
      };

      // Save reward to localStorage
      const existingRewards = JSON.parse(localStorage.getItem('claimedRewards') || '[]');
      existingRewards.push(rewardData);
      localStorage.setItem('claimedRewards', JSON.stringify(existingRewards));

      // Update phone user data with name
      const updatedPhoneUser = {
        ...phoneAuthUser,
        fullName: data.name,
        firstName: data.name.split(' ')[0] || '',
        lastName: data.name.split(' ').slice(1).join(' ') || ''
      };
      localStorage.setItem('spinWheelPhoneUser', JSON.stringify(updatedPhoneUser));
      setPhoneAuthUser(updatedPhoneUser);

      // Update CRM with name
      await updateCustomerName(phoneAuthUser.phone, data.name);

      toast.success(`🎉 Reward claimed successfully, ${data.name}!`);
      setShowRewardClaimModal(false);
      setIsClaimed(true);
      resetRewardClaim();
      
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward. Please try again.');
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
    
    if (wheelConfig.maxSpinsPerCustomer === 0) return; // Unlimited spins

    try {
      const userPhone = phoneAuthUser ? phoneAuthUser.phone : currentUser?.phone;
      if (!userPhone) return;
      
      // Use the new simpler method that doesn't require Firebase indexes
      const result = await GamificationService.getCustomerSpinsCountToday(wheelConfig.restaurantId, userPhone);
      if (result.success && typeof result.data === 'number') {
        const spinsToday = result.data;
        const remaining = Math.max(0, wheelConfig.maxSpinsPerCustomer - spinsToday);
        setRemainingSpins(remaining);
        setCanSpin(remaining > 0);
        
        console.log('📊 Spin limit check:', {
          userPhone,
          spinsToday,
          maxAllowed: wheelConfig.maxSpinsPerCustomer,
          remaining,
          canSpin: remaining > 0
        });
      }
    } catch (error) {
      console.error('Error checking spin limit:', error);
      // Fallback to unlimited spins on error
      setRemainingSpins(wheelConfig.maxSpinsPerCustomer || 999);
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
          
          // Check if this is a winning spin and user needs to provide name for phone auth
          if (isWinning && phoneAuthUser && !phoneAuthUser.fullName) {
            setRewardClaimData({
              spinResult: selectedSegment,
              spinRecord: result.data,
              couponCode: generateCouponCode()
            });
            setShowRewardClaimModal(true);
          }
          
          // Refresh loyalty info if points were earned
          if (wheelConfig.pointsConfig?.enabled) {
            setTimeout(() => loadInitialLoyaltyInfo(), 500); // Reduced delay to ensure points are processed
          }
          
          // Refresh dashboard data if dashboard is open
          if (showUserDashboard) {
            setTimeout(() => loadUserDashboard(), 700); // Reduced delay for dashboard refresh
          }
        }
      } catch (error) {
        console.error('Error recording spin:', error);
      }
    }, 2500); // 2.5 second spin duration for optimal balance of excitement and speed
  };

  const handleClaimReward = async () => {
    // Use phone authenticated user or regular authenticated user
    const user = phoneAuthUser || currentUser;
    
    if (!spinResult || !currentSpinRecord || !user) return;
    
    // Check if it's a "Better Luck" or losing segment
    const isWinning = !(spinResult.rewardType === 'custom' && spinResult.label.toLowerCase().includes('luck'));
    
    if (!isWinning) {
      toast.error('No reward to claim. Better luck next time!');
      return;
    }

    // For phone auth users without a name, show the reward claim modal
    if (phoneAuthUser && !phoneAuthUser.fullName) {
      setRewardClaimData({
        spinResult,
        spinRecord: currentSpinRecord,
        couponCode: generateCouponCode()
      });
      setShowRewardClaimModal(true);
      return;
    }

    setIsClaimingReward(true);
    try {
      // Generate coupon code
      const newCouponCode = generateCouponCode();
      
      // Step 1: Update the spin record with coupon code
      const claimResult = await GamificationService.claimSpinReward(
        wheelConfig.restaurantId,
        currentSpinRecord.id,
        {
          customerName: phoneAuthUser ? phoneAuthUser.fullName : (currentUser?.name || 'User'),
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
            name: phoneAuthUser.fullName || 'Spin Wheel User',
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
          setCouponCode(newCouponCode);
          setIsClaimed(true);
          
          toast.success('🎉 Reward claimed and added to systems!');
          console.log('✅ Customer added to CRM and coupon created in coupon dashboard');
        } else {
          // Claim succeeded but integration failed - still show success to user
          setCouponCode(newCouponCode);
          setIsClaimed(true);
          
          toast.success('🎉 Reward claimed successfully!');
          console.warn('⚠️ Integration with CRM/Coupon system failed:', integrationResult.error);
        }
      } else {
        toast.error('Failed to claim reward. Please try again.');
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsClaimingReward(false);
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
      } else {
        console.log('❌ No spin history or error:', spinHistoryResult.error);
        setUserSpinHistory([]); // Ensure it's set to empty array
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

  const isWinningSegment = spinResult && !(spinResult.rewardType === 'custom' && spinResult.label.toLowerCase().includes('luck'));

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

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header - Clean Modern Design */}
        <div className="text-center mb-8">
          {/* User Info & Controls (when authenticated) */}
          {((isAuthenticated && currentUser) || (isPhoneAuthenticated && phoneAuthUser)) && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold">
                      {phoneAuthUser ? (phoneAuthUser.fullName || 'Spin Wheel User') : (currentUser?.name || 'User')}
                    </div>
                    <div className="text-white/70 text-sm">
                      {phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || '')}
                    </div>
                    <div className="text-green-400 text-sm font-medium">
                      🏆 {userLoyaltyInfo?.currentThreshold?.name || 'Bronze'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {wheelConfig.maxSpinsPerCustomer > 0 && (
                    <div className="bg-blue-500/30 px-4 py-2 rounded-full border border-blue-400/50">
                      <span className="text-white text-sm font-semibold">
                        🎯 {remainingSpins} spins left
                      </span>
                    </div>
                  )}
                  
                  <button
                    onClick={handleOpenDashboard}
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-white font-medium transition-all duration-200 flex items-center space-x-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Dashboard</span>
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
                    className="bg-red-500/20 hover:bg-red-500/30 px-4 py-2 rounded-xl text-white font-medium transition-all duration-200"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Title */}
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
              {restaurantName}
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-4"></div>
            <h2 className="text-xl md:text-2xl text-white/90 font-medium">
              {wheelConfig.name}
            </h2>
          </div>
        </div>

        {/* Main Content Container */}
        <div className="flex flex-col items-center space-y-8">


          {/* Spin Wheel Section */}
          <div className="w-full max-w-md">
            {/* Wheel Container */}
            <div className="relative mb-8">
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-orange-500/20 to-yellow-400/20 rounded-full blur-2xl animate-pulse"></div>
              
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-20">
                <div className="w-0 h-0 border-l-5 border-r-5 border-b-10 border-transparent border-b-white drop-shadow-lg"></div>
              </div>
              
              {/* Main Wheel */}
              <div
                ref={wheelRef}
                className="relative transition-transform ease-out rounded-full border-4 border-white shadow-2xl overflow-hidden mx-auto"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transitionDuration: isSpinning ? '4s' : '0.5s',
                  transitionTimingFunction: isSpinning ? 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'ease',
                  width: '480px',
                  height: '480px'
                }}
              >
                <svg width="480" height="480" viewBox="0 0 600 600" className="w-full h-full block">
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
                        
                        {/* Segment text - Single offer text */}
                        <g transform={`translate(${textPos.x}, ${textPos.y}) rotate(${textPos.rotation})`}>
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.max(16, getOptimalFontSize(segment.label, wheelConfig.segments.length) + 4)}
                            fontWeight="bold"
                            fill="black"
                            style={{ 
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {formatRewardText(segment)}
                          </text>
                        </g>
                        
                        {/* Reward icon */}
                        <g transform={`translate(${300 + 240 * Math.cos((2 * Math.PI * index) / wheelConfig.segments.length + Math.PI / wheelConfig.segments.length - Math.PI / 2)}, ${300 + 240 * Math.sin((2 * Math.PI * index) / wheelConfig.segments.length + Math.PI / wheelConfig.segments.length - Math.PI / 2)})`}>
                          <circle
                            r="15"
                            fill="rgba(255,255,255,0.95)"
                            stroke={segment.color}
                            strokeWidth="2"
                            className="drop-shadow-md"
                          />
                          <text
                            x="0"
                            y="5"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="16"
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
                    r="50" 
                    fill="url(#centerGradient)" 
                    stroke="#ffffff" 
                    strokeWidth="4" 
                    className="drop-shadow-lg" 
                  />
                  
                  {/* Center content */}
                  <g transform="translate(300, 300)">
                    <text 
                      x="0" 
                      y="-5" 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontSize="24"
                    >
                      🎰
                    </text>
                    
                    <text 
                      x="0" 
                      y="12" 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontSize="10" 
                      fontWeight="bold"
                      fill="white"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      SPIN
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Spin Button */}
            <div className="mb-8 w-full flex justify-center">
              <button
                onClick={handleSpin}
                disabled={!canSpin || isSpinning || !(isAuthenticated || isPhoneAuthenticated)}
                className={`relative px-8 py-4 text-xl font-bold rounded-2xl transition-all duration-200 transform w-full max-w-xs ${
                  canSpin && !isSpinning && (isAuthenticated || isPhoneAuthenticated)
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:scale-105 shadow-xl'
                    : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                } border-2 border-white/20`}
              >
                <div className="flex items-center justify-center space-x-3">
                  {isSpinning ? (
                    <>
                      <RotateCcw className="w-6 h-6 animate-spin" />
                      <span>Spinning...</span>
                    </>
                  ) : !(isAuthenticated || isPhoneAuthenticated) ? (
                    <>
                      <Lock className="w-6 h-6" />
                      <span>Verify Phone to Spin</span>
                    </>
                  ) : !canSpin ? (
                    <>
                      <XCircle className="w-6 h-6" />
                      <span>No Spins Left</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6" />
                      <span>Spin to Win!</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Rewards Preview */}
          {!hasSpun && (
            <div className="w-full max-w-4xl">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                <div className="text-center mb-6">
                  <Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Amazing Rewards Await!
                  </h3>
                  <p className="text-white/80">
                    Spin the wheel get rewards
                  </p>
                </div>
                
                {/* Rewards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {wheelConfig.segments.slice(0, 4).map((segment, index) => (
                    <div
                      key={segment.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10"
                    >
                      <div 
                        className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: segment.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="text-white font-medium text-sm mb-1">
                        {segment.label}
                      </div>
                      <div className="text-white/70 text-xs">
                        {formatSubtitleText(segment)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {wheelConfig.segments.length > 4 && (
                  <div className="text-center mt-4">
                    <span className="text-white/70 text-sm">
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

              {/* Coupon Code Display */}
              {isClaimed && couponCode && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                  <div className="text-sm text-gray-600 mb-2">Your Coupon Code</div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-xl font-bold text-orange-600 bg-white px-4 py-2 rounded-lg border-2 border-orange-200">
                      {couponCode}
                    </span>
                    <button
                      onClick={copyCouponCode}
                      className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Show this code to redeem your reward
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Claim Reward Button */}
                {!isClaimed && isWinningSegment && (
                  <button
                    onClick={handleClaimReward}
                    disabled={isClaimingReward}
                    className={`w-full font-bold py-4 px-6 rounded-xl transition-all duration-200 ${
                      isClaimingReward 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'
                    } text-white`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {isClaimingReward ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Claiming Reward...</span>
                        </>
                      ) : (
                        <>
                          <Ticket className="w-5 h-5" />
                          <span>Claim Your Reward!</span>
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
          <div className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Your Dashboard</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadUserDashboard}
                  disabled={loadingDashboard}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RotateCcw className={`w-5 h-5 ${loadingDashboard ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowUserDashboard(false)}
                  className="bg-gray-200 hover:bg-gray-300 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDashboard ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your data...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User Info Card */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {phoneAuthUser ? (phoneAuthUser.fullName || 'Spin Wheel User') : (currentUser?.name || 'User')}
                      </h3>
                      <p className="text-gray-600">
                        {phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || '')}
                      </p>
                      {userLoyaltyInfo && (
                        <div className="text-purple-600 font-medium">
                          ⭐ {userLoyaltyInfo.currentPoints || 0} points • {userLoyaltyInfo.currentThreshold?.name || 'Bronze Member'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Spin History */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 text-purple-500 mr-2" />
                    Spin History ({userSpinHistory.length} spins)
                  </h3>
                  
                  {/* Debug info - remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <div className="font-medium text-blue-800">Debug Info:</div>
                      <div>User: {phoneAuthUser ? phoneAuthUser.phone : (currentUser?.phone || 'None')}</div>
                      <div>Auth Type: {phoneAuthUser ? 'Phone' : (currentUser ? 'Regular' : 'None')}</div>
                      <div>Restaurant: {wheelConfig.restaurantId}</div>
                      <div>Spin History Length: {userSpinHistory.length}</div>
                      <div>Current Spin Record: {currentSpinRecord ? 'Yes' : 'No'}</div>
                      <div>Has Spun: {hasSpun ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                  
                  {userSpinHistory.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {userSpinHistory.slice(0, 10).map((spin, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              spin.resultMessage.toLowerCase().includes('luck') 
                                ? 'bg-gray-400' 
                                : 'bg-gradient-to-r from-green-400 to-emerald-500'
                            }`}>
                              {spin.resultMessage.toLowerCase().includes('luck') ? (
                                <XCircle className="w-4 h-4 text-white" />
                              ) : (
                                <Gift className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{spin.resultMessage}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(spin.spinDate).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            spin.isRedeemed 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {spin.isRedeemed ? 'Redeemed' : 'Pending'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No spins yet. Start spinning to see your history!</p>
                    </div>
                  )}
                </div>

                {/* Coupons */}
                {userCoupons.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <Ticket className="w-5 h-5 text-orange-500 mr-2" />
                      Your Coupons
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userCoupons.slice(0, 4).map((coupon, index) => (
                        <div key={index} className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-xl p-4">
                          <div className="font-bold text-orange-600">{coupon.code}</div>
                          <div className="text-sm text-gray-600">{coupon.description}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            Expires: {new Date(coupon.expiryDate).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
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
      `}</style>
    </div>
  );
} 