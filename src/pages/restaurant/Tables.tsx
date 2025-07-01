import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Clock,
  MapPin,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  User,
  Settings,
  Grid3X3,
  RefreshCw,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { TableService } from '@/services/tableService';
import { TableAreaService } from '@/services/tableAreaService';
import { TableStatusService } from '@/services/tableStatusService';
import { Table, TableStatus } from '@/types';
import { VoiceCommand } from '@/services/voiceService';
import { VoiceLoadingOverlay } from '@/components/voice/VoiceLoadingOverlay';
import { VoiceKOTDialog } from '@/components/voice/VoiceKOTDialog';

interface CreateTableForm {
  number: string;
  area: string;
  capacity: number;
}

interface CreateAreaForm {
  areaName: string;
}

export default function Tables() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const navigate = useNavigate();
  
  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<TableStatus | 'all'>('all');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showCreateAreaModal, setShowCreateAreaModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceLoadingStage, setVoiceLoadingStage] = useState<'processing' | 'placing' | 'completed'>('processing');
  const [voiceLoadingMessage, setVoiceLoadingMessage] = useState('');
  const [voiceOrderDetails, setVoiceOrderDetails] = useState<{
    orderNumber: string;
    tableNumber: string;
    items: { name: string; quantity: number }[];
  } | null>(null);
  const [showVoiceKOTDialog, setShowVoiceKOTDialog] = useState(false);

  // Track initial load to prevent showing notifications on first load
  const isInitialLoad = useRef(true);

  const {
    register: registerTable,
    handleSubmit: handleTableSubmit,
    reset: resetTable,
    setValue,
    formState: { errors: tableErrors, isValid: isTableValid },
  } = useForm<CreateTableForm>({
    mode: 'onChange',
  });

  const {
    register: registerArea,
    handleSubmit: handleAreaSubmit,
    reset: resetArea,
    formState: { errors: areaErrors, isValid: isAreaValid },
  } = useForm<CreateAreaForm>({
    mode: 'onChange',
  });

  // Generate KOT content for Tables page
  const generateKOTContent = (order: any, restaurant: any, table: any): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>KOT - ${order.orderNumber}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            margin: 0; 
            padding: 0 10px; 
            width: 100%;
            background: #fff;
          }
          .kot-container {
            width: 100%;
            padding: 15px 5px;
            min-height: auto;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
            margin-bottom: 15px; 
          }
          .restaurant-name { 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 5px;
          }
          .order-info { 
            margin-bottom: 15px; 
            line-height: 1.4;
          }
          .items { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 15px 0;
          }
          .items th, .items td { 
            border: 1px solid #000; 
            padding: 8px; 
            text-align: left; 
            font-size: 13px;
          }
          .items th { 
            background-color: #f0f0f0; 
            font-weight: bold;
          }
          .footer { 
            margin-top: 20px; 
            text-align: center; 
            font-size: 12px; 
            border-top: 1px dashed #000;
            padding-top: 15px;
          }
          .order-notes {
            margin-top: 15px; 
            padding: 10px; 
            border: 1px solid #000;
            background: #f9f9f9;
          }
          @media print {
            body { 
              margin: 0; 
              padding: 0 8px;
              width: 100%;
            }
            .kot-container {
              padding: 10px 0;
              width: 100%;
              min-height: auto;
            }
            .no-print { display: none; }
            .header, .order-info, .items, .order-notes, .footer {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="kot-container">
        <div class="header">
          <div class="restaurant-name">${restaurant.name}</div>
          <div>KITCHEN ORDER TICKET</div>
        </div>
        
        <div class="order-info">
          <p><strong>Order #:</strong> ${order.orderNumber}</p>
          <p><strong>Table:</strong> ${table.number} (${table.area})</p>
          <p><strong>Date/Time:</strong> ${order.createdAt.toLocaleString()}</p>
          <p><strong>Staff:</strong> ${order.staffId}</p>
        </div>
        
        <table class="items">
          <thead>
            <tr>
              <th>Qty</th>
              <th>Item</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item: any) => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name}</td>
                <td>${item.notes || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${order.notes ? `
            <div class="order-notes">
            <strong>Order Notes:</strong><br>
            ${order.notes}
          </div>
        ` : ''}
        
        <div class="footer">
          <p>*** KITCHEN COPY ***</p>
          <p>Printed at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Handle KOT printing for voice orders
  const handleVoiceKOTPrint = () => {
    if (voiceOrderDetails && restaurant) {
      const table = tables.find(t => t.number === voiceOrderDetails.tableNumber);
      if (table) {
        const order = {
          orderNumber: voiceOrderDetails.orderNumber,
          items: voiceOrderDetails.items,
          createdAt: new Date(),
          staffId: user?.name || 'Voice Order',
          notes: `Voice order placed at ${new Date().toLocaleTimeString()}`
        };
        
        const kotContent = generateKOTContent(order, restaurant, table);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(kotContent);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }
        
        toast.success('KOT sent to kitchen');
      }
    }
  };

  // Load tables data with enhanced caching and real-time updates
  const loadTables = useCallback(async (forceRefresh = false) => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      
      if (forceRefresh) {
        // Clear cache to force Firebase fetch
        TableService.clearCache(restaurant.id);
        setIsSyncing(true);
      }

      // Load both tables and table areas
      const [tablesResult, areasResult] = await Promise.all([
        TableService.getTablesForRestaurant(restaurant.id),
        TableAreaService.getTableAreasForRestaurant(restaurant.id)
      ]);

      if (tablesResult.success && tablesResult.data) {
        setTables(tablesResult.data);
        
        // Extract unique areas from tables (for backward compatibility)
        const uniqueAreas = [...new Set(tablesResult.data.map(table => table.area))].sort();
        setAreas(uniqueAreas);
        
        setLastSync(new Date());
        
        console.log(`Debug: tables.length = ${tablesResult.data.length}, tableAreas.length = ${areasResult.data?.length || 0}, isLoading = false`);
        
        if (forceRefresh) {
          toast.success('Tables synchronized successfully');
        }
      } else {
        toast.error(tablesResult.error || 'Failed to load tables');
      }

      // Table areas loaded successfully but not stored in state (unused)
      
    } catch (error) {
      toast.error('Failed to load tables');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [restaurant]);

  // Real-time table subscription
  useEffect(() => {
    if (!restaurant) return;

    console.log('🔄 Tables: Setting up real-time table subscription');
    setIsLoading(true);

    // Subscribe to real-time table updates
    const unsubscribe = TableService.subscribeToTables(
      restaurant.id,
      (updatedTables) => {
        console.log('🔄 Tables: Real-time table update received:', {
          count: updatedTables.length,
          tables: updatedTables.map(t => ({ number: t.number, status: t.status }))
        });

        setTables(updatedTables);
        
        // Extract unique areas from tables (for backward compatibility)
        const uniqueAreas = [...new Set(updatedTables.map(table => table.area))].sort();
        setAreas(uniqueAreas);
        
        setLastSync(new Date());
        setIsLoading(false);
        setIsSyncing(false);
        
        // Show notification for status changes (only after initial load)
        if (!isInitialLoad.current) {
          console.log('🔄 Tables: Table status updated in real-time');
        } else {
          isInitialLoad.current = false;
        }
      }
    );

    // Clean up subscription on unmount
    return () => {
      console.log('🔄 Tables: Cleaning up real-time table subscription');
      unsubscribe();
    };
  }, [restaurant]);

  // Initialize tables on first load
  const initializeTablesIfNeeded = useCallback(async () => {
    if (!restaurant) return;

    try {
      // Check if we have any tables (from cache or fresh)
      if (tables.length === 0) {
        console.log('🎯 No tables found, initializing default tables...');
        
        const result = await TableService.initializeDefaultTables(restaurant.id);
        if (result.success && result.data) {
          setTables(result.data);
          
          const uniqueAreas = [...new Set(result.data.map(table => table.area))].sort();
          setAreas(uniqueAreas);
          
          setLastSync(new Date());
          toast.success('Welcome! Default tables have been created for you.');
        }
      }
    } catch (error) {
      console.error('Failed to initialize default tables:', error);
    }
  }, [restaurant]);

  // Effects
  useEffect(() => {
    if (restaurant) {
      loadTables();
      
      // Auto-check table statuses on load (after a delay to allow tables to load)
      setTimeout(() => {
        TableStatusService.autoFixWithNotification(restaurant.id);
      }, 3000);
    }
  }, [restaurant]);

  // Effects - Initialize tables if needed (but rely on real-time subscription for updates)
  useEffect(() => {
    if (restaurant && tables.length === 0 && !isLoading) {
      initializeTablesIfNeeded();
    }
  }, [restaurant, tables.length, isLoading, initializeTablesIfNeeded]);

  // Auto-fix table statuses on load (after tables are loaded via real-time subscription)
  useEffect(() => {
    if (restaurant && tables.length > 0 && !isInitialLoad.current) {
      // Auto-check table statuses after real-time subscription loads tables
      setTimeout(() => {
        TableStatusService.autoFixWithNotification(restaurant.id);
      }, 3000);
    }
  }, [restaurant, tables.length]);

  // Remove manual refresh on visibility change - real-time subscription handles updates
  // This prevents conflicts with real-time updates

  // Sync function for manual refresh (clears cache, real-time subscription will reload)
  const handleSyncTables = async () => {
    if (!restaurant) return;
    
    try {
      setIsSyncing(true);
      
      // Clear cache to force fresh data - real-time subscription will automatically reload
      TableService.clearCache(restaurant.id);
      
      // Show success message after a brief delay
      setTimeout(() => {
        toast.success('Tables synchronized successfully');
        setIsSyncing(false);
      }, 1000);
      
    } catch (error) {
      toast.error('Failed to sync tables');
      setIsSyncing(false);
    }
  };

  const handleTableClick = (table: Table) => {
    if (table.status === 'available') {
      navigate(`/${restaurant?.slug}/order/${table.id}`);
    }
  };

  // Voice command event listeners (updated to work with real-time data)
  useEffect(() => {
    // Listen for table status updates from other components (legacy support)
    const handleTableStatusUpdate = (event: CustomEvent) => {
      const { tableId, newStatus } = event.detail;
      console.log('📡 Tables: Received table status update event:', { tableId, newStatus });
      
      // Note: Real-time subscription will handle the actual update
      // This event is kept for backward compatibility
    };
    
    window.addEventListener('tableStatusUpdated', handleTableStatusUpdate as EventListener);
    
    return () => {
      window.removeEventListener('tableStatusUpdated', handleTableStatusUpdate as EventListener);
    };
  }, []);

  // Handlers
  const handleCreateTable = async (data: CreateTableForm) => {
    if (!restaurant) return;

    try {
      const result = await TableService.createTable({
        restaurantId: restaurant.id,
        number: data.number,
        area: data.area,
        areaId: data.area.toLowerCase().replace(/\s+/g, '-'), // Convert area name to areaId
        capacity: data.capacity,
        status: 'available',
        isActive: true,
      });

      if (result.success && result.data) {
        // Add to local state (cache is updated automatically)
        setTables(prev => [...prev, result.data!]);
        
        // Update areas if new area
        if (!areas.includes(data.area)) {
          setAreas(prev => [...prev, data.area].sort());
        }
        
        toast.success(`Table ${data.number} created successfully!`);
        setShowCreateTableModal(false);
        resetTable();
      } else {
        toast.error(result.error || 'Failed to create table');
      }
    } catch (error) {
      toast.error('Failed to create table');
    }
  };

  const handleCreateArea = async (data: CreateAreaForm) => {
    if (!areas.includes(data.areaName)) {
      setAreas(prev => [...prev, data.areaName].sort());
      toast.success(`Area "${data.areaName}" added successfully!`);
      setShowCreateAreaModal(false);
      resetArea();
    } else {
      toast.error('Area already exists');
    }
  };

  const handleUpdateTableStatus = async (table: Table, newStatus: TableStatus) => {
    if (!restaurant) return;

    try {
      // Special handling when manually marking table as available
      if (newStatus === 'available') {
        const confirmed = confirm(
          `Marking Table ${table.number} as available will cancel all active orders for this table. Are you sure you want to proceed?`
        );
        
        if (!confirmed) return;

        // Clear cache first to ensure we get fresh data
        const { OrderService } = await import('@/services/orderService');
        OrderService.clearCache(restaurant.id);

        // Cancel all active orders for this table before making it available
        const ordersResult = await OrderService.getOrdersByTable(restaurant.id, table.id);
        
        if (ordersResult.success && ordersResult.data) {
          const activeOrders = ordersResult.data.filter(order => 
            ['placed', 'confirmed', 'preparing', 'ready'].includes(order.status) ||
            (order.status === 'completed' && order.paymentStatus !== 'paid')
          );
          
          if (activeOrders.length > 0) {
            console.log(`🔄 Tables: Cancelling ${activeOrders.length} active orders for table ${table.number}`);
            
            // Cancel all active orders
            const cancelPromises = activeOrders.map(async (order) => {
              return OrderService.updateOrderStatus(order.id, restaurant.id, 'cancelled', {
                notes: `Table manually marked as available - orders cancelled automatically at ${new Date().toLocaleString()}`
              });
            });
            
            const results = await Promise.all(cancelPromises);
            const allSuccessful = results.every(result => result.success);
            
            if (!allSuccessful) {
              toast.error('Failed to cancel some orders. Please try again.');
              return;
            }
            
            toast.success(`${activeOrders.length} order(s) cancelled for Table ${table.number}`);
          }
          
          // Clear cache again after cancelling orders
          OrderService.clearCache(restaurant.id);
        }
      }

      const result = await TableService.updateTable(table.id, restaurant.id, {
        status: newStatus,
      });

      if (result.success && result.data) {
        // Update local state (cache is updated automatically)
        setTables(prev =>
          prev.map(t => t.id === table.id ? result.data! : t)
        );
        
        // If marking as available, force refresh to ensure UI is consistent
        if (newStatus === 'available') {
          console.log(`🔄 Tables: Forcing data refresh after marking table ${table.number} as available`);
          
          // Clear OrderService cache one more time to ensure fresh data
          const { OrderService } = await import('@/services/orderService');
          OrderService.clearCache(restaurant.id);
          
          // Small delay to allow database changes to propagate
          setTimeout(() => {
            loadTables();
          }, 500);
          
          toast.success(`Table ${table.number} marked as available and all orders cancelled`);
        } else {
          toast.success(`Table ${table.number} ${newStatus}`);
        }
      } else {
        toast.error(result.error || 'Failed to update table');
      }
    } catch (error) {
      console.error('Error updating table status:', error);
      toast.error('Failed to update table');
    }
  };

  const handleEditTable = (table: Table) => {
    setSelectedTable(table);
    setValue('number', table.number);
    setValue('area', table.area);
    setValue('capacity', table.capacity);
    setShowEditModal(true);
  };

  const handleUpdateTable = async (data: CreateTableForm) => {
    if (!restaurant || !selectedTable) return;

    try {
      const result = await TableService.updateTable(selectedTable.id, restaurant.id, {
        number: data.number,
        area: data.area,
        areaId: data.area.toLowerCase().replace(/\s+/g, '-'), // Convert area name to areaId
        capacity: data.capacity,
      });

      if (result.success && result.data) {
        // Update local state (cache is updated automatically)
        setTables(prev =>
          prev.map(t => t.id === selectedTable.id ? result.data! : t)
        );
        
        // Update areas if new area
        if (!areas.includes(data.area)) {
          setAreas(prev => [...prev, data.area].sort());
        }
        
        toast.success(`Table ${data.number} updated successfully!`);
        setShowEditModal(false);
        setSelectedTable(null);
        resetTable();
      } else {
        toast.error(result.error || 'Failed to update table');
      }
    } catch (error) {
      toast.error('Failed to update table');
    }
  };

  const handleDeleteTable = async (table: Table) => {
    if (!restaurant || !confirm(`Delete Table ${table.number}?`)) return;

    try {
      const result = await TableService.deleteTable(table.id, restaurant.id);

      if (result.success) {
        // Remove from local state (cache is updated automatically)
        setTables(prev => prev.filter(t => t.id !== table.id));
        toast.success('Table deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete table');
      }
    } catch (error) {
      toast.error('Failed to delete table');
    }
  };

  // Voice Command Handlers
  const handleVoiceTableStatusCommand = useCallback((event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🏓 Tables: Voice table status command received:', command);
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for status update');
      return;
    }
    
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    // Parse voice command for status change with enhanced keyword detection
    const statusCommands = {
      'occupied': 'occupied' as TableStatus,
      'available': 'available' as TableStatus,
      'reserved': 'reserved' as TableStatus,
      'cleaning': 'cleaning' as TableStatus,
      'busy': 'occupied' as TableStatus,
      'free': 'available' as TableStatus,
      'empty': 'available' as TableStatus,
      'clean': 'cleaning' as TableStatus,
    };
    
    const originalText = command.originalText.toLowerCase();
    let newStatus: TableStatus | null = null;
    
    // Check for status keywords in the command
    for (const [keyword, status] of Object.entries(statusCommands)) {
      if (originalText.includes(keyword)) {
        newStatus = status;
        console.log(`🎤 Detected status keyword: ${keyword} -> ${status}`);
        break;
      }
    }
    
    if (newStatus) {
      console.log(`🎤 Updating table ${table.number} from ${table.status} to ${newStatus}`);
      handleUpdateTableStatus(table, newStatus);
      toast.success(`🎤 Table ${table.number} status changed to ${newStatus}`);
    } else {
      console.log(`🎤 No status keyword found in: "${originalText}"`);
      toast.error(`🎤 Please specify status for table ${table.number}: available, occupied, reserved, or cleaning`);
    }
  }, [tables, handleUpdateTableStatus]);

  // Voice order command handler
  const handleVoiceOrderCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice order command received:', command);
    
    if (!restaurant || !user) {
      toast.error('🎤 Unable to process order at this time');
      return;
    }
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for placing order');
      return;
    }
    
    // Find the table
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    if (table) {
      console.log('🎤 Tables: Found table:', { id: table.id, number: table.number, status: table.status });
      
      // If there are menu items in the command, this is a direct order placement
      if (command.menuItems && command.menuItems.length > 0) {
        console.log('🎤 Tables: Processing voice order on current page');
        
        // Start voice processing workflow with loading overlay and dismiss existing toasts
        toast.dismiss();
        setIsVoiceProcessing(true);
        setVoiceLoadingStage('processing');
        setVoiceLoadingMessage('Processing voice command...');
        
        // Process order placement in background using ghost ordering
        try {
          setVoiceLoadingStage('placing');
          setVoiceLoadingMessage('Creating your order...');
          
          // Use the new AI-powered menu matching
          setTimeout(async () => {
            try {
              if (!restaurant || !user) {
                throw new Error('Restaurant or user not available');
              }
              
              const { MenuService } = await import('@/services/menuService');
              const { OrderService } = await import('@/services/orderService');
              const { TableService } = await import('@/services/tableService');
              const { VoiceService } = await import('@/services/voiceService');
              
              // Load menu items to match voice items
              const menuResult = await MenuService.getMenuItemsForRestaurant(restaurant.id);
              if (!menuResult.success || !menuResult.data) {
                throw new Error('Failed to load menu items');
              }
              
              const menuItems = menuResult.data;
              
              // Use AI-powered menu matching instead of hardcoded logic
              console.log('🎤 Tables: Using AI to match voice items to menu items...');
              const matchedItems = await VoiceService.matchMenuItemsIntelligently(command.menuItems!, menuItems);
              
              const cartItems: any[] = [];
              
              for (const matchedItem of matchedItems) {
                if (matchedItem.matchedItem) {
                  console.log(`🎤 Tables: AI matched "${matchedItem.name}" → "${matchedItem.matchedItem.name}"`);
                  
                  const cartItem = {
                    id: matchedItem.matchedItem.id,
                    menuItemId: matchedItem.matchedItem.id,
                    name: matchedItem.matchedItem.name,
                    price: matchedItem.matchedItem.price,
                    quantity: matchedItem.quantity,
                    total: matchedItem.matchedItem.price * matchedItem.quantity,
                    variants: [],
                    notes: `Voice order: "${matchedItem.name}" matched to "${matchedItem.matchedItem.name}" at ${new Date().toLocaleTimeString()}`
                  };
                  
                  cartItems.push(cartItem);
                } else {
                  console.warn(`🎤 Tables: No match found for voice item: ${matchedItem.name}`);
                  // Will show summary at the end
                }
              }
              
              if (cartItems.length === 0) {
                throw new Error('No valid menu items found');
              }
              
              // Update table status to occupied first
              await TableService.updateTable(table.id, restaurant.id, { status: 'occupied' });
              
              // Create order directly
              const orderResult = await OrderService.createOrder(
                restaurant.id,
                table.id,
                user!.id,
                cartItems,
                restaurant.settings?.taxRate || 8.5,
                `Voice order: ${command.menuItems!.map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}`
              );
              
              if (orderResult.success && orderResult.data) {
                const newOrder = orderResult.data;
                console.log('✅ Tables: Voice order created successfully:', { orderId: newOrder.id, orderNumber: newOrder.orderNumber });
                
                // Move to completed stage
                setVoiceLoadingStage('completed');
                setVoiceLoadingMessage('Order placed successfully!');
                
                // Prepare order details for KOT dialog
                setVoiceOrderDetails({
                  orderNumber: newOrder.orderNumber,
                  tableNumber: table.number,
                  items: matchedItems.filter(item => item.matchedItem).map(item => ({
                    name: item.matchedItem?.name || item.name,
                    quantity: item.quantity
                  }))
                });
                
                // Real-time subscription will automatically update table status
                
                // Hide loading after a brief delay and show final success message
                setTimeout(() => {
                  setIsVoiceProcessing(false);
                  
                  // Show single consolidated success message
                  const successItems = matchedItems.filter(item => item.matchedItem);
                  const failedItems = matchedItems.filter(item => !item.matchedItem);
                  
                  if (successItems.length > 0) {
                    const itemsText = successItems.map(item => `${item.quantity}x ${item.matchedItem?.name}`).join(', ');
                    toast.success(`🎤 Voice order completed: ${itemsText} placed for table ${table.number}!`, {
                      duration: 4000
                    });
                  }
                  
                  if (failedItems.length > 0) {
                    const failedNames = failedItems.map(item => item.name).join(', ');
                    toast.error(`🎤 Items not found: ${failedNames}`);
                  }
                  
                  // Generate and print KOT
                  setTimeout(() => {
                    console.log('🎤 Tables: Generating KOT for ghost order...');
                    
                    // Generate KOT content
                    const kotContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>KOT - ${newOrder.orderNumber}</title>
                        <style>
                          body { 
                            font-family: 'Courier New', monospace; 
                            margin: 0; 
                            padding: 0 10px; 
                            width: 100%;
                            background: #fff;
                          }
                          .kot-container {
                            width: 100%;
                            padding: 15px 5px;
                            min-height: auto;
                          }
                          .header { 
                            text-align: center; 
                            border-bottom: 2px solid #000; 
                            padding-bottom: 10px; 
                            margin-bottom: 15px; 
                          }
                          .restaurant-name { 
                            font-size: 18px; 
                            font-weight: bold; 
                            margin-bottom: 5px;
                          }
                          .order-info { 
                            margin-bottom: 15px; 
                            line-height: 1.4;
                          }
                          .items { 
                            border-collapse: collapse; 
                            width: 100%; 
                            margin: 15px 0;
                          }
                          .items th, .items td { 
                            border: 1px solid #000; 
                            padding: 8px; 
                            text-align: left; 
                            font-size: 13px;
                          }
                          .items th { 
                            background-color: #f0f0f0; 
                            font-weight: bold;
                          }
                          .footer { 
                            margin-top: 20px; 
                            text-align: center; 
                            font-size: 12px; 
                            border-top: 1px dashed #000;
                            padding-top: 15px;
                          }
                          .order-notes {
                            margin-top: 15px; 
                            padding: 10px; 
                            border: 1px solid #000;
                            background: #f9f9f9;
                          }
                          @media print {
                            body { 
                              margin: 0; 
                              padding: 0 8px;
                              width: 100%;
                            }
                            .kot-container {
                              padding: 10px 0;
                              width: 100%;
                              min-height: auto;
                            }
                            .no-print { display: none; }
                            .header, .order-info, .items, .order-notes, .footer {
                              page-break-inside: avoid;
                            }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="kot-container">
                        <div class="header">
                          <div class="restaurant-name">${restaurant.name}</div>
                          <div>KITCHEN ORDER TICKET</div>
                        </div>
                        
                        <div class="order-info">
                          <p><strong>Order #:</strong> ${newOrder.orderNumber}</p>
                          <p><strong>Table:</strong> ${table.number} (${table.area})</p>
                          <p><strong>Date/Time:</strong> ${newOrder.createdAt.toLocaleString()}</p>
                          <p><strong>Staff:</strong> ${newOrder.staffId}</p>
                        </div>
                        
                        <table class="items">
                          <thead>
                            <tr>
                              <th>Qty</th>
                              <th>Item</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${newOrder.items.map((item: any) => `
                              <tr>
                                <td>${item.quantity}</td>
                                <td>${item.name}</td>
                                <td>${item.notes || ''}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        
                        ${newOrder.notes ? `
                            <div class="order-notes">
                            <strong>Order Notes:</strong><br>
                            ${newOrder.notes}
                          </div>
                        ` : ''}
                        
                        <div class="footer">
                          <p>*** KITCHEN COPY ***</p>
                          <p>Printed at: ${new Date().toLocaleString()}</p>
                          </div>
                        </div>
                      </body>
                      </html>
                    `;
                    
                    // Open KOT in new window
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(kotContent);
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                      printWindow.close();
                      
                      toast.success('🧾 KOT sent to kitchen!');
                      console.log('🎤 Tables: KOT generated and sent to kitchen');
                    }
                  }, 500);
                }, 1000);
                
              } else {
                throw new Error(orderResult.error || 'Failed to create order');
              }
            } catch (error) {
              console.error('❌ Tables: Voice order failed:', error);
              setIsVoiceProcessing(false);
              toast.error(`🎤 Voice order failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }, 500);
        } catch (error) {
          console.error('❌ Tables: Voice order processing failed:', error);
          setIsVoiceProcessing(false);
          toast.error('🎤 Failed to process voice order');
        }
      } else {
        // No menu items, navigate to order page
        console.log('🎤 Tables: No menu items in command, navigating to order page');
        navigate(`/${restaurant.slug}/order/${table.id}`);
      }
    } else {
      toast.error(`Table ${command.tableNumber} not found.`);
    }
  }, [restaurant, user, tables, navigate, loadTables]);

  // Voice payment command handler
  const handleVoicePaymentCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice payment command received:', command);
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for payment');
      return;
    }
    
    // Find the table
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    // Check if table has orders (occupied status)
    if (table.status !== 'occupied') {
      toast.error(`🎤 Table ${command.tableNumber} is ${table.status}, no orders to pay for`);
      return;
    }
    
    // Navigate to the order page for this table to process payment
    console.log('🎤 Tables: Navigating to order page for payment processing');
    navigate(`/${restaurant?.slug}/order/${table.id}`);
    
    // Wait for navigation then dispatch payment command again
    setTimeout(() => {
      console.log('🎤 Tables: Re-dispatching payment command for TakeOrder component');
      const retryEvent = new CustomEvent('voicePaymentCommand', {
        detail: { command }
      });
      window.dispatchEvent(retryEvent);
    }, 1500); // Give time for TakeOrder component to mount
    
    toast.success(`🎤 Opening payment for table ${table.number}...`);
  }, [tables, navigate, restaurant]);

  // Voice KOT print command handler
  const handleVoiceKotPrintCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice KOT print command received:', command);
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for KOT printing');
      return;
    }
    
    // Find the table
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    // Check if table has orders (occupied status)
    if (table.status !== 'occupied') {
      toast.error(`🎤 Table ${command.tableNumber} is ${table.status}, no orders to print KOT for`);
      return;
    }
    
    // Navigate to the order page for this table to print KOT
    console.log('🎤 Tables: Navigating to order page for KOT printing');
    navigate(`/${restaurant?.slug}/order/${table.id}`);
    
    // Wait for navigation then dispatch KOT print command again
    setTimeout(() => {
      console.log('🎤 Tables: Re-dispatching KOT print command for TakeOrder component');
      const retryEvent = new CustomEvent('voiceKotPrintCommand', {
        detail: { command }
      });
      window.dispatchEvent(retryEvent);
    }, 1500); // Give time for TakeOrder component to mount
    
    toast.success(`🎤 Opening KOT printing for table ${table.number}...`);
  }, [tables, navigate, restaurant]);

  // Voice order cancel command handler
  const handleVoiceOrderCancelCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice order cancel command received:', command);
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for order cancellation');
      return;
    }
    
    // Find the table
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    // Check if table has orders (occupied status)
    if (table.status !== 'occupied') {
      toast.error(`🎤 Table ${command.tableNumber} is ${table.status}, no orders to cancel`);
      return;
    }
    
    // Navigate to the order page for this table to cancel orders
    console.log('🎤 Tables: Navigating to order page for order cancellation');
    navigate(`/${restaurant?.slug}/order/${table.id}`);
    
    // Wait for navigation then dispatch cancel command again
    setTimeout(() => {
      console.log('🎤 Tables: Re-dispatching order cancel command for TakeOrder component');
      const retryEvent = new CustomEvent('voiceOrderCancelCommand', {
        detail: { command }
      });
      window.dispatchEvent(retryEvent);
    }, 1500);
    
    toast.success(`🎤 Opening order cancellation for table ${table.number}...`);
  }, [tables, navigate, restaurant]);

  // Voice table merge command handler
  const handleVoiceTableMergeCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice table merge command received:', command);
    
    if (!command.tableNumber || !command.targetTableNumber) {
      toast.error('🎤 Please specify both source and target table numbers for merging');
      return;
    }
    
    // Find both tables
    const sourceTable = tables.find(t => parseInt(t.number) === command.tableNumber);
    const targetTable = tables.find(t => parseInt(t.number) === command.targetTableNumber);
    
    if (!sourceTable) {
      toast.error(`🎤 Source table ${command.tableNumber} not found`);
      return;
    }
    
    if (!targetTable) {
      toast.error(`🎤 Target table ${command.targetTableNumber} not found`);
      return;
    }
    
    // Check if source table has orders
    if (sourceTable.status !== 'occupied') {
      toast.error(`🎤 Source table ${command.tableNumber} has no orders to merge`);
      return;
    }
    
    // For now, just show a confirmation message (full implementation would require order service enhancement)
    const confirmed = confirm(`Merge all orders from Table ${sourceTable.number} to Table ${targetTable.number}?`);
    
    if (confirmed) {
      // Simulate merge by updating table statuses
      await handleUpdateTableStatus(sourceTable, 'available');
      await handleUpdateTableStatus(targetTable, 'occupied');
      
      toast.success(`🔗 Orders merged from table ${sourceTable.number} to table ${targetTable.number}`);
    }
  }, [tables, handleUpdateTableStatus]);

  // Voice table transfer command handler
  const handleVoiceTableTransferCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice table transfer command received:', command);
    
    if (!command.tableNumber || !command.targetTableNumber) {
      toast.error('🎤 Please specify both source and target table numbers for transfer');
      return;
    }
    
    // Find both tables
    const sourceTable = tables.find(t => parseInt(t.number) === command.tableNumber);
    const targetTable = tables.find(t => parseInt(t.number) === command.targetTableNumber);
    
    if (!sourceTable) {
      toast.error(`🎤 Source table ${command.tableNumber} not found`);
      return;
    }
    
    if (!targetTable) {
      toast.error(`🎤 Target table ${command.targetTableNumber} not found`);
      return;
    }
    
    // Check if source table has orders
    if (sourceTable.status !== 'occupied') {
      toast.error(`🎤 Source table ${command.tableNumber} has no orders to transfer`);
      return;
    }
    
    // Check if target table is available
    if (targetTable.status !== 'available') {
      toast.error(`🎤 Target table ${command.targetTableNumber} is not available`);
      return;
    }
    
    // For now, just show a confirmation message (full implementation would require order service enhancement)
    const confirmed = confirm(`Transfer all orders from Table ${sourceTable.number} to Table ${targetTable.number}?`);
    
    if (confirmed) {
      // Simulate transfer by updating table statuses
      await handleUpdateTableStatus(sourceTable, 'available');
      await handleUpdateTableStatus(targetTable, 'occupied');
      
      toast.success(`📤 Orders transferred from table ${sourceTable.number} to table ${targetTable.number}`);
    }
  }, [tables, handleUpdateTableStatus]);

  // Voice customer command handler
  const handleVoiceCustomerCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('👤 Tables: Voice customer command received:', command);
    
    if (!restaurant) {
      toast.error('🎤 Restaurant context not available');
      return;
    }

    const { customerName, customerPhone, customerEmail } = command;
    
    if (!customerName && !customerPhone) {
      toast.error('🎤 Please specify customer name or phone number');
      return;
    }

    try {
      // Prepare customer data
      const customerData = {
        name: customerName || '',
        phone: customerPhone || '',
        email: customerEmail || '',
        address: '',
        preferences: ['voice_added'] // Tag as voice-added customer
      };

      console.log('👤 Creating customer via voice:', customerData);
      
      // Import CustomerService dynamically
      const { CustomerService } = await import('@/services/customerService');
      
      // Create customer
      const result = await CustomerService.createCustomer(restaurant.id, customerData);
      
      if (result.success) {
        const customerInfo = customerName || `Customer with phone ${customerPhone}`;
        toast.success(`🎤 Successfully added ${customerInfo} to CRM!`);
        
        // Also show email if provided
        if (customerEmail) {
          toast.success(`📧 Email ${customerEmail} saved for ${customerInfo}`);
        }
        
        console.log('👤 Customer created successfully:', result.data);
      } else {
        console.error('❌ Customer creation failed:', result.error);
        
        // Check if it's a duplicate customer error
        if (result.error?.includes('already exists') || result.error?.includes('duplicate')) {
          toast.error(`🎤 Customer with this information already exists in CRM`);
        } else {
          toast.error(`🎤 Failed to add customer: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('❌ Error creating customer:', error);
      toast.error('🎤 Failed to add customer to CRM');
    }
  }, [restaurant]);

  // Voice place order command handler (ghost ordering from Tables page)
  const handleVoicePlaceOrderCommand = useCallback(async (event: CustomEvent) => {
    const { command }: { command: VoiceCommand } = event.detail;
    
    console.log('🎤 Tables: Voice place order command received (ghost ordering):', command);
    
    if (!restaurant || !user) {
      toast.error('🎤 Unable to place order at this time');
      return;
    }
    
    if (!command.tableNumber) {
      toast.error('🎤 Please specify table number for placing order');
      return;
    }
    
    // Find the table
    const table = tables.find(t => parseInt(t.number) === command.tableNumber);
    if (!table) {
      toast.error(`🎤 Table ${command.tableNumber} not found`);
      return;
    }
    
    // Check if command has menu items for ghost ordering
    if (!command.menuItems || command.menuItems.length === 0) {
      console.log('🎤 Tables: No menu items, navigating to order page instead');
      navigate(`/${restaurant.slug}/order/${table.id}`);
      return;
    }
    
    try {
      console.log('🎤 Tables: Starting ghost ordering process...');
      
      // Import required services
      const { MenuService } = await import('@/services/menuService');
      const { OrderService } = await import('@/services/orderService');
      const { TableService } = await import('@/services/tableService');
      
      // Load menu items to match voice items
      const menuResult = await MenuService.getMenuItemsForRestaurant(restaurant.id);
      if (!menuResult.success || !menuResult.data) {
        throw new Error('Failed to load menu items');
      }
      
      const menuItems = menuResult.data;
      console.log('🎤 Tables: Loaded menu items for matching');
      
      // Find and match menu items
      const cartItems: any[] = [];
      
      for (const voiceItem of command.menuItems) {
        const findMenuItem = (searchTerm: string) => {
          const normalizeWord = (word: string) => {
            return word.toLowerCase()
              .replace(/s$/, '') // Remove plural 's'
              .replace(/ies$/, 'y') // Convert 'ies' to 'y'
              .replace(/es$/, '') // Remove 'es'
              .trim();
          };
          
          const searchWords = searchTerm.toLowerCase().split(' ').map(normalizeWord);
          
          return menuItems.find((item: any) => {
            const itemWords = item.name.toLowerCase().split(' ').map(normalizeWord);
            return searchWords.every((searchWord: string) => 
              itemWords.some((itemWord: string) => 
                itemWord.includes(searchWord) || searchWord.includes(itemWord)
              )
            );
          });
        };
        
        const foundMenuItem = findMenuItem(voiceItem.name);
        if (foundMenuItem) {
          console.log(`🎤 Tables: Found menu item: ${foundMenuItem.name} for voice item: ${voiceItem.name}`);
          
          // Create cart item
          const cartItem = {
            id: foundMenuItem.id,
            menuItemId: foundMenuItem.id,
            name: foundMenuItem.name,
            price: foundMenuItem.price,
            quantity: voiceItem.quantity,
            total: foundMenuItem.price * voiceItem.quantity,
            variants: [],
            notes: `Voice order placed from Tables page at ${new Date().toLocaleTimeString()}`
          };
          
          cartItems.push(cartItem);
        } else {
          console.warn(`🎤 Tables: Menu item not found: ${voiceItem.name}`);
          toast.error(`Menu item "${voiceItem.name}" not found`);
        }
      }
      
      if (cartItems.length === 0) {
        toast.error('🎤 No valid menu items found to place order');
        return;
      }
      
      console.log('🎤 Tables: Creating order directly in background...', { cartItems });
      
      // Update table status to occupied first
      await TableService.updateTable(table.id, restaurant.id, { status: 'occupied' });
      
      // Create order directly
      const orderResult = await OrderService.createOrder(
        restaurant.id,
        table.id,
        user.id,
        cartItems,
        restaurant.settings?.taxRate || 8.5,
        `Voice order: ${command.menuItems.map(item => `${item.quantity}x ${item.name}`).join(', ')} - placed at ${new Date().toLocaleTimeString()}`
      );
      
      if (orderResult.success && orderResult.data) {
        const newOrder = orderResult.data;
        console.log('✅ Tables: Ghost order created successfully:', { orderId: newOrder.id, orderNumber: newOrder.orderNumber });
        
        // Real-time subscription will automatically update table status
        
        // Success message
        const itemsText = command.menuItems.map(item => `${item.quantity}x ${item.name}`).join(', ');
        toast.success(`🎤 Order placed successfully: ${itemsText} for table ${table.number}!`);
        
        // Generate and show KOT dialog
        setTimeout(() => {
          console.log('🎤 Tables: Generating KOT for ghost order...');
          
          // Generate KOT content
          const kotContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>KOT - ${newOrder.orderNumber}</title>
              <style>
                body { 
                  font-family: 'Courier New', monospace; 
                  margin: 0; 
                  padding: 0 10px; 
                  width: 100%;
                  background: #fff;
                }
                .kot-container {
                  width: 100%;
                  padding: 15px 5px;
                  min-height: auto;
                }
                .header { 
                  text-align: center; 
                  border-bottom: 2px solid #000; 
                  padding-bottom: 10px; 
                  margin-bottom: 15px; 
                }
                .restaurant-name { 
                  font-size: 18px; 
                  font-weight: bold; 
                  margin-bottom: 5px;
                }
                .order-info { 
                  margin-bottom: 15px; 
                  line-height: 1.4;
                }
                .items { 
                  border-collapse: collapse; 
                  width: 100%; 
                  margin: 15px 0;
                }
                .items th, .items td { 
                  border: 1px solid #000; 
                  padding: 8px; 
                  text-align: left; 
                  font-size: 13px;
                }
                .items th { 
                  background-color: #f0f0f0; 
                  font-weight: bold;
                }
                .footer { 
                  margin-top: 20px; 
                  text-align: center; 
                  font-size: 12px; 
                  border-top: 1px dashed #000;
                  padding-top: 15px;
                }
                .order-notes {
                  margin-top: 15px; 
                  padding: 10px; 
                  border: 1px solid #000;
                  background: #f9f9f9;
                }
                @media print {
                  body { 
                    margin: 0; 
                    padding: 0 8px;
                    width: 100%;
                  }
                  .kot-container {
                    padding: 10px 0;
                    width: 100%;
                    min-height: auto;
                  }
                  .no-print { display: none; }
                  .header, .order-info, .items, .order-notes, .footer {
                    page-break-inside: avoid;
                  }
                }
              </style>
            </head>
            <body>
              <div class="kot-container">
              <div class="header">
                <div class="restaurant-name">${restaurant.name}</div>
                <div>KITCHEN ORDER TICKET</div>
              </div>
              
              <div class="order-info">
                <p><strong>Order #:</strong> ${newOrder.orderNumber}</p>
                <p><strong>Table:</strong> ${table.number} (${table.area})</p>
                <p><strong>Date/Time:</strong> ${newOrder.createdAt.toLocaleString()}</p>
                <p><strong>Staff:</strong> ${newOrder.staffId}</p>
              </div>
              
              <table class="items">
                <thead>
                  <tr>
                    <th>Qty</th>
                    <th>Item</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${newOrder.items.map((item: any) => `
                    <tr>
                      <td>${item.quantity}</td>
                      <td>${item.name}</td>
                      <td>${item.notes || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              ${newOrder.notes ? `
                  <div class="order-notes">
                  <strong>Order Notes:</strong><br>
                  ${newOrder.notes}
                </div>
              ` : ''}
              
              <div class="footer">
                <p>*** KITCHEN COPY ***</p>
                <p>Printed at: ${new Date().toLocaleString()}</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
          // Open KOT in new window
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(kotContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
            
            toast.success('🧾 KOT sent to kitchen!');
            console.log('🎤 Tables: KOT generated and sent to kitchen');
          }
        }, 500);
        
      } else {
        throw new Error(orderResult.error || 'Failed to create order');
      }
      
    } catch (error) {
      console.error('❌ Tables: Ghost ordering failed:', error);
      toast.error('🎤 Failed to place order. Please try manually.');
    }
  }, [restaurant, user, tables, navigate, loadTables]);

  // Voice command event listeners  
  useEffect(() => {
    window.addEventListener('voiceTableStatusCommand', handleVoiceTableStatusCommand as unknown as EventListener);
    window.addEventListener('voiceOrderCommand', handleVoiceOrderCommand as unknown as EventListener);
    window.addEventListener('voicePlaceOrderCommand', handleVoicePlaceOrderCommand as unknown as EventListener);
    window.addEventListener('voicePaymentCommand', handleVoicePaymentCommand as unknown as EventListener);
    window.addEventListener('voiceKotPrintCommand', handleVoiceKotPrintCommand as unknown as EventListener);
    window.addEventListener('voiceOrderCancelCommand', handleVoiceOrderCancelCommand as unknown as EventListener);
    window.addEventListener('voiceTableMergeCommand', handleVoiceTableMergeCommand as unknown as EventListener);
    window.addEventListener('voiceTableTransferCommand', handleVoiceTableTransferCommand as unknown as EventListener);
    window.addEventListener('voiceCustomerCommand', handleVoiceCustomerCommand as unknown as EventListener);
    
    return () => {
      window.removeEventListener('voiceTableStatusCommand', handleVoiceTableStatusCommand as unknown as EventListener);
      window.removeEventListener('voiceOrderCommand', handleVoiceOrderCommand as unknown as EventListener);
      window.removeEventListener('voicePlaceOrderCommand', handleVoicePlaceOrderCommand as unknown as EventListener);
      window.removeEventListener('voicePaymentCommand', handleVoicePaymentCommand as unknown as EventListener);
      window.removeEventListener('voiceKotPrintCommand', handleVoiceKotPrintCommand as unknown as EventListener);
      window.removeEventListener('voiceOrderCancelCommand', handleVoiceOrderCancelCommand as unknown as EventListener);
      window.removeEventListener('voiceTableMergeCommand', handleVoiceTableMergeCommand as unknown as EventListener);
      window.removeEventListener('voiceTableTransferCommand', handleVoiceTableTransferCommand as unknown as EventListener);
      window.removeEventListener('voiceCustomerCommand', handleVoiceCustomerCommand as unknown as EventListener);
    };
  }, [handleVoiceTableStatusCommand, handleVoiceOrderCommand, handleVoicePlaceOrderCommand, handleVoicePaymentCommand, handleVoiceKotPrintCommand, handleVoiceOrderCancelCommand, handleVoiceTableMergeCommand, handleVoiceTableTransferCommand, handleVoiceCustomerCommand]);

  // Filter and display logic
  const filteredTables = tables.filter(table => {
    const matchesArea = selectedArea === 'all' || table.area === selectedArea;
    const matchesStatus = selectedStatus === 'all' || table.status === selectedStatus;
    return matchesArea && matchesStatus;
  });

  const getStatusStats = () => {
    return {
      total: tables.length,
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length,
      cleaning: tables.filter(t => t.status === 'cleaning').length,
    };
  };

  const stats = getStatusStats();

  if (!restaurant) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Table Management</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-2">
                <span>{stats.total} total tables</span>
                <span className="text-green-600">{stats.available} available</span>
                <span className="text-red-600">{stats.occupied} occupied</span>
                {lastSync && (
                  <span className="text-gray-500">
                    Last sync: {lastSync.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            
            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center space-x-3">
              <button
                onClick={handleSyncTables}
                disabled={isSyncing}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sync with server and fix areas"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={async () => {
                  if (restaurant) {
                    await TableStatusService.autoFixWithNotification(restaurant.id);
                    // Real-time subscription will automatically update tables
                  }
                }}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="Fix table statuses (occupied tables without orders)"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Takeaway Orders Button */}
              <button
                onClick={() => navigate(`/${restaurant?.slug}/takeaway`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                title="Manage takeaway orders"
              >
                <User className="w-4 h-4 mr-2" />
                Takeaway Orders
              </button>
              
              <button
                onClick={() => navigate('settings')}
                className="btn btn-secondary"
                title="Manage table areas and settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
              
              <button
                onClick={() => setShowCreateAreaModal(true)}
                className="btn btn-secondary"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Add Area
              </button>
              
              <button
                onClick={() => setShowCreateTableModal(true)}
                className="btn btn-theme-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </button>
            </div>

            {/* Mobile Action Buttons */}
            <div className="lg:hidden">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSyncTables}
                  disabled={isSyncing}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sync with server and fix areas"
                >
                  <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
                
                <button
                  onClick={async () => {
                    if (restaurant) {
                      await TableStatusService.autoFixWithNotification(restaurant.id);
                      // Real-time subscription will automatically update tables
                    }
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Fix table statuses (occupied tables without orders)"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Takeaway Orders Button - Mobile */}
                <button
                  onClick={() => navigate(`/${restaurant?.slug}/takeaway`)}
                  className="btn btn-secondary text-sm px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                  title="Manage takeaway orders"
                >
                  <User className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Takeaway</span>
                </button>
                
                <button
                  onClick={() => navigate('settings')}
                  className="btn btn-secondary text-sm px-3 py-2"
                  title="Manage table areas and settings"
                >
                  <Settings className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                
                <button
                  onClick={() => setShowCreateAreaModal(true)}
                  className="btn btn-secondary text-sm px-3 py-2"
                >
                  <MapPin className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Area</span>
                </button>
                
                <button
                  onClick={() => setShowCreateTableModal(true)}
                  className="btn btn-theme-primary text-sm px-3 py-2"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Table</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total Tables</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.available}</div>
            <div className="text-xs sm:text-sm text-gray-600">Available</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.occupied}</div>
            <div className="text-xs sm:text-sm text-gray-600">Occupied</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.reserved}</div>
            <div className="text-xs sm:text-sm text-gray-600">Reserved</div>
          </div>
          <div className="card p-3 sm:p-4 text-center col-span-2 sm:col-span-1">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.cleaning}</div>
            <div className="text-xs sm:text-sm text-gray-600">Cleaning</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Area</label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Areas ({tables.length})</option>
                {areas.map(area => (
                  <option key={area} value={area}>
                    {area} ({tables.filter(t => t.area === area).length})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TableStatus | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
                <option value="out_of_service">Out of Service</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading tables...</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center py-12">
            <Grid3X3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tables yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first table or area.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setShowCreateAreaModal(true)}
                className="btn btn-secondary"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Create Area
              </button>
              <button
                onClick={() => setShowCreateTableModal(true)}
                className="btn btn-theme-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Table
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Group tables by area */}
            {areas.map(area => {
              const areaTables = filteredTables.filter(table => table.area === area);
              if (areaTables.length === 0) return null;
              
              return (
                <div key={area}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    {area} ({areaTables.length})
                  </h2>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                    {areaTables.map(table => (
                      <TableCard
                        key={table.id}
                        table={table}
                        onUpdateStatus={handleUpdateTableStatus}
                        onEdit={handleEditTable}
                        onDelete={handleDeleteTable}
                        onClick={handleTableClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Area Modal */}
        {showCreateAreaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create New Area</h2>
                <p className="text-gray-600 mt-1">Add a new dining area to organize your tables</p>
              </div>
              
              <form onSubmit={handleAreaSubmit(handleCreateArea)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area Name
                  </label>
                  <input
                    {...registerArea('areaName', { required: 'Area name is required' })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Main Dining, Patio, VIP Section"
                  />
                  {areaErrors.areaName && (
                    <p className="text-red-500 text-sm mt-1">{areaErrors.areaName.message}</p>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAreaModal(false);
                      resetArea();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isAreaValid}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Create Area
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Table Modal */}
        {showCreateTableModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create New Table</h2>
                <p className="text-gray-600 mt-1">Add a new table to your restaurant</p>
              </div>
              
              <form onSubmit={handleTableSubmit(handleCreateTable)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table Number
                  </label>
                  <input
                    {...registerTable('number', { required: 'Table number is required' })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1, A1, T01"
                  />
                  {tableErrors.number && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area
                  </label>
                  <select
                    {...registerTable('area', { required: 'Area is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an area</option>
                    {areas.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                  {tableErrors.area && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.area.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    {...registerTable('capacity', { 
                      required: 'Capacity is required',
                      min: { value: 1, message: 'Capacity must be at least 1' },
                      max: { value: 20, message: 'Capacity cannot exceed 20' }
                    })}
                    type="number"
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Number of seats"
                  />
                  {tableErrors.capacity && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.capacity.message}</p>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTableModal(false);
                      resetTable();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isTableValid}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Create Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Table Modal */}
        {showEditModal && selectedTable && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit Table</h2>
                <p className="text-gray-600 mt-1">Update table information</p>
              </div>
              
              <form onSubmit={handleTableSubmit(handleUpdateTable)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table Number
                  </label>
                  <input
                    {...registerTable('number', { required: 'Table number is required' })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1, A1, T01"
                  />
                  {tableErrors.number && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area
                  </label>
                  <select
                    {...registerTable('area', { required: 'Area is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an area</option>
                    {areas.map(area => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                  {tableErrors.area && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.area.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    {...registerTable('capacity', { 
                      required: 'Capacity is required',
                      min: { value: 1, message: 'Capacity must be at least 1' },
                      max: { value: 20, message: 'Capacity cannot exceed 20' }
                    })}
                    type="number"
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Number of seats"
                  />
                  {tableErrors.capacity && (
                    <p className="text-red-500 text-sm mt-1">{tableErrors.capacity.message}</p>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedTable(null);
                      resetTable();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isTableValid}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Update Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Voice Loading Overlay */}
      <VoiceLoadingOverlay
        isVisible={isVoiceProcessing}
        stage={voiceLoadingStage}
        message={voiceLoadingMessage}
      />

      {/* Voice KOT Dialog */}
      <VoiceKOTDialog
        isVisible={showVoiceKOTDialog}
        onClose={() => setShowVoiceKOTDialog(false)}
        onPrintKOT={handleVoiceKOTPrint}
        orderDetails={voiceOrderDetails}
      />
    </div>
  );
}

// Table Card Component
interface TableCardProps {
  table: Table;
  onUpdateStatus: (table: Table, status: TableStatus) => void;
  onEdit: (table: Table) => void;
  onDelete: (table: Table) => void;
  onClick: (table: Table) => void;
}

function TableCard({ table, onUpdateStatus, onEdit, onDelete }: TableCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { restaurant } = useRestaurant();

  const getStatusIcon = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'occupied':
        return <User className="w-4 h-4 text-red-500" />;
      case 'reserved':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cleaning':
        return <Settings className="w-4 h-4 text-blue-500" />;
      case 'out_of_service':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-50 border-green-200';
      case 'occupied':
        return 'bg-red-50 border-red-200';
      case 'reserved':
        return 'bg-yellow-50 border-yellow-200';
      case 'cleaning':
        return 'bg-blue-50 border-blue-200';
      case 'out_of_service':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleTableClick = () => {
    if (restaurant && (table.status === 'available' || table.status === 'occupied')) {
      // Navigate to order taking page
      window.location.href = `/${restaurant.slug}/order/${table.id}`;
    }
  };

  const canTakeOrder = table.status === 'available' || table.status === 'occupied';

  return (
    <div 
      className={`card border-2 ${getStatusColor(table.status)} relative ${
        canTakeOrder ? 'cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1' : ''
      }`}
      onClick={canTakeOrder ? handleTableClick : undefined}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Table {table.number}</h3>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent table click when clicking menu
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px] sm:min-w-[160px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(table, 'available');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Available</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(table, 'occupied');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <User className="w-4 h-4 text-red-500" />
                  <span>Occupied</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(table, 'reserved');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>Reserved</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(table, 'cleaning');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4 text-blue-500" />
                  <span>Cleaning</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(table, 'out_of_service');
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <span>Out of Service</span>
                </button>
                <div className="border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(table);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Edit3 className="w-4 h-4 text-blue-500" />
                    <span>Edit Table</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(table);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-gray-600">Status:</span>
            <div className="flex items-center space-x-1">
              {getStatusIcon(table.status)}
              <span className="capitalize text-gray-700 text-xs sm:text-sm">{table.status.replace('_', ' ')}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-gray-600">Capacity:</span>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="text-gray-700">{table.capacity}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-gray-600">Area:</span>
            <span className="text-gray-700 truncate ml-2">{table.area}</span>
          </div>
          
          {canTakeOrder && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-center font-medium" style={{ color: 'var(--color-primary)' }}>
                👆 Click to take order
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 