import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '@/types';
import { RestaurantAuthService } from '@/services/restaurantAuthService';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/utils';

export interface RestaurantAuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isPinAuthenticated: boolean; // Track PIN-based auth separately
  login: (email: string, password: string, restaurantSlug: string) => Promise<void>;
  loginWithPin: (pin: string, restaurantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType | undefined>(undefined);

interface RestaurantAuthProviderProps {
  children: React.ReactNode;
}

// Storage keys for persistence
const USER_STORAGE_KEY = 'restaurant_auth_user';
const PIN_AUTH_STORAGE_KEY = 'restaurant_auth_pin_mode';

export function RestaurantAuthProvider({ children }: RestaurantAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  
  // Use refs to track current state for Firebase auth listener
  const userRef = useRef<User | null>(null);
  const isPinAuthenticatedRef = useRef<boolean>(false);
  const authInitializedRef = useRef<boolean>(false);
  
  // Update refs when state changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  useEffect(() => {
    isPinAuthenticatedRef.current = isPinAuthenticated;
  }, [isPinAuthenticated]);

  // Fallback initialization timeout to prevent infinite loading
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (!authInitializedRef.current) {
        console.log('🚨 Fallback auth initialization - preventing infinite loading');
        setLoading(false);
        authInitializedRef.current = true;
      }
    }, 8000); // 8 second absolute fallback

    return () => clearTimeout(fallbackTimeout);
  }, []);

  // Initialize state from localStorage on mount
  useEffect(() => {
    console.log('🔄 RestaurantAuthContext: Initializing from localStorage');
    
    const initializeAuth = async () => {
      try {
        const storedUser = storage.get<User | null>(USER_STORAGE_KEY, null);
        const storedPinAuth = storage.get<boolean>(PIN_AUTH_STORAGE_KEY, false);
        
        if (storedUser && storedPinAuth) {
          console.log('✅ Restored PIN authenticated user from localStorage:', storedUser.name);
          setUser(storedUser);
          setIsPinAuthenticated(true);
        } else if (storedUser && !storedPinAuth) {
          console.log('✅ Found stored user (Firebase auth mode)');
          setUser(storedUser);
          setIsPinAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to restore auth state from localStorage:', error);
        storage.remove(USER_STORAGE_KEY);
        storage.remove(PIN_AUTH_STORAGE_KEY);
      }
    };

    // Add timeout for localStorage initialization
    const initTimeout = setTimeout(() => {
      console.log('⏰ localStorage initialization timeout - proceeding without stored auth');
    }, 2000);

    initializeAuth().finally(() => {
      clearTimeout(initTimeout);
    });

    return () => {
      clearTimeout(initTimeout);
    };
  }, []);

  useEffect(() => {
    console.log('🔄 RestaurantAuthContext: Setting up Firebase auth listener');
    
    // Set up a timeout fallback to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Auth initialization timeout reached - setting loading to false');
      setLoading(false);
      authInitializedRef.current = true;
    }, 5000); // 5 second timeout
    
    // Listen to Firebase auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        // Clear the timeout since auth state change fired
        clearTimeout(loadingTimeout);
        
        console.log('🔄 Firebase auth state changed:', { 
          hasFirebaseUser: !!firebaseUser, 
          firebaseUserId: firebaseUser?.uid,
          currentUserId: userRef.current?.id,
          isPinAuthenticated: isPinAuthenticatedRef.current 
        });
        
        if (firebaseUser) {
          // User is signed in via Firebase Auth (email/password login)
          
          // If we already have user data and it matches, we're good
          if (userRef.current && userRef.current.id === firebaseUser.uid && !isPinAuthenticatedRef.current) {
            console.log('✅ Firebase user matches current user, no action needed');
            setLoading(false);
            authInitializedRef.current = true;
            return;
          }
          
          // Don't override PIN-authenticated users
          if (isPinAuthenticatedRef.current) {
            console.log('⚠️ Ignoring Firebase auth change - user is PIN authenticated');
            setLoading(false);
            authInitializedRef.current = true;
            return;
          }
          
          console.log('🔄 Processing Firebase authenticated user...');
          
          // Wait a bit for the signup process to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user document exists now
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            // User document found, update local state
            console.log('✅ Found user document for Firebase user');
            const userData = userDoc.data();
            const localUser: User = {
              id: userDoc.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              restaurantId: userData.restaurantId,
              pin: userData.pin,
              permissions: userData.permissions || [],
              isActive: userData.isActive,
              lastLoginAt: userData.lastLoginAt?.toDate(),
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date(),
              createdBy: userData.createdBy
            };
            
            console.log('📝 Setting Firebase authenticated user:', { name: localUser.name, email: localUser.email });
            setUser(localUser);
            setIsPinAuthenticated(false); // This is Firebase auth, not PIN auth
            
            // Store in localStorage
            storage.set(USER_STORAGE_KEY, localUser);
            storage.set(PIN_AUTH_STORAGE_KEY, false);
          } else {
            // If still no user document after waiting, something went wrong
            console.warn('Firebase user exists but no Firestore user document found after waiting');
            await RestaurantAuthService.logout();
            setUser(null);
            setIsPinAuthenticated(false);
            storage.remove(USER_STORAGE_KEY);
            storage.remove(PIN_AUTH_STORAGE_KEY);
          }
        } else {
          // User is signed out from Firebase
          // Only clear user if they were Firebase-authenticated (not PIN-authenticated)
          if (!isPinAuthenticatedRef.current) {
            console.log('🔄 Firebase user signed out, clearing user state');
            setUser(null);
            storage.remove(USER_STORAGE_KEY);
            storage.remove(PIN_AUTH_STORAGE_KEY);
          } else {
            console.log('⚠️ Firebase user signed out but keeping PIN authenticated user');
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (!isPinAuthenticatedRef.current) {
          console.log('❌ Error handling auth state, clearing user (not PIN authenticated)');
          setUser(null);
          storage.remove(USER_STORAGE_KEY);
          storage.remove(PIN_AUTH_STORAGE_KEY);
        } else {
          console.log('❌ Error handling auth state, keeping PIN authenticated user');
        }
      } finally {
        setLoading(false);
        authInitializedRef.current = true;
      }
    });

    return () => {
      console.log('🔄 RestaurantAuthContext: Cleaning up Firebase auth listener');
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, []); // Remove dependencies to prevent re-renders

  const login = async (email: string, password: string, restaurantSlug: string): Promise<void> => {
    try {
      console.log('🔐 Email login attempt:', { email, restaurantSlug });
      setLoading(true);
      
      const result = await RestaurantAuthService.loginWithEmail(email, password, restaurantSlug);
      
      if (result.success && result.user) {
        console.log('✅ Email login successful:', { name: result.user.name });
        setUser(result.user);
        setIsPinAuthenticated(false); // This is email/password login
        
        // Store in localStorage
        storage.set(USER_STORAGE_KEY, result.user);
        storage.set(PIN_AUTH_STORAGE_KEY, false);
        
        toast.success(`Welcome back, ${result.user.name}!`);
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Email login failed:', error.message);
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
      authInitializedRef.current = true;
    }
  };

  const loginWithPin = async (pin: string, restaurantSlug: string): Promise<void> => {
    try {
      console.log('🔐 PIN login attempt:', { pin: pin.substring(0, 2) + '**', restaurantSlug });
      setLoading(true);
      
      const result = await RestaurantAuthService.loginWithPin(pin, restaurantSlug);
      
      if (result.success && result.user) {
        console.log('✅ PIN login successful:', { name: result.user.name });
        setUser(result.user);
        setIsPinAuthenticated(true); // This is PIN-based login
        
        // Store in localStorage with PIN auth flag
        storage.set(USER_STORAGE_KEY, result.user);
        storage.set(PIN_AUTH_STORAGE_KEY, true);
        
        toast.success(`Welcome back, ${result.user.name}!`);
      } else {
        throw new Error(result.error || 'PIN login failed');
      }
    } catch (error: any) {
      console.error('❌ PIN login failed:', error.message);
      toast.error(error.message || 'PIN login failed');
      throw error;
    } finally {
      setLoading(false);
      authInitializedRef.current = true;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🔐 Logout attempt:', { isPinAuthenticated: isPinAuthenticatedRef.current });
      
      // Only logout from Firebase if user was Firebase-authenticated
      if (!isPinAuthenticatedRef.current) {
        console.log('📤 Signing out from Firebase Auth');
        await RestaurantAuthService.logout();
      } else {
        console.log('📤 PIN authenticated user logout (no Firebase signout)');
      }
      
      setUser(null);
      setIsPinAuthenticated(false);
      
      // Clear localStorage
      storage.remove(USER_STORAGE_KEY);
      storage.remove(PIN_AUTH_STORAGE_KEY);
      
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('❌ Logout failed:', error);
      toast.error('Logout failed');
      throw error;
    }
  };

  const value: RestaurantAuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isPinAuthenticated,
    login,
    loginWithPin,
    logout,
  };

  return (
    <RestaurantAuthContext.Provider value={value}>
      {children}
    </RestaurantAuthContext.Provider>
  );
}

export function useRestaurantAuth(): RestaurantAuthContextType {
  const context = useContext(RestaurantAuthContext);
  if (context === undefined) {
    throw new Error('useRestaurantAuth must be used within a RestaurantAuthProvider');
  }
  return context;
} 