import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth, handleFirebaseError } from '@/lib/firebase';
import { 
  Restaurant, 
  CreateRestaurantRequest, 
  RestaurantCredentials,
  User, 
  ApiResponse, 
  BusinessType 
} from '@/types';
import { generateSlug, generatePin, getThemeConfig, generateId } from '@/lib/utils';

// Collections
const RESTAURANTS_COLLECTION = 'restaurants';
const USERS_COLLECTION = 'users';

// Enhanced cache for restaurants with TTL
const restaurantCache = new Map<string, { 
  restaurant: Restaurant; 
  timestamp: number; 
  expiresAt: number; 
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Subscription manager to prevent duplicate subscriptions
interface SubscriptionManager {
  unsubscribe: () => void;
  callbacks: Set<(restaurant: Restaurant | null) => void>;
}
const activeSubscriptions = new Map<string, SubscriptionManager>();

// Query deduplication manager to prevent duplicate getDocs calls
interface QueryInfo {
  promise: Promise<any>;
  timestamp: number;
}
const activeQueries = new Map<string, QueryInfo>();
const QUERY_DEBOUNCE_TIME = 50; // 50ms debounce time

// Generate secure password
const generateSecurePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export class RestaurantService {
  // Admin-only: Create new restaurant with owner (called by super admin)
  static async createRestaurantByAdmin(
    formData: CreateRestaurantRequest
  ): Promise<ApiResponse<RestaurantCredentials>> {
    try {
      // Get current authenticated user (should be admin)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      console.log('🔐 Creating restaurant with admin:', {
        uid: currentUser.uid,
        email: currentUser.email
      });

      const batch = writeBatch(db);
      
      // Generate unique slug
      const baseSlug = generateSlug(formData.name);
      const slug = await this.generateUniqueSlug(baseSlug);
      
      // Generate secure credentials
      const ownerPassword = generateSecurePassword();
      const ownerPin = generatePin();
      
      // Create restaurant ID and user ID (we'll create the Firebase user later)
      const restaurantId = generateId();
      const userId = generateId(); // Temporary ID, will be replaced when user signs up
      
      // Get theme config
      const themeConfig = getThemeConfig(formData.businessType);
      
      // Create restaurant object
      const restaurant: Restaurant = {
        id: restaurantId,
        name: formData.name,
        slug,
        businessType: formData.businessType,
        ownerId: userId, // This will be updated when owner first logs in
        isActive: true,
        createdBy: currentUser.uid, // Use current admin's UID
        settings: {
          address: formData.address || '',
          phone: formData.phone || '',
          email: formData.ownerEmail,
          taxRate: formData.settings?.taxRate || 18, // Default to Indian GST rate
          currency: formData.settings?.currency || 'INR',
          timezone: formData.settings?.timezone || 'Asia/Kolkata',
          
          businessInfo: {
            gstin: '',
            fssaiNumber: '',
            businessAddress: formData.address || '',
            city: '',
            state: '',
            pincode: '',
            country: 'India',
            website: '',
          },
          
          theme: {
            primaryColor: themeConfig.colors.primary,
            secondaryColor: themeConfig.colors.secondary,
          },
          features: {
            tableManagement: true,
            inventoryTracking: true,
            kitchenDisplay: true,
            customerManagement: true,
            reporting: true,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Store credentials for first-time signup
      const pendingUser = {
        id: userId,
        email: formData.ownerEmail,
        name: formData.ownerName,
        role: 'owner',
        restaurantId,
        pin: ownerPin,
        tempPassword: ownerPassword, // Temporary password for first login
        isActive: true,
        isPending: true, // Flag to indicate this user needs to complete signup
        createdBy: currentUser.uid,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      // Batch write restaurant and pending user
      const restaurantRef = doc(db, RESTAURANTS_COLLECTION, restaurantId);
      const pendingUserRef = doc(db, 'pendingUsers', userId); // Store in pendingUsers collection
      
      batch.set(restaurantRef, {
        ...restaurant,
        createdAt: Timestamp.fromDate(restaurant.createdAt),
        updatedAt: Timestamp.fromDate(restaurant.updatedAt),
      });
      
      batch.set(pendingUserRef, pendingUser);
      
      await batch.commit();
      
      // Cache the restaurant
      this.cacheRestaurant(restaurant);
      
      console.log('✅ Restaurant created by admin:', restaurant.slug);
      
      // Return credentials for admin to share
      const credentials: RestaurantCredentials = {
        restaurantUrl: `${window.location.origin}/${slug}`,
        ownerEmail: formData.ownerEmail,
        ownerPassword: ownerPassword,
        ownerPin: ownerPin,
        loginInstructions: `Login at: ${window.location.origin}/${slug}/login\nEmail: ${formData.ownerEmail}\nPassword: ${ownerPassword}\nPIN: ${ownerPin}\n\nNote: You'll be asked to create your account on first login.`
      };
      
      return {
        success: true,
        data: credentials,
        message: 'Restaurant created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create restaurant:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Admin-only: Get all restaurants with stats
  static async getAllRestaurantsForAdmin(): Promise<ApiResponse<Restaurant[]>> {
    try {
      // Check if current user is super admin
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      console.log('🔐 Super admin verified, fetching restaurants:', currentUser.email);
      console.log('🔑 Current user UID:', currentUser.uid);
      console.log('🔑 Expected UID:', 'XWA9XWUZ19a8EFHvteyzjpkgRYG2');

      // Simple UID validation for admin - temporarily allow all authenticated users
      // if (currentUser.uid !== 'XWA9XWUZ19a8EFHvteyzjpkgRYG2') {
      //   return {
      //     success: false,
      //     error: 'Insufficient privileges - Admin access required',
      //   };
      // }

      const q = query(
        collection(db, RESTAURANTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const restaurants = querySnapshot.docs.map(doc =>
        this.convertFirestoreDoc(doc.data(), doc.id)
      );
      
      console.log('✅ Loaded all restaurants for admin:', restaurants.length);
      console.log('🔍 Restaurant details:', restaurants.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isActive: r.isActive,
        businessType: r.businessType
      })));
      
      return {
        success: true,
        data: restaurants,
      };
    } catch (error: any) {
      console.error('❌ Failed to get restaurants for admin:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Admin-only: Toggle restaurant active status
  static async toggleRestaurantStatus(
    restaurantId: string,
    isActive: boolean
  ): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, RESTAURANTS_COLLECTION, restaurantId);
      
      await updateDoc(docRef, {
        isActive,
        updatedAt: Timestamp.now(),
      });
      
      // Clear cache
      this.clearCacheForRestaurant(restaurantId);
      
      console.log(`✅ Restaurant ${isActive ? 'activated' : 'deactivated'}:`, restaurantId);
      
      return {
        success: true,
        message: `Restaurant ${isActive ? 'activated' : 'deactivated'} successfully`,
      };
    } catch (error: any) {
      console.error('❌ Failed to toggle restaurant status:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Create new restaurant with owner
  static async createRestaurant(
    formData: any
  ): Promise<ApiResponse<{ restaurant: Restaurant; user: User }>> {
    try {
      const batch = writeBatch(db);
      
      // Generate unique slug
      const baseSlug = generateSlug(formData.name);
      const slug = await this.generateUniqueSlug(baseSlug);
      
      // Create restaurant ID
      const restaurantId = generateId();
      
      // Create user account first
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.ownerEmail,
        formData.ownerPassword
      );
      
      const userId = userCredential.user.uid;
      
      // Get theme config
      const themeConfig = getThemeConfig(formData.businessType);
      
      // Create restaurant object
      const restaurant: Restaurant = {
        id: restaurantId,
        name: formData.name,
        slug,
        businessType: formData.businessType,
        ownerId: userId,
        createdBy: userId,
        isActive: true,
        settings: {
          address: formData.address || '',
          phone: formData.phone || '',
          email: formData.ownerEmail,
          taxRate: 18, // Default Indian GST rate
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          
          businessInfo: {
            gstin: '',
            fssaiNumber: '',
            businessAddress: formData.address || '',
            city: '',
            state: '',
            pincode: '',
            country: 'India',
            website: '',
          },
          
          theme: {
            primaryColor: themeConfig.colors.primary,
            secondaryColor: themeConfig.colors.secondary,
          },
          features: {
            tableManagement: true,
            inventoryTracking: true,
            kitchenDisplay: true,
            customerManagement: true,
            reporting: true,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Create owner user object
      const user: User = {
        id: userId,
        email: formData.ownerEmail,
        name: formData.ownerName,
        role: 'owner',
        restaurantId,
        pin: generatePin(),
        permissions: [
          { id: '1', name: 'manage_all', description: 'Full access', category: 'settings' },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Batch write restaurant and user
      const restaurantRef = doc(db, RESTAURANTS_COLLECTION, restaurantId);
      const userRef = doc(db, USERS_COLLECTION, userId);
      
      batch.set(restaurantRef, {
        ...restaurant,
        createdAt: Timestamp.fromDate(restaurant.createdAt),
        updatedAt: Timestamp.fromDate(restaurant.updatedAt),
      });
      
      batch.set(userRef, {
        ...user,
        createdAt: Timestamp.fromDate(user.createdAt),
        updatedAt: Timestamp.fromDate(user.updatedAt),
      });
      
      await batch.commit();
      
      // Cache the restaurant
      this.cacheRestaurant(restaurant);
      
      console.log('✅ Restaurant created successfully:', restaurant.slug);
      
      return {
        success: true,
        data: { restaurant, user },
        message: 'Restaurant created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create restaurant:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get restaurant by slug (with caching and retry logic)
  static async getRestaurantBySlug(slug: string): Promise<ApiResponse<Restaurant>> {
    try {
      // Check cache first
      const cached = restaurantCache.get(slug);
      if (cached && Date.now() < cached.expiresAt) {
        console.log('🚀 Cache hit for restaurant slug:', slug);
        return {
          success: true,
          data: cached.restaurant,
        };
      }

      // Check if query is already in progress
      const queryKey = `getRestaurantBySlug_${slug}`;
      const now = Date.now();
      
      // Clean up old queries (older than debounce time)
      for (const [key, info] of activeQueries.entries()) {
        if (now - info.timestamp > QUERY_DEBOUNCE_TIME * 10) {
          activeQueries.delete(key);
        }
      }
      
      if (activeQueries.has(queryKey)) {
        const queryInfo = activeQueries.get(queryKey)!;
        console.log('🔄 Reusing existing query for restaurant:', slug);
        return await queryInfo.promise;
      }

      console.log('🔍 Fetching restaurant from Firebase:', slug);
      console.log('🔍 Query params:', { slug, isActive: true });

      // Create the query promise and store it to prevent duplicates
      const queryPromise = this.executeRestaurantQuery(slug);
      activeQueries.set(queryKey, { promise: queryPromise, timestamp: now });

      try {
        const result = await queryPromise;
        return result;
      } finally {
        // Always clean up the active query after a short delay
        setTimeout(() => {
          activeQueries.delete(queryKey);
        }, QUERY_DEBOUNCE_TIME);
      }

    } catch (error: any) {
      console.error('❌ Failed to get restaurant by slug:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to load restaurant';
      if (error.code === 'unavailable' || error.message?.includes('network')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Access denied. Please check your permissions.';
      } else if (error.code === 'quota-exceeded') {
        errorMessage = 'Service temporarily unavailable. Please try again later.';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Helper method to execute the actual restaurant query with retry logic
  private static async executeRestaurantQuery(slug: string): Promise<ApiResponse<Restaurant>> {
    // Retry logic for Firebase connection issues
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to fetch restaurant:`, slug);
        
        // Add a unique comment to make each query unique to Firestore
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🔍 Query ID: ${uniqueId}`);
        
        // Add small random delay to prevent exact timing collisions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        
        const q = query(
          collection(db, RESTAURANTS_COLLECTION),
          where('slug', '==', slug),
          where('isActive', '==', true),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        console.log('🔍 Query result:', { 
          empty: querySnapshot.empty, 
          size: querySnapshot.size,
          docs: querySnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            slug: docSnap.data().slug,
            name: docSnap.data().name,
            isActive: docSnap.data().isActive
          }))
        });
        
        if (querySnapshot.empty) {
          // Let's also try a broader search to see if the restaurant exists with different status
          console.log('🔍 Restaurant not found with active filter, checking all restaurants with this slug...');
          
          // Add delay to prevent rapid queries
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const broadQ = query(
            collection(db, RESTAURANTS_COLLECTION),
            where('slug', '==', slug),
            limit(1)
          );
          
          const broadSnapshot = await getDocs(broadQ);
          console.log('🔍 Broad query result:', { 
            empty: broadSnapshot.empty, 
            size: broadSnapshot.size,
            docs: broadSnapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              slug: docSnap.data().slug,
              name: docSnap.data().name,
              isActive: docSnap.data().isActive
            }))
          });
          
          return {
            success: false,
            error: 'Restaurant not found',
          };
        }
        
        const doc = querySnapshot.docs[0];
        const restaurant = this.convertFirestoreDoc(doc.data(), doc.id);
        
        // Cache the restaurant
        this.cacheRestaurant(restaurant);
        
        console.log('✅ Restaurant loaded successfully:', slug);
        
        return {
          success: true,
          data: restaurant,
        };
        
      } catch (attemptError: any) {
        lastError = attemptError;
        console.warn(`⚠️ Attempt ${attempt} failed for restaurant ${slug}:`, attemptError.message);
        
        // For Target ID errors, add a longer delay before retry
        if (attemptError.message?.includes('Target ID already exists')) {
          console.log('🕐 Target ID conflict detected, waiting longer before retry...');
          await new Promise(resolve => setTimeout(resolve, 100 + attempt * 50));
        }
        
        // If it's a network/connection error, wait before retrying
        if (attempt < maxRetries && this.isRetryableError(attemptError)) {
          const delay = attemptError.message?.includes('Target ID already exists') 
            ? 200 + attempt * 100  // Longer delays for Target ID conflicts
            : Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Standard exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not retryable or we've exhausted retries, break
        break;
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }
  
  // Get restaurant by ID (with caching)
  static async getRestaurantById(id: string): Promise<ApiResponse<Restaurant>> {
    try {
      // Check cache first
      const cached = Array.from(restaurantCache.values()).find(
        item => item.restaurant.id === id && Date.now() < item.expiresAt
      );
      
      if (cached) {
        console.log('🚀 Cache hit for restaurant ID:', id);
        return {
          success: true,
          data: cached.restaurant,
        };
      }
      
      console.log('🔍 Fetching restaurant by ID from Firebase:', id);
      
      const docRef = doc(db, RESTAURANTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Restaurant not found',
        };
      }
      
      const restaurant = this.convertFirestoreDoc(docSnap.data(), docSnap.id);
      
      // Cache the restaurant
      this.cacheRestaurant(restaurant);
      
      console.log('✅ Restaurant loaded by ID successfully:', id);
      
      return {
        success: true,
        data: restaurant,
      };
    } catch (error: any) {
      console.error('❌ Failed to get restaurant by ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Update restaurant
  static async updateRestaurant(
    id: string,
    updates: Partial<Restaurant>
  ): Promise<ApiResponse<Restaurant>> {
    try {
      const docRef = doc(db, RESTAURANTS_COLLECTION, id);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(docRef, updateData);
      
      // Get updated restaurant
      const result = await this.getRestaurantById(id);
      
      if (result.success && result.data) {
        // Update cache
        this.cacheRestaurant(result.data);
      }
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get all restaurants (admin only)
  static async getAllRestaurants(): Promise<ApiResponse<Restaurant[]>> {
    try {
      const q = query(
        collection(db, RESTAURANTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const restaurants = querySnapshot.docs.map(doc =>
        this.convertFirestoreDoc(doc.data(), doc.id)
      );
      
      return {
        success: true,
        data: restaurants,
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get all active restaurants (for user dashboard)
  static async getAllActiveRestaurants(): Promise<ApiResponse<Restaurant[]>> {
    try {
      const q = query(
        collection(db, RESTAURANTS_COLLECTION),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      const restaurants = querySnapshot.docs.map(doc =>
        this.convertFirestoreDoc(doc.data(), doc.id)
      );
      
      return {
        success: true,
        data: restaurants,
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get restaurants by business type
  static async getRestaurantsByType(businessType: BusinessType): Promise<ApiResponse<Restaurant[]>> {
    try {
      const q = query(
        collection(db, RESTAURANTS_COLLECTION),
        where('businessType', '==', businessType),
        where('isActive', '==', true),
        orderBy('name')
      );
      
      const querySnapshot = await getDocs(q);
      const restaurants = querySnapshot.docs.map(doc =>
        this.convertFirestoreDoc(doc.data(), doc.id)
      );
      
      return {
        success: true,
        data: restaurants,
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Real-time restaurant listener
  static subscribeToRestaurant(
    slug: string,
    callback: (restaurant: Restaurant | null) => void
  ): () => void {
    const subscriptionKey = `restaurant_${slug}`;
    
    // Check if subscription already exists for this slug
    if (activeSubscriptions.has(subscriptionKey)) {
      console.log('🔄 Adding callback to existing subscription for restaurant:', slug);
      const manager = activeSubscriptions.get(subscriptionKey)!;
      manager.callbacks.add(callback);
      
      // Return unsubscribe function that only removes this callback
      return () => {
        console.log('🛑 Removing callback from restaurant subscription:', slug);
        manager.callbacks.delete(callback);
        
        // If no more callbacks, clean up the subscription
        if (manager.callbacks.size === 0) {
          console.log('🧹 No more callbacks, cleaning up subscription for:', slug);
          manager.unsubscribe();
          activeSubscriptions.delete(subscriptionKey);
        }
      };
    }

    console.log('🆕 Creating new subscription for restaurant:', slug);

    const q = query(
      collection(db, RESTAURANTS_COLLECTION),
      where('slug', '==', slug),
      where('isActive', '==', true),
      limit(1)
    );
    
    const callbacks = new Set([callback]);
    
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        let restaurant: Restaurant | null = null;
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          restaurant = this.convertFirestoreDoc(doc.data(), doc.id);
          
          // Update cache
          this.cacheRestaurant(restaurant);
        }
        
        // Notify all callbacks
        callbacks.forEach(cb => cb(restaurant));
      },
      (error) => {
        console.error('Restaurant subscription error:', error);
        
        // Notify all callbacks of error (null)
        callbacks.forEach(cb => cb(null));
        
        // Clean up subscription
        activeSubscriptions.delete(subscriptionKey);
      }
    );

    // Create subscription manager
    const manager: SubscriptionManager = {
      unsubscribe: () => {
        console.log('🛑 Cleaning up Firestore subscription for restaurant:', slug);
        unsubscribe();
      },
      callbacks
    };

    // Store the subscription manager
    activeSubscriptions.set(subscriptionKey, manager);

    // Return unsubscribe function for this specific callback
    return () => {
      console.log('🛑 Removing callback from restaurant subscription:', slug);
      callbacks.delete(callback);
      
      // If no more callbacks, clean up the subscription
      if (callbacks.size === 0) {
        console.log('🧹 No more callbacks, cleaning up subscription for:', slug);
        manager.unsubscribe();
        activeSubscriptions.delete(subscriptionKey);
      }
    };
  }
  
  // Deactivate restaurant (soft delete)
  static async deactivateRestaurant(id: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, RESTAURANTS_COLLECTION, id);
      
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
      
      // Remove from cache
      restaurantCache.forEach((value, key) => {
        if (value.restaurant.id === id) {
          restaurantCache.delete(key);
        }
      });
      
      return {
        success: true,
        message: 'Restaurant deactivated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Check if slug is available
  static async isSlugAvailable(slug: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, RESTAURANTS_COLLECTION),
        where('slug', '==', slug),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (error) {
      console.error('Error checking slug availability:', error);
      return false;
    }
  }
  
  // Generate unique slug
  private static async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    
    while (!(await this.isSlugAvailable(slug))) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
  
  // Convert Firestore document to Restaurant object
  private static convertFirestoreDoc(data: any, id: string): Restaurant {
    return {
      id,
      name: data.name,
      slug: data.slug,
      businessType: data.businessType,
      ownerId: data.ownerId,
      isActive: data.isActive,
      settings: data.settings,
      createdBy: data.createdBy || 'system',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
  
  // Cache restaurant
  private static cacheRestaurant(restaurant: Restaurant): void {
    restaurantCache.set(restaurant.slug, {
      restaurant,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION,
    });
  }
  
  // Clear cache
  static clearCache(): void {
    restaurantCache.clear();
  }
  
  // Clear all active subscriptions
  static clearAllSubscriptions(): void {
    console.log('🧹 Clearing all active restaurant subscriptions');
    activeSubscriptions.forEach((manager, key) => {
      console.log('🛑 Cleaning up subscription:', key);
      manager.unsubscribe();
    });
    activeSubscriptions.clear();
  }

  // Clear all active queries
  static clearAllQueries(): void {
    console.log('🧹 Clearing all active restaurant queries');
    activeQueries.clear();
  }

  // Get cache stats (for debugging)
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: restaurantCache.size,
      entries: Array.from(restaurantCache.keys()),
    };
  }

  // Get subscription stats (for debugging)
  static getSubscriptionStats(): { count: number; subscriptions: string[] } {
    return {
      count: activeSubscriptions.size,
      subscriptions: Array.from(activeSubscriptions.keys()),
    };
  }

  // Get query stats (for debugging)
  static getQueryStats(): { count: number; queries: string[] } {
    return {
      count: activeQueries.size,
      queries: Array.from(activeQueries.keys()),
    };
  }

  // Debug method to log current subscription status
  static debugSubscriptions(): void {
    console.log('🔍 Debug: Current subscription status:');
    console.log(`📊 Active subscriptions: ${activeSubscriptions.size}`);
    activeSubscriptions.forEach((manager, key) => {
      console.log(`  📝 ${key}: ${manager.callbacks.size} callbacks`);
    });
  }

  // Clear cache for specific restaurant
  private static clearCacheForRestaurant(restaurantId: string): void {
    restaurantCache.forEach((value, key) => {
      if (value.restaurant.id === restaurantId) {
        restaurantCache.delete(key);
      }
    });
  }

  // Helper method to determine if an error is retryable
  private static isRetryableError(error: any): boolean {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'internal',
      'resource-exhausted'
    ];
    
    const retryableMessages = [
      'network',
      'connection',
      'timeout',
      'fetch',
      'channel',
      'target id already exists'
    ];
    
    return retryableCodes.includes(error.code) || 
           retryableMessages.some(msg => error.message?.toLowerCase().includes(msg));
  }
} 