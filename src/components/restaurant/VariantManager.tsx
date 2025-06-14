import { useState } from 'react';
import { Plus, Trash2, Edit, Save } from 'lucide-react';
import { MenuItemVariant, MenuItemVariantOption } from '@/types';
import { generateId } from '@/lib/utils';

interface VariantManagerProps {
  variants: MenuItemVariant[];
  onChange: (variants: MenuItemVariant[]) => void;
}

export default function VariantManager({ variants, onChange }: VariantManagerProps) {
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<string | null>(null);

  const addVariant = () => {
    const newVariant: MenuItemVariant = {
      id: generateId(),
      name: '',
      type: 'single',
      required: false,
      options: [],
    };
    onChange([...variants, newVariant]);
    setEditingVariant(newVariant.id);
  };

  const updateVariant = (variantId: string, updates: Partial<MenuItemVariant>) => {
    const updatedVariants = variants.map(variant =>
      variant.id === variantId ? { ...variant, ...updates } : variant
    );
    onChange(updatedVariants);
  };

  const deleteVariant = (variantId: string) => {
    onChange(variants.filter(variant => variant.id !== variantId));
  };

  const addOption = (variantId: string) => {
    const newOption: MenuItemVariantOption = {
      id: generateId(),
      name: '',
      priceModifier: 0,
      isDefault: false,
    };
    
    updateVariant(variantId, {
      options: [...(variants.find(v => v.id === variantId)?.options || []), newOption],
    });
    setEditingOption(newOption.id);
  };

  const updateOption = (variantId: string, optionId: string, updates: Partial<MenuItemVariantOption>) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;

    const updatedOptions = variant.options.map(option =>
      option.id === optionId ? { ...option, ...updates } : option
    );
    
    updateVariant(variantId, { options: updatedOptions });
  };

  const deleteOption = (variantId: string, optionId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;

    updateVariant(variantId, {
      options: variant.options.filter(option => option.id !== optionId),
    });
  };

  const setDefaultOption = (variantId: string, optionId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant || variant.type !== 'single') return;

    const updatedOptions = variant.options.map(option => ({
      ...option,
      isDefault: option.id === optionId,
    }));
    
    updateVariant(variantId, { options: updatedOptions });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Menu Item Variants</h3>
        <button
          type="button"
          onClick={addVariant}
          className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No variants configured. Add variants like size, spice level, or toppings to give customers more options.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {variants.map((variant) => (
            <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editingVariant === variant.id ? (
                    <>
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(e) => updateVariant(variant.id, { name: e.target.value })}
                        placeholder="Variant name (e.g., Size, Spice Level)"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <select
                        value={variant.type}
                        onChange={(e) => updateVariant(variant.id, { type: e.target.value as 'single' | 'multiple' })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="single">Single Choice</option>
                        <option value="multiple">Multiple Choice</option>
                      </select>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variant.required}
                            onChange={(e) => updateVariant(variant.id, { required: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Required</span>
                        </label>
                        {variant.type === 'multiple' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Max selections</label>
                            <input
                              type="number"
                              min="1"
                              value={variant.maxSelections || ''}
                              onChange={(e) => updateVariant(variant.id, { maxSelections: parseInt(e.target.value) || undefined })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="∞"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h4 className="font-medium text-gray-900">{variant.name || 'Unnamed Variant'}</h4>
                        <p className="text-sm text-gray-600">
                          {variant.type === 'single' ? 'Single Choice' : 'Multiple Choice'}
                          {variant.required ? ' • Required' : ' • Optional'}
                          {variant.type === 'multiple' && variant.maxSelections && ` • Max ${variant.maxSelections}`}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {editingVariant === variant.id ? (
                    <button
                      type="button"
                      onClick={() => setEditingVariant(null)}
                      className="p-1 text-green-600 hover:text-green-700"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingVariant(variant.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteVariant(variant.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-medium text-gray-700">Options</h5>
                  <button
                    type="button"
                    onClick={() => addOption(variant.id)}
                    className="flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Option
                  </button>
                </div>

                {variant.options.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No options configured</p>
                ) : (
                  <div className="space-y-2">
                    {variant.options.map((option) => (
                      <div key={option.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                        {editingOption === option.id ? (
                          <>
                            <input
                              type="text"
                              value={option.name}
                              onChange={(e) => updateOption(variant.id, option.id, { name: e.target.value })}
                              placeholder="Option name"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-gray-600">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={option.priceModifier}
                                onChange={(e) => updateOption(variant.id, option.id, { priceModifier: parseFloat(e.target.value) || 0 })}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            <select
                              value={option.pricingType || 'additive'}
                              onChange={(e) => updateOption(variant.id, option.id, { pricingType: e.target.value as 'additive' | 'standalone' })}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="additive">Add to base</option>
                              <option value="standalone">Replace base</option>
                            </select>
                            {variant.type === 'single' && (
                              <label className="flex items-center space-x-1">
                                <input
                                  type="radio"
                                  name={`default-${variant.id}`}
                                  checked={option.isDefault}
                                  onChange={() => setDefaultOption(variant.id, option.id)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-600">Default</span>
                              </label>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingOption(null)}
                              className="p-1 text-green-600 hover:text-green-700"
                            >
                              <Save className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-900">{option.name || 'Unnamed Option'}</span>
                            <div className="flex flex-col items-end">
                            <span className="text-sm text-gray-600">
                                {option.pricingType === 'standalone' ? '' : option.priceModifier > 0 && '+'}
                              ₹{option.priceModifier.toFixed(2)}
                            </span>
                              <span className="text-xs text-gray-500">
                                {option.pricingType === 'standalone' ? 'Standalone' : 'Additive'}
                              </span>
                            </div>
                            {option.isDefault && variant.type === 'single' && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingOption(option.id)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOption(variant.id, option.id)}
                              className="p-1 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 