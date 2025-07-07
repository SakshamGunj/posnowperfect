import {
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  MenuItem, 
  Table, 
  Order, 
  OrderItem,
  Category,
  OrderStatus
} from '@/types';
import { generateId, generateOrderNumber } from '@/lib/utils';

export class SeedDataService {
  
  // Seed sample data for a restaurant
  static async seedRestaurantData(restaurantId: string, userId: string): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      console.log('🌱 Starting data seeding for restaurant:', restaurantId);
      
      // Create batches for different collections
      const batch = writeBatch(db);
      
      // 1. Create sample categories
      const categories = this.createSampleCategories(restaurantId);
      categories.forEach(category => {
        const categoryRef = doc(db, 'restaurants', restaurantId, 'categories', category.id);
        batch.set(categoryRef, {
          ...category,
          createdAt: Timestamp.fromDate(category.createdAt),
          updatedAt: Timestamp.fromDate(category.updatedAt),
        });
      });
      
      // 2. Create sample menu items
      const menuItems = this.createSampleMenuItems(restaurantId, categories);
      menuItems.forEach(item => {
        const itemRef = doc(db, 'restaurants', restaurantId, 'menuItems', item.id);
        batch.set(itemRef, {
          ...item,
          createdAt: Timestamp.fromDate(item.createdAt),
          updatedAt: Timestamp.fromDate(item.updatedAt),
        });
      });
      
      // 3. Create sample tables
      const tables = this.createSampleTables(restaurantId, userId);
      tables.forEach(table => {
        const tableRef = doc(db, 'restaurants', restaurantId, 'tables', table.id);
        batch.set(tableRef, {
          ...table,
          createdAt: Timestamp.fromDate(table.createdAt),
          updatedAt: Timestamp.fromDate(table.updatedAt),
        });
      });
      
      // Commit the first batch
      await batch.commit();
      console.log('✅ Committed categories, menu items, and tables');
      
      // 4. Create sample orders (separate batch due to size)
      const orders = this.createSampleOrders(restaurantId, userId, menuItems, tables);
      const orderBatch = writeBatch(db);
      
      orders.forEach(order => {
        const orderRef = doc(db, 'restaurants', restaurantId, 'orders', order.id);
        orderBatch.set(orderRef, {
          ...order,
          createdAt: Timestamp.fromDate(order.createdAt),
          updatedAt: Timestamp.fromDate(order.updatedAt),
        });
      });
      
      await orderBatch.commit();
      console.log('✅ Committed sample orders');
      
      return {
        success: true,
        message: `Sample data created successfully! Added ${categories.length} categories, ${menuItems.length} menu items, ${tables.length} tables, and ${orders.length} orders.`
      };
      
    } catch (error: any) {
      console.error('❌ Failed to seed restaurant data:', error);
      return {
        success: false,
        error: error.message || 'Failed to create sample data'
      };
    }
  }
  
  // Create sample categories
  private static createSampleCategories(restaurantId: string): Category[] {
    const now = new Date();
    
    return [
      {
        id: generateId(),
        restaurantId,
        name: 'Starters',
        description: 'Appetizers and small plates',
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        name: 'Main Course',
        description: 'Main dishes and entrees',
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        name: 'Beverages',
        description: 'Hot and cold drinks',
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        name: 'Desserts',
        description: 'Sweet treats and desserts',
        isActive: true,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  
  // Create sample menu items
  private static createSampleMenuItems(restaurantId: string, categories: Category[]): MenuItem[] {
    const now = new Date();
    const startersCategory = categories.find(c => c.name === 'Starters')!;
    const mainCategory = categories.find(c => c.name === 'Main Course')!;
    const beveragesCategory = categories.find(c => c.name === 'Beverages')!;
    const dessertsCategory = categories.find(c => c.name === 'Desserts')!;
    
    return [
      // Starters
      {
        id: generateId(),
        restaurantId,
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with caesar dressing, croutons, and parmesan',
        price: 180,
        category: startersCategory.name,
        categoryId: startersCategory.id,
        categoryName: startersCategory.name,
        isAvailable: true,
        isVeg: true,
        spiceLevel: 'mild',
        preparationTime: 10,
        ingredients: ['lettuce', 'caesar dressing', 'croutons', 'parmesan'],
        allergens: ['dairy'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        name: 'Chicken Wings',
        description: 'Crispy chicken wings with buffalo sauce',
        price: 250,
        category: startersCategory.name,
        categoryId: startersCategory.id,
        categoryName: startersCategory.name,
        isAvailable: true,
        isVeg: false,
        spiceLevel: 'medium',
        preparationTime: 15,
        ingredients: ['chicken wings', 'buffalo sauce', 'celery'],
        allergens: [],
        createdAt: now,
        updatedAt: now,
      },
      // Main Course
      {
        id: generateId(),
        restaurantId,
        name: 'Grilled Chicken Breast',
        description: 'Juicy grilled chicken breast with herbs and vegetables',
        price: 450,
        category: mainCategory.name,
        categoryId: mainCategory.id,
        categoryName: mainCategory.name,
        isAvailable: true,
        isVeg: false,
        spiceLevel: 'mild',
        preparationTime: 25,
        ingredients: ['chicken breast', 'herbs', 'vegetables'],
        allergens: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        name: 'Paneer Butter Masala',
        description: 'Cottage cheese in rich tomato and butter gravy',
        price: 380,
        category: mainCategory.name,
        categoryId: mainCategory.id,
        categoryName: mainCategory.name,
        isAvailable: true,
        isVeg: true,
        spiceLevel: 'medium',
        preparationTime: 20,
        ingredients: ['paneer', 'tomatoes', 'butter', 'spices'],
        allergens: ['dairy'],
        createdAt: now,
        updatedAt: now,
      },
      // Beverages
      {
        id: generateId(),
        restaurantId,
        name: 'Fresh Lime Soda',
        description: 'Refreshing lime soda with mint',
        price: 80,
        category: beveragesCategory.name,
        categoryId: beveragesCategory.id,
        categoryName: beveragesCategory.name,
        isAvailable: true,
        isVeg: true,
        spiceLevel: 'mild',
        preparationTime: 5,
        ingredients: ['lime', 'soda', 'mint'],
        allergens: [],
        createdAt: now,
        updatedAt: now,
      },
      // Desserts
      {
        id: generateId(),
        restaurantId,
        name: 'Chocolate Brownie',
        description: 'Rich chocolate brownie with vanilla ice cream',
        price: 220,
        category: dessertsCategory.name,
        categoryId: dessertsCategory.id,
        categoryName: dessertsCategory.name,
        isAvailable: true,
        isVeg: true,
        spiceLevel: 'mild',
        preparationTime: 12,
        ingredients: ['chocolate', 'brownie', 'ice cream'],
        allergens: ['dairy', 'eggs'],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  
  // Create sample tables
  private static createSampleTables(restaurantId: string, userId: string): Table[] {
    const now = new Date();
    
    return [
      {
        id: generateId(),
        restaurantId,
        number: '1',
        capacity: 2,
        area: 'Main Hall',
        areaId: 'main-hall',
        status: 'available',
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        number: '2',
        capacity: 4,
        area: 'Main Hall',
        areaId: 'main-hall',
        status: 'occupied',
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        number: '3',
        capacity: 4,
        area: 'Main Hall',
        areaId: 'main-hall',
        status: 'available',
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        restaurantId,
        number: '4',
        capacity: 6,
        area: 'VIP Section',
        areaId: 'vip-section',
        status: 'occupied',
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  
  // Create sample orders
  private static createSampleOrders(
    restaurantId: string, 
    userId: string, 
    menuItems: MenuItem[], 
    tables: Table[]
  ): Order[] {
    const orders: Order[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // Create orders for today
    for (let i = 0; i < 8; i++) {
      const table = tables[Math.floor(Math.random() * tables.length)];
      const orderItems = this.generateRandomOrderItems(menuItems);
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.18; // 18% tax
      const total = subtotal + tax;
      
      orders.push({
        id: generateId(),
        restaurantId,
        orderNumber: generateOrderNumber(restaurantId),
        tableId: table.id,
        type: 'dine_in',
        status: OrderStatus.COMPLETED,
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentStatus: 'paid',
        staffId: userId,
        createdAt: new Date(today.getTime() + Math.random() * 16 * 60 * 60 * 1000), // Random time today
        updatedAt: now,
      });
    }
    
    // Create orders for yesterday
    for (let i = 0; i < 5; i++) {
      const table = tables[Math.floor(Math.random() * tables.length)];
      const orderItems = this.generateRandomOrderItems(menuItems);
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      
      orders.push({
        id: generateId(),
        restaurantId,
        orderNumber: generateOrderNumber(restaurantId),
        tableId: table.id,
        type: 'dine_in',
        status: OrderStatus.COMPLETED,
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        paymentStatus: 'paid',
        staffId: userId,
        createdAt: new Date(yesterday.getTime() + Math.random() * 16 * 60 * 60 * 1000), // Random time yesterday
        updatedAt: yesterday,
      });
    }
    
    return orders;
  }
  
  // Generate random order items
  private static generateRandomOrderItems(menuItems: MenuItem[]): OrderItem[] {
    const items: OrderItem[] = [];
    const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
    
    for (let i = 0; i < numItems; i++) {
      const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 2) + 1; // 1-2 quantity
      
      items.push({
        id: generateId(),
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        total: menuItem.price * quantity,
      });
    }
    
    return items;
  }
} 