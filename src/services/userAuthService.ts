import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  GamificationUser, 
  LoginCredentials, 
  RegisterData, 
  VerificationRequest, 
  AuthResponse 
} from '@/types';
import bcrypt from 'bcryptjs';
import VerificationService from './verificationService';
import getVerificationConfig from '../config/verificationConfig';

class UserAuthService {
  private getCollection(restaurantId: string) {
    return collection(db, `restaurants/${restaurantId}/gamificationUsers`);
  }
  
  private verificationService: VerificationService;

  constructor() {
    this.verificationService = new VerificationService(getVerificationConfig());
  }

  // Generate device fingerprint for fraud prevention
  generateDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
      timestamp: Date.now()
    };

    return btoa(JSON.stringify(fingerprint)).slice(0, 32);
  }

  // Generate secure 6-digit verification code
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash password securely
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Validate phone number format
  private validatePhoneNumber(phone: string): boolean {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return false;
    }

    // Basic pattern validation (can be enhanced for specific countries)
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    return phoneRegex.test(phone);
  }

  // Validate email format
  private validateEmail(email: string): boolean {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    return emailRegex.test(email);
  }

  // Check for suspicious activity
  private async checkSuspiciousActivity(
    restaurantId: string, 
    _phone: string, 
    deviceFingerprint?: string,
    ipAddress?: string
  ): Promise<{ isSuspicious: boolean; reason?: string }> {
    const usersRef = this.getCollection(restaurantId);
    
    try {
      // Check for multiple accounts with same device fingerprint
      if (deviceFingerprint) {
        const deviceQuery = query(
          usersRef,
          where('deviceFingerprint', '==', deviceFingerprint)
        );
        const deviceSnapshot = await getDocs(deviceQuery);
        
        if (deviceSnapshot.size > 3) {
          return { isSuspicious: true, reason: 'Multiple accounts from same device' };
        }
      }

      // For IP check, use a simpler approach to avoid compound index requirement
      if (ipAddress) {
        // First get all users for this restaurant with this IP
        const ipQuery = query(
          usersRef,
          where('ipAddress', '==', ipAddress)
        );
        const ipSnapshot = await getDocs(ipQuery);
        
        // Then filter in memory for recent registrations (last hour)
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const recentRegistrations = ipSnapshot.docs.filter(doc => {
          const userData = doc.data();
          const createdAt = userData.createdAt?.toDate();
          return createdAt && createdAt >= oneHourAgo;
        });
        
        if (recentRegistrations.length > 2) {
          return { isSuspicious: true, reason: 'Too many accounts from same IP' };
        }
      }

      return { isSuspicious: false };
      
    } catch (error) {
      // If any query fails, don't block registration but log the error
      console.warn('Suspicious activity check failed:', error);
      return { isSuspicious: false };
    }
  }

  // Register new user
  async registerUser(restaurantId: string, registerData: RegisterData): Promise<AuthResponse> {
    try {
      // Validate input data
      if (!registerData.name.trim()) {
        return { success: false, message: 'Name is required' };
      }

      if (!this.validatePhoneNumber(registerData.phone)) {
        return { success: false, message: 'Please enter a valid phone number' };
      }

      if (registerData.email && !this.validateEmail(registerData.email)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      if (registerData.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long' };
      }

      if (registerData.password !== registerData.confirmPassword) {
        return { success: false, message: 'Passwords do not match' };
      }

      // Check for existing user with same phone
      const usersRef = this.getCollection(restaurantId);
      const phoneQuery = query(
        usersRef,
        where('phone', '==', registerData.phone)
      );
      const existingUser = await getDocs(phoneQuery);

      if (!existingUser.empty) {
        return { success: false, message: 'An account with this phone number already exists' };
      }

      // Check for suspicious activity
      const ipAddress = await this.getClientIP();
      const suspiciousCheck = await this.checkSuspiciousActivity(
        restaurantId,
        registerData.phone,
        registerData.deviceFingerprint,
        ipAddress
      );

      if (suspiciousCheck.isSuspicious) {
        return { 
          success: false, 
          message: `Account creation blocked: ${suspiciousCheck.reason}. Please contact support.` 
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(registerData.password);

      // Generate verification code
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create user
      const userData: Omit<GamificationUser, 'id'> = {
        restaurantId,
        name: registerData.name.trim(),
        phone: registerData.phone,
        email: registerData.email?.trim() || undefined,
        passwordHash,
        isVerified: false,
        phoneVerified: false,
        emailVerified: false,
        createdAt: new Date(),
        totalSpins: 0,
        totalWins: 0,
        isBlocked: false,
        verificationCode,
        verificationCodeExpiry,
        deviceFingerprint: registerData.deviceFingerprint,
        ipAddress
      };

      // Save to Firebase
      const docRef = await addDoc(usersRef, {
        ...userData,
        createdAt: Timestamp.fromDate(userData.createdAt),
        verificationCodeExpiry: Timestamp.fromDate(verificationCodeExpiry)
      });

      const newUser: GamificationUser = {
        id: docRef.id,
        ...userData
      };

      // Send verification code via SMS
      try {
        const restaurantName = 'TenVerse Spin Wheel';
        
        const smsResult = await this.verificationService.sendSMSVerification(
          registerData.phone,
          verificationCode,
          restaurantName
        );

        if (!smsResult.success) {
          console.warn('SMS sending failed:', smsResult.error);
        }

        // Send email verification if email provided
        if (registerData.email) {
          const emailResult = await this.verificationService.sendEmailVerification(
            registerData.email,
            verificationCode,
            restaurantName,
            registerData.name
          );
          console.log('Email verification result:', emailResult);
        }

      } catch (error) {
        console.error('Verification sending error:', error);
      }

      return {
        success: true,
        user: newUser,
        message: 'Account created successfully! Please check your phone for the verification code.',
        requiresVerification: true
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  }

  // Login user
  async loginUser(restaurantId: string, credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const usersRef = this.getCollection(restaurantId);
      
      // Check if login is by phone or email
      const isEmail = this.validateEmail(credentials.phoneOrEmail);
      const field = isEmail ? 'email' : 'phone';
      
      const userQuery = query(
        usersRef,
        where(field, '==', credentials.phoneOrEmail)
      );
      
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        return { success: false, message: 'Invalid phone number/email or password' };
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      const user: GamificationUser = {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate(),
        verificationCodeExpiry: userData.verificationCodeExpiry?.toDate()
      } as GamificationUser;

      // Check if user is blocked
      if (user.isBlocked) {
        return { success: false, message: 'Your account has been blocked. Please contact support.' };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(credentials.password, user.passwordHash);
      if (!passwordValid) {
        return { success: false, message: 'Invalid phone number/email or password' };
      }

      // Update last login
      await updateDoc(doc(db, `restaurants/${restaurantId}/gamificationUsers`, user.id), {
        lastLoginAt: Timestamp.fromDate(new Date()),
        deviceFingerprint: credentials.deviceFingerprint
      });

      // Check if verification is required
      if (!user.phoneVerified) {
        return {
          success: true,
          user,
          message: 'Please verify your phone number to continue',
          requiresVerification: true
        };
      }

      return {
        success: true,
        user: { ...user, lastLoginAt: new Date() },
        message: 'Login successful!'
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  // Verify phone/email with code
  async verifyUser(verification: VerificationRequest): Promise<AuthResponse> {
    try {
      const userDoc = await getDoc(doc(db, `restaurants/${verification.restaurantId}/gamificationUsers`, verification.userId));

      if (!userDoc.exists()) {
        return { success: false, message: 'User not found' };
      }

      const userData = userDoc.data();
      const user: GamificationUser = {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate(),
        verificationCodeExpiry: userData.verificationCodeExpiry?.toDate()
      } as GamificationUser;

      // Check if code is expired
      if (user.verificationCodeExpiry && new Date() > user.verificationCodeExpiry) {
        return { success: false, message: 'Verification code has expired. Please request a new one.' };
      }

      // Check if code matches
      if (user.verificationCode !== verification.code) {
        return { success: false, message: 'Invalid verification code' };
      }

      // Update verification status
      const updateData: any = {
        verificationCode: null,
        verificationCodeExpiry: null,
        isVerified: true
      };

      if (verification.type === 'phone') {
        updateData.phoneVerified = true;
      } else if (verification.type === 'email') {
        updateData.emailVerified = true;
      }

      await updateDoc(doc(db, `restaurants/${verification.restaurantId}/gamificationUsers`, verification.userId), updateData);

      return {
        success: true,
        user: { ...user, ...updateData },
        message: 'Verification successful!'
      };

    } catch (error) {
      console.error('Verification error:', error);
      return { success: false, message: 'Verification failed. Please try again.' };
    }
  }

  // Get user by phone
  async getUserByPhone(restaurantId: string, phone: string): Promise<GamificationUser | null> {
    try {
      const usersRef = this.getCollection(restaurantId);
      const q = query(usersRef, where('phone', '==', phone));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      return {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate(),
        verificationCodeExpiry: userData.verificationCodeExpiry?.toDate()
      } as GamificationUser;

    } catch (error) {
      console.error('Error getting user by phone:', error);
      return null;
    }
  }

  // Get user by ID
  async getUserById(restaurantId: string, userId: string): Promise<GamificationUser | null> {
    try {
      const userDoc = await getDoc(doc(db, `restaurants/${restaurantId}/gamificationUsers`, userId));

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      return {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt.toDate(),
        lastLoginAt: userData.lastLoginAt?.toDate(),
        verificationCodeExpiry: userData.verificationCodeExpiry?.toDate()
      } as GamificationUser;

    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  // Get client IP address (basic implementation)
  private async getClientIP(): Promise<string> {
    try {
      // In production, you might want to use a more reliable IP detection service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<Pick<GamificationUser, 'name' | 'email'>>): Promise<{ success: boolean; message: string }> {
    try {
      // Find user across restaurants
      const restaurantsRef = collection(db, 'restaurants');
      const restaurantsSnapshot = await getDocs(restaurantsRef);
      
      let found = false;
      
      for (const restaurantDoc of restaurantsSnapshot.docs) {
        const userRef = doc(db, `restaurants/${restaurantDoc.id}/gamificationUsers`, userId);
        const userSnapshot = await getDoc(userRef);
        
        if (userSnapshot.exists()) {
          await updateDoc(userRef, {
            ...updates,
            updatedAt: Timestamp.fromDate(new Date())
          });
          found = true;
          break;
        }
      }

      if (!found) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return {
        success: false,
        message: 'Failed to update profile'
      };
    }
  }

  // Check if user exists
  async checkUserExists(restaurantId: string, phone: string): Promise<{ exists: boolean; userId?: string }> {
    try {
      const usersRef = this.getCollection(restaurantId);
      const q = query(
        usersRef,
        where('phone', '==', phone)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return { exists: false };
      }

      return {
        exists: true,
        userId: querySnapshot.docs[0].id
      };
    } catch (error) {
      console.error('Error checking user existence:', error);
      return { exists: false };
    }
  }

  // Update user (for spin tracking)
  async updateUser(restaurantId: string, userId: string, updates: Partial<GamificationUser>): Promise<boolean> {
    try {
      const userRef = doc(db, `restaurants/${restaurantId}/gamificationUsers`, userId);
      
      const updateData: any = { ...updates };
      
      // Convert date fields to Timestamps if they exist
      if (updateData.lastLoginAt) {
        updateData.lastLoginAt = Timestamp.fromDate(updateData.lastLoginAt);
      }
      if (updateData.verificationCodeExpiry) {
        updateData.verificationCodeExpiry = Timestamp.fromDate(updateData.verificationCodeExpiry);
      }
      
      // Remove id and createdAt from updates (these shouldn't be updated)
      delete updateData.id;
      delete updateData.createdAt;

      await updateDoc(userRef, updateData);
      return true;

    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  // Resend verification code
  async resendVerificationCode(restaurantId: string, userId: string, type: 'phone' | 'email'): Promise<AuthResponse> {
    try {
      const user = await this.getUserById(restaurantId, userId);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (type === 'phone' && user.phoneVerified) {
        return { success: false, message: 'Phone number is already verified' };
      }

      if (type === 'email' && user.emailVerified) {
        return { success: false, message: 'Email is already verified' };
      }

      // Generate new verification code
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user with new code
      await updateDoc(doc(db, `restaurants/${restaurantId}/gamificationUsers`, userId), {
        verificationCode,
        verificationCodeExpiry: Timestamp.fromDate(verificationCodeExpiry)
      });

      // Send verification code
      const restaurantName = 'TenVerse Spin Wheel';

      if (type === 'phone') {
        const smsResult = await this.verificationService.sendSMSVerification(
          user.phone,
          verificationCode,
          restaurantName
        );

        if (!smsResult.success) {
          return { success: false, message: 'Failed to send SMS verification code' };
        }
      } else if (type === 'email' && user.email) {
        const emailResult = await this.verificationService.sendEmailVerification(
          user.email,
          verificationCode,
          restaurantName,
          user.name
        );

        if (!emailResult.success) {
          return { success: false, message: 'Failed to send email verification code' };
        }
      } else {
        return { success: false, message: 'Email not available for this user' };
      }

      return {
        success: true,
        message: `Verification code sent to your ${type}`
      };

    } catch (error) {
      console.error('Error resending verification code:', error);
      return { success: false, message: 'Failed to resend verification code' };
    }
  }

  // Reset password
  async resetPassword(restaurantId: string, phone: string): Promise<AuthResponse> {
    try {
      const user = await this.getUserByPhone(restaurantId, phone);

      if (!user) {
        return { success: false, message: 'No account found with this phone number' };
      }

      // Generate reset code
      const resetCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user with reset code
      await updateDoc(doc(db, `restaurants/${restaurantId}/gamificationUsers`, user.id), {
        verificationCode: resetCode,
        verificationCodeExpiry: Timestamp.fromDate(verificationCodeExpiry)
      });

      // Send reset code via SMS
      const smsResult = await this.verificationService.sendSMSVerification(
        phone,
        resetCode,
        'TenVerse Spin Wheel'
      );

      if (!smsResult.success) {
        return { success: false, message: 'Failed to send reset code' };
      }

      return {
        success: true,
        message: 'Password reset code sent to your phone',
        user: user
      };

    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, message: 'Failed to send reset code' };
    }
  }

  // Update password with reset code
  async updatePasswordWithCode(
    restaurantId: string,
    phone: string,
    code: string,
    newPassword: string
  ): Promise<AuthResponse> {
    try {
      const user = await this.getUserByPhone(restaurantId, phone);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify reset code
      if (user.verificationCode !== code) {
        return { success: false, message: 'Invalid reset code' };
      }

      if (user.verificationCodeExpiry && new Date() > user.verificationCodeExpiry) {
        return { success: false, message: 'Reset code has expired' };
      }

      if (newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long' };
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password and clear reset code
      await updateDoc(doc(db, `restaurants/${restaurantId}/gamificationUsers`, user.id), {
        passwordHash,
        verificationCode: null,
        verificationCodeExpiry: null
      });

      return {
        success: true,
        message: 'Password updated successfully',
        user: { ...user, passwordHash }
      };

    } catch (error) {
      console.error('Error updating password:', error);
      return { success: false, message: 'Failed to update password' };
    }
  }

  // Create phone-authenticated user (for phone.email verification)
  async createPhoneAuthUser(restaurantId: string, userData: Partial<GamificationUser>): Promise<AuthResponse> {
    try {
      const usersRef = this.getCollection(restaurantId);
      
      // Get client IP
      const ipAddress = await this.getClientIP();

      // Create user data
      const fullUserData: Omit<GamificationUser, 'id'> = {
        restaurantId,
        name: userData.name || 'Spin Wheel User',
        phone: userData.phone || '',
        email: userData.email || '',
        passwordHash: userData.passwordHash || 'phone_auth_user',
        isVerified: true, // Phone already verified via phone.email
        phoneVerified: true,
        emailVerified: false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        totalSpins: 0,
        totalWins: 0,
        isBlocked: false,
        deviceFingerprint: userData.deviceFingerprint || `phone_${userData.phone}`,
        ipAddress,
        ...userData
      };

      // Save to Firebase
      const docRef = await addDoc(usersRef, {
        ...fullUserData,
        createdAt: Timestamp.fromDate(fullUserData.createdAt),
        lastLoginAt: Timestamp.fromDate(fullUserData.lastLoginAt || new Date())
      });

      const newUser: GamificationUser = {
        id: docRef.id,
        ...fullUserData
      };

      return {
        success: true,
        user: newUser,
        message: 'Phone-authenticated user created successfully!'
      };

    } catch (error) {
      console.error('Phone auth user creation error:', error);
      return { success: false, message: 'Failed to create phone-authenticated user' };
    }
  }
}

export const userAuthService = new UserAuthService(); 