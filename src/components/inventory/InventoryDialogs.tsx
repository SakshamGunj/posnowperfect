// Removed React import since it's not needed in React 18+ with automatic JSX runtime
import { useState, useEffect, useCallback } from 'react';
import { X, Save, Package, Clock, TrendingUp, TrendingDown, RotateCcw, AlertTriangle, Search, Link, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { InventoryItem, MenuItem, InventoryTransaction, InventoryUnit, InventoryLinkedItem } from '@/types';
import { formatCurrency, generateId } from '@/lib/utils';
import { InventoryService } from '@/services/inventoryService';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import toast from 'react-hot-toast';

// Menu Item Search Component
interface MenuItemSearchProps {
  menuItems: MenuItem[];
  onSelect: (menuItem: MenuItem | null) => void;
  disabled?: boolean;
  initialValue?: MenuItem | null;
  placeholder?: string;
}

function MenuItemSearch({ menuItems, onSelect, disabled, initialValue, placeholder }: MenuItemSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(initialValue || null);

  useEffect(() => {
    if (initialValue) {
      setSelectedMenuItem(initialValue);
    }
  }, [initialValue]);

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.price.toString().includes(searchTerm)
  );

  const handleSelect = (item: MenuItem) => {
    setSelectedMenuItem(item);
    onSelect(item);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedMenuItem(null);
    onSelect(null);
    setSearchTerm('');
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={selectedMenuItem ? `${selectedMenuItem.name} - ${formatCurrency(selectedMenuItem.price)}` : searchTerm}
          onChange={(e) => {
            if (!selectedMenuItem) {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }
          }}
          onFocus={() => !selectedMenuItem && setIsOpen(true)}
          placeholder={placeholder || "Search menu items..."}
          disabled={disabled}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
          readOnly={!!selectedMenuItem}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {selectedMenuItem ? (
            <button
              type="button"
              onClick={handleClear}
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

      {/* Dropdown */}
      {isOpen && !disabled && !selectedMenuItem && (
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
              <div className="px-3 py-4 text-gray-500 text-sm text-center">
                {searchTerm ? 'No menu items found matching your search' : 'Start typing to search menu items...'}
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
  setValue: any;
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
  setValue,
  selectedUnit,
  isSubmitting,
}: InventoryDialogProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingInventoryData, setPendingInventoryData] = useState<any>(null);
  const [newInventoriesToCreate, setNewInventoriesToCreate] = useState<Array<{menuItem: MenuItem, quantity: number, unit: InventoryUnit, customUnit?: string}>>([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [pendingLinkedItems, setPendingLinkedItems] = useState<InventoryLinkedItem[]>([]);
  const [reverseLinkedItems, setReverseLinkedItems] = useState<Array<{
    inventory: InventoryItem;
    menuItem: MenuItem;
    linkData: InventoryLinkedItem;
  }>>([]);

  if (!isOpen) return null;

  const availableMenuItems = inventory 
    ? menuItems.filter(item => item.id === inventory.menuItemId || !existingInventory.some(inv => inv.menuItemId === item.id))
    : menuItems.filter(item => !existingInventory.some(inv => inv.menuItemId === item.id));

  const initialSelectedItem = inventory ? menuItems.find(item => item.id === inventory.menuItemId) || null : null;
  const currentMenuItem = selectedMenuItem || initialSelectedItem;

  // Function to find reverse links (items that link TO this item)
  const findReverseLinks = useCallback(() => {
    if (!inventory) {
      setReverseLinkedItems([]);
      return;
    }

    const reverseLinks: Array<{
      inventory: InventoryItem;
      menuItem: MenuItem;
      linkData: InventoryLinkedItem;
    }> = [];

    // Check all other inventory items to see if they link to this item
    existingInventory.forEach(otherInventory => {
      if (otherInventory.id === inventory.id) return; // Skip self
      
      if (otherInventory.linkedItems && otherInventory.linkedItems.length > 0) {
        otherInventory.linkedItems.forEach(linkedItem => {
          if (linkedItem.linkedInventoryId === inventory.id || linkedItem.linkedMenuItemId === inventory.menuItemId) {
            const linkedMenuItem = menuItems.find(item => item.id === otherInventory.menuItemId);
            if (linkedMenuItem) {
              reverseLinks.push({
                inventory: otherInventory,
                menuItem: linkedMenuItem,
                linkData: linkedItem
              });
            }
          }
        });
      }
    });

    setReverseLinkedItems(reverseLinks);
  }, [inventory, existingInventory, menuItems]);

  // Reset selected menu item when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedMenuItem(initialSelectedItem);
      // Initialize pending linked items from existing inventory
      setPendingLinkedItems(inventory?.linkedItems || []);
      // Find items that link to this inventory
      findReverseLinks();
    } else {
      setSelectedMenuItem(null);
      setPendingLinkedItems([]);
      setReverseLinkedItems([]);
    }
  }, [isOpen, initialSelectedItem, inventory, findReverseLinks]);

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

  const handleFormSubmit = (data: any) => {
    // Filter out undefined values to prevent Firebase errors
    const cleanData = Object.keys(data).reduce((acc, key) => {
      if (data[key] !== undefined && data[key] !== '') {
        acc[key] = data[key];
      }
      return acc;
    }, {} as any);

    // Ensure customUnit is only included when unit is 'custom'
    if (cleanData.unit !== 'custom') {
      delete cleanData.customUnit;
    }

    // Add pending linked items if any
    if (pendingLinkedItems.length > 0) {
      cleanData.linkedItems = pendingLinkedItems;
      cleanData.isBaseInventory = true;
      cleanData.reverseLinksEnabled = pendingLinkedItems.some(item => item.enableReverseLink);
    }

    console.log('🔗 Saving inventory with data:', cleanData);
    onSave(cleanData);
  };

  const handleLinkItems = (linkedItems: InventoryLinkedItem[]) => {
    console.log('🔗 handleLinkItems called with:', linkedItems);
    
    // Store pending linked items for display
    setPendingLinkedItems(linkedItems);
    
    if (!inventory) {
      // For new inventory, just store the linked items to be saved later
      console.log('🔗 New inventory - storing pending linked items');
      setShowLinkModal(false);
      return;
    }
    
    // Update the current inventory with linked items
    const updatedInventory = {
      ...inventory,
      linkedItems: linkedItems,
      isBaseInventory: linkedItems.length > 0,
      reverseLinksEnabled: linkedItems.some(item => item.enableReverseLink)
    };
    
    // Save the updated inventory with links
    onSave(updatedInventory);
    
    // Handle creating new inventories if needed
    newInventoriesToCreate.forEach(newInv => {
      // This would typically call a separate function to create new inventory
      console.log('Creating new inventory for:', newInv.menuItem.name, newInv.quantity, newInv.unit);
    });
    
    setShowLinkModal(false);
  };

  const handleCreateNewInventory = (menuItem: MenuItem, quantity: number, unit: InventoryUnit, customUnit?: string) => {
    setNewInventoriesToCreate([...newInventoriesToCreate, { menuItem, quantity, unit, customUnit }]);
  };

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
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
          {/* Menu Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Menu Item *
            </label>
            <MenuItemSearch
              menuItems={availableMenuItems}
              onSelect={(item) => {
                setValue('menuItemId', item?.id || '');
                setSelectedMenuItem(item);
              }}
              disabled={!!inventory}
              initialValue={initialSelectedItem}
              placeholder="Search and select menu item..."
            />
            {/* Hidden input for form validation */}
            <input
              type="hidden"
              {...register('menuItemId', { required: 'Menu item is required' })}
            />
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
                  min: { value: 0, message: 'Quantity cannot be negative' },
                  valueAsNumber: true
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
                  min: { value: 0, message: 'Threshold cannot be negative' },
                  valueAsNumber: true
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
                  min: { value: 0, message: 'Consumption cannot be negative' },
                  valueAsNumber: true
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
                {...register('maxCapacity', { valueAsNumber: true })}
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
                {...register('costPerUnit', { valueAsNumber: true })}
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

          {/* Linked Items Section - Show for both create and edit modes */}
          {(
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">Linked Items</h3>
                  <p className="text-sm text-gray-600">
                    {inventory ? 'Items sharing the same base inventory' : 'Set up items that will share the same base inventory'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentMenuItem && !inventory) {
                      alert('Please select a menu item first to enable linking functionality.');
                      return;
                    }
                    setShowLinkModal(true);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                    currentMenuItem || inventory 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                  disabled={!currentMenuItem && !inventory}
                >
                  <Link className="w-4 h-4" />
                  <span>Link Items</span>
                </button>
              </div>
              
              {/* Forward Links - Items this inventory links to */}
              {((inventory && inventory.linkedItems && inventory.linkedItems.length > 0) || pendingLinkedItems.length > 0) && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1 text-blue-600" />
                    Items linked from this inventory
                  </h4>
                  {(pendingLinkedItems.length > 0 ? pendingLinkedItems : inventory?.linkedItems || []).map((linkedItem) => (
                    <div key={linkedItem.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-green-900">{linkedItem.linkedMenuItemName}</p>
                          <p className="text-sm text-green-700">
                            Ratio: 1:{linkedItem.ratio} 
                            {linkedItem.enableReverseLink && ` | Reverse: 1:${linkedItem.reverseRatio || 1}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {linkedItem.enableReverseLink && (
                          <ToggleRight className="w-4 h-4 text-green-600" />
                        )}
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reverse Links - Items that link to this inventory */}
              {reverseLinkedItems.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <TrendingDown className="w-4 h-4 mr-1 text-purple-600" />
                    Items linked to this inventory
                  </h4>
                  {reverseLinkedItems.map((reverseLink, index) => (
                    <div key={`reverse-${index}`} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-purple-900">{reverseLink.menuItem.name}</p>
                          <p className="text-sm text-purple-700">
                            Linked with ratio: 1:{reverseLink.linkData.ratio}
                            {reverseLink.linkData.enableReverseLink && ` | Reverse: 1:${reverseLink.linkData.reverseRatio || 1}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {reverseLink.linkData.enableReverseLink && (
                          <ToggleRight className="w-4 h-4 text-purple-600" />
                        )}
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          Linked Item
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show empty state only if no links exist in either direction */}
              {((inventory && (!inventory.linkedItems || inventory.linkedItems.length === 0)) && pendingLinkedItems.length === 0 && reverseLinkedItems.length === 0) && (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Link className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {inventory ? 'No linked items yet' : 'No linked items configured'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {inventory 
                      ? 'Link items that share the same base inventory' 
                      : 'Click "Link Items" to set up consumption ratios for related menu items'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

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
              className="btn btn-theme-primary"
            >
              {isSubmitting ? (
                <>
                  <Package className="w-4 h-4 mr-2 animate-spin" />
                  {inventory ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {inventory ? 'Update Inventory' : 'Create Inventory'}
                </>
              )}
            </button>
          </div>
        </form>
        
        {/* Link Item Modal */}
        {currentMenuItem && (
          <LinkItemModal
            isOpen={showLinkModal}
            onClose={() => setShowLinkModal(false)}
            onSave={handleLinkItems}
            currentInventory={inventory || {
              id: 'temp',
              menuItemId: currentMenuItem.id,
              restaurantId: '',
              currentQuantity: 0,
              unit: selectedUnit || 'pieces',
              minimumThreshold: 0,
              consumptionPerOrder: 1,
              isTracked: true,
              autoDeduct: true,
              linkedItems: [],
              createdAt: new Date(),
              updatedAt: new Date()
            } as InventoryItem}
            currentMenuItem={currentMenuItem}
            menuItems={menuItems}
            existingInventory={existingInventory}
            onCreateNewInventory={handleCreateNewInventory}
          />
        )}
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
  onRefreshTransactions?: () => Promise<void>;
}

export function HistoryDialog({
  isOpen,
  onClose,
  inventory,
  menuItemName,
  transactions,
  onRefreshTransactions,
}: HistoryDialogProps) {
  const { user } = useRestaurantAuth();
  const [isCreatingInitial, setIsCreatingInitial] = useState(false);

  if (!isOpen) return null;

  const handleCreateInitialTransaction = async () => {
    if (!user || !inventory) return;

    try {
      setIsCreatingInitial(true);
      
      const result = await InventoryService.createInitialTransactionForInventory(
        inventory.id,
        inventory.restaurantId,
        user.id
      );

      if (result.success) {
        if (result.data) {
          toast.success('Initial transaction created successfully');
          if (onRefreshTransactions) {
            await onRefreshTransactions();
          }
        } else {
          toast.success(result.message || 'No transaction needed');
        }
      } else {
        toast.error(result.error || 'Failed to create initial transaction');
      }
    } catch (error) {
      console.error('Error creating initial transaction:', error);
      toast.error('Failed to create initial transaction');
    } finally {
      setIsCreatingInitial(false);
    }
  };

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
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-medium text-gray-700 mb-2">No transaction history available</h4>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Transaction history will show when:</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
                    <ul className="space-y-2">
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                        Inventory is restocked
                      </li>
                      <li className="flex items-center">
                        <TrendingDown className="w-4 h-4 text-red-600 mr-2 flex-shrink-0" />
                        Items are sold (order deductions)
                      </li>
                      <li className="flex items-center">
                        <RotateCcw className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                        Manual adjustments are made
                      </li>
                      <li className="flex items-center">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                        Waste or loss is recorded
                      </li>
                    </ul>
                  </div>
                                     <p className="text-xs text-gray-500 mt-3">
                     Try adjusting the inventory quantity or processing some orders to see transactions appear.
                   </p>
                 </div>
                 
                 {inventory.currentQuantity > 0 && (
                   <div className="mt-6">
                     <button
                       onClick={handleCreateInitialTransaction}
                       disabled={isCreatingInitial}
                       className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       {isCreatingInitial ? (
                         <>
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                           Creating...
                         </>
                       ) : (
                         <>
                           <TrendingUp className="w-4 h-4 mr-2" />
                           Create Initial Stock Record
                         </>
                       )}
                     </button>
                     <p className="text-xs text-gray-500 mt-2">
                       This will create a record of your current {inventory.currentQuantity} {getUnitDisplay(inventory.unit, inventory.customUnit)} stock
                     </p>
                   </div>
                 )}
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