// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { X, Save, Package, Clock, TrendingUp, TrendingDown, RotateCcw, AlertTriangle } from 'lucide-react';
import { InventoryItem, MenuItem, InventoryTransaction, InventoryUnit } from '@/types';
import { formatCurrency } from '@/lib/utils';

// Inventory Create/Edit Dialog
interface InventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  inventory: InventoryItem | null;
  menuItems: MenuItem[];
  existingInventory: InventoryItem[];
  register: any;
  handleSubmit: any;
  selectedUnit: InventoryUnit;
  isSubmitting: boolean;
}

export function InventoryDialog({
  isOpen,
  onClose,
  onSave,
  inventory,
  menuItems,
  existingInventory,
  register,
  handleSubmit,
  selectedUnit,
  isSubmitting,
}: InventoryDialogProps) {
  if (!isOpen) return null;

  const availableMenuItems = inventory 
    ? menuItems.filter(item => item.id === inventory.menuItemId || !existingInventory.some(inv => inv.menuItemId === item.id))
    : menuItems.filter(item => !existingInventory.some(inv => inv.menuItemId === item.id));

  const unitOptions = [
    { value: 'pieces', label: 'Pieces' },
    { value: 'ml', label: 'Milliliters (ml)' },
    { value: 'liters', label: 'Liters' },
    { value: 'grams', label: 'Grams (g)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'cups', label: 'Cups' },
    { value: 'portions', label: 'Portions' },
    { value: 'bottles', label: 'Bottles' },
    { value: 'cans', label: 'Cans' },
    { value: 'custom', label: 'Custom Unit' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {inventory ? 'Edit Inventory' : 'Add Inventory'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-6">
          {/* Menu Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Menu Item *
            </label>
            <select
              {...register('menuItemId', { required: 'Menu item is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!!inventory}
            >
              {availableMenuItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatCurrency(item.price)}
                </option>
              ))}
            </select>
            {availableMenuItems.length === 0 && (
              <p className="text-sm text-yellow-600 mt-1">
                All menu items already have inventory setup
              </p>
            )}
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Quantity *
              </label>
              <input
                {...register('currentQuantity', { 
                  required: 'Quantity is required',
                  min: { value: 0, message: 'Quantity cannot be negative' }
                })}
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit *
              </label>
              <select
                {...register('unit', { required: 'Unit is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {unitOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Unit */}
          {selectedUnit === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Unit Name *
              </label>
              <input
                {...register('customUnit', { 
                  required: selectedUnit === 'custom' ? 'Custom unit name is required' : false
                })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., servings, batches, etc."
              />
            </div>
          )}

          {/* Thresholds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Threshold *
              </label>
              <input
                {...register('minimumThreshold', { 
                  required: 'Minimum threshold is required',
                  min: { value: 0, message: 'Threshold cannot be negative' }
                })}
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Alert when below this level"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumption Per Order *
              </label>
              <input
                {...register('consumptionPerOrder', { 
                  required: 'Consumption per order is required',
                  min: { value: 0, message: 'Consumption cannot be negative' }
                })}
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="How much is used per order"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Capacity
              </label>
              <input
                {...register('maxCapacity')}
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Storage capacity (optional)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Per Unit
              </label>
              <input
                {...register('costPerUnit')}
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cost price per unit"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier
            </label>
            <input
              {...register('supplier')}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Supplier name (optional)"
            />
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('isTracked')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Track inventory</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                {...register('autoDeduct')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto-deduct on orders</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableMenuItems.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2 inline" />
                  {inventory ? 'Update Inventory' : 'Create Inventory'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Adjustment Dialog
interface AdjustmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  inventory: InventoryItem;
  menuItemName: string;
  register: any;
  handleSubmit: any;
  isSubmitting: boolean;
}

export function AdjustmentDialog({
  isOpen,
  onClose,
  onSave,
  inventory,
  menuItemName,
  register,
  handleSubmit,
  isSubmitting,
}: AdjustmentDialogProps) {
  if (!isOpen) return null;

  const getUnitDisplay = (unit: InventoryUnit, customUnit?: string): string => {
    return unit === 'custom' && customUnit ? customUnit : unit;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Adjust Inventory</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">{menuItemName}</h3>
            <p className="text-sm text-gray-600">
              Current Stock: {inventory.currentQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Quantity *
              </label>
              <input
                {...register('newQuantity', { 
                  required: 'New quantity is required',
                  min: { value: 0, message: 'Quantity cannot be negative' }
                })}
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Enter quantity in ${getUnitDisplay(inventory.unit, inventory.customUnit)}`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adjustment Type *
              </label>
              <select
                {...register('type', { required: 'Type is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="restock">🔄 Restock</option>
                <option value="manual_adjustment">⚙️ Manual Adjustment</option>
                <option value="waste">🗑️ Waste/Loss</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <input
                {...register('reason')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief reason for adjustment"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes (optional)"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Adjusting...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2 inline" />
                    Adjust Inventory
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// History Dialog
interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem;
  menuItemName: string;
  transactions: InventoryTransaction[];
}

export function HistoryDialog({
  isOpen,
  onClose,
  inventory,
  menuItemName,
  transactions,
}: HistoryDialogProps) {
  if (!isOpen) return null;

  const getUnitDisplay = (unit: InventoryUnit, customUnit?: string): string => {
    return unit === 'custom' && customUnit ? customUnit : unit;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'restock':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'order_deduction':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'manual_adjustment':
        return <RotateCcw className="w-4 h-4 text-blue-600" />;
      case 'waste':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'restock':
        return 'Restock';
      case 'order_deduction':
        return 'Order Deduction';
      case 'manual_adjustment':
        return 'Manual Adjustment';
      case 'waste':
        return 'Waste/Loss';
      case 'return':
        return 'Return';
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Inventory History</h2>
              <p className="text-gray-600">{menuItemName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Current Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Current Stock:</span>
                <p className="font-medium">
                  {inventory.currentQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Minimum Threshold:</span>
                <p className="font-medium">
                  {inventory.minimumThreshold} {getUnitDisplay(inventory.unit, inventory.customUnit)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Transaction History</h3>
            
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No transaction history available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="font-medium text-gray-900">
                          {getTransactionLabel(transaction.type)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()} {new Date(transaction.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Change:</span>
                        <p className={`font-medium ${transaction.quantityChanged >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.quantityChanged >= 0 ? '+' : ''}{transaction.quantityChanged} {getUnitDisplay(inventory.unit, inventory.customUnit)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Previous:</span>
                        <p className="font-medium">{transaction.previousQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">New:</span>
                        <p className="font-medium">{transaction.newQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)}</p>
                      </div>
                    </div>
                    
                    {transaction.reason && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Reason:</span>
                        <p className="text-sm">{transaction.reason}</p>
                      </div>
                    )}
                    
                    {transaction.notes && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Notes:</span>
                        <p className="text-sm">{transaction.notes}</p>
                      </div>
                    )}
                    
                    {transaction.orderId && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Order ID:</span>
                        <p className="text-sm font-mono">{transaction.orderId}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 