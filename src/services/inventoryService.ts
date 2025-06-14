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
  Timestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { InventoryItem, InventoryTransaction, InventoryAlert, ApiResponse } from '@/types';
import { generateId } from '@/lib/utils';

export class InventoryService {
  private static readonly INVENTORY_COLLECTION = 'inventory';
  private static readonly TRANSACTIONS_COLLECTION = 'inventoryTransactions';
  private static readonly ALERTS_COLLECTION = 'inventoryAlerts';

  // Create inventory item for menu item
  static async createInventoryItem(inventoryData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<InventoryItem>> {
    try {
      const inventoryId = generateId();
      const inventory: InventoryItem = {
        id: inventoryId,
        ...inventoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const inventoryRef = doc(db, 'restaurants', inventoryData.restaurantId, this.INVENTORY_COLLECTION, inventoryId);

      await setDoc(inventoryRef, {
        ...inventory,
        createdAt: Timestamp.fromDate(inventory.createdAt),
        updatedAt: Timestamp.fromDate(inventory.updatedAt),
        lastRestockedAt: inventory.lastRestockedAt ? Timestamp.fromDate(inventory.lastRestockedAt) : null,
      });

      console.log('✅ Inventory item created:', inventory.id);

      return {
        success: true,
        data: inventory,
        message: 'Inventory item created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create inventory item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get inventory item by menu item ID
  static async getInventoryByMenuItemId(menuItemId: string, restaurantId: string): Promise<ApiResponse<InventoryItem | null>> {
    try {
      const q = query(
        collection(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION),
        where('menuItemId', '==', menuItemId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const inventory = this.convertFirestoreInventoryItem(querySnapshot.docs[0].data(), querySnapshot.docs[0].id);

      return {
        success: true,
        data: inventory,
      };
    } catch (error: any) {
      console.error('❌ Failed to get inventory by menu item ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get all inventory items for restaurant
  static async getInventoryForRestaurant(restaurantId: string): Promise<ApiResponse<InventoryItem[]>> {
    try {
      const q = query(
        collection(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const inventoryItems = querySnapshot.docs.map(doc =>
        this.convertFirestoreInventoryItem(doc.data(), doc.id)
      );

      return {
        success: true,
        data: inventoryItems,
      };
    } catch (error: any) {
      console.error('❌ Failed to get inventory for restaurant:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Update inventory item
  static async updateInventoryItem(inventoryId: string, restaurantId: string, updates: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    try {
      const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventoryId);

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      // Handle date fields
      if (updates.lastRestockedAt) {
        updateData.lastRestockedAt = Timestamp.fromDate(updates.lastRestockedAt);
      }

      await updateDoc(inventoryRef, updateData);

      // Get updated inventory item
      const result = await this.getInventoryById(inventoryId, restaurantId);
      
      if (result.success && result.data) {
        console.log('✅ Inventory item updated:', inventoryId);
        return result;
      }

      return {
        success: false,
        error: 'Failed to get updated inventory item',
      };
    } catch (error: any) {
      console.error('❌ Failed to update inventory item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get inventory by ID
  static async getInventoryById(inventoryId: string, restaurantId: string): Promise<ApiResponse<InventoryItem>> {
    try {
      const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventoryId);
      const docSnap = await getDoc(inventoryRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Inventory item not found',
        };
      }

      const inventory = this.convertFirestoreInventoryItem(docSnap.data(), docSnap.id);

      return {
        success: true,
        data: inventory,
      };
    } catch (error: any) {
      console.error('❌ Failed to get inventory by ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Delete inventory item
  static async deleteInventoryItem(inventoryId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventoryId);
      await deleteDoc(inventoryRef);

      console.log('✅ Inventory item deleted:', inventoryId);

      return {
        success: true,
        message: 'Inventory item deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete inventory item:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Record inventory transaction
  static async recordTransaction(transactionData: Omit<InventoryTransaction, 'id' | 'createdAt'>): Promise<ApiResponse<InventoryTransaction>> {
    try {
      const transactionId = generateId();
      const transaction: InventoryTransaction = {
        id: transactionId,
        ...transactionData,
        createdAt: new Date(),
      };

      const transactionRef = doc(db, 'restaurants', transactionData.restaurantId, this.TRANSACTIONS_COLLECTION, transactionId);

      await setDoc(transactionRef, {
        ...transaction,
        createdAt: Timestamp.fromDate(transaction.createdAt),
      });

      console.log('✅ Inventory transaction recorded:', transaction.type, transaction.quantityChanged);

      return {
        success: true,
        data: transaction,
        message: 'Transaction recorded successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to record inventory transaction:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Adjust inventory quantity with transaction logging
  static async adjustInventoryQuantity(
    inventoryId: string,
    restaurantId: string,
    newQuantity: number,
    type: 'restock' | 'manual_adjustment' | 'waste',
    staffId: string,
    reason?: string,
    notes?: string
  ): Promise<ApiResponse<{ inventory: InventoryItem; transaction: InventoryTransaction }>> {
    try {
      // Get current inventory
      const inventoryResult = await this.getInventoryById(inventoryId, restaurantId);
      if (!inventoryResult.success || !inventoryResult.data) {
        return {
          success: false,
          error: inventoryResult.error || 'Inventory item not found',
        };
      }

      const currentInventory = inventoryResult.data;
      const quantityChanged = newQuantity - currentInventory.currentQuantity;

      // Update inventory quantity
      const updateData: Partial<InventoryItem> = {
        currentQuantity: newQuantity,
      };

      if (type === 'restock') {
        updateData.lastRestockedAt = new Date();
        updateData.lastRestockedQuantity = quantityChanged;
      }

      const updateResult = await this.updateInventoryItem(inventoryId, restaurantId, updateData);
      if (!updateResult.success || !updateResult.data) {
        return {
          success: false,
          error: updateResult.error || 'Failed to update inventory',
        };
      }

      // Record transaction
      const transactionResult = await this.recordTransaction({
        inventoryItemId: inventoryId,
        menuItemId: currentInventory.menuItemId,
        restaurantId,
        type,
        quantityChanged,
        previousQuantity: currentInventory.currentQuantity,
        newQuantity,
        reason,
        notes,
        staffId,
      });

      if (!transactionResult.success || !transactionResult.data) {
        return {
          success: false,
          error: transactionResult.error || 'Failed to record transaction',
        };
      }

      // Check for alerts
      await this.checkAndCreateAlerts(updateResult.data);

      return {
        success: true,
        data: {
          inventory: updateResult.data,
          transaction: transactionResult.data,
        },
        message: 'Inventory adjusted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to adjust inventory quantity:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Deduct inventory for order
  static async deductInventoryForOrder(
    orderId: string,
    orderItems: Array<{ menuItemId: string; quantity: number }>,
    restaurantId: string,
    staffId: string
  ): Promise<ApiResponse<InventoryTransaction[]>> {
    try {
      const transactions: InventoryTransaction[] = [];
      const batch = writeBatch(db);

      for (const orderItem of orderItems) {
        // Get inventory for this menu item
        const inventoryResult = await this.getInventoryByMenuItemId(orderItem.menuItemId, restaurantId);
        
        if (!inventoryResult.success || !inventoryResult.data) {
          console.log('⚠️ No inventory tracking for menu item:', orderItem.menuItemId);
          continue;
        }

        const inventory = inventoryResult.data;
        
        // Skip if auto-deduct is disabled or not tracked
        if (!inventory.autoDeduct || !inventory.isTracked) {
          continue;
        }

        const totalDeduction = inventory.consumptionPerOrder * orderItem.quantity;
        const newQuantity = Math.max(0, inventory.currentQuantity - totalDeduction);

        // Update inventory
        const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventory.id);
        batch.update(inventoryRef, {
          currentQuantity: newQuantity,
          updatedAt: Timestamp.now(),
        });

        // Create transaction record
        const transactionId = generateId();
        const transaction: InventoryTransaction = {
          id: transactionId,
          inventoryItemId: inventory.id,
          menuItemId: orderItem.menuItemId,
          restaurantId,
          type: 'order_deduction',
          quantityChanged: -totalDeduction,
          previousQuantity: inventory.currentQuantity,
          newQuantity,
          orderId,
          staffId,
          createdAt: new Date(),
        };

        const transactionRef = doc(db, 'restaurants', restaurantId, this.TRANSACTIONS_COLLECTION, transactionId);
        batch.set(transactionRef, {
          ...transaction,
          createdAt: Timestamp.fromDate(transaction.createdAt),
        });

        transactions.push(transaction);
      }

      await batch.commit();

      console.log('✅ Inventory deducted for order:', orderId, transactions.length, 'items');

      return {
        success: true,
        data: transactions,
        message: 'Inventory deducted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to deduct inventory for order:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get transaction history for inventory item
  static async getTransactionHistory(inventoryItemId: string, restaurantId: string): Promise<ApiResponse<InventoryTransaction[]>> {
    try {
      const q = query(
        collection(db, 'restaurants', restaurantId, this.TRANSACTIONS_COLLECTION),
        where('inventoryItemId', '==', inventoryItemId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc =>
        this.convertFirestoreTransaction(doc.data(), doc.id)
      );

      return {
        success: true,
        data: transactions,
      };
    } catch (error: any) {
      console.error('❌ Failed to get transaction history:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get low stock items
  static async getLowStockItems(restaurantId: string): Promise<ApiResponse<InventoryItem[]>> {
    try {
      const inventoryResult = await this.getInventoryForRestaurant(restaurantId);
      
      if (!inventoryResult.success || !inventoryResult.data) {
        return inventoryResult;
      }

      const lowStockItems = inventoryResult.data.filter(item =>
        item.isTracked && item.currentQuantity <= item.minimumThreshold
      );

      return {
        success: true,
        data: lowStockItems,
      };
    } catch (error: any) {
      console.error('❌ Failed to get low stock items:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Check and create alerts for inventory levels
  private static async checkAndCreateAlerts(inventory: InventoryItem): Promise<void> {
    try {
      if (!inventory.isTracked) return;

      let alertType: 'low_stock' | 'out_of_stock' | 'overstocked' | null = null;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let message = '';

      if (inventory.currentQuantity === 0) {
        alertType = 'out_of_stock';
        severity = 'critical';
        message = `${inventory.menuItemId} is out of stock`;
      } else if (inventory.currentQuantity <= inventory.minimumThreshold) {
        alertType = 'low_stock';
        severity = inventory.currentQuantity <= inventory.minimumThreshold * 0.5 ? 'high' : 'medium';
        message = `${inventory.menuItemId} is running low (${inventory.currentQuantity} ${inventory.unit} remaining)`;
      } else if (inventory.maxCapacity && inventory.currentQuantity > inventory.maxCapacity) {
        alertType = 'overstocked';
        severity = 'low';
        message = `${inventory.menuItemId} is overstocked`;
      }

      if (alertType) {
        const alertId = generateId();
        const alert: InventoryAlert = {
          id: alertId,
          inventoryItemId: inventory.id,
          menuItemId: inventory.menuItemId,
          restaurantId: inventory.restaurantId,
          type: alertType,
          message,
          severity,
          isRead: false,
          createdAt: new Date(),
        };

        const alertRef = doc(db, 'restaurants', inventory.restaurantId, this.ALERTS_COLLECTION, alertId);
        await setDoc(alertRef, {
          ...alert,
          createdAt: Timestamp.fromDate(alert.createdAt),
        });
      }
    } catch (error) {
      console.error('Failed to create inventory alert:', error);
    }
  }

  // Convert Firestore document to InventoryItem
  private static convertFirestoreInventoryItem(data: any, id: string): InventoryItem {
    return {
      id,
      menuItemId: data.menuItemId,
      restaurantId: data.restaurantId,
      currentQuantity: data.currentQuantity,
      unit: data.unit,
      customUnit: data.customUnit,
      minimumThreshold: data.minimumThreshold,
      consumptionPerOrder: data.consumptionPerOrder,
      maxCapacity: data.maxCapacity,
      costPerUnit: data.costPerUnit,
      supplier: data.supplier,
      lastRestockedAt: data.lastRestockedAt?.toDate(),
      lastRestockedQuantity: data.lastRestockedQuantity,
      isTracked: data.isTracked,
      autoDeduct: data.autoDeduct,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  // Convert Firestore document to InventoryTransaction
  private static convertFirestoreTransaction(data: any, id: string): InventoryTransaction {
    return {
      id,
      inventoryItemId: data.inventoryItemId,
      menuItemId: data.menuItemId,
      restaurantId: data.restaurantId,
      type: data.type,
      quantityChanged: data.quantityChanged,
      previousQuantity: data.previousQuantity,
      newQuantity: data.newQuantity,
      reason: data.reason,
      notes: data.notes,
      orderId: data.orderId,
      staffId: data.staffId,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  }
} 