import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Star, 
  ShoppingCart, 
  Plus, 
  Minus, 
  MapPin, 
  Truck, 
  Shield, 
  Award,
  Heart,
  Share2,
  Zap,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MarketplaceProduct, PricingTier } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/services/marketplaceService';
import { getBestPriceForQuantity } from '@/services/marketplaceService';
import toast from 'react-hot-toast';

interface ProductDetailPageProps {
  product: MarketplaceProduct;
  onAddToCart: (product: MarketplaceProduct, quantity: number) => void;
  onBack: () => void;
}

const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ 
  product, 
  onAddToCart, 
  onBack 
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(product.minimumOrderQuantity);
  const [selectedTier, setSelectedTier] = useState<PricingTier>(product.pricingTiers[0]);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Update pricing tier based on quantity
  useEffect(() => {
    const bestTier = getBestPriceForQuantity(product.pricingTiers, quantity);
    setSelectedTier(bestTier);
  }, [quantity, product.pricingTiers]);

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    toast.success(`Added ${quantity} ${product.unit} of ${product.name} to cart!`);
  };

  const handleQuantityChange = (newQuantity: number) => {
    const minQty = product.minimumOrderQuantity;
    const maxQty = product.maximumOrderQuantity || Infinity;
    
    if (newQuantity >= minQty && newQuantity <= maxQty) {
      setQuantity(newQuantity);
    }
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => 
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => 
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  const categoryInfo = MARKETPLACE_CATEGORIES.find(cat => cat.id === product.category);
  const totalPrice = selectedTier.pricePerUnit * quantity;
  const savings = product.pricingTiers[0].pricePerUnit * quantity - totalPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-600 hover:text-red-500">
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-600 hover:text-blue-500">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Desktop Back Button */}
        <button 
          onClick={onBack}
          className="hidden lg:flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Products</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-200">
              <div className="aspect-square relative">
                <img
                  src={product.images[selectedImageIndex] || '/api/placeholder/600/600'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Image Navigation */}
                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-md transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.tags.includes('featured') && (
                    <span className="bg-yellow-500 text-white px-3 py-1 text-sm font-medium rounded-full flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Featured
                    </span>
                  )}
                  {selectedTier.discountPercentage && (
                    <span className="bg-red-500 text-white px-3 py-1 text-sm font-medium rounded-full">
                      {selectedTier.discountPercentage}% OFF
                    </span>
                  )}
                  {product.qualityGrade && (
                    <span className="bg-green-500 text-white px-3 py-1 text-sm font-medium rounded-full flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      Grade {product.qualityGrade}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Image Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={image || '/api/placeholder/80/80'}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title and Category */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{categoryInfo?.icon}</span>
                <span className="text-sm text-gray-600 font-medium">
                  {categoryInfo?.name}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Supplier Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Supplied by</p>
                <p className="text-gray-600">{product.supplierName}</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  ${selectedTier.pricePerUnit.toFixed(2)}
                </span>
                <span className="text-lg text-gray-600">per {product.unit}</span>
                {selectedTier.discountPercentage && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md text-sm font-medium">
                    {selectedTier.discountPercentage}% off
                  </span>
                )}
              </div>

              {/* Bulk Pricing Tiers */}
              {product.pricingTiers.length > 1 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Bulk Pricing
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.pricingTiers.map((tier, index) => (
                      <div 
                        key={index}
                        className={`p-3 rounded-lg border text-sm ${
                          tier === selectedTier 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">
                          {tier.minQuantity}+ {product.unit}
                        </div>
                        <div className="text-lg font-bold">
                          ${tier.pricePerUnit.toFixed(2)}
                        </div>
                        {tier.discountPercentage && (
                          <div className="text-green-600 text-xs">
                            {tier.discountPercentage}% off
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Quantity
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= product.minimumOrderQuantity}
                      className="p-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || product.minimumOrderQuantity)}
                      min={product.minimumOrderQuantity}
                      max={product.maximumOrderQuantity}
                      className="w-20 px-3 py-3 text-center border-0 focus:ring-0"
                    />
                    <button
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={product.maximumOrderQuantity ? quantity >= product.maximumOrderQuantity : false}
                      className="p-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Min: {product.minimumOrderQuantity} {product.unit}</div>
                    {product.maximumOrderQuantity && (
                      <div>Max: {product.maximumOrderQuantity} {product.unit}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Price */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between text-lg">
                  <span className="font-medium">Total Price:</span>
                  <span className="font-bold text-2xl text-gray-900">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                {savings > 0 && (
                  <div className="text-green-600 text-sm mt-1">
                    You save ${savings.toFixed(2)} with bulk pricing!
                  </div>
                )}
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-3 font-medium text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={`w-full mt-3 py-3 rounded-xl border-2 font-medium transition-all ${
                  isWishlisted
                    ? 'border-red-500 text-red-500 bg-red-50'
                    : 'border-gray-300 text-gray-700 hover:border-red-500 hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 inline mr-2 ${isWishlisted ? 'fill-current' : ''}`} />
                {isWishlisted ? 'Added to Wishlist' : 'Add to Wishlist'}
              </button>
            </div>

            {/* Product Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                <Shield className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Quality Assured</p>
                  <p className="text-sm text-green-700">Verified supplier</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <Truck className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Fast Delivery</p>
                  <p className="text-sm text-blue-700">2-3 business days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Specifications */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Product Specifications</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200">
                {Object.entries(product.specifications).map(([key, value]) => (
                  value && (
                    <div key={key} className="px-6 py-4 flex justify-between">
                      <span className="font-medium text-gray-900 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-gray-600">{value}</span>
                    </div>
                  )
                ))}
                <div className="px-6 py-4 flex justify-between">
                  <span className="font-medium text-gray-900">Unit</span>
                  <span className="text-gray-600">{product.unit}</span>
                </div>
                <div className="px-6 py-4 flex justify-between">
                  <span className="font-medium text-gray-900">Minimum Order</span>
                  <span className="text-gray-600">{product.minimumOrderQuantity} {product.unit}</span>
                </div>
                {product.maximumOrderQuantity && (
                  <div className="px-6 py-4 flex justify-between">
                    <span className="font-medium text-gray-900">Maximum Order</span>
                    <span className="text-gray-600">{product.maximumOrderQuantity} {product.unit}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Certifications & Tags */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Certifications & Tags</h3>
            <div className="space-y-4">
              {product.certifications.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Certifications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {product.certifications.map((cert, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-3">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Availability Status */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-3">Availability</h4>
                <div className={`flex items-center gap-2 ${
                  product.isAvailable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {product.isAvailable ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {product.isAvailable ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                {product.stockQuantity && (
                  <p className="text-sm text-gray-600 mt-2">
                    {product.stockQuantity} {product.unit} available
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
