import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MenuItem, MenuItemVariant, SelectedVariant } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface VariantSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem;
  onConfirm: (variants: SelectedVariant[], finalPrice: number) => void;
}

export default function VariantSelectionModal({
  isOpen,
  onClose,
  menuItem,
  onConfirm,
}: VariantSelectionModalProps) {
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const variants = menuItem.variants || [];

  // Calculate the final price based on selected variants
  const calculateFinalPrice = () => {
    const basePrice = Number(menuItem.price) || 0;
    let finalPrice = basePrice;
    
    // Process variants to handle different pricing types
    selectedVariants.forEach(variant => {
      const modifier = Number(variant.priceModifier) || 0;
      const pricingType = (variant as any).pricingType || 'additive';
      
      if (pricingType === 'standalone') {
        // For standalone pricing, use the variant price as the final price
        finalPrice = modifier;
      } else {
        // For additive pricing, add to the current price
        finalPrice += modifier;
      }
    });
    
    return finalPrice;
  };

  const handleVariantSelection = (variant: MenuItemVariant, optionId: string) => {
    const option = variant.options.find(opt => opt.id === optionId);
    if (!option) return;

    if (variant.type === 'single') {
      // For single choice, replace existing selection for this variant
      const newSelectedVariants = selectedVariants.filter(
        sv => sv.variantId !== variant.id
      );
      
      newSelectedVariants.push({
        variantId: variant.id,
        variantName: variant.name,
        optionId: option.id,
        optionName: option.name,
        priceModifier: Number(option.priceModifier) || 0,
        pricingType: option.pricingType || 'additive',
      });
      
      setSelectedVariants(newSelectedVariants);
    } else {
      // For multiple choice, toggle the selection
      const existingIndex = selectedVariants.findIndex(
        sv => sv.variantId === variant.id && sv.optionId === optionId
      );

      if (existingIndex >= 0) {
        // Remove if already selected
        const newSelectedVariants = [...selectedVariants];
        newSelectedVariants.splice(existingIndex, 1);
        setSelectedVariants(newSelectedVariants);
      } else {
        // Add if not selected (check max selections)
        const currentSelectionsForVariant = selectedVariants.filter(
          sv => sv.variantId === variant.id
        ).length;

        if (!variant.maxSelections || currentSelectionsForVariant < variant.maxSelections) {
          setSelectedVariants([
            ...selectedVariants,
            {
              variantId: variant.id,
              variantName: variant.name,
              optionId: option.id,
              optionName: option.name,
              priceModifier: Number(option.priceModifier) || 0,
              pricingType: option.pricingType || 'additive',
            },
          ]);
        }
      }
    }
  };

  const isOptionSelected = (variantId: string, optionId: string) => {
    return selectedVariants.some(
      sv => sv.variantId === variantId && sv.optionId === optionId
    );
  };

  const validateSelections = () => {
    const validationErrors: string[] = [];

    variants.forEach(variant => {
      if (variant.required) {
        const hasSelection = selectedVariants.some(sv => sv.variantId === variant.id);
        if (!hasSelection) {
          validationErrors.push(`Please select an option for ${variant.name}`);
        }
      }
    });

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleConfirm = () => {
    if (validateSelections()) {
      const finalPrice = calculateFinalPrice();
      onConfirm(selectedVariants, finalPrice);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedVariants([]);
    setErrors([]);
    onClose();
  };

  // Initialize with default selections on first render
  React.useEffect(() => {
    if (variants.length > 0 && selectedVariants.length === 0) {
      const defaultSelections: SelectedVariant[] = [];
      
      variants.forEach(variant => {
        if (variant.type === 'single') {
          const defaultOption = variant.options.find(opt => opt.isDefault) || variant.options[0];
          if (defaultOption) {
            defaultSelections.push({
              variantId: variant.id,
              variantName: variant.name,
              optionId: defaultOption.id,
              optionName: defaultOption.name,
              priceModifier: defaultOption.priceModifier,
            pricingType: defaultOption.pricingType || 'additive',
            });
          }
        }
      });
      
      setSelectedVariants(defaultSelections);
    }
  }, [variants, selectedVariants.length]);

  const finalPrice = calculateFinalPrice();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Customize {menuItem.name}</h2>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Item Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-medium text-gray-900">{menuItem.name}</span>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(finalPrice)}
              </span>
            </div>
            {menuItem.description && (
              <p className="text-gray-600 text-sm">{menuItem.description}</p>
            )}
          </div>

          {/* Variants */}
          {variants.map((variant) => (
            <div key={variant.id} className="mb-6">
              <div className="flex items-center mb-3">
                <h3 className="text-md font-medium text-gray-900">{variant.name}</h3>
                {variant.required && (
                  <span className="ml-2 text-red-500 text-sm">*</span>
                )}
                {variant.type === 'multiple' && variant.maxSelections && (
                  <span className="ml-2 text-gray-500 text-sm">
                    (Max {variant.maxSelections})
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {variant.options.map((option) => {
                  const isSelected = isOptionSelected(variant.id, option.id);
                  const currentSelectionsCount = selectedVariants.filter(
                    sv => sv.variantId === variant.id
                  ).length;
                  const isMaxReached = variant.maxSelections && 
                    currentSelectionsCount >= variant.maxSelections && 
                    !isSelected;

                  return (
                    <div
                      key={option.id}
                      onClick={() => 
                        !isMaxReached && handleVariantSelection(variant, option.id)
                      }
                      className={`
                        p-3 border rounded-lg cursor-pointer transition-colors
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : isMaxReached
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {variant.type === 'single' ? (
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() => {}}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              disabled={!!isMaxReached}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <span className="text-gray-900">{option.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                        <span className="text-gray-600">
                            {option.pricingType === 'standalone' ? '' : option.priceModifier > 0 && '+'}
                          {option.priceModifier !== 0 && formatCurrency(option.priceModifier)}
                        </span>
                          {option.pricingType === 'standalone' && (
                            <span className="text-xs text-blue-600">Standalone</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ul className="text-red-600 text-sm space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Selected Variants Summary */}
          {selectedVariants.length > 0 && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Options:</h4>
              <div className="space-y-1">
                {selectedVariants.map((variant, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {variant.variantName}: {variant.optionName}
                    </span>
                    <div className="flex flex-col items-end">
                    <span className="text-gray-600">
                        {variant.pricingType === 'standalone' ? '' : variant.priceModifier > 0 && '+'}
                      {variant.priceModifier !== 0 && formatCurrency(variant.priceModifier)}
                    </span>
                      {variant.pricingType === 'standalone' && (
                        <span className="text-xs text-blue-600">Standalone</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add to Order - {formatCurrency(finalPrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 