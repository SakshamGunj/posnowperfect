import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { 
  ExpenseCategory, 
  ExpenseCategoryType,
  ApiResponse 
} from '@/types';
import { generateId } from '@/lib/utils';

// Collections
const EXPENSE_CATEGORIES_COLLECTION = 'expenseCategories';

// Default expense categories
const DEFAULT_CATEGORIES: Omit<ExpenseCategory, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
  {
    name: 'Staff Salaries',
    description: 'Employee wages, salaries, and benefits',
    color: '#3B82F6',
    icon: 'Users',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 100000,
      alertThreshold: 80,
    },
  },
  {
    name: 'Inventory & Supplies',
    description: 'Food ingredients, beverages, and raw materials',
    color: '#10B981',
    icon: 'Package',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 50000,
      alertThreshold: 85,
    },
  },
  {
    name: 'Utilities',
    description: 'Electricity, water, gas, internet, and phone bills',
    color: '#F59E0B',
    icon: 'Zap',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 15000,
      alertThreshold: 75,
    },
  },
  {
    name: 'Rent & Property',
    description: 'Restaurant rent, property taxes, and maintenance',
    color: '#8B5CF6',
    icon: 'Building',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 80000,
      alertThreshold: 90,
    },
  },
  {
    name: 'Marketing & Advertising',
    description: 'Promotional activities, social media ads, and campaigns',
    color: '#EF4444',
    icon: 'Megaphone',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 20000,
      alertThreshold: 70,
    },
  },
  {
    name: 'Equipment & Technology',
    description: 'Kitchen equipment, POS systems, and technology upgrades',
    color: '#6366F1',
    icon: 'Laptop',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 25000,
      alertThreshold: 80,
    },
  },
  {
    name: 'Maintenance & Repairs',
    description: 'Equipment repairs, cleaning supplies, and facility maintenance',
    color: '#84CC16',
    icon: 'Wrench',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 12000,
      alertThreshold: 75,
    },
  },
  {
    name: 'Professional Services',
    description: 'Accounting, legal, consulting, and professional fees',
    color: '#06B6D4',
    icon: 'FileText',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 10000,
      alertThreshold: 80,
    },
  },
  {
    name: 'Insurance',
    description: 'Business insurance, liability coverage, and worker compensation',
    color: '#EC4899',
    icon: 'Shield',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 8000,
      alertThreshold: 90,
    },
  },
  {
    name: 'Transportation',
    description: 'Delivery vehicles, fuel, and transportation costs',
    color: '#F97316',
    icon: 'Truck',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 15000,
      alertThreshold: 75,
    },
  },
  {
    name: 'Taxes & Fees',
    description: 'Government taxes, licensing fees, and regulatory compliance',
    color: '#64748B',
    icon: 'Receipt',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 20000,
      alertThreshold: 85,
    },
  },
  {
    name: 'Miscellaneous',
    description: 'Other business expenses not covered in specific categories',
    color: '#6B7280',
    icon: 'MoreHorizontal',
    isDefault: true,
    isActive: true,
    budget: {
      monthlyLimit: 5000,
      alertThreshold: 70,
    },
  },
];

// Cache for categories
const categoryCache = new Map<string, { 
  categories: ExpenseCategory[]; 
  timestamp: number; 
  expiresAt: number; 
}>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export class ExpenseCategoryService {
  // Initialize default categories for new restaurant
  static async initializeDefaultCategories(restaurantId: string, createdBy: string): Promise<ApiResponse<ExpenseCategory[]>> {
    try {
      const batch = writeBatch(db);
      const categories: ExpenseCategory[] = [];

      for (const defaultCategory of DEFAULT_CATEGORIES) {
        const categoryId = generateId();
        const categoryData = {
          ...defaultCategory,
          id: categoryId,
          restaurantId,
          createdBy,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const categoryRef = doc(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION, categoryId);
        batch.set(categoryRef, categoryData);
        
        categories.push(this.convertFirestoreDoc(categoryData, categoryId));
      }

      await batch.commit();

      // Clear cache
      this.clearCache(restaurantId);

      console.log('✅ Default expense categories initialized:', categories.length);
      
      return {
        success: true,
        data: categories,
        message: 'Default expense categories initialized successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to initialize default categories:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Create new expense category
  static async createCategory(
    restaurantId: string, 
    categoryData: Omit<ExpenseCategory, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    createdBy: string
  ): Promise<ApiResponse<ExpenseCategory>> {
    try {
      const categoryId = generateId();
      const fullCategoryData = {
        ...categoryData,
        id: categoryId,
        restaurantId,
        createdBy,
        isDefault: false, // Custom categories are never default
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const categoryRef = doc(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION, categoryId);
      await addDoc(collection(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION), fullCategoryData);

      // Clear cache
      this.clearCache(restaurantId);

      const category = this.convertFirestoreDoc(fullCategoryData, categoryId);

      console.log('✅ Expense category created successfully:', category.id);
      
      return {
        success: true,
        data: category,
        message: 'Expense category created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create expense category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get all categories for restaurant
  static async getCategoriesForRestaurant(restaurantId: string): Promise<ApiResponse<ExpenseCategory[]>> {
    try {
      // Check cache first
      const cached = categoryCache.get(restaurantId);
      if (cached && Date.now() < cached.expiresAt) {
        return {
          success: true,
          data: cached.categories,
        };
      }

      const categoriesRef = collection(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION);
      const q = query(categoriesRef, orderBy('name', 'asc'));
      
      const querySnapshot = await getDocs(q);
      const categories = querySnapshot.docs
        .map(doc => this.convertFirestoreDoc(doc.data(), doc.id))
        .sort((a, b) => {
          // Sort by isDefault first (true comes first), then by name
          if (a.isDefault !== b.isDefault) {
            return a.isDefault ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      // If no categories exist, initialize default ones
      if (categories.length === 0) {
        console.log('No expense categories found, initializing defaults...');
        const initResult = await this.initializeDefaultCategories(restaurantId, 'system');
        return initResult;
      }

      // Cache the results
      categoryCache.set(restaurantId, {
        categories,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION,
      });

      return {
        success: true,
        data: categories,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense categories:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get active categories only
  static async getActiveCategoriesForRestaurant(restaurantId: string): Promise<ApiResponse<ExpenseCategory[]>> {
    try {
      const result = await this.getCategoriesForRestaurant(restaurantId);
      
      if (result.success && result.data) {
        const activeCategories = result.data.filter(category => category.isActive);
        return {
          success: true,
          data: activeCategories,
        };
      }

      return result;
    } catch (error: any) {
      console.error('❌ Failed to get active expense categories:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get category by ID
  static async getCategoryById(restaurantId: string, categoryId: string): Promise<ApiResponse<ExpenseCategory>> {
    try {
      const docRef = doc(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION, categoryId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return {
          success: false,
          error: 'Expense category not found',
        };
      }

      const category = this.convertFirestoreDoc(docSnapshot.data(), docSnapshot.id);

      return {
        success: true,
        data: category,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Update expense category
  static async updateCategory(
    restaurantId: string, 
    categoryId: string, 
    updates: Partial<Omit<ExpenseCategory, 'id' | 'restaurantId' | 'createdAt' | 'createdBy'>>
  ): Promise<ApiResponse<ExpenseCategory>> {
    try {
      const docRef = doc(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION, categoryId);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, updateData);

      // Clear cache
      this.clearCache(restaurantId);

      // Get updated category
      const result = await this.getCategoryById(restaurantId, categoryId);
      
      console.log('✅ Expense category updated successfully:', categoryId);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to update expense category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Delete expense category (only custom categories can be deleted)
  static async deleteCategory(restaurantId: string, categoryId: string): Promise<ApiResponse<void>> {
    try {
      // First check if it's a default category
      const categoryResult = await this.getCategoryById(restaurantId, categoryId);
      if (!categoryResult.success || !categoryResult.data) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      if (categoryResult.data.isDefault) {
        return {
          success: false,
          error: 'Cannot delete default categories',
        };
      }

      const docRef = doc(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION, categoryId);
      await deleteDoc(docRef);

      // Clear cache
      this.clearCache(restaurantId);

      console.log('✅ Expense category deleted successfully:', categoryId);
      
      return {
        success: true,
        message: 'Expense category deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete expense category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Toggle category active status
  static async toggleCategoryStatus(
    restaurantId: string, 
    categoryId: string, 
    isActive: boolean
  ): Promise<ApiResponse<ExpenseCategory>> {
    try {
      return await this.updateCategory(restaurantId, categoryId, { isActive });
    } catch (error: any) {
      console.error('❌ Failed to toggle category status:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Subscribe to categories (real-time)
  static subscribeToCategories(
    restaurantId: string,
    callback: (categories: ExpenseCategory[]) => void
  ): () => void {
    try {
      const categoriesRef = collection(db, 'restaurants', restaurantId, EXPENSE_CATEGORIES_COLLECTION);
      const q = query(categoriesRef, orderBy('isDefault', 'desc'), orderBy('name', 'asc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const categories = querySnapshot.docs.map(doc =>
          this.convertFirestoreDoc(doc.data(), doc.id)
        );
        callback(categories);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Failed to subscribe to expense categories:', error);
      return () => {};
    }
  }

  // Convert Firestore document to ExpenseCategory object
  private static convertFirestoreDoc(data: any, id: string): ExpenseCategory {
    return {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      isDefault: data.isDefault || false,
      isActive: data.isActive !== false, // Default to true if not specified
      budget: data.budget,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      createdBy: data.createdBy,
    };
  }

  // Clear cache
  static clearCache(restaurantId: string): void {
    categoryCache.delete(restaurantId);
  }

  // Clear all cache
  static clearAllCache(): void {
    categoryCache.clear();
  }

  // Get default categories template (for reference)
  static getDefaultCategoriesTemplate(): typeof DEFAULT_CATEGORIES {
    return DEFAULT_CATEGORIES;
  }
} 