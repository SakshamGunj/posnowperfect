import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  UserCredential 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  query, 
  collection, 
  where, 
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { auth, db, handleFirebaseError } from '@/lib/firebase';
import { User } from '@/types';
import { EmployeeService } from './employeeService';

export interface RestaurantLoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

export class RestaurantAuthService {
  /**
   * Login restaurant user with email and password
   */
  static async loginWithEmail(
    email: string, 
    password: string, 
    restaurantSlug: string
  ): Promise<RestaurantLoginResult> {
    try {
      console.log('🔐 Starting email login:', { email, restaurantSlug });
      
      // First, check if this is a pending user (first-time login)
      const pendingUsersQuery = query(
        collection(db, 'pendingUsers'),
        where('email', '==', email)
      );
      
      const pendingUsersSnapshot = await getDocs(pendingUsersQuery);
      console.log('🔍 Pending users check:', { 
        empty: pendingUsersSnapshot.empty, 
        size: pendingUsersSnapshot.size 
      });
      
      if (!pendingUsersSnapshot.empty) {
        console.log('✅ Found pending user, handling first-time signup');
        // This is a first-time login, handle signup
        return await this.handleFirstTimeSignup(email, password, restaurantSlug, pendingUsersSnapshot.docs[0]);
      }

      console.log('🔍 No pending user found, checking for employee login...');
      
      // Check if this is an employee login
      const restaurantQuery = query(
        collection(db, 'restaurants'),
        where('slug', '==', restaurantSlug)
      );
      
      const restaurantSnapshot = await getDocs(restaurantQuery);
      if (!restaurantSnapshot.empty) {
        const restaurantDoc = restaurantSnapshot.docs[0];
        const restaurantId = restaurantDoc.id;
        
        console.log('🔍 Attempting employee login for restaurant:', restaurantId);
        const employeeResult = await EmployeeService.loginEmployee(email, password, restaurantId);
        
        if (employeeResult.success && employeeResult.data) {
          console.log('✅ Employee login successful:', employeeResult.data.name);
          
          // Convert employee to user format for compatibility
          const employeeAsUser: User = {
            id: employeeResult.data.id,
            email: employeeResult.data.email,
            name: employeeResult.data.name,
            role: employeeResult.data.role as any, // 'manager' | 'staff' -> UserRole
            restaurantId: employeeResult.data.restaurantId,
            pin: employeeResult.data.pin,
            permissions: [], // Employee permissions are handled differently
            isActive: employeeResult.data.isActive,
            lastLoginAt: employeeResult.data.lastLoginAt,
            createdAt: employeeResult.data.createdAt,
            updatedAt: employeeResult.data.updatedAt,
            createdBy: employeeResult.data.createdBy
          };
          
          return { success: true, user: employeeAsUser };
        }
      }
      
      console.log('🔍 Employee login failed, attempting owner login');
      
      // Regular owner login flow
      try {
        // Authenticate with Firebase
        console.log('🔐 Attempting Firebase Auth login...');
        const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        console.log('✅ Firebase Auth successful:', firebaseUser.uid);

        if (!firebaseUser?.email) {
          console.log('❌ No Firebase user email');
          return { success: false, error: 'Authentication failed' };
        }

        // Get user data from Firestore
        console.log('🔍 Looking for user document in Firestore...');
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        console.log('🔍 User document exists:', userDoc.exists());
        
        if (!userDoc.exists()) {
          console.log('❌ User document not found in Firestore');
          await signOut(auth);
          return { success: false, error: 'User account not found. Please contact your administrator.' };
        }

        const userData = userDoc.data();
        const user: User = {
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

        // Verify user belongs to the restaurant
        if (!user.restaurantId) {
          await signOut(auth);
          return { success: false, error: 'User not associated with any restaurant' };
        }

        // Get restaurant data to verify slug
        const restaurantDoc = await getDoc(doc(db, 'restaurants', user.restaurantId));
        if (!restaurantDoc) {
          throw new Error('Failed to retrieve restaurant data');
        }
        
        if (restaurantDoc.exists()) {
          const restaurantData = restaurantDoc.data();
          console.log('🏪 Restaurant data:', { 
            name: restaurantData?.name,
            id: userData.restaurantId 
          });
        } else {
          console.log('❌ Restaurant document not found:', userData.restaurantId);
          await signOut(auth);
          return { success: false, error: 'Restaurant not found' };
        }

        // Check if user is active
        if (!user.isActive) {
          await signOut(auth);
          return { success: false, error: 'Your account has been deactivated. Contact your manager.' };
        }

        // Check if restaurant is active
        if (!restaurantDoc.data()?.isActive) {
          await signOut(auth);
          return { success: false, error: 'This restaurant is currently inactive' };
        }

        // Update last login time
        await updateDoc(doc(db, 'users', user.id), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        return { 
          success: true, 
          user: {
            ...user,
            lastLoginAt: new Date()
          }
        };
      } catch (authError: any) {
        // If login fails, check if the error is due to user not existing
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password') {
          return { success: false, error: 'Invalid email or password' };
        }
        throw authError;
      }
    } catch (error: any) {
      const errorMessage = handleFirebaseError(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle first-time signup for pending users
   */
  private static async handleFirstTimeSignup(
    email: string,
    password: string,
    restaurantSlug: string,
    pendingUserDoc: any
  ): Promise<RestaurantLoginResult> {
    try {
      const pendingUserData = pendingUserDoc.data();
      console.log('🔄 First-time signup data:', {
        email: pendingUserData.email,
        restaurantId: pendingUserData.restaurantId,
        tempPassword: pendingUserData.tempPassword?.substring(0, 3) + '***'
      });
      
      // Verify password matches the temporary password
      const providedPassword = password.trim();
      const expectedPassword = pendingUserData.tempPassword?.trim();
      
      console.log('🔍 Password comparison:', {
        providedLength: providedPassword.length,
        expectedLength: expectedPassword?.length,
        match: providedPassword === expectedPassword
      });
      
      if (providedPassword !== expectedPassword) {
        console.log('❌ Password mismatch:', {
          provided: providedPassword.substring(0, 3) + '***',
          expected: expectedPassword?.substring(0, 3) + '***'
        });
        return { success: false, error: 'Invalid password. Please use the password provided by your admin.' };
      }

      console.log('✅ Password verified, checking restaurant...');
      
      // Verify restaurant slug
      const restaurantDoc = await getDoc(doc(db, 'restaurants', pendingUserData.restaurantId));
      if (!restaurantDoc.exists()) {
        console.log('❌ Restaurant not found');
        return { success: false, error: 'Restaurant not found' };
      }

      const restaurantData = restaurantDoc.data();
      console.log('🏪 Restaurant data:', {
        slug: restaurantData.slug,
        expectedSlug: restaurantSlug,
        isActive: restaurantData.isActive
      });
      
      if (restaurantData.slug !== restaurantSlug) {
        console.log('❌ Restaurant slug mismatch');
        return { success: false, error: 'User does not belong to this restaurant' };
      }

      console.log('✅ Restaurant verified, creating Firebase Auth account...');
      
      // Create Firebase Auth account
      let userCredential: UserCredential;
      let firebaseUser: FirebaseUser;
      
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = userCredential.user;
        console.log('✅ Firebase Auth account created:', firebaseUser.uid);
      } catch (authError: any) {
        console.log('⚠️ Firebase Auth error:', authError.code, authError.message);
        
        if (authError.code === 'auth/email-already-in-use') {
          // User already exists, try to sign in instead
          console.log('🔄 Email already in use, attempting to sign in...');
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
            firebaseUser = userCredential.user;
            console.log('✅ Firebase Auth sign in successful:', firebaseUser.uid);
          } catch (signInError: any) {
            console.log('❌ Sign in failed:', signInError.code, signInError.message);
            return { success: false, error: 'Account setup error. Please contact your administrator.' };
          }
        } else {
          console.log('❌ Failed to create Firebase Auth account:', authError.message);
          return { success: false, error: `Account creation failed: ${authError.message}` };
        }
      }

      // Create user document in Firestore
      const user: User = {
        id: firebaseUser.uid,
        email: pendingUserData.email,
        name: pendingUserData.name,
        role: pendingUserData.role,
        restaurantId: pendingUserData.restaurantId,
        pin: pendingUserData.pin,
        permissions: pendingUserData.permissions || [
          { id: '1', name: 'manage_all', description: 'Full restaurant access', category: 'settings' }
        ],
        isActive: pendingUserData.isActive,
        lastLoginAt: new Date(),
        createdAt: pendingUserData.createdAt?.toDate() || new Date(),
        updatedAt: new Date(),
        createdBy: pendingUserData.createdBy
      };

      // Check if user document already exists
      const existingUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (existingUserDoc.exists()) {
        console.log('✅ User document already exists, proceeding with login...');
        
        // Just delete the pending user and return the existing user
        await deleteDoc(doc(db, 'pendingUsers', pendingUserDoc.id));
        console.log('🗑️ Deleted pending user document');
        
        const userData = existingUserDoc.data();
        const existingUser: User = {
          id: existingUserDoc.id,
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
        
        // Update last login time
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        return { 
          success: true, 
          user: {
            ...existingUser,
            lastLoginAt: new Date()
          }
        };
      }

      // Batch write: create user and update restaurant owner ID, delete pending user
      const batch = writeBatch(db);
      
      console.log('📝 Creating batch write operations...');
      
      // Create user document
      const userRef = doc(db, 'users', firebaseUser.uid);
      batch.set(userRef, {
        ...user,
        createdAt: pendingUserData.createdAt,
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
      console.log('📝 Added user creation to batch');

      // Update restaurant owner ID to the real Firebase UID
      const restaurantRef = doc(db, 'restaurants', pendingUserData.restaurantId);
      batch.update(restaurantRef, {
        ownerId: firebaseUser.uid,
        updatedAt: serverTimestamp()
      });
      console.log('📝 Added restaurant update to batch');

      // Delete pending user document
      const pendingUserRef = doc(db, 'pendingUsers', pendingUserDoc.id);
      batch.delete(pendingUserRef);
      console.log('📝 Added pending user deletion to batch');

      console.log('🚀 Committing batch write...');
      await batch.commit();
      console.log('✅ Batch write completed successfully');

      return { 
        success: true, 
        user: {
          ...user,
          lastLoginAt: new Date()
        }
      };
    } catch (error: any) {
      const errorMessage = handleFirebaseError(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Login restaurant user with PIN
   */
  static async loginWithPin(
    pin: string, 
    restaurantSlug: string
  ): Promise<RestaurantLoginResult> {
    try {
      console.log('🔐 Starting PIN login:', { pin: pin.substring(0, 2) + '**', restaurantSlug });
      
      // First, get the restaurant ID from slug
      const restaurantQuery = query(
        collection(db, 'restaurants'),
        where('slug', '==', restaurantSlug)
      );
      
      const restaurantSnapshot = await getDocs(restaurantQuery);
      if (restaurantSnapshot.empty) {
        return { success: false, error: 'Restaurant not found' };
      }
      
      const restaurantDoc = restaurantSnapshot.docs[0];
      const restaurantId = restaurantDoc.id;
      
      // Check for employee login first
      console.log('🔍 Attempting employee PIN login...');
      const employeeResult = await EmployeeService.loginEmployeeWithPin(pin.trim(), restaurantId);
      
      if (employeeResult.success && employeeResult.data) {
        console.log('✅ Employee PIN login successful:', employeeResult.data.name);
        
        // Convert employee to user format for compatibility
        const employeeAsUser: User = {
          id: employeeResult.data.id,
          email: employeeResult.data.email,
          name: employeeResult.data.name,
          role: employeeResult.data.role as any, // 'manager' | 'staff' -> UserRole
          restaurantId: employeeResult.data.restaurantId,
          pin: employeeResult.data.pin,
          permissions: [], // Employee permissions are handled differently
          isActive: employeeResult.data.isActive,
          lastLoginAt: employeeResult.data.lastLoginAt,
          createdAt: employeeResult.data.createdAt,
          updatedAt: employeeResult.data.updatedAt,
          createdBy: employeeResult.data.createdBy
        };
        
        return { success: true, user: employeeAsUser };
      }
      
      console.log('🔍 Employee PIN login failed, attempting owner PIN login');
      
      // Find owner by PIN and restaurant
      const cleanPin = pin.trim();
      const usersQuery = query(
        collection(db, 'users'),
        where('pin', '==', cleanPin)
      );

      console.log('🔍 Searching for users with PIN...');
      console.log('🔍 Searching for PIN:', cleanPin.substring(0, 2) + '**');
      let usersSnapshot;
      
      try {
        usersSnapshot = await getDocs(usersQuery);
      } catch (queryError: any) {
        // Check for internal assertion failure
        if (queryError.message?.includes('INTERNAL ASSERTION FAILED') || 
            queryError.message?.includes('Unexpected state')) {
          console.error('🔥 Firestore internal assertion failure detected. Please refresh the page.');
          throw new Error('Database connection error. Please refresh the page and try again.');
        } else {
          throw queryError;
        }
      }
      
      console.log('🔍 Found users with PIN:', usersSnapshot.size);
      
      if (usersSnapshot.empty) {
        console.log('❌ No users found with PIN');
        
        // Check if this PIN exists in pendingUsers (user hasn't completed signup)
        const pendingUsersQuery = query(
          collection(db, 'pendingUsers'),
          where('pin', '==', cleanPin)
        );
        
        try {
          const pendingUsersSnapshot = await getDocs(pendingUsersQuery);
          if (!pendingUsersSnapshot.empty) {
            // Check if any pending user belongs to this restaurant
            for (const pendingDoc of pendingUsersSnapshot.docs) {
              const pendingData = pendingDoc.data();
              if (pendingData.restaurantId) {
                const restaurantDoc = await getDoc(doc(db, 'restaurants', pendingData.restaurantId));
                if (restaurantDoc.exists() && restaurantDoc.data()?.slug === restaurantSlug) {
                  return { 
                    success: false, 
                    error: 'Please complete your first-time setup by logging in with your email and password first, then you can use PIN login.' 
                  };
                }
              }
            }
          }
        } catch (pendingError) {
          console.error('Error checking pending users:', pendingError);
        }
        
        return { success: false, error: 'Invalid PIN' };
      }

      // Check each user to find the one belonging to this restaurant
      let validUser: User | null = null;
      
      console.log('🔍 Checking users for restaurant match...');
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        console.log('👤 Checking user:', { 
          id: userDoc.id, 
          email: userData.email, 
          restaurantId: userData.restaurantId 
        });
        
        if (userData.restaurantId) {
          // Get restaurant data to verify slug
          console.log('🏪 Fetching restaurant data for:', userData.restaurantId);
          
          let restaurantDoc;
          try {
            restaurantDoc = await getDoc(doc(db, 'restaurants', userData.restaurantId));
          } catch (docError: any) {
            // Check for internal assertion failure - let global handler catch it
            if (docError.message?.includes('INTERNAL ASSERTION FAILED') || 
                docError.message?.includes('Unexpected state')) {
              console.error('🔥 Firestore assertion failure in restaurant fetch');
              throw docError; // Let global error handler catch this
            } else {
              throw docError;
            }
          }
          
          if (restaurantDoc.exists()) {
            const restaurantData = restaurantDoc.data();
            console.log('🏪 Restaurant data:', { 
              slug: restaurantData.slug, 
              expectedSlug: restaurantSlug,
              match: restaurantData.slug === restaurantSlug 
            });
            
            if (restaurantData.slug === restaurantSlug) {
              console.log('✅ Found matching user for restaurant');
              validUser = {
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
              break;
            }
          } else {
            console.log('❌ Restaurant document not found:', userData.restaurantId);
          }
        } else {
          console.log('⚠️ User has no restaurantId:', userDoc.id);
        }
      }

      if (!validUser) {
        console.log('❌ No valid user found for restaurant');
        return { success: false, error: 'Invalid PIN for this restaurant' };
      }

      // Check if user is active
      if (!validUser.isActive) {
        console.log('❌ User is not active');
        return { success: false, error: 'Your account has been deactivated. Contact your manager.' };
      }

      console.log('✅ PIN authentication successful for user:', validUser.name);

      // Note: PIN login doesn't authenticate with Firebase Auth
      // This is for quick access only. For full Firebase features, 
      // users should use email/password login

      // Update last login time
      console.log('📝 Updating last login time...');
      await updateDoc(doc(db, 'users', validUser.id), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('✅ PIN login completed successfully');
      return { 
        success: true, 
        user: {
          ...validUser,
          lastLoginAt: new Date()
        }
      };
    } catch (error: any) {
      console.error('❌ PIN login error:', error);
      const errorMessage = handleFirebaseError(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Logout current user
   */
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }

  /**
   * Get current authenticated user from Firebase Auth
   */
  static getCurrentFirebaseUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Check if current user is authenticated with Firebase
   */
  static isFirebaseAuthenticated(): boolean {
    return auth.currentUser !== null;
  }
} 