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
  const { user } = useRestaurantAuth();
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkedItems, setLinkedItems] = useState<InventoryLinkedItem[]>([]);
  const [isStandaloneItem, setIsStandaloneItem] = useState(false);
  const [standaloneItemName, setStandaloneItemName] = useState('');

  useEffect(() => {
    if (inventory) {
      // Editing existing inventory
      setIsStandaloneItem(!inventory.menuItemId);
      if (!inventory.menuItemId) {
        // This is a standalone item, extract name from some field
        setStandaloneItemName(inventory.displayName || inventory.id || '');
      } else {
        // Find the corresponding menu item
        const menuItem = menuItems.find(item => item.id === inventory.menuItemId);
        setSelectedMenuItem(menuItem || null);
        setStandaloneItemName('');
      }
      setLinkedItems(inventory.linkedItems || []);
    } else {
      // Creating new inventory
      setIsStandaloneItem(false);
      setSelectedMenuItem(null);
      setStandaloneItemName('');
      setLinkedItems([]);
    }
  }, [inventory, menuItems]);

  const availableMenuItems = menuItems.filter(item => 
    !existingInventory.some(inv => inv.menuItemId === item.id && inv.id !== inventory?.id)
  );

  const handleMenuItemSelect = (menuItem: MenuItem | null) => {
    setSelectedMenuItem(menuItem);
    setIsStandaloneItem(false);
    setStandaloneItemName('');
    if (menuItem) {
      setValue('menuItemId', menuItem.id);
    } else {
      setValue('menuItemId', '');
    }
  };

  const handleCreateStandalone = (itemName: string) => {
    setIsStandaloneItem(true);
    setStandaloneItemName(itemName);
    setSelectedMenuItem(null);
    setValue('menuItemId', ''); // Clear menu item ID for standalone items
  };

  const handleFormSubmit = (data: any) => {
    console.log('📝 Form submission:', { data, isStandaloneItem, standaloneItemName, selectedMenuItem });
    
    // Validate that either menu item is selected OR standalone name is provided
    if (!isStandaloneItem && !selectedMenuItem) {
      alert('Please select a menu item or create a standalone inventory item');
      return;
    }

    if (isStandaloneItem && !standaloneItemName.trim()) {
      alert('Please provide a name for the standalone inventory item');
      return;
    }

    const submitData = {
      ...data,
      linkedItems,
      isStandaloneItem,
      standaloneItemName: isStandaloneItem ? standaloneItemName : undefined,
      menuItemId: isStandaloneItem ? null : selectedMenuItem?.id,
    };

    console.log('🚀 Submitting inventory data:', submitData);
    onSave(submitData);
  };

  const handleLinkItems = (linkedItems: InventoryLinkedItem[]) => {
    console.log('🔗 LinkItems received:', linkedItems);
    setLinkedItems(linkedItems);
    setShowLinkDialog(false);
  };

  const handleCreateNewInventory = (menuItem: MenuItem, quantity: number, unit: InventoryUnit, customUnit?: string) => {
    // Implementation for creating linked inventory - existing logic
    console.log('Creating new linked inventory:', { menuItem, quantity, unit, customUnit });
    
    // This will be handled by the parent component
    // For now, we'll just close the link dialog
    setShowLinkDialog(false);
  };

  const renderLinkedItemsPreview = () => {
    if (!linkedItems.length) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
          <Link className="w-4 h-4 mr-2" />
          Linked Items ({linkedItems.length})
        </h4>
        <div className="space-y-2">
          {linkedItems.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{item.linkedMenuItemName}</span>
              <span className="text-gray-500">Ratio: 1:{item.ratio}</span>
            </div>
          ))}
          {linkedItems.length > 3 && (
            <div className="text-xs text-gray-500">
              +{linkedItems.length - 3} more items
            </div>
          )}
        </div>
      </div>
    );
  };

  const getUnitDisplay = (unit: InventoryUnit, customUnit?: string): string => {
    return unit === 'custom' && customUnit ? customUnit : unit;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {inventory ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
            <button
                type="button"
              onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
            >
                <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
            {/* Menu Item Selection or Standalone Creation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {isStandaloneItem ? 'Inventory Item Name' : 'Menu Item'}
                <span className="text-red-500 ml-1">*</span>
            </label>
              
              {!inventory && ( // Only show search for new items
            <MenuItemSearch
              menuItems={availableMenuItems}
                  onSelect={handleMenuItemSelect}
                  onCreateStandalone={handleCreateStandalone}
                  initialValue={selectedMenuItem}
                  allowStandaloneCreation={true}
                  placeholder="Search menu items or type to create standalone item..."
            />
              )}

              {inventory && isStandaloneItem && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center text-sm text-blue-700">
                    <Package className="w-4 h-4 mr-2" />
                    <span>Standalone inventory item: <strong>{standaloneItemName}</strong></span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    This item is not linked to any menu items - it's for inventory tracking only.
                  </p>
                </div>
              )}

              {inventory && !isStandaloneItem && selectedMenuItem && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center text-sm text-green-700">
                    <Package className="w-4 h-4 mr-2" />
                    <span>Linked to menu item: <strong>{selectedMenuItem.name}</strong></span>
          </div>
                  <p className="text-xs text-green-600 mt-1">
                    Price: {formatCurrency(selectedMenuItem.price)}
                  </p>
                </div>
              )}

              {/* Hidden input for form registration */}
              <input type="hidden" {...register('menuItemId')} />
            </div>

            {/* Rest of the form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Quantity */}
            <div>
                <label className="form-label">
                  Current Quantity <span className="text-red-500">*</span>
              </label>
              <input
                  type="number"
                  step="0.01"
                  min="0"
                {...register('currentQuantity', { 
                    required: 'Current quantity is required',
                    min: { value: 0, message: 'Quantity cannot be negative' }
                })}
                  className="input"
                  placeholder="Enter current stock quantity"
              />
            </div>
            
              {/* Unit */}
            <div>
                <label className="form-label">
                  Unit <span className="text-red-500">*</span>
              </label>
              <select
                {...register('unit', { required: 'Unit is required' })}
                  className="input"
                >
                  <option value="">Select Unit</option>
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="grams">Grams (g)</option>
                  <option value="liters">Liters (L)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="cups">Cups</option>
                  <option value="portions">Portions</option>
                  <option value="bottles">Bottles</option>
                  <option value="cans">Cans</option>
                  <option value="custom">Custom Unit</option>
              </select>
          </div>

              {/* Custom Unit (conditional) */}
          {selectedUnit === 'custom' && (
                <div className="md:col-span-2">
                  <label className="form-label">
                    Custom Unit <span className="text-red-500">*</span>
              </label>
              <input
                    type="text"
                {...register('customUnit', { 
                  required: selectedUnit === 'custom' ? 'Custom unit name is required' : false
                })}
                    className="input"
                    placeholder="Enter custom unit (e.g., boxes, packets, trays)"
              />
            </div>
          )}

              {/* Minimum Threshold */}
            <div>
                <label className="form-label">
                  Minimum Threshold <span className="text-red-500">*</span>
              </label>
              <input
                  type="number"
                  step="0.01"
                  min="0"
                {...register('minimumThreshold', { 
                  required: 'Minimum threshold is required',
                    min: { value: 0, message: 'Threshold cannot be negative' }
                })}
                  className="input"
                  placeholder="Alert when stock falls below this level"
              />
            </div>
            
              {/* Consumption Per Order */}
            <div>
                <label className="form-label">
                  Consumption Per Order <span className="text-red-500">*</span>
              </label>
              <input
                  type="number"
                  step="0.01"
                  min="0"
                {...register('consumptionPerOrder', { 
                  required: 'Consumption per order is required',
                    min: { value: 0, message: 'Consumption cannot be negative' }
                })}
                  className="input"
                placeholder="How much is used per order"
              />
          </div>

              {/* Max Capacity */}
            <div>
                <label className="form-label">Max Capacity (Optional)</label>
              <input
                type="number"
                  step="0.01"
                  min="0"
                  {...register('maxCapacity')}
                  className="input"
                  placeholder="Maximum storage capacity"
              />
            </div>
            
              {/* Cost Per Unit */}
            <div>
                <label className="form-label">Cost Per Unit (Optional)</label>
              <input
                type="number"
                step="0.01"
                  min="0"
                  {...register('costPerUnit')}
                  className="input"
                placeholder="Cost price per unit"
              />
          </div>

              {/* Supplier */}
              <div className="md:col-span-2">
                <label className="form-label">Supplier (Optional)</label>
            <input
              type="text"
                  {...register('supplier')}
                  className="input"
                  placeholder="Enter supplier name"
            />
              </div>
          </div>

            {/* Tracking Settings */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Tracking Settings</h4>
              
              <div className="space-y-4">
                {/* Is Tracked */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900">Enable Inventory Tracking</h5>
                    <p className="text-sm text-gray-600">Track stock levels and receive low stock alerts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                      {...register('isTracked')}
                      className="sr-only peer"
              />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
                </div>

                {/* Auto Deduct */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900">Auto-Deduct from Orders</h5>
                    <p className="text-sm text-gray-600">Automatically reduce stock when orders are placed</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                      {...register('autoDeduct')}
                      className="sr-only peer"
              />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
                </div>
              </div>
          </div>

            {/* Linking System */}
            {selectedMenuItem && !isStandaloneItem && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="text-lg font-medium text-gray-900">Inventory Linking</h4>
                  <p className="text-sm text-gray-600">
                      Link this inventory to other menu items for automatic stock management
                  </p>
                </div>
                <button
                  type="button"
                    onClick={() => setShowLinkDialog(true)}
                    className="btn btn-secondary flex items-center"
                >
                    <Link className="w-4 h-4 mr-2" />
                    {linkedItems.length > 0 ? 'Manage Links' : 'Add Links'}
                </button>
              </div>
              
                {renderLinkedItemsPreview()}
                </div>
              )}

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
                className="btn btn-theme-primary flex items-center disabled:opacity-50"
            >
              {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                  <Save className="w-4 h-4 mr-2" />
              )}
                {isSubmitting ? 'Saving...' : (inventory ? 'Update Inventory' : 'Create Inventory')}
            </button>
          </div>
        </form>
        </div>
      </div>
        
      {/* Link Items Dialog */}
      {showLinkDialog && selectedMenuItem && (
          <LinkItemModal
          isOpen={showLinkDialog}
          onClose={() => setShowLinkDialog(false)}
            onSave={handleLinkItems}
          currentInventory={inventory || {} as InventoryItem}
          currentMenuItem={selectedMenuItem}
            menuItems={menuItems}
            existingInventory={existingInventory}
            onCreateNewInventory={handleCreateNewInventory}
          />
        )}
    </>
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