import { 
  signInWithEmailAndPassword,
  UserCredential,
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, handleFirebaseError } from '@/lib/firebase';

// Type definitions
interface AdminLoginResult {
  success: boolean;
  error?: string;
  user?: {
    uid: string;
    email: string;
    role: string;
  };
}

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  businessType: 'restaurant' | 'cafe' | 'bar';
  status: 'active' | 'inactive' | 'deleted';
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  lastActivity: Date;
  settings: any;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    activeUsers: number;
  };
}

interface AdminDashboardStats {
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

// Super Admin Configuration


export class AdminService {
  /**
   * Login as super admin
   */
  static async loginAdmin(email: string, password: string): Promise<AdminLoginResult> {
    try {
      // Authenticate with Firebase
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user?.email) {
        return { success: false, error: 'Authentication failed' };
      }

      // Verify super admin status
      const isSuperAdmin = await this.verifySuperAdmin(user.email);
      if (!isSuperAdmin) {
        await auth.signOut();
        return { success: false, error: 'Insufficient privileges' };
      }

      // Log admin login
      await this.logAdminActivity(user.uid, 'login', {
        email: user.email,
        timestamp: new Date().toISOString(),
      });

      return { 
        success: true, 
        user: {
          uid: user.uid,
          email: user.email,
          role: 'super_admin'
        }
      };
    } catch (error: any) {
      const errorMessage = handleFirebaseError(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Verify if user is a super admin
   */
  static async verifySuperAdmin(email: string): Promise<boolean> {
    try {
      const adminDoc = await getDoc(doc(db, 'superAdmins', email));
      return adminDoc.exists() && adminDoc.data()?.active === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all restaurants for admin dashboard
   */
  static async getAllRestaurants(): Promise<AdminRestaurant[]> {
    try {
      const restaurantsRef = collection(db, 'restaurants');
      const restaurantsSnapshot = await getDocs(restaurantsRef);
      
      const restaurants: AdminRestaurant[] = [];
      
      for (const restaurantDoc of restaurantsSnapshot.docs) {
        const data = restaurantDoc.data();
        
        // Get owner details
        let ownerName = 'Unknown';
        if (data.ownerId) {
          try {
            const ownerDoc = await getDoc(doc(db, 'users', data.ownerId));
            if (ownerDoc.exists()) {
              const ownerData = ownerDoc.data();
              ownerName = ownerData.name || ownerData.email || 'Unknown';
            }
          } catch (error) {
            // Owner lookup failed, use default
          }
        }

        restaurants.push({
          id: restaurantDoc.id,
          name: data.name || 'Unnamed Restaurant',
          slug: data.slug || '',
          businessType: data.businessType || 'restaurant',
          status: data.status || 'inactive',
          ownerId: data.ownerId || '',
          ownerName,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastActivity: data.lastActivity?.toDate() || new Date(),
          settings: data.settings || {},
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            activeUsers: 0,
          }
        });
      }
      
      // Sort by creation date (newest first)
      restaurants.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return restaurants;
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }

  /**
   * Update restaurant status
   */
  static async updateRestaurantStatus(restaurantId: string, status: 'active' | 'inactive'): Promise<void> {
    try {
      const restaurantRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(restaurantRef, {
        status,
        lastActivity: serverTimestamp(),
      });

      // Log admin activity
      if (auth.currentUser) {
        await this.logAdminActivity(auth.currentUser.uid, 'restaurant_status_update', {
          restaurantId,
          newStatus: status,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }

  /**
   * Delete restaurant (soft delete by setting status to deleted)
   */
  static async deleteRestaurant(restaurantId: string): Promise<void> {
    try {
      const restaurantRef = doc(db, 'restaurants', restaurantId);
      
      // Soft delete by updating status
      await updateDoc(restaurantRef, {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });

      // Log admin activity
      if (auth.currentUser) {
        await this.logAdminActivity(auth.currentUser.uid, 'restaurant_delete', {
          restaurantId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }

  /**
   * Get admin dashboard statistics
   */
  static async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const restaurants = await this.getAllRestaurants();
      
      const stats: AdminDashboardStats = {
        totalRestaurants: restaurants.length,
        activeRestaurants: restaurants.filter(r => r.status === 'active').length,
        inactiveRestaurants: restaurants.filter(r => r.status === 'inactive').length,
        businessTypes: {
          restaurants: restaurants.filter(r => r.businessType === 'restaurant').length,
          cafes: restaurants.filter(r => r.businessType === 'cafe').length,
          bars: restaurants.filter(r => r.businessType === 'bar').length,
        },
        totalRevenue: restaurants.reduce((sum, r) => sum + (r.stats?.totalRevenue || 0), 0),
        totalOrders: restaurants.reduce((sum, r) => sum + (r.stats?.totalOrders || 0), 0),
      };

      return stats;
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }

  /**
   * Log admin activity for audit trail
   */
  private static async logAdminActivity(
    adminId: string, 
    action: string, 
    details: Record<string, any>
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId,
        action,
        details,
        timestamp: serverTimestamp(),
        ipAddress: 'unknown', // Could be enhanced with actual IP detection
      });
    } catch (error) {
      // Log activity failure should not break the main operation
    }
  }

  /**
   * Logout admin
   */
  static async logoutAdmin(): Promise<void> {
    try {
      if (auth.currentUser) {
        await this.logAdminActivity(auth.currentUser.uid, 'logout', {
          timestamp: new Date().toISOString(),
        });
      }
      await auth.signOut();
    } catch (error: any) {
      throw new Error(handleFirebaseError(error));
    }
  }
} 