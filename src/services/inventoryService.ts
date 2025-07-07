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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AdjustmentReasonLabels: { [key: string]: string } = {
  MANUAL_COUNT: 'Manual Count',
  PURCHASE_ORDER: 'Purchase Order',
  SALE: 'Sale',
  DAMAGE: 'Damage',
  THEFT: 'Theft',
  RETURN: 'Return',
  OTHER: 'Other',
};

const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export class InventoryService {
  private static readonly INVENTORY_COLLECTION = 'inventory';
  private static readonly TRANSACTIONS_COLLECTION = 'inventoryTransactions';
  private static readonly ALERTS_COLLECTION = 'inventoryAlerts';

  private restaurantId: string;

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
  }

  static async generateInventoryReportPDF(
    restaurantId: string,
    dateRange: { start: Date; end: Date },
    restaurantName: string
  ): Promise<Blob> {
    const doc = new jsPDF();
    let yPosition = 20;

    // 1. Fetch Data
    const itemsQuery = query(
      collection(db, `restaurants/${restaurantId}/inventory`)
    );
    const itemsSnap = await getDocs(itemsQuery);
    const inventoryItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const adjustmentsQuery = query(
      collection(db, `restaurants/${restaurantId}/inventoryTransactions`), // Corrected collection name
      where('createdAt', '>=', dateRange.start), // Corrected field name
      where('createdAt', '<=', dateRange.end),   // Corrected field name
      orderBy('createdAt', 'desc')             // Corrected field name
    );
    const adjustmentsSnap = await getDocs(adjustmentsQuery);
    const adjustments = adjustmentsSnap.docs.map(doc => doc.data() as any);

    // 2. Group adjustments by item
    const adjustmentsByItem: { [key: string]: any[] } = {};
    adjustments.forEach(adj => {
      if (!adjustmentsByItem[adj.inventoryItemId]) { // Corrected field name
        adjustmentsByItem[adj.inventoryItemId] = [];
      }
      adjustmentsByItem[adj.inventoryItemId].push(adj); // Corrected field name
    });

    // 3. Build PDF
    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`${restaurantName} - Inventory Report`, 105, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`, 105, yPosition, { align: 'center' });
    yPosition += 15;

    // Loop through each inventory item
    inventoryItems.forEach(item => {
      const itemAdjustments = adjustmentsByItem[item.id] || [];
      if (itemAdjustments.length === 0) return; // Skip items with no adjustments in the period

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Item Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40);
      const itemName = (item.name || item.displayName || item.standaloneItemName || item.menuItemId || 'Unnamed Item') as string;
      doc.text(`${itemName} (${item.unit || ''})`, 20, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.text(`Current Stock: ${item.stock}`, 20, yPosition);
      yPosition += 10;

      // Table of adjustments for the item
      autoTable(doc, {
        startY: yPosition,
        head: [['Date/Time', 'Reason', 'Change', 'New Stock', 'User']],
        body: itemAdjustments.map(adj => [
          formatTimestamp(adj.createdAt), // Corrected field name
          adj.reason || adj.type,
          adj.quantityChanged > 0 ? `+${adj.quantityChanged}` : adj.quantityChanged, // Corrected field name
          adj.newQuantity, // Corrected field name
          adj.staffId || 'N/A', // Corrected field name
        ]),
        theme: 'grid',
        headStyles: { fillColor: [74, 85, 104], textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' },
          3: { halign: 'right' },
        },
        didDrawPage: (data: any) => {
          yPosition = data.cursor.y + 10;
        },
        margin: {left: 20, right: 20}
      });
       yPosition = (doc as any).lastAutoTable.finalY + 15;
    });

    if (Object.keys(adjustmentsByItem).length === 0) {
       doc.setFontSize(12);
       doc.setTextColor(150);
       doc.text('No inventory adjustments recorded for the selected period.', 105, yPosition + 20, {align: 'center'});
    }


    return doc.output('blob');
  }

  // Create inventory item
  static async createInventoryItem(inventoryData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>, staffId?: string): Promise<ApiResponse<InventoryItem>> {
    try {
      const inventoryId = generateId();
      const inventory: InventoryItem = {
        id: inventoryId,
        ...inventoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const inventoryRef = doc(db, 'restaurants', inventoryData.restaurantId, this.INVENTORY_COLLECTION, inventoryId);

      // Clean data by removing undefined fields (Firestore doesn't accept undefined values)
      const cleanedInventory = this.cleanInventoryData({
        ...inventory,
        createdAt: Timestamp.fromDate(inventory.createdAt),
        updatedAt: Timestamp.fromDate(inventory.updatedAt),
        lastRestockedAt: inventory.lastRestockedAt ? Timestamp.fromDate(inventory.lastRestockedAt) : null,
      });

      await setDoc(inventoryRef, cleanedInventory);

      console.log('✅ Inventory item created:', inventory.id);

      // Record initial stock transaction if quantity > 0
      // Always record transaction to ensure history is available
      if (inventory.currentQuantity > 0) {
        const transactionStaffId = staffId || 'system'; // Use system as fallback
        await this.recordTransaction({
          inventoryItemId: inventory.id,
          menuItemId: inventory.menuItemId,
          restaurantId: inventory.restaurantId,
          type: 'restock',
          quantityChanged: inventory.currentQuantity,
          previousQuantity: 0,
          newQuantity: inventory.currentQuantity,
          reason: 'Initial stock setup',
          notes: 'Inventory item created with initial stock',
          staffId: transactionStaffId,
        });
      }

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
  static async updateInventoryItem(inventoryId: string, restaurantId: string, updates: Partial<InventoryItem>, staffId?: string, skipTransactionRecord = false): Promise<ApiResponse<InventoryItem>> {
    try {
      const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventoryId);

      // Get current inventory data to compare for quantity changes
      let currentInventory: InventoryItem | null = null;
      let shouldRecordTransaction = false;
      
      if ((updates.currentQuantity !== undefined || staffId) && !skipTransactionRecord) {
        const currentResult = await this.getInventoryById(inventoryId, restaurantId);
        if (currentResult.success && currentResult.data) {
          currentInventory = currentResult.data;
          
          // Check if quantity is being changed
          if (updates.currentQuantity !== undefined && updates.currentQuantity !== currentInventory.currentQuantity) {
            shouldRecordTransaction = true;
          }
        }
      }

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      // Handle date fields
      if (updates.lastRestockedAt) {
        updateData.lastRestockedAt = Timestamp.fromDate(updates.lastRestockedAt);
      }

      // Handle linked items properly
      if (updates.linkedItems) {
        updateData.linkedItems = updates.linkedItems.map(item => ({
          ...item,
          createdAt: item.createdAt instanceof Date ? Timestamp.fromDate(item.createdAt) : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? Timestamp.fromDate(item.updatedAt) : item.updatedAt,
        }));
      }

      // Filter out undefined fields to prevent Firebase errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(inventoryRef, updateData);

      // Get updated inventory item
      const result = await this.getInventoryById(inventoryId, restaurantId);
      
      if (result.success && result.data) {
        console.log('✅ Inventory item updated:', inventoryId);
        
        // Record transaction if quantity was changed and we have staffId
        if (shouldRecordTransaction && currentInventory && staffId && updates.currentQuantity !== undefined) {
          const quantityChanged = updates.currentQuantity - currentInventory.currentQuantity;
          
          // Determine transaction type based on quantity change
          let transactionType: 'restock' | 'manual_adjustment' | 'waste' = 'manual_adjustment';
          let reason = 'Inventory quantity updated';
          
          if (quantityChanged > 0) {
            transactionType = 'restock';
            reason = 'Inventory restocked';
          } else if (quantityChanged < 0) {
            transactionType = 'manual_adjustment';
            reason = 'Inventory adjusted down';
          }

          // Record the transaction
          const transactionResult = await this.recordTransaction({
            inventoryItemId: inventoryId,
            menuItemId: currentInventory.menuItemId,
            restaurantId,
            type: transactionType,
            quantityChanged,
            previousQuantity: currentInventory.currentQuantity,
            newQuantity: updates.currentQuantity,
            reason,
            notes: 'Updated via inventory edit',
            staffId,
          });

          if (transactionResult.success) {
            console.log('✅ Transaction recorded for inventory update:', quantityChanged);
          } else {
            console.error('❌ Failed to record transaction for inventory update:', transactionResult.error);
          }
        }
        
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

      const cleanedTransaction = this.cleanInventoryData({
        ...transaction,
        createdAt: Timestamp.fromDate(transaction.createdAt),
      });

      await setDoc(transactionRef, cleanedTransaction);

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

      const updateResult = await this.updateInventoryItem(inventoryId, restaurantId, updateData, undefined, true);
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

      // Handle reverse linking: if this is a linked item, update base inventory
      if (currentInventory.baseInventoryId && currentInventory.baseRatio && quantityChanged !== 0) {
        const baseInventoryResult = await this.getInventoryById(currentInventory.baseInventoryId, restaurantId);
        
        if (baseInventoryResult.success && baseInventoryResult.data) {
          const baseInventory = baseInventoryResult.data;
          
          // Calculate change to base inventory based on reverse ratio
          const baseQuantityChange = quantityChanged * currentInventory.baseRatio;
          const newBaseQuantity = Math.max(0, baseInventory.currentQuantity + baseQuantityChange);
          
          console.log(`🔄 Reverse link adjustment: ${quantityChanged} × ${currentInventory.baseRatio} = ${baseQuantityChange} change to base inventory`);
          
          // Update base inventory
          const baseUpdateResult = await this.updateInventoryItem(
            currentInventory.baseInventoryId, 
            restaurantId, 
            { currentQuantity: newBaseQuantity },
            undefined,
            true // Skip transaction recording to handle it manually
          );
          
          if (baseUpdateResult.success) {
            // Record transaction for base inventory
            await this.recordTransaction({
              inventoryItemId: currentInventory.baseInventoryId,
              menuItemId: baseInventory.menuItemId,
              restaurantId,
              type: 'manual_adjustment',
              quantityChanged: baseQuantityChange,
              previousQuantity: baseInventory.currentQuantity,
              newQuantity: newBaseQuantity,
              reason: `Reverse link adjustment from ${currentInventory.menuItemId} (ratio: ${currentInventory.baseRatio})`,
              notes: `Triggered by adjustment to linked item: ${reason || 'Manual adjustment'}`,
              staffId,
            });
            
            console.log(`✅ Updated base inventory via reverse link: ${baseInventory.currentQuantity} → ${newBaseQuantity}`);
          }
        }
      }

      // Handle forward linking: if this is a base item with linked items, update them
      if (currentInventory.linkedItems && currentInventory.linkedItems.length > 0 && quantityChanged !== 0) {
        for (const linkedItem of currentInventory.linkedItems) {
          if (!linkedItem.isActive) continue;
          
          // Get linked inventory by menuItemId (linkedInventoryId actually contains menuItemId)
          const linkedInventoryResult = await this.getInventoryByMenuItemId(linkedItem.linkedInventoryId, restaurantId);
          
          if (!linkedInventoryResult.success || !linkedInventoryResult.data) {
            console.log(`⚠️ Linked inventory not found for menuItemId: ${linkedItem.linkedInventoryId}`);
            continue;
          }

          const linkedInventory = linkedInventoryResult.data;
          
          // Calculate change to linked inventory based on ratio
          const linkedQuantityChange = quantityChanged * linkedItem.ratio;
          const newLinkedQuantity = Math.max(0, linkedInventory.currentQuantity + linkedQuantityChange);
          
          console.log(`🔗 Forward link adjustment: ${quantityChanged} × ${linkedItem.ratio} = ${linkedQuantityChange} change to linked item`);
          
          // Update linked inventory
          const linkedUpdateResult = await this.updateInventoryItem(
            linkedItem.linkedInventoryId,
            restaurantId,
            { currentQuantity: newLinkedQuantity },
            undefined,
            true // Skip transaction recording to handle it manually
          );
          
          if (linkedUpdateResult.success) {
            // Record transaction for linked inventory
            await this.recordTransaction({
              inventoryItemId: linkedItem.linkedInventoryId,
              menuItemId: linkedInventory.menuItemId,
              restaurantId,
              type: 'manual_adjustment',
              quantityChanged: linkedQuantityChange,
              previousQuantity: linkedInventory.currentQuantity,
              newQuantity: newLinkedQuantity,
              reason: `Forward link adjustment from ${currentInventory.menuItemId} (ratio: ${linkedItem.ratio})`,
              notes: `Triggered by adjustment to base item: ${reason || 'Manual adjustment'}`,
              staffId,
            });
            
            console.log(`✅ Updated linked inventory via forward link: ${linkedInventory.currentQuantity} → ${newLinkedQuantity}`);
          }
        }
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

  // Deduct inventory for order with linked item support
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
        console.log(`📦 Processing order item: ${orderItem.menuItemId}, quantity: ${orderItem.quantity}`);

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

        

        // Update main inventory
        const inventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, inventory.id);
        batch.update(inventoryRef, {
          currentQuantity: newQuantity,
          updatedAt: Timestamp.now(),
        });

        // Create transaction record for main inventory
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

        // Process linked items deduction
        if (inventory.linkedItems && inventory.linkedItems.length > 0) {
          console.log(`🔗 Processing ${inventory.linkedItems.length} linked items for ${orderItem.menuItemId}`);
          console.log(`🔗 Linked items:`, inventory.linkedItems.map(item => ({ 
            name: item.linkedMenuItemName, 
            ratio: item.ratio, 
            reverseRatio: item.reverseRatio,
            enableReverseLink: item.enableReverseLink,
            isActive: item.isActive 
          })));
          
          for (const linkedItem of inventory.linkedItems) {
            if (!linkedItem.isActive) {
              console.log(`⏭️ Skipping inactive linked item: ${linkedItem.linkedMenuItemName}`);
              continue;
            }

            // Get linked inventory
            const linkedInventoryResult = await this.getInventoryByMenuItemId(linkedItem.linkedInventoryId, restaurantId);
            
            if (!linkedInventoryResult.success || !linkedInventoryResult.data) {
              console.log(`⚠️ Linked inventory not found for menuItemId: ${linkedItem.linkedInventoryId}`);
              continue;
            }

            const linkedInventory = linkedInventoryResult.data;

            // Calculate linked deduction based on ratio
            const linkedDeductionAmount = totalDeduction * linkedItem.ratio;
            const linkedNewQuantity = Math.max(0, linkedInventory.currentQuantity - linkedDeductionAmount);

            

            // Update linked inventory
            const linkedInventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, linkedInventory.id);
            batch.update(linkedInventoryRef, {
              currentQuantity: linkedNewQuantity,
              updatedAt: Timestamp.now(),
            });

            // Create transaction record for linked inventory
            const linkedTransactionId = generateId();
            const linkedTransaction: InventoryTransaction = {
              id: linkedTransactionId,
              inventoryItemId: linkedInventory.id,
              menuItemId: linkedInventory.menuItemId,
              restaurantId,
              type: 'order_deduction',
              quantityChanged: -linkedDeductionAmount,
              previousQuantity: linkedInventory.currentQuantity,
              newQuantity: linkedNewQuantity,
              orderId,
              staffId,
              reason: `Linked deduction from ${orderItem.menuItemId} (ratio: ${linkedItem.ratio})`,
              createdAt: new Date(),
            };

            const linkedTransactionRef = doc(db, 'restaurants', restaurantId, this.TRANSACTIONS_COLLECTION, linkedTransactionId);
            batch.set(linkedTransactionRef, {
              ...linkedTransaction,
              createdAt: Timestamp.fromDate(linkedTransaction.createdAt),
            });

            transactions.push(linkedTransaction);
          }
        }

        // Process reverse linked items if this inventory is linked to another base
        if (inventory.baseInventoryId && inventory.baseRatio) {
          console.log(`🔄 Processing reverse link for base inventory: ${inventory.baseInventoryId}`);
          
          const baseInventoryResult = await this.getInventoryById(inventory.baseInventoryId, restaurantId);
          
          if (baseInventoryResult.success && baseInventoryResult.data) {
            const baseInventory = baseInventoryResult.data;
            
            // Check if reverse linking is enabled
            const reverseLinkedItem = baseInventory.linkedItems?.find(item => 
              item.linkedInventoryId === inventory.id && item.enableReverseLink
            );
            
            if (reverseLinkedItem) {
              const reverseDeductionAmount = totalDeduction * (reverseLinkedItem.reverseRatio || 1);
              const reverseNewQuantity = Math.max(0, baseInventory.currentQuantity - reverseDeductionAmount);

  

              // Update base inventory
              const baseInventoryRef = doc(db, 'restaurants', restaurantId, this.INVENTORY_COLLECTION, baseInventory.id);
              batch.update(baseInventoryRef, {
                currentQuantity: reverseNewQuantity,
                updatedAt: Timestamp.now(),
              });

              // Create transaction record for reverse deduction
              const reverseTransactionId = generateId();
              const reverseTransaction: InventoryTransaction = {
                id: reverseTransactionId,
                inventoryItemId: baseInventory.id,
                menuItemId: baseInventory.menuItemId,
                restaurantId,
                type: 'order_deduction',
                quantityChanged: -reverseDeductionAmount,
                previousQuantity: baseInventory.currentQuantity,
                newQuantity: reverseNewQuantity,
                orderId,
                staffId,
                reason: `Reverse linked deduction from ${orderItem.menuItemId} (reverse ratio: ${reverseLinkedItem.reverseRatio || 1})`,
                createdAt: new Date(),
              };

              const reverseTransactionRef = doc(db, 'restaurants', restaurantId, this.TRANSACTIONS_COLLECTION, reverseTransactionId);
              batch.set(reverseTransactionRef, {
                ...reverseTransaction,
                createdAt: Timestamp.fromDate(reverseTransaction.createdAt),
              });

              transactions.push(reverseTransaction);
            }
          }
        }
      }

      await batch.commit();

      

      return {
        success: true,
        data: transactions,
        message: 'Inventory deducted successfully with linked items',
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
  static async getTransactionHistory(
    inventoryItemId: string,
    restaurantId: string,
    filters: {
      dateRange?: { from: Date; to: Date };
      type?: 'all' | 'order_deduction' | 'adjustment';
    } = {}
  ): Promise<ApiResponse<InventoryTransaction[]>> {
    try {
      const collectionRef = collection(db, 'restaurants', restaurantId, this.TRANSACTIONS_COLLECTION);
      
      let q = query(
        collectionRef,
        where('inventoryItemId', '==', inventoryItemId),
        orderBy('createdAt', 'desc')
      );

      // Apply date filter
      if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
        const endOfDay = new Date(filters.dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.dateRange.from)), where('createdAt', '<=', Timestamp.fromDate(endOfDay)));
      }
      
      q = query(q, limit(250)); // Increased limit

      const querySnapshot = await getDocs(q);
      let transactions = querySnapshot.docs.map(doc =>
        this.convertFirestoreTransaction(doc.data(), doc.id)
      );

      // Apply type filter client-side as Firestore doesn't support range + IN on different fields
      if (filters.type && filters.type !== 'all') {
        if (filters.type === 'order_deduction') {
          transactions = transactions.filter(t => t.type === 'order_deduction');
        } else if (filters.type === 'adjustment') {
          transactions = transactions.filter(t => ['restock', 'waste', 'correction'].includes(t.type));
        }
      }

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
        
        const cleanedAlert = this.cleanInventoryData({
          ...alert,
          createdAt: Timestamp.fromDate(alert.createdAt),
        });
        
        await setDoc(alertRef, cleanedAlert);
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
      
      // Inventory Linking System
      linkedItems: data.linkedItems ? data.linkedItems.map((item: any) => ({
        id: item.id,
        linkedInventoryId: item.linkedInventoryId,
        linkedMenuItemId: item.linkedMenuItemId,
        linkedMenuItemName: item.linkedMenuItemName,
        ratio: item.ratio,
        reverseRatio: item.reverseRatio,
        enableReverseLink: item.enableReverseLink,
        isActive: item.isActive,
        createdAt: item.createdAt?.toDate() || new Date(),
        updatedAt: item.updatedAt?.toDate() || new Date(),
      })) : undefined,
      baseInventoryId: data.baseInventoryId,
      baseRatio: data.baseRatio,
      isBaseInventory: data.isBaseInventory,
      reverseLinksEnabled: data.reverseLinksEnabled,
      
      // Standalone Item Support
      isStandaloneItem: data.isStandaloneItem,
      displayName: data.displayName,
      standaloneItemName: data.standaloneItemName,
      
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  // Create initial transaction for existing inventory items (data migration)
  static async createInitialTransactionForInventory(inventoryId: string, restaurantId: string, staffId: string): Promise<ApiResponse<InventoryTransaction | null>> {
    try {
      // Get inventory item
      const inventoryResult = await this.getInventoryById(inventoryId, restaurantId);
      if (!inventoryResult.success || !inventoryResult.data) {
        return {
          success: false,
          error: 'Inventory item not found',
        };
      }

      const inventory = inventoryResult.data;

      // Check if any transactions already exist for this inventory
      const existingTransactions = await this.getTransactionHistory(inventoryId, restaurantId);
      if (existingTransactions.success && existingTransactions.data && existingTransactions.data.length > 0) {
        return {
          success: true,
          data: null, // No transaction created - already exists
          message: 'Transactions already exist for this inventory item',
        };
      }

      // Create initial transaction only if current quantity > 0
      if (inventory.currentQuantity > 0) {
        const transactionResult = await this.recordTransaction({
          inventoryItemId: inventory.id,
          menuItemId: inventory.menuItemId,
          restaurantId: inventory.restaurantId,
          type: 'restock',
          quantityChanged: inventory.currentQuantity,
          previousQuantity: 0,
          newQuantity: inventory.currentQuantity,
          reason: 'Initial stock entry',
          notes: 'Historical stock data - created during transaction system implementation',
          staffId,
        });

        return transactionResult;
      }

      return {
        success: true,
        data: null,
        message: 'No initial transaction needed - inventory quantity is 0',
      };
    } catch (error: any) {
      console.error('❌ Failed to create initial transaction:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
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

  // Fix linked inventory IDs - ensure they point to the correct inventory items
  static async fixLinkedInventoryIds(restaurantId: string): Promise<ApiResponse<{ fixed: number; total: number }>> {
    try {
      console.log('🔧 Starting to fix linked inventory IDs...');
      
      // Get all inventory items
      const allInventoryResult = await this.getInventoryForRestaurant(restaurantId);
      if (!allInventoryResult.success || !allInventoryResult.data) {
        return {
          success: false,
          error: 'Failed to get inventory items'
        };
      }
      
      const allInventory = allInventoryResult.data;
      let fixedCount = 0;
      let totalLinksChecked = 0;
      
      for (const inventory of allInventory) {
        if (!inventory.linkedItems || inventory.linkedItems.length === 0) continue;
        
        let inventoryUpdated = false;
        const updatedLinkedItems = [...inventory.linkedItems];
        
        for (let i = 0; i < updatedLinkedItems.length; i++) {
          const linkedItem = updatedLinkedItems[i];
          totalLinksChecked++;
          
          // Find the actual inventory item by menu item ID
          const actualLinkedInventory = allInventory.find(inv => 
            inv.menuItemId === linkedItem.linkedMenuItemId
          );
          
          if (actualLinkedInventory && actualLinkedInventory.id !== linkedItem.linkedInventoryId) {
            console.log(`🔧 Fixing linked inventory ID: ${linkedItem.linkedMenuItemName}`);
            console.log(`   Old ID: ${linkedItem.linkedInventoryId}`);
            console.log(`   New ID: ${actualLinkedInventory.id}`);
            
            // Update the linked inventory ID
            updatedLinkedItems[i] = {
              ...linkedItem,
              linkedInventoryId: actualLinkedInventory.id,
              updatedAt: new Date()
            };
            
            inventoryUpdated = true;
            fixedCount++;
          }
        }
        
        // Update the inventory if any linked items were fixed
        if (inventoryUpdated) {
          const updateResult = await this.updateInventoryItem(
            inventory.id,
            restaurantId,
            { linkedItems: updatedLinkedItems },
            'system', // Use system as staff ID for this fix
            true // Skip transaction recording
          );
          
          if (updateResult.success) {
            console.log(`✅ Updated inventory: ${inventory.menuItemId}`);
          } else {
            console.error(`❌ Failed to update inventory: ${inventory.menuItemId}`);
          }
        }
      }
      
      console.log(`🔧 Finished fixing linked inventory IDs: ${fixedCount}/${totalLinksChecked} fixed`);
      
      return {
        success: true,
        data: { fixed: fixedCount, total: totalLinksChecked },
        message: `Fixed ${fixedCount} out of ${totalLinksChecked} linked inventory IDs`
      };
      
    } catch (error: any) {
      console.error('❌ Failed to fix linked inventory IDs:', error);
      return {
        success: false,
        error: handleFirebaseError(error)
      };
    }
  }

  // Function to fix existing linked inventory items that may have incorrect data
  static async enableAutoDeductForAll(restaurantId: string): Promise<ApiResponse<{ updated: number }>> {
    try {

      
      // Get all inventory items
      const allInventoryResult = await this.getInventoryForRestaurant(restaurantId);
      if (!allInventoryResult.success || !allInventoryResult.data) {
        return {
          success: false,
          error: 'Failed to get inventory items'
        };
      }
      
      const allInventory = allInventoryResult.data;
      let updatedCount = 0;
      
      for (const inventory of allInventory) {
        if (!inventory.autoDeduct || !inventory.isTracked) {
          const updateData: any = {};
          
          if (!inventory.autoDeduct) {
            updateData.autoDeduct = true;
          }
          if (!inventory.isTracked) {
            updateData.isTracked = true;
          }

          const result = await this.updateInventoryItem(
            inventory.id,
            restaurantId,
            updateData,
            'system',
            true // Skip transaction recording
          );
          
          if (result.success) {
            updatedCount++;
          }
        }
      }
      
      
      
      return {
        success: true,
        data: { updated: updatedCount },
        message: `Enabled auto-deduct for ${updatedCount} inventory items`
      };
      
    } catch (error: any) {
      console.error('❌ Failed to enable auto-deduct for all:', error);
      return {
        success: false,
        error: handleFirebaseError(error)
      };
    }
  }

  // Helper method to clean data by removing undefined fields (Firestore doesn't accept undefined values)
  private static cleanInventoryData(data: any): any {
    const cleaned: any = {};
    
    for (const key in data) {
      if (data[key] !== undefined) {
        cleaned[key] = data[key];
      }
    }
    
    return cleaned;
  }
} 