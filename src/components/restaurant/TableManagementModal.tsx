import { useState, useEffect } from 'react';
import { ArrowRightLeft, GitMerge, X, AlertCircle } from 'lucide-react';
import { Table, Order } from '@/types';
import { TableService } from '@/services/tableService';
import { OrderService } from '@/services/orderService';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTable: Table;
  restaurantId: string;
  currentOrders: Order[];
  onOperationComplete: () => void;
}

export default function TableManagementModal({
  isOpen,
  onClose,
  currentTable,
  restaurantId,
  currentOrders,
  onOperationComplete,
}: TableManagementModalProps) {
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [operation, setOperation] = useState<'transfer' | 'merge'>('transfer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingTables, setLoadingTables] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadAvailableTables();
    }
  }, [isOpen, restaurantId]);

  const loadAvailableTables = async () => {
    setLoadingTables(true);
    try {
      const result = await TableService.getTablesForRestaurant(restaurantId);
      if (result.success && result.data) {
        // Filter out current table and get tables based on operation
        const filteredTables = result.data.filter(table => {
          if (table.id === currentTable.id) return false;
          
          if (operation === 'transfer') {
            // For transfer, only show available tables
            return table.status === 'available';
          } else {
            // For merge, show available and occupied tables
            return table.status === 'available' || table.status === 'occupied';
          }
        });
        
        setAvailableTables(filteredTables);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
      toast.error('Failed to load available tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleOperationChange = (newOperation: 'transfer' | 'merge') => {
    setOperation(newOperation);
    setSelectedTables([]);
    loadAvailableTables();
  };

  const handleTableSelect = (tableId: string) => {
    if (operation === 'transfer') {
      // For transfer, only allow one table selection
      setSelectedTables([tableId]);
    } else {
      // For merge, allow multiple table selection
      setSelectedTables(prev => {
        if (prev.includes(tableId)) {
          return prev.filter(id => id !== tableId);
        } else {
          return [...prev, tableId];
        }
      });
    }
  };

  const handleTransfer = async () => {
    if (selectedTables.length !== 1) {
      toast.error('Please select one table to transfer to');
      return;
    }

    setIsProcessing(true);
    try {
      // Transfer orders
      const transferResult = await OrderService.transferOrders(
        currentTable.id,
        selectedTables[0],
        restaurantId
      );

      if (!transferResult.success) {
        throw new Error(transferResult.error || 'Failed to transfer orders');
      }

      // Update table statuses
      const tableResult = await TableService.transferTable(
        currentTable.id,
        selectedTables[0],
        restaurantId
      );

      if (!tableResult.success) {
        throw new Error(tableResult.error || 'Failed to update table status');
      }

      const targetTable = availableTables.find(t => t.id === selectedTables[0]);
      toast.success(`Orders transferred to Table ${targetTable?.number}`);
      onOperationComplete();
      onClose();
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(error instanceof Error ? error.message : 'Transfer failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMerge = async () => {
    if (selectedTables.length === 0) {
      toast.error('Please select at least one table to merge');
      return;
    }

    setIsProcessing(true);
    try {
      const allTableIds = [currentTable.id, ...selectedTables];
      
      // Merge tables
      const mergeResult = await TableService.mergeTables(allTableIds, restaurantId);
      
      if (!mergeResult.success) {
        throw new Error(mergeResult.error || 'Failed to merge tables');
      }

      // Update order notes to indicate merged tables
      const tableNumbers = [
        currentTable.number,
        ...selectedTables.map(id => {
          const table = availableTables.find(t => t.id === id);
          return table?.number || 'Unknown';
        })
      ];

      for (const order of currentOrders) {
        await OrderService.updateOrderForMerge(order.id, restaurantId, tableNumbers);
      }

      toast.success(`Tables ${tableNumbers.join(', ')} merged successfully`);
      onOperationComplete();
      onClose();
    } catch (error) {
      console.error('Merge failed:', error);
      toast.error(error instanceof Error ? error.message : 'Merge failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTotalAmount = () => {
    return currentOrders.reduce((total, order) => total + order.total, 0);
  };

  const getSelectedTablesInfo = () => {
    return selectedTables.map(id => {
      const table = availableTables.find(t => t.id === id);
      return table ? `Table ${table.number}` : 'Unknown';
    }).join(', ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Table Management</h3>
                <p className="text-sm text-gray-600">
                  Current Table: {currentTable.number} | {currentOrders.length} orders | {formatCurrency(getTotalAmount())}
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4">
            {/* Operation Selection */}
            <div className="mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => handleOperationChange('transfer')}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    operation === 'transfer'
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Table
                </button>
                
                <button
                  onClick={() => handleOperationChange('merge')}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    operation === 'merge'
                      ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <GitMerge className="w-4 h-4 mr-2" />
                  Merge Tables
                </button>
              </div>
              
              <div className="mt-2">
                {operation === 'transfer' && (
                  <p className="text-sm text-gray-600">
                    Move all orders from this table to another available table
                  </p>
                )}
                {operation === 'merge' && (
                  <p className="text-sm text-gray-600">
                    Combine orders from multiple tables into one bill
                  </p>
                )}
              </div>
            </div>

            {/* Table Selection */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                {operation === 'transfer' ? 'Select Target Table' : 'Select Tables to Merge'}
              </h4>
              
              {loadingTables ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600 mt-2">Loading tables...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                  {availableTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table.id)}
                      className={`p-3 border-2 rounded-lg text-center transition-colors ${
                        selectedTables.includes(table.id)
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">Table {table.number}</div>
                      <div className="text-xs text-gray-500">{table.area}</div>
                      <div className={`text-xs mt-1 px-2 py-1 rounded-full ${
                        table.status === 'available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {table.status}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {availableTables.length === 0 && !loadingTables && (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    {operation === 'transfer' 
                      ? 'No available tables for transfer' 
                      : 'No tables available for merging'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedTables.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Operation Summary</h4>
                {operation === 'transfer' && (
                  <p className="text-sm text-gray-600">
                    Transfer {currentOrders.length} orders from Table {currentTable.number} to {getSelectedTablesInfo()}
                  </p>
                )}
                {operation === 'merge' && (
                  <p className="text-sm text-gray-600">
                    Merge Table {currentTable.number} with {getSelectedTablesInfo()}
                  </p>
                )}
                <p className="text-sm font-medium text-gray-900 mt-1">
                  Total Amount: {formatCurrency(getTotalAmount())}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              
              <button
                onClick={operation === 'transfer' ? handleTransfer : handleMerge}
                disabled={selectedTables.length === 0 || isProcessing}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  selectedTables.length === 0 || isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : operation === 'transfer'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    {operation === 'transfer' ? (
                      <>
                        <ArrowRightLeft className="w-4 h-4 mr-1" />
                        Transfer
                      </>
                    ) : (
                      <>
                        <GitMerge className="w-4 h-4 mr-1" />
                        Merge
                      </>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 