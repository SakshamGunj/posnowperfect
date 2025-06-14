import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { MenuItem, Category, ApiResponse } from '@/types';
import { generateId } from '@/lib/utils';

// Smart caching system for menu items
class MenuCache {
  private static readonly MENU_CACHE_KEY = 'tenverse_pos_menu';
  private static readonly CATEGORIES_CACHE_KEY = 'tenverse_pos_categories';
  private static readonly CACHE_EXPIRY_KEY = 'tenverse_pos_menu_expiry';
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  // Get menu items from localStorage
  static getMenuItems(restaurantId: string): MenuItem[] {
    try {
      const cacheKey = `${this.MENU_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      const cached = localStorage.getItem(cacheKey);
      const expiry = localStorage.getItem(expiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry)) {
        console.log('🚀 Menu cache hit for restaurant:', restaurantId);
        return JSON.parse(cached).map(this.parseItemDates);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get menu from cache:', error);
      return [];
    }
  }
  
  // Store menu items in localStorage
  static setMenuItems(restaurantId: string, items: MenuItem[]): void {
    try {
      const cacheKey = `${this.MENU_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      localStorage.setItem(cacheKey, JSON.stringify(items));
      localStorage.setItem(expiryKey, (Date.now() + this.CACHE_DURATION).toString());
      
      console.log('💾 Menu items cached for restaurant:', restaurantId, 'Count:', items.length);
    } catch (error) {
      console.error('Failed to cache menu items:', error);
    }
  }
  
  // Get categories from localStorage
  static getCategories(restaurantId: string): Category[] {
    try {
      const cacheKey = `${this.CATEGORIES_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      const cached = localStorage.getItem(cacheKey);
      const expiry = localStorage.getItem(expiryKey);
      
      if (cached && expiry && Date.now() < parseInt(expiry)) {
        console.log('🚀 Categories cache hit for restaurant:', restaurantId);
        return JSON.parse(cached).map(this.parseCategoryDates);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get categories from cache:', error);
      return [];
    }
  }
  
  // Store categories in localStorage
  static setCategories(restaurantId: string, categories: Category[]): void {
    try {
      const cacheKey = `${this.CATEGORIES_CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      
      localStorage.setItem(cacheKey, JSON.stringify(categories));
      localStorage.setItem(expiryKey, (Date.now() + this.CACHE_DURATION).toString());
      
      console.log('💾 Categories cached for restaurant:', restaurantId, 'Count:', categories.length);
    } catch (error) {
      console.error('Failed to cache categories:', error);
    }
  }
  
  // Add single item to cache
  static addMenuItem(restaurantId: string, item: MenuItem): void {
    const items = this.getMenuItems(restaurantId);
    items.push(item);
    this.setMenuItems(restaurantId, items);
  }
  
  // Update single item in cache
  static updateMenuItem(restaurantId: string, updatedItem: MenuItem): void {
    const items = this.getMenuItems(restaurantId);
    const index = items.findIndex(i => i.id === updatedItem.id);
    
    if (index !== -1) {
      items[index] = updatedItem;
      this.setMenuItems(restaurantId, items);
    }
  }
  
  // Remove item from cache
  static removeMenuItem(restaurantId: string, itemId: string): void {
    const items = this.getMenuItems(restaurantId);
    const filtered = items.filter(i => i.id !== itemId);
    this.setMenuItems(restaurantId, filtered);
  }
  
  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    const menuKey = `${this.MENU_CACHE_KEY}_${restaurantId}`;
    const categoriesKey = `${this.CATEGORIES_CACHE_KEY}_${restaurantId}`;
    const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
    
    localStorage.removeItem(menuKey);
    localStorage.removeItem(categoriesKey);
    localStorage.removeItem(expiryKey);
  }
  
  // Check if cache is fresh
  static isCacheFresh(restaurantId: string): boolean {
    const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
    const expiry = localStorage.getItem(expiryKey);
    
    return expiry ? Date.now() < parseInt(expiry) : false;
  }
  
  // Parse date strings back to Date objects
  private static parseItemDates(item: any): MenuItem {
    return {
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    };
  }
  
  private static parseCategoryDates(category: any): Category {
    return {
      ...category,
      createdAt: new Date(category.createdAt),
      updatedAt: new Date(category.updatedAt),
    };
  }
}

export class MenuService {
  private static readonly MENU_ITEMS_COLLECTION = 'menuItems';
  private static readonly CATEGORIES_COLLECTION = 'categories';
  
  // Get all menu items for restaurant (with smart caching)
  static async getMenuItemsForRestaurant(restaurantId: string): Promise<ApiResponse<MenuItem[]>> {
    try {
      // Try cache first
      const cachedItems = MenuCache.getMenuItems(restaurantId);
      if (cachedItems.length > 0 && MenuCache.isCacheFresh(restaurantId)) {
        return {
          success: true,
          data: cachedItems,
        };
      }
      
      console.log('🔍 Fetching menu items from Firebase for restaurant:', restaurantId);
      
      let items: MenuItem[] = [];
      
      try {
        // Try the optimized query with composite index first
        const q = query(
          collection(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION),
          orderBy('category'),
          orderBy('name')
        );
        
        const querySnapshot = await getDocs(q);
        items = querySnapshot.docs.map(doc => 
          this.convertFirestoreMenuItem(doc.data(), doc.id)
        );
      } catch (indexError: any) {
        // If index is building or not available, fall back to simple query
        if (indexError.code === 'failed-precondition' && indexError.message.includes('index')) {
          console.log('🔄 Index building, using fallback query with client-side sorting');
          
          const fallbackQuery = query(
            collection(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION)
          );
          
          const querySnapshot = await getDocs(fallbackQuery);
          items = querySnapshot.docs.map(doc => 
            this.convertFirestoreMenuItem(doc.data(), doc.id)
          );
          
          // Sort client-side as fallback
          items.sort((a, b) => {
            if (a.category !== b.category) {
              return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
          });
        } else {
          throw indexError;
        }
      }
      
      // Cache the results
      MenuCache.setMenuItems(restaurantId, items);
      
      console.log('✅ Menu items loaded and cached:', items.length);
      
      return {
        success: true,
        data: items,
      };
    } catch (error: any) {
      console.error('❌ Failed to get menu items:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get categories for restaurant
  static async getCategoriesForRestaurant(restaurantId: string): Promise<ApiResponse<Category[]>> {
    try {
      // Try cache first
      const cachedCategories = MenuCache.getCategories(restaurantId);
      if (cachedCategories.length > 0 && MenuCache.isCacheFresh(restaurantId)) {
        return {
          success: true,
          data: cachedCategories,
        };
      }
      
      console.log('🔍 Fetching categories from Firebase for restaurant:', restaurantId);
      
      let categories: Category[] = [];
      
      try {
        // Try optimized query first
      const q = query(
        collection(db, 'restaurants', restaurantId, this.CATEGORIES_COLLECTION),
          where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
        categories = querySnapshot.docs
          .map(doc => this.convertFirestoreCategory(doc.data(), doc.id))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          
      } catch (indexError: any) {
        console.warn('⚠️ Optimized query failed, trying fallback approach:', indexError.message);
        
        // Fallback: Get all categories without filtering, then filter in memory
        try {
          const simpleQuery = collection(db, 'restaurants', restaurantId, this.CATEGORIES_COLLECTION);
          const allDocs = await getDocs(simpleQuery);
          categories = allDocs.docs
            .map(doc => this.convertFirestoreCategory(doc.data(), doc.id))
            .filter(cat => cat.isActive) // Filter in memory
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            
          console.log('✅ Fallback query succeeded');
        } catch (fallbackError: any) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      // Cache the results
      MenuCache.setCategories(restaurantId, categories);
      
      console.log('✅ Categories loaded and cached:', categories.length);
      
      return {
        success: true,
        data: categories,
      };
    } catch (error: any) {
      console.error('❌ Failed to get categories:', error);
      
      // Return empty array instead of error to allow app to continue
      return {
        success: true,
        data: [],
      };
    }
  }
  
  // Initialize default menu for new restaurant
  static async initializeDefaultMenu(restaurantId: string): Promise<ApiResponse<{ items: MenuItem[], categories: Category[] }>> {
    try {
      // Check if menu already exists
      const existingItems = await this.getMenuItemsForRestaurant(restaurantId);
      if (existingItems.success && existingItems.data && existingItems.data.length > 0) {
        const existingCategories = await this.getCategoriesForRestaurant(restaurantId);
        return {
          success: true,
          data: {
            items: existingItems.data,
            categories: existingCategories.data || [],
          },
        };
      }
      
      console.log('🎯 Creating default menu for restaurant:', restaurantId);
      
      const batch = writeBatch(db);
      
      // Create default categories
      const defaultCategories: Omit<Category, 'id'>[] = [
        {
          restaurantId,
          name: 'Appetizers',
          description: 'Start your meal with these delicious options',
          sortOrder: 1,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Main Courses',
          description: 'Our signature dishes and hearty meals',
          sortOrder: 2,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Beverages',
          description: 'Refreshing drinks and specialty beverages',
          sortOrder: 3,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Desserts',
          description: 'Sweet endings to your perfect meal',
          sortOrder: 4,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      const categories: Category[] = [];
      
      for (const categoryData of defaultCategories) {
        const categoryId = generateId();
        const category: Category = {
          id: categoryId,
          ...categoryData,
        };
        
        const categoryRef = doc(db, 'restaurants', restaurantId, this.CATEGORIES_COLLECTION, categoryId);
        batch.set(categoryRef, {
          ...category,
          createdAt: Timestamp.fromDate(category.createdAt),
          updatedAt: Timestamp.fromDate(category.updatedAt),
        });
        
        categories.push(category);
      }
      
      // Get category references
      const appetizerCategory = categories.find(c => c.name === 'Appetizers')!;
      const mainCategory = categories.find(c => c.name === 'Main Courses')!;
      const beverageCategory = categories.find(c => c.name === 'Beverages')!;
      const dessertCategory = categories.find(c => c.name === 'Desserts')!;
      
      // Create default menu items
      const defaultItems: Omit<MenuItem, 'id'>[] = [
        // Appetizers
        {
          restaurantId,
          name: 'Caesar Salad',
          description: 'Fresh romaine lettuce with parmesan cheese and croutons',
          price: 12.99,
          category: 'Appetizers',
          categoryId: appetizerCategory.id,
          categoryName: appetizerCategory.name,
          isAvailable: true,
          ingredients: ['romaine lettuce', 'parmesan cheese', 'croutons', 'caesar dressing'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Chicken Wings',
          description: 'Crispy wings with your choice of sauce',
          price: 14.99,
          category: 'Appetizers',
          categoryId: appetizerCategory.id,
          categoryName: appetizerCategory.name,
          isAvailable: true,
          ingredients: ['chicken wings', 'buffalo sauce', 'celery', 'blue cheese'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Main Courses
        {
          restaurantId,
          name: 'Grilled Chicken',
          description: 'Tender grilled chicken breast with seasonal vegetables',
          price: 18.99,
          category: 'Main Courses',
          categoryId: mainCategory.id,
          categoryName: mainCategory.name,
          isAvailable: true,
          ingredients: ['chicken breast', 'seasonal vegetables', 'herbs', 'olive oil'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Beef Burger',
          description: 'Juicy beef patty with lettuce, tomato, and fries',
          price: 16.99,
          category: 'Main Courses',
          categoryId: mainCategory.id,
          categoryName: mainCategory.name,
          isAvailable: true,
          ingredients: ['beef patty', 'lettuce', 'tomato', 'onion', 'pickles', 'fries'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Beverages
        {
          restaurantId,
          name: 'Fresh Orange Juice',
          description: 'Freshly squeezed orange juice',
          price: 4.99,
          category: 'Beverages',
          categoryId: beverageCategory.id,
          categoryName: beverageCategory.name,
          isAvailable: true,
          ingredients: ['fresh oranges'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          name: 'Coffee',
          description: 'Premium roasted coffee',
          price: 3.99,
          category: 'Beverages',
          categoryId: beverageCategory.id,
          categoryName: beverageCategory.name,
          isAvailable: true,
          ingredients: ['coffee beans', 'water'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Desserts
        {
          restaurantId,
          name: 'Chocolate Cake',
          description: 'Rich chocolate cake with chocolate frosting',
          price: 7.99,
          category: 'Desserts',
          categoryId: dessertCategory.id,
          categoryName: dessertCategory.name,
          isAvailable: true,
          ingredients: ['chocolate', 'flour', 'eggs', 'butter', 'sugar'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      const items: MenuItem[] = [];
      
      for (const itemData of defaultItems) {
        const itemId = generateId();
        const item: MenuItem = {
          id: itemId,
          ...itemData,
        };
        
        const itemRef = doc(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION, itemId);
        batch.set(itemRef, {
          ...item,
          createdAt: Timestamp.fromDate(item.createdAt),
          updatedAt: Timestamp.fromDate(item.updatedAt),
        });
        
        items.push(item);
      }
      
      await batch.commit();
      
      // Cache the new data
      MenuCache.setMenuItems(restaurantId, items);
      MenuCache.setCategories(restaurantId, categories);
      
      console.log('✅ Default menu created and cached');
      
      return {
        success: true,
        data: { items, categories },
        message: 'Default menu created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create default menu:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get available menu items by category
  static async getAvailableItemsByCategory(restaurantId: string, category?: string): Promise<ApiResponse<MenuItem[]>> {
    const result = await this.getMenuItemsForRestaurant(restaurantId);
    
    if (result.success && result.data) {
      let filteredItems = result.data.filter(item => item.isAvailable);
      
      if (category) {
        filteredItems = filteredItems.filter(item => item.category === category);
      }
      
      return {
        success: true,
        data: filteredItems,
      };
    }
    
    return result;
  }
  
  // Search menu items
  static async searchMenuItems(restaurantId: string, searchTerm: string): Promise<ApiResponse<MenuItem[]>> {
    const result = await this.getMenuItemsForRestaurant(restaurantId);
    
    if (result.success && result.data) {
      const filteredItems = result.data.filter(item =>
        item.isAvailable &&
        (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         item.ingredients?.some(ingredient => 
           ingredient.toLowerCase().includes(searchTerm.toLowerCase())
         ))
      );
      
      return {
        success: true,
        data: filteredItems,
      };
    }
    
    return result;
  }
  
  // Create menu item
  static async createMenuItem(itemData: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<MenuItem>> {
    try {
      const itemId = generateId();
      const item: MenuItem = {
        id: itemId,
        ...itemData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const itemRef = doc(db, 'restaurants', itemData.restaurantId, this.MENU_ITEMS_COLLECTION, itemId);
      
      await setDoc(itemRef, {
        ...item,
        createdAt: Timestamp.fromDate(item.createdAt),
        updatedAt: Timestamp.fromDate(item.updatedAt),
      });
      
      // Add to cache
      MenuCache.addMenuItem(itemData.restaurantId, item);
      
      console.log('✅ Menu item created and cached:', item.name);
      
      return {
        success: true,
        data: item,
        message: 'Menu item created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create menu item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Update menu item
  static async updateMenuItem(itemId: string, restaurantId: string, updates: Partial<MenuItem>): Promise<ApiResponse<MenuItem>> {
    try {
      const itemRef = doc(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION, itemId);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(itemRef, updateData);
      
      // Get updated item from cache and update it
      const cachedItems = MenuCache.getMenuItems(restaurantId);
      const itemIndex = cachedItems.findIndex(i => i.id === itemId);
      
      if (itemIndex !== -1) {
        const updatedItem = {
          ...cachedItems[itemIndex],
          ...updates,
          updatedAt: new Date(),
        };
        
        MenuCache.updateMenuItem(restaurantId, updatedItem);
        
        return {
          success: true,
          data: updatedItem,
          message: 'Menu item updated successfully',
        };
      }
      
      // Fallback: fetch from Firebase
      const result = await this.getMenuItemById(itemId, restaurantId);
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to update menu item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Delete menu item
  static async deleteMenuItem(itemId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      const itemRef = doc(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION, itemId);
      
      await deleteDoc(itemRef);
      
      // Remove from cache
      MenuCache.removeMenuItem(restaurantId, itemId);
      
      console.log('✅ Menu item deleted and removed from cache:', itemId);
      
      return {
        success: true,
        message: 'Menu item deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete menu item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get menu item by ID
  static async getMenuItemById(itemId: string, restaurantId: string): Promise<ApiResponse<MenuItem>> {
    try {
      // Try cache first
      const cachedItems = MenuCache.getMenuItems(restaurantId);
      const cachedItem = cachedItems.find(i => i.id === itemId);
      
      if (cachedItem) {
        return {
          success: true,
          data: cachedItem,
        };
      }
      
      // Fetch from Firebase
      const itemRef = doc(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION, itemId);
      const docSnap = await getDoc(itemRef);
      
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Menu item not found',
        };
      }
      
      const item = this.convertFirestoreMenuItem(docSnap.data(), docSnap.id);
      
      return {
        success: true,
        data: item,
      };
    } catch (error: any) {
      console.error('❌ Failed to get menu item by ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    MenuCache.clearCache(restaurantId);
  }
  
  // Subscribe to menu changes (real-time updates)
  static subscribeToMenuItems(
    restaurantId: string,
    callback: (items: MenuItem[]) => void
  ): () => void {
    const q = query(
      collection(db, 'restaurants', restaurantId, this.MENU_ITEMS_COLLECTION),
      orderBy('category'),
      orderBy('name')
    );
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const items = querySnapshot.docs.map(doc =>
          this.convertFirestoreMenuItem(doc.data(), doc.id)
        );
        
        // Update cache
        MenuCache.setMenuItems(restaurantId, items);
        
        callback(items);
      },
      (error) => {
        console.error('Menu subscription error:', error);
      }
    );
  }
  
  // Convert Firestore document to MenuItem object
  private static convertFirestoreMenuItem(data: any, id: string): MenuItem {
    return {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      image: data.image,
      isAvailable: data.isAvailable,
      ingredients: data.ingredients || [],
      allergens: data.allergens || [],
      nutritionInfo: data.nutritionInfo,
      customizations: data.customizations || [],
      variants: data.variants || [],
      preparationTime: data.preparationTime,
      spiceLevel: data.spiceLevel,
      isVeg: data.isVeg,
      isVegetarian: data.isVegetarian,
      isVegan: data.isVegan,
      isGlutenFree: data.isGlutenFree,
      tags: data.tags || [],
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
  
  // Convert Firestore document to Category object
  private static convertFirestoreCategory(data: any, id: string): Category {
    return {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
  
  // Category Management Functions
  
  // Create category
  static async createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Category>> {
    try {
      const categoryId = generateId();
      const category: Category = {
        id: categoryId,
        ...categoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const categoryRef = doc(db, 'restaurants', categoryData.restaurantId, this.CATEGORIES_COLLECTION, categoryId);
      
      await setDoc(categoryRef, {
        ...category,
        createdAt: Timestamp.fromDate(category.createdAt),
        updatedAt: Timestamp.fromDate(category.updatedAt),
      });
      
      // Add to cache
      const cachedCategories = MenuCache.getCategories(categoryData.restaurantId);
      cachedCategories.push(category);
      MenuCache.setCategories(categoryData.restaurantId, cachedCategories);
      
      console.log('✅ Category created and cached:', category.name);
      
      return {
        success: true,
        data: category,
        message: 'Category created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Update category
  static async updateCategory(categoryId: string, restaurantId: string, updates: Partial<Category>): Promise<ApiResponse<Category>> {
    try {
      const categoryRef = doc(db, 'restaurants', restaurantId, this.CATEGORIES_COLLECTION, categoryId);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(categoryRef, updateData);
      
      // Get updated category from cache and update it
      const cachedCategories = MenuCache.getCategories(restaurantId);
      const categoryIndex = cachedCategories.findIndex(c => c.id === categoryId);
      
      if (categoryIndex !== -1) {
        const updatedCategory = {
          ...cachedCategories[categoryIndex],
          ...updates,
          updatedAt: new Date(),
        };
        
        cachedCategories[categoryIndex] = updatedCategory;
        MenuCache.setCategories(restaurantId, cachedCategories);
        
        return {
          success: true,
          data: updatedCategory,
          message: 'Category updated successfully',
        };
      }
      
      // Fallback: reload categories
      const result = await this.getCategoriesForRestaurant(restaurantId);
      if (result.success && result.data) {
        const updatedCategory = result.data.find(c => c.id === categoryId);
        if (updatedCategory) {
          return {
            success: true,
            data: updatedCategory,
            message: 'Category updated successfully',
          };
        }
      }
      
      return {
        success: false,
        error: 'Failed to find updated category',
      };
      
    } catch (error: any) {
      console.error('❌ Failed to update category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Delete category
  static async deleteCategory(categoryId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      const categoryRef = doc(db, 'restaurants', restaurantId, this.CATEGORIES_COLLECTION, categoryId);
      
      await deleteDoc(categoryRef);
      
      // Remove from cache
      const cachedCategories = MenuCache.getCategories(restaurantId);
      const filtered = cachedCategories.filter(c => c.id !== categoryId);
      MenuCache.setCategories(restaurantId, filtered);
      
      console.log('✅ Category deleted and removed from cache:', categoryId);
      
      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete category:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
} 