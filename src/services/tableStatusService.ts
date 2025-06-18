import { TableService } from './tableService';
import { OrderService } from './orderService';
import toast from 'react-hot-toast';

interface TableStatusFix {
  tableId: string;
  tableNumber: string;
  currentStatus: string;
  correctStatus: string;
  reason: string;
}

export class TableStatusService {
  /**
   * Check and fix table statuses that don't match their actual order state
   * This will scan all tables and fix those showing 'occupied' without orders
   */
  static async checkAndFixTableStatuses(restaurantId: string): Promise<{
    success: boolean;
    fixed: TableStatusFix[];
    errors: string[];
  }> {
    try {
      console.log('🔧 TableStatusService: Starting table status audit for restaurant:', restaurantId);
      
      // Get all tables
      const tablesResult = await TableService.getTablesForRestaurant(restaurantId);
      if (!tablesResult.success || !tablesResult.data) {
        return {
          success: false,
          fixed: [],
          errors: ['Failed to fetch tables']
        };
      }
      
      const tables = tablesResult.data;
      const fixes: TableStatusFix[] = [];
      const errors: string[] = [];
      
      // Check each table that shows as occupied
      for (const table of tables) {
        if (table.status === 'occupied') {
          try {
            // Check if table actually has active orders
            const ordersResult = await OrderService.getOrdersByTable(restaurantId, table.id);
            
            if (ordersResult.success && ordersResult.data) {
              // Consider orders as "active" if they are in kitchen workflow OR completed but not paid
              const activeOrders = ordersResult.data.filter(order => 
                ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status) ||
                (order.status === 'completed' && order.paymentStatus !== 'paid')
              );
              
              // If no active orders but table shows occupied, fix it
              if (activeOrders.length === 0) {
                console.log(`🔧 Fixing table ${table.number}: occupied -> available (no active orders)`);
                
                const updateResult = await TableService.updateTable(table.id, restaurantId, {
                  status: 'available'
                });
                
                if (updateResult.success) {
                  fixes.push({
                    tableId: table.id,
                    tableNumber: table.number,
                    currentStatus: 'occupied',
                    correctStatus: 'available',
                    reason: 'No active orders found'
                  });
                } else {
                  errors.push(`Failed to update table ${table.number}: ${updateResult.error}`);
                }
              } else {
                console.log(`✅ Table ${table.number} correctly shows occupied (${activeOrders.length} active orders)`);
              }
            } else {
              // If we can't get orders, assume table should be available
              console.log(`🔧 Fixing table ${table.number}: occupied -> available (failed to fetch orders)`);
              
              const updateResult = await TableService.updateTable(table.id, restaurantId, {
                status: 'available'
              });
              
              if (updateResult.success) {
                fixes.push({
                  tableId: table.id,
                  tableNumber: table.number,
                  currentStatus: 'occupied',
                  correctStatus: 'available',
                  reason: 'Could not verify orders'
                });
              } else {
                errors.push(`Failed to update table ${table.number}: ${updateResult.error}`);
              }
            }
          } catch (error) {
            console.error(`Error checking table ${table.number}:`, error);
            errors.push(`Error checking table ${table.number}: ${error}`);
          }
        }
      }
      
      console.log('🔧 TableStatusService: Audit complete', {
        tablesChecked: tables.length,
        fixesApplied: fixes.length,
        errors: errors.length
      });
      
      return {
        success: true,
        fixed: fixes,
        errors
      };
      
    } catch (error) {
      console.error('🔧 TableStatusService: Audit failed:', error);
      return {
        success: false,
        fixed: [],
        errors: [String(error)]
      };
    }
  }
  
  /**
   * Auto-fix table statuses with user notification
   */
  static async autoFixWithNotification(restaurantId: string): Promise<void> {
    try {
      toast('🔧 Checking table statuses...', { 
        icon: '⏳',
        duration: 1500,
        style: {
          fontSize: '12px',
          padding: '6px 10px',
          maxWidth: '200px',
          background: 'rgba(59, 130, 246, 0.85)',
          color: '#fff',
          borderRadius: '6px'
        }
      });
      
      const result = await this.checkAndFixTableStatuses(restaurantId);
      
      if (result.success) {
        if (result.fixed.length > 0) {
          const tableNumbers = result.fixed.map(f => f.tableNumber).join(', ');
          toast.success(`🔧 Fixed ${result.fixed.length} table status(es): Tables ${tableNumbers}`);
          
          // Log details
          result.fixed.forEach(fix => {
            console.log(`✅ Fixed Table ${fix.tableNumber}: ${fix.currentStatus} → ${fix.correctStatus} (${fix.reason})`);
          });
        } else {
          toast.success('✅ All table statuses are correct');
        }
        
        if (result.errors.length > 0) {
          console.warn('🔧 Some tables had errors:', result.errors);
          toast(`⚠️ ${result.errors.length} table(s) had errors - check console`, { icon: '⚠️' });
        }
      } else {
        toast.error('🔧 Failed to check table statuses');
        console.error('🔧 Table status check failed:', result.errors);
      }
    } catch (error) {
      console.error('🔧 Auto-fix error:', error);
      toast.error('🔧 Error checking table statuses');
    }
  }
}

export const tableStatusService = new TableStatusService(); 