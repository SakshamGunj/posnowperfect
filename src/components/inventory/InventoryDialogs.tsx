// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Package, Clock, TrendingUp, TrendingDown, RotateCcw, AlertTriangle, Search, Link, Plus, ToggleLeft, ToggleRight, Trash2, Edit, History, Minus, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { InventoryItem, MenuItem, InventoryTransaction, InventoryUnit, InventoryLinkedItem } from '@/types';
import { formatCurrency, generateId } from '@/lib/utils';
import { InventoryService } from '@/services/inventoryService';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import toast from 'react-hot-toast';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';

// Menu Item Search Component
interface MenuItemSearchProps {
  menuItems: MenuItem[];
  onSelect: (menuItem: MenuItem | null) => void;
  onCreateStandalone?: (itemName: string) => void;
  disabled?: boolean;
  initialValue?: MenuItem | null;
  placeholder?: string;
  allowStandaloneCreation?: boolean;
}

function MenuItemSearch({ 
  menuItems, 
  onSelect, 
  onCreateStandalone,
  disabled, 
  initialValue, 
  placeholder,
  allowStandaloneCreation = false 
}: MenuItemSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(initialValue || null);
  const [standaloneItemName, setStandaloneItemName] = useState<string>('');

  useEffect(() => {
    if (initialValue) {
      setSelectedMenuItem(initialValue);
    }
  }, [initialValue]);

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.price.toString().includes(searchTerm)
  );

  const hasExactMatch = filteredItems.some(item => 
    item.name.toLowerCase() === searchTerm.toLowerCase()
  );

  const handleSelect = (item: MenuItem) => {
    setSelectedMenuItem(item);
    onSelect(item);
    setSearchTerm('');
    setIsOpen(false);
    setStandaloneItemName('');
  };

  const handleClear = () => {
    setSelectedMenuItem(null);
    onSelect(null);
    setSearchTerm('');
    setIsOpen(true);
    setStandaloneItemName('');
  };

  const handleCreateStandalone = () => {
    if (searchTerm.trim() && onCreateStandalone) {
      setStandaloneItemName(searchTerm.trim());
      onCreateStandalone(searchTerm.trim());
      setSelectedMenuItem(null);
      setIsOpen(false);
    }
  };

  const showCreateOption = allowStandaloneCreation && 
                          searchTerm.trim().length > 0 && 
                          !hasExactMatch && 
                          filteredItems.length === 0;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={selectedMenuItem ? `${selectedMenuItem.name} - ${formatCurrency(selectedMenuItem.price)}` : standaloneItemName || searchTerm}
          onChange={(e) => {
            if (!selectedMenuItem && !standaloneItemName) {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }
          }}
          onFocus={() => !selectedMenuItem && !standaloneItemName && setIsOpen(true)}
          placeholder={placeholder || "Search menu items..."}
          disabled={disabled}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          readOnly={!!selectedMenuItem || !!standaloneItemName}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {selectedMenuItem || standaloneItemName ? (
            <button
              type="button"
              onClick={() => {
                handleClear();
                setStandaloneItemName('');
              }}
              disabled={disabled}
              className="text-gray-400 hover:text-gray-600 disabled:hover:text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Show standalone item indicator */}
      {standaloneItemName && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-sm text-blue-700">
            <Package className="w-4 h-4 mr-2" />
            <span>Creating standalone inventory item: <strong>{standaloneItemName}</strong></span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            This item won't be linked to your menu items - it's for inventory tracking only.
          </p>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && !selectedMenuItem && !standaloneItemName && (
        <>
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center justify-between border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-gray-600 font-semibold">{formatCurrency(item.price)}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4">
                {searchTerm ? (
                  <div className="space-y-3">
                    <div className="text-center text-gray-500 text-sm">
                      No menu items found matching "{searchTerm}"
                    </div>
                    {showCreateOption && (
                      <button
                        type="button"
                        onClick={handleCreateStandalone}
                        className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center justify-center text-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          <span className="font-medium">Create inventory item: "{searchTerm}"</span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Create standalone inventory (not linked to menu)
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm text-center">
                    Start typing to search menu items...
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-0"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
}

// Link Item Modal Component
interface LinkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkedItems: InventoryLinkedItem[]) => void;
  currentInventory: InventoryItem;
  currentMenuItem: MenuItem;
  menuItems: MenuItem[];
  existingInventory: InventoryItem[];
  onCreateNewInventory: (menuItem: MenuItem, quantity: number, unit: InventoryUnit, customUnit?: string) => void;
}

function LinkItemModal({ 
  isOpen, 
  onClose, 
  onSave, 
  currentInventory, 
  currentMenuItem,
  menuItems, 
  existingInventory,
  onCreateNewInventory 
}: LinkItemModalProps) {
  const [linkedItems, setLinkedItems] = useState<InventoryLinkedItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [linkRatio, setLinkRatio] = useState<number>(1);
  const [reverseRatio, setReverseRatio] = useState<number>(1);
  const [enableReverseLink, setEnableReverseLink] = useState(false);
  const [newItemQuantity, setNewItemQuantity] = useState<number>(0);
  const [newItemUnit, setNewItemUnit] = useState<InventoryUnit>('pieces');
  const [newItemCustomUnit, setNewItemCustomUnit] = useState<string>('');

  useEffect(() => {
    console.log('🔗 LinkItemModal useEffect triggered:', {
      isOpen,
      currentInventoryLinkedItems: currentInventory.linkedItems,
      currentInventoryLinkedItemsLength: currentInventory.linkedItems?.length || 0,
      currentLinkedItemsLength: linkedItems.length
    });
    
    // Only reset linkedItems if modal is opening and we don't already have items
    // OR if the currentInventory has actual linked items (not empty temp object)
    if (isOpen && linkedItems.length === 0 && currentInventory.linkedItems && currentInventory.linkedItems.length > 0) {
      console.log('🔗 Setting linkedItems from currentInventory:', currentInventory.linkedItems);
      setLinkedItems([...currentInventory.linkedItems]);
    } else if (isOpen && linkedItems.length === 0 && (!currentInventory.linkedItems || currentInventory.linkedItems.length === 0)) {
      console.log('🔗 Setting empty linkedItems array for first time');
      setLinkedItems([]);
    }
    // Don't reset if we already have linkedItems - preserve them
  }, [isOpen, currentInventory.linkedItems]);

  const availableMenuItems = menuItems.filter(item => 
    item.id !== currentInventory.menuItemId && 
    !linkedItems.some(linked => linked.linkedMenuItemId === item.id)
  );

  const inventoryExistsForItem = (menuItemId: string) => {
    return existingInventory.some(inv => inv.menuItemId === menuItemId);
  };

  const handleAddLinkedItem = () => {
    if (!selectedMenuItem) {
      console.log('No menu item selected');
      return;
    }

    // Check if inventory exists for this menu item
    const existingInventoryForItem = existingInventory.find(inv => inv.menuItemId === selectedMenuItem.id);
    
    // Validate for new inventory creation
    if (!existingInventoryForItem && newItemQuantity <= 0) {
      console.log('Validation failed: newItemQuantity:', newItemQuantity);
      alert('Please specify initial stock quantity greater than 0 for this new item');
      return;
    }

    // Validate consumption ratio
    if (linkRatio <= 0) {
      alert('Consumption ratio must be greater than 0');
      return;
    }

    // Validate reverse ratio if enabled
    if (enableReverseLink && reverseRatio <= 0) {
      alert('Reverse ratio must be greater than 0');
      return;
    }

    const linkedItem: InventoryLinkedItem = {
      id: generateId(),
      linkedInventoryId: '', // Will be set when inventory exists or is created
      linkedMenuItemId: selectedMenuItem.id,
      linkedMenuItemName: selectedMenuItem.name,
      ratio: linkRatio,
      reverseRatio: reverseRatio,
      enableReverseLink: enableReverseLink,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingInventoryForItem) {
      // Use existing inventory
      linkedItem.linkedInventoryId = existingInventoryForItem.id;
      const newLinkedItems = [...linkedItems, linkedItem];
      console.log('🔗 Setting new linkedItems with existing inventory:', newLinkedItems);
      setLinkedItems(newLinkedItems);
      console.log('Added linked item with existing inventory:', linkedItem);
    } else {
      // Create new inventory
      linkedItem.linkedInventoryId = 'new_' + selectedMenuItem.id; // Temporary ID
      const newLinkedItems = [...linkedItems, linkedItem];
      console.log('🔗 Setting new linkedItems with new inventory:', newLinkedItems);
      setLinkedItems(newLinkedItems);
      
      // Create new inventory for this item
      onCreateNewInventory(selectedMenuItem, newItemQuantity, newItemUnit, newItemCustomUnit);
      console.log('Added linked item with new inventory:', linkedItem);
    }

    // Reset form
    setSelectedMenuItem(null);
    setLinkRatio(1);
    setReverseRatio(1);
    setEnableReverseLink(false);
    setNewItemQuantity(0);
    setNewItemUnit('pieces');
    setNewItemCustomUnit('');
    setShowAddForm(false);
  };

  const handleRemoveLinkedItem = (itemId: string) => {
    setLinkedItems(linkedItems.filter(item => item.id !== itemId));
  };

  const handleUpdateLinkedItem = (itemId: string, field: keyof InventoryLinkedItem, value: any) => {
    setLinkedItems(linkedItems.map(item => 
      item.id === itemId ? { ...item, [field]: value, updatedAt: new Date() } : item
    ));
  };

  const handleSave = () => {
    onSave(linkedItems);
    onClose();
  };

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Link className="w-5 h-5 mr-2 text-blue-600" />
                Link Inventory Items
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Link items that share the same base inventory: <strong>{currentMenuItem.name}</strong>
              </p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Explanation Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">How Inventory Linking Works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Link items that use the same base ingredient (e.g., 30ml and 60ml drinks from same bottle)</li>
              <li>• Set consumption ratios: when 1x 60ml is ordered, it consumes 2x worth of 30ml equivalent</li>
              <li>• Enable reverse linking to sync both ways</li>
              <li>• Add new items directly from this interface</li>
            </ul>
          </div>

          {/* Current Linked Items */}
          {linkedItems.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Linked Items ({linkedItems.length})</h3>
              <div className="space-y-3">
                {linkedItems.map((linkedItem) => (
                  <div key={linkedItem.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{linkedItem.linkedMenuItemName}</h4>
                            <p className="text-sm text-gray-600">
                              Ratio: 1x {currentMenuItem.name} = {linkedItem.ratio}x {linkedItem.linkedMenuItemName}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {/* Ratio Input */}
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Ratio:</label>
                          <input
                            type="number"
                            value={linkedItem.ratio}
                            onChange={(e) => handleUpdateLinkedItem(linkedItem.id, 'ratio', parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0.1"
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        {/* Reverse Link Toggle */}
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Reverse:</label>
                          <button
                            onClick={() => handleUpdateLinkedItem(linkedItem.id, 'enableReverseLink', !linkedItem.enableReverseLink)}
                            className="flex items-center"
                          >
                            {linkedItem.enableReverseLink ? (
                              <ToggleRight className="w-5 h-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </div>

                        {/* Reverse Ratio Input */}
                        {linkedItem.enableReverseLink && (
                          <div className="flex items-center space-x-2">
                            <label className="text-sm text-gray-600">Rev Ratio:</label>
                            <input
                              type="number"
                              value={linkedItem.reverseRatio || 1}
                              onChange={(e) => handleUpdateLinkedItem(linkedItem.id, 'reverseRatio', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0.1"
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        )}

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveLinkedItem(linkedItem.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Remove linked item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Linked Item */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Add Linked Item</h3>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Link</span>
                </button>
              )}
            </div>

            {showAddForm && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                {/* Menu Item Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Menu Item *
                  </label>
                  <MenuItemSearch
                    menuItems={availableMenuItems}
                    onSelect={setSelectedMenuItem}
                    placeholder="Search available menu items..."
                  />
                </div>

                {selectedMenuItem && (
                  <>
                    {/* Check if inventory exists */}
                    {!inventoryExistsForItem(selectedMenuItem.id) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800 mb-3">
                          <strong>{selectedMenuItem.name}</strong> doesn't have inventory yet. 
                          You can create it now:
                        </p>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Initial Quantity *
                            </label>
                            <input
                              type="number"
                              value={newItemQuantity}
                              onChange={(e) => setNewItemQuantity(parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0.1"
                              className={`w-full px-2 py-1 border rounded text-sm ${
                                newItemQuantity <= 0 
                                  ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                              }`}
                              placeholder="Enter quantity > 0"
                            />
                            {newItemQuantity <= 0 && (
                              <p className="text-xs text-red-600 mt-1">
                                Quantity must be greater than 0
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Unit *
                            </label>
                            <select
                              value={newItemUnit}
                              onChange={(e) => setNewItemUnit(e.target.value as InventoryUnit)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              {unitOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {newItemUnit === 'custom' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Custom Unit *
                              </label>
                              <input
                                type="text"
                                value={newItemCustomUnit}
                                onChange={(e) => setNewItemCustomUnit(e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="Unit name"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Link Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Consumption Ratio *
                        </label>
                        <input
                          type="number"
                          value={linkRatio}
                          onChange={(e) => setLinkRatio(parseFloat(e.target.value) || 1)}
                          step="0.1"
                          min="0.1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="1.0"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          When 1x {currentMenuItem.name} is consumed, how much of {selectedMenuItem.name} equivalent is consumed?
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            checked={enableReverseLink}
                            onChange={(e) => setEnableReverseLink(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">Enable Reverse Link</span>
                        </label>
                        
                        {enableReverseLink && (
                          <input
                            type="number"
                            value={reverseRatio}
                            onChange={(e) => setReverseRatio(parseFloat(e.target.value) || 1)}
                            step="0.1"
                            min="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="1.0"
                          />
                        )}
                        
                        {enableReverseLink && (
                          <p className="text-xs text-gray-500 mt-1">
                            When 1x {selectedMenuItem.name} is consumed, how much of {currentMenuItem.name} equivalent is consumed?
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setSelectedMenuItem(null);
                          setLinkRatio(1);
                          setReverseRatio(1);
                          setEnableReverseLink(false);
                          setNewItemQuantity(0);
                          setNewItemUnit('pieces');
                          setNewItemCustomUnit('');
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddLinkedItem}
                        disabled={
                          !selectedMenuItem || 
                          linkRatio <= 0 || 
                          (!inventoryExistsForItem(selectedMenuItem?.id || '') && newItemQuantity <= 0) ||
                          (enableReverseLink && reverseRatio <= 0)
                        }
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          !selectedMenuItem ? 'Please select a menu item' :
                          linkRatio <= 0 ? 'Consumption ratio must be greater than 0' :
                          (!inventoryExistsForItem(selectedMenuItem?.id || '') && newItemQuantity <= 0) ? 'Please specify initial quantity greater than 0' :
                          (enableReverseLink && reverseRatio <= 0) ? 'Reverse ratio must be greater than 0' :
                          'Add this item as a linked inventory'
                        }
                      >
                        Add Link
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2 inline" />
              Save Links
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// REFACTORED InventoryDialog
export function InventoryDialog({
  isOpen,
  onClose,
  onSave,
  inventory,
  menuItems,
  existingInventory,
  register,
  handleSubmit,
  setValue,
  selectedUnit,
  isSubmitting,
}) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  const formInputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2";
  const formLabelClasses = "block text-sm font-medium text-gray-700";

  useEffect(() => {
    const isNewStandalone = !inventory && isStandalone;
    const isEditStandalone = inventory && (inventory.isStandaloneItem || inventory.menuItemId?.startsWith('standalone_'));
    if (isNewStandalone || isEditStandalone) {
      setIsStandalone(true);
      if (isEditStandalone) {
          setValue('standaloneItemName', inventory.displayName || inventory.standaloneItemName);
      }
    } else {
      setIsStandalone(false);
    }
  }, [isOpen, inventory, isStandalone]);

  const handleMenuItemSelect = (menuItem: MenuItem | null) => {
    setSelectedMenuItem(menuItem);
    setValue('menuItemId', menuItem?.id);
  };
  
  const handleCreateStandalone = (name: string) => {
    setValue('standaloneItemName', name);
    setValue('menuItemId', `standalone_${generateId()}`);
    setValue('isStandaloneItem', true);
  };

  const currentMenuItem = menuItems.find(item => item.id === inventory?.menuItemId);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-0 sm:p-4">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] border-t-4 border-blue-500 sm:border-t-0">
        {/* Mobile drag indicator */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        <div className="flex justify-between items-center p-4 sm:p-6 border-b sticky top-0 bg-white z-10 rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <h3 className="text-xl sm:text-lg font-bold text-gray-900">{inventory ? 'Edit Inventory Item' : 'Create Inventory Item'}</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your inventory tracking settings</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            
            {/* Item Selection */}
            <div className="p-4 sm:p-5 border-2 border-gray-200 rounded-xl bg-gray-50/50">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                <div className="flex items-center">
                  <Package className="w-5 h-5 text-blue-600 mr-2" />
                  <label className="font-semibold text-gray-900 text-base">Track Inventory For</label>
                </div>
                {!inventory && (
                  <button 
                    type="button" 
                    onClick={() => setIsStandalone(!isStandalone)} 
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                  >
                    {isStandalone ? 'Link to Menu Item' : 'Create Standalone Item'}
                  </button>
                )}
              </div>
              {isStandalone ? (
                  <div>
                    <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Standalone Item Name</label>
                    <input 
                      {...register('standaloneItemName', { required: true })} 
                      placeholder="e.g., Flour, Cleaning Supplies, Raw Materials" 
                      className={`${formInputClasses} text-base`} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Create an inventory item not linked to any menu item</p>
                  </div>
              ) : (
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Select Menu Item</label>
                  <MenuItemSearch 
                    menuItems={menuItems.filter(item => !existingInventory.some(inv => inv.menuItemId === item.id && inv.id !== inventory?.id))}
                    onSelect={handleMenuItemSelect}
                    initialValue={currentMenuItem}
                    disabled={!!inventory}
                    allowStandaloneCreation={!inventory}
                    onCreateStandalone={(name) => {
                        setIsStandalone(true);
                        handleCreateStandalone(name);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Stock Details */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                <h4 className="font-semibold text-gray-900 text-base">Stock Details</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Current Quantity</label>
                  <input 
                    {...register('currentQuantity', { required: true, valueAsNumber: true })} 
                    type="number" 
                    placeholder="0"
                    className={`${formInputClasses} text-base`} 
                  />
                </div>
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Unit</label>
                  <select {...register('unit')} className={`${formInputClasses} text-base`}>
                      <option value="pieces">Pieces</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="g">Grams (g)</option>
                      <option value="liters">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                      <option value="custom">Custom</option>
                  </select>
                </div>
                {selectedUnit === 'custom' && (
                  <div className="sm:col-span-2">
                    <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Custom Unit Name</label>
                    <input 
                      {...register('customUnit')} 
                      placeholder="e.g., Bottle, Box, Pack" 
                      className={`${formInputClasses} text-base`} 
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Tracking & Threshold */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                <h4 className="font-semibold text-gray-900 text-base">Thresholds & Consumption</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Minimum Threshold</label>
                  <input 
                    {...register('minimumThreshold', { required: true, valueAsNumber: true })} 
                    type="number" 
                    placeholder="10"
                    className={`${formInputClasses} text-base`} 
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this level</p>
                </div>
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Consumption per Order</label>
                  <input 
                    {...register('consumptionPerOrder', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    placeholder="1"
                    className={`${formInputClasses} text-base`} 
                  />
                  <p className="text-xs text-gray-500 mt-1">How much is used per customer order</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-purple-600 mr-2" />
                <h4 className="font-semibold text-gray-900 text-base">Additional Information</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Supplier (Optional)</label>
                  <input 
                    {...register('supplier')} 
                    placeholder="e.g., ABC Supplies Co."
                    className={`${formInputClasses} text-base`} 
                  />
                </div>
                <div>
                  <label className={`${formLabelClasses} text-sm font-medium mb-2`}>Cost per Unit (Optional)</label>
                  <input 
                    {...register('costPerUnit', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    placeholder="0.00"
                    className={`${formInputClasses} text-base`} 
                  />
                </div>
              </div>
            </div>
            
            {/* Toggles */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200">
              <div className="flex items-center mb-4">
                <RotateCcw className="w-5 h-5 text-indigo-600 mr-2" />
                <h4 className="font-semibold text-gray-900 text-base">Tracking Settings</h4>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900">Track Stock</span>
                    <p className="text-sm text-gray-600">Monitor stock levels and receive alerts</p>
                  </div>
                  <input {...register('isTracked')} type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/>
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div>
                    <span className="font-medium text-gray-900">Auto-deduct from Orders</span>
                    <p className="text-sm text-gray-600">Automatically reduce stock when orders are placed</p>
                  </div>
                  <input {...register('autoDeduct')} type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/>
                </label>
              </div>
            </div>
          </div>
          
          {/* Sticky Footer */}
          <div className="p-4 sm:p-6 bg-white border-t border-gray-200 flex flex-col sm:flex-row gap-3 sticky bottom-0 shadow-[0_-4px_8px_rgba(0,0,0,0.05)]">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {inventory ? 'Update Item' : 'Create Item'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// REFACTORED AdjustmentDialog
export function AdjustmentDialog({
  isOpen,
  onClose,
  onSave,
  inventory,
  menuItemName,
  register,
  handleSubmit,
  setValue,
  watch,
  isSubmitting,
}) {
  const [adjustmentType, setAdjustmentType] = useState<'restock' | 'waste' | 'correction'>('restock');
  const [currentQuantity, setCurrentQuantity] = useState(1);

  useEffect(() => {
    // When the adjustment type changes, reset the quantity to 1
    const newQuantity = 1;
    setCurrentQuantity(newQuantity);
    setValue('quantity', newQuantity, { shouldTouch: true });
  }, [adjustmentType, setValue]);

  const handleQuantityChange = (newValue: number | string) => {
    let numericValue: number;

    if (typeof newValue === 'string') {
      if (newValue.trim() === '' || newValue.trim() === '-') {
        numericValue = 0;
      } else {
        const parsed = parseFloat(newValue);
        numericValue = isNaN(parsed) ? 0 : parsed;
      }
    } else {
      numericValue = newValue;
    }

    if (adjustmentType !== 'correction' && numericValue < 0) {
      numericValue = 0;
    }

    setCurrentQuantity(numericValue);
    setValue('quantity', numericValue, { shouldTouch: true });
  };
  
  const getUnitLabel = (unit: string, customUnit?: string) => {
    if (unit === 'custom' && customUnit) return customUnit;
    if (!unit) return '';
    return unit.charAt(0).toUpperCase() + unit.slice(1);
  };

  const formInputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 px-3 py-2";
  const formLabelClasses = "block text-sm font-medium text-gray-700";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold">Adjust Stock</h3>
            <p className="text-sm text-gray-500">{menuItemName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm text-blue-700">Current Stock</p>
                <p className="text-3xl font-bold text-blue-900">{inventory.currentQuantity} <span className="text-xl">{getUnitLabel(inventory.unit, inventory.customUnit)}</span></p>
            </div>
            
            <div>
                <label className={formLabelClasses}>Adjustment Type</label>
                <select {...register('type')} onChange={(e) => setAdjustmentType(e.target.value as any)} className={formInputClasses}>
                    <option value="restock">Restock</option>
                    <option value="waste">Record Waste</option>
                    <option value="correction">Manual Correction</option>
                </select>
            </div>
            
            <div>
                <label className={formLabelClasses}>
                    {adjustmentType === 'restock' && 'Quantity to Add'}
                    {adjustmentType === 'waste' && 'Quantity to Remove'}
                    {adjustmentType === 'correction' && 'New Total Quantity'}
                </label>
                 <div className="flex items-center justify-center gap-4 mt-2">
                    <button type="button" onClick={() => handleQuantityChange(currentQuantity - 1)} className="p-3 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 disabled:opacity-50" disabled={adjustmentType !== 'correction' && currentQuantity <= 0}>
                        <Minus size={20} />
                    </button>
                    <span className="text-2xl font-bold w-20 text-center tabular-nums">{currentQuantity}</span>
                    <button type="button" onClick={() => handleQuantityChange(currentQuantity + 1)} className="p-3 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300">
                        <Plus size={20} />
                    </button>
                </div>
                <div className="mt-4">
                     <label htmlFor="manual-quantity" className="block text-sm font-medium text-gray-500 mb-1 text-center">Or enter amount directly</label>
                     <input 
                        id="manual-quantity"
                        type="text"
                        inputMode={adjustmentType === 'correction' ? "decimal" : "numeric"}
                        value={currentQuantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        className={`${formInputClasses} text-center max-w-xs mx-auto`}
                    />
                </div>
                <input type="hidden" {...register('quantity')} />
            </div>

            <div>
              <label className={formLabelClasses}>Reason / Notes (Optional)</label>
              <textarea {...register('notes')} rows={3} className={formInputClasses} placeholder="e.g., Damaged goods, stock count..."></textarea>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// REFACTORED HistoryDialog
export function HistoryDialog({
  isOpen,
  onClose,
  inventory,
  menuItemName,
  transactions,
  onRefreshTransactions,
  isLoading,
}) {
  const [filterType, setFilterType] = useState<'all' | 'order_deduction' | 'adjustment'>('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const setDatePreset = (preset: string) => {
    const to = new Date();
    const from = new Date();
    
    switch (preset) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() - 1);
        to.setHours(23, 59, 59, 999);
        break;
      case 'last7':
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'last30':
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      default:
        setDateRange({});
        setActivePreset(null);
        return;
    }
    setDateRange({ from, to });
    setActivePreset(preset);
    setShowDatePicker(false);
  };

  const handleDateSelect = (range: any) => {
    setDateRange(range);
    setActivePreset(null); // Deactivate presets when custom range is chosen
  }
  
  const handleRefresh = () => {
    onRefreshTransactions({ dateRange, type: filterType });
  };
  
  useEffect(() => {
    // Refresh when filters change
    handleRefresh();
  }, [filterType, dateRange]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'restock': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'order_deduction': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'waste': return <Trash2 className="w-5 h-5 text-yellow-600" />;
      case 'correction': return <Edit className="w-5 h-5 text-blue-500" />;
      default: return <History className="w-5 h-5 text-gray-500" />;
    }
  };
  
  const getTransactionLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  if (!isOpen) return null;

  const FilterButton = ({ value, label }) => (
    <button
      onClick={() => setFilterType(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        filterType === value
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      {label}
    </button>
  );

  const PresetButton = ({ label, preset }) => (
    <button
      onClick={() => setDatePreset(preset)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        activePreset === preset
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <p className="text-sm text-gray-500">{menuItemName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={20} /></button>
        </div>
        
        {/* Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Type:</span>
            <FilterButton value="all" label="All" />
            <FilterButton value="order_deduction" label="From Orders" />
            <FilterButton value="adjustment" label="Adjustments" />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Date:</span>
            <PresetButton label="Today" preset="today" />
            <PresetButton label="Yesterday" preset="yesterday" />
            <PresetButton label="Last 7 Days" preset="last7" />
            <PresetButton label="Last 30 Days" preset="last30" />

            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activePreset === null && dateRange.from ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <CalendarIcon size={16} />
                <span>
                  {dateRange.from && activePreset === null ? 
                    `${format(dateRange.from, 'LLL dd, y')} - ${dateRange.to ? format(dateRange.to, 'LLL dd, y') : '...'}` 
                    : 'Custom Range'
                  }
                </span>
              </button>
              {showDatePicker && (
                <div className="absolute top-full mt-2 bg-white border shadow-lg rounded-md z-20" onMouseLeave={() => setShowDatePicker(false)}>
                  <DayPicker
                    mode="range"
                    selected={dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                  />
                </div>
              )}
            </div>
             <button
                onClick={() => {
                  setDateRange({});
                  setActivePreset(null);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Clear
              </button>
          </div>
        </div>
        
        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="text-center py-16">
                <p>Loading history...</p>
              </div>
            ) : transactions.length === 0 ? (
                <div className="text-center py-16">
                    <Package className="mx-auto text-gray-400" size={48}/>
                    <h4 className="mt-4 font-semibold">No Transactions Found</h4>
                    <p className="text-gray-500 text-sm mt-1">No history matches your current filters.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {transactions.map(tx => (
                        <div key={tx.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border">
                            <div className="mt-1">{getTransactionIcon(tx.type)}</div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline">
                                    <p className="font-semibold">{getTransactionLabel(tx.type)}</p>
                                    <p className="text-xs text-gray-500">{format(tx.createdAt, 'PPpp')}</p>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div>
                                        <p className="text-sm text-gray-600">
                                            Change: 
                                            <span className={`font-bold ${tx.quantityChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.quantityChanged > 0 ? '+' : ''}{tx.quantityChanged}
                                            </span>
                                        </p>
                                        <p className="text-sm text-gray-500">New Balance: <span className="font-bold text-gray-800">{tx.newQuantity}</span></p>
                                    </div>
                                    <div className="text-right text-xs">
                                        {tx.orderId && <p>Order ID: {tx.orderId.substring(0, 8)}...</p>}
                                        {tx.staffId && <p>By: {tx.staffId}</p>}
                                        {tx.reason && <p className="italic text-gray-500">"{tx.reason}"</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
          <button type="button" onClick={handleRefresh} className="btn btn-secondary" disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary">Close</button>
        </div>
      </div>
    </div>
  );
} 