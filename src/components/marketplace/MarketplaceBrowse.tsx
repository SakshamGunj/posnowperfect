import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Star,
  MapPin,
  Package2,
  Truck,
  DollarSign
} from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { 
  getProducts, 
  getFeaturedProducts, 
  getRecommendedProducts, 
  MARKETPLACE_CATEGORIES 
} from '@/services/marketplaceService';
import { 
  MarketplaceProduct, 
  MarketplaceCategory, 
  MarketplaceCartItem 
} from '@/types';
import { seedMarketplaceData } from '@/services/marketplaceSeedService';
import ProductDetailPage from './ProductDetailPage';
import toast from 'react-hot-toast';

interface MarketplaceBrowseProps {
  onCartUpdate: (cartItems: MarketplaceCartItem[]) => void;
}

type ViewState = 'browse' | 'product-detail';

interface BrowseState {
  view: ViewState;
  selectedProduct?: MarketplaceProduct;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'price' | 'rating' | 'newest';

const MarketplaceBrowse: React.FC<MarketplaceBrowseProps> = ({ onCartUpdate }) => {
  const { restaurant } = useRestaurant();
  
  // State management
  const [browseState, setBrowseState] = useState<BrowseState>({ view: 'browse' });
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'all' | 'featured' | 'recommended'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [cart, setCart] = useState<MarketplaceCartItem[]>([]);
  
  // Filter states
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showInStockOnly, setShowInStockOnly] = useState(true);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (!restaurant) return;
      
      try {
        setLoading(true);
        
        // Load all data in parallel
        const [allProducts, featured, recommended] = await Promise.all([
          getProducts({ isAvailable: true, sortBy }),
          getFeaturedProducts(8),
          getRecommendedProducts(restaurant.id)
        ]);
        
        setProducts(allProducts);
        setFeaturedProducts(featured);
        setRecommendedProducts(recommended);
        
      } catch (error) {
        console.error('Error loading marketplace data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [restaurant, sortBy]);

  // Filter and search products
  const filteredProducts = React.useMemo(() => {
    let result = products;
    
    // Category filtering
    if (selectedCategory !== 'all' && selectedCategory !== 'featured' && selectedCategory !== 'recommended') {
      result = result.filter(product => product.category === selectedCategory);
    }
    
    // Search filtering
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        product.supplierName.toLowerCase().includes(searchLower)
      );
    }
    
    // Price range filtering
    result = result.filter(product => {
      const minPrice = product.pricingTiers[0]?.pricePerUnit || 0;
      return minPrice >= priceRange[0] && minPrice <= priceRange[1];
    });
    
    // Stock filtering
    if (showInStockOnly) {
      result = result.filter(product => product.isAvailable);
    }
    
    // Supplier filtering
    if (selectedSuppliers.length > 0) {
      result = result.filter(product => selectedSuppliers.includes(product.supplierId));
    }
    
    return result;
  }, [products, selectedCategory, searchTerm, priceRange, showInStockOnly, selectedSuppliers]);

  // Display products based on selected category
  const displayProducts = React.useMemo(() => {
    switch (selectedCategory) {
      case 'featured':
        return featuredProducts;
      case 'recommended':
        return recommendedProducts;
      default:
        return filteredProducts;
    }
  }, [selectedCategory, filteredProducts, featuredProducts, recommendedProducts]);

  // Navigation functions
  const openProductDetail = (product: MarketplaceProduct) => {
    setBrowseState({ view: 'product-detail', selectedProduct: product });
  };

  const closeProductDetail = () => {
    setBrowseState({ view: 'browse' });
  };

  // Add to cart function
  const addToCart = (product: MarketplaceProduct, quantity: number = 1) => {
    const existingItemIndex = cart.findIndex(item => item.productId === product.id);
    const bestTier = product.pricingTiers.find(tier => 
      quantity >= tier.minQuantity && (!tier.maxQuantity || quantity <= tier.maxQuantity)
    ) || product.pricingTiers[0];
    
    const newCartItem: MarketplaceCartItem = {
      productId: product.id,
      product,
      quantity,
      selectedTier: bestTier,
      unitPrice: bestTier.pricePerUnit,
      totalPrice: bestTier.pricePerUnit * quantity
    };
    
    let updatedCart: MarketplaceCartItem[];
    
    if (existingItemIndex >= 0) {
      updatedCart = [...cart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: updatedCart[existingItemIndex].quantity + quantity,
        totalPrice: (updatedCart[existingItemIndex].quantity + quantity) * bestTier.pricePerUnit
      };
    } else {
      updatedCart = [...cart, newCartItem];
    }
    
    setCart(updatedCart);
    onCartUpdate(updatedCart);
  };

  // Handle seed data
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const result = await seedMarketplaceData();
      
      if (result.success) {
        toast.success(result.message);
        // Reload data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error seeding marketplace data:', error);
      toast.error('Failed to seed marketplace data');
    } finally {
      setIsSeeding(false);
    }
  };

  // Product card component
  const ProductCard: React.FC<{ product: MarketplaceProduct; view: ViewMode }> = ({ product, view }) => {
    const [quantity, setQuantity] = useState(product.minimumOrderQuantity);
    const bestTier = product.pricingTiers.find(tier => 
      quantity >= tier.minQuantity && (!tier.maxQuantity || quantity <= tier.maxQuantity)
    ) || product.pricingTiers[0];

    if (view === 'list') {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div 
              className="cursor-pointer group"
              onClick={() => openProductDetail(product)}
            >
              <img
                src={product.images[0] || '/api/placeholder/80/80'}
                alt={product.name}
                className="w-full sm:w-20 h-48 sm:h-20 object-cover rounded-lg group-hover:opacity-80 transition-opacity"
              />
            </div>
            
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1" onClick={() => openProductDetail(product)}>
                  <h3 className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {MARKETPLACE_CATEGORIES.find(cat => cat.id === product.category)?.name}
                    </span>
                    <span className="flex items-center text-sm text-gray-500">
                      <MapPin className="w-3 h-3 mr-1" />
                      {product.supplierName}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${bestTier.pricePerUnit.toFixed(2)}
                      <span className="text-sm font-normal text-gray-500">/{product.unit}</span>
                    </div>
                    {bestTier.discountPercentage && (
                      <span className="text-sm text-green-600">
                        {bestTier.discountPercentage}% off bulk
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuantity(Math.max(product.minimumOrderQuantity, quantity - 1));
                        }}
                        className="p-1 rounded-md border border-gray-300 hover:bg-gray-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center">{quantity}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuantity(quantity + 1);
                        }}
                        className="p-1 rounded-md border border-gray-300 hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-500 hidden sm:block">
                        Min: {product.minimumOrderQuantity}
                      </span>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product, quantity);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
        <div className="aspect-w-1 aspect-h-1 w-full relative">
          <div 
            className="cursor-pointer h-48 sm:h-56 lg:h-48"
            onClick={() => openProductDetail(product)}
          >
            <img
              src={product.images[0] || '/api/placeholder/300/300'}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.tags.includes('featured') && (
              <span className="bg-yellow-500 text-white px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1">
                <Star className="w-3 h-3" />
                <span className="hidden sm:inline">Featured</span>
              </span>
            )}
            {product.tags.includes('trending') && (
              <span className="bg-green-500 text-white px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span className="hidden sm:inline">Trending</span>
              </span>
            )}
            {bestTier.discountPercentage && (
              <span className="bg-red-500 text-white px-2 py-1 text-xs font-medium rounded-full">
                {bestTier.discountPercentage}% OFF
              </span>
            )}
          </div>
          
          {/* Quick actions */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openProductDetail(product);
              }}
              className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
              title="View Details"
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
              title="Add to Wishlist"
            >
              <Heart className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        
        <div className="p-3 sm:p-4">
          <div 
            className="cursor-pointer"
            onClick={() => openProductDetail(product)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors text-sm sm:text-base">
                {product.name}
              </h3>
              <span className="text-xs text-gray-500 ml-2 hidden sm:block">
                {MARKETPLACE_CATEGORIES.find(cat => cat.id === product.category)?.icon}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{product.supplierName}</span>
              </span>
              
              {product.qualityGrade && (
                <span className="flex items-center gap-1 text-sm">
                  <Award className="w-3 h-3 text-yellow-500" />
                  <span className="hidden sm:inline">Grade </span>{product.qualityGrade}
                </span>
              )}
            </div>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-bold text-gray-900">
                  ${bestTier.pricePerUnit.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">/{product.unit}</span>
              </div>
              
              {product.pricingTiers.length > 1 && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span className="hidden sm:inline">Bulk discounts</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQuantity(Math.max(product.minimumOrderQuantity, quantity - 1));
                }}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <span className="w-8 sm:w-12 text-center text-sm">{quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQuantity(quantity + 1);
                }}
                className="p-1 rounded-md border border-gray-300 hover:bg-gray-50"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product, quantity);
              }}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
              Add to Cart
            </button>
            
            <div className="text-xs text-gray-500 mt-2 text-center">
              Min: {product.minimumOrderQuantity} {product.unit}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Show product detail page if a product is selected
  if (browseState.view === 'product-detail' && browseState.selectedProduct) {
    return (
      <ProductDetailPage
        product={browseState.selectedProduct}
        onAddToCart={addToCart}
        onBack={closeProductDetail}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading products...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Enhanced Search and Filters Bar */}
      <div className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Enhanced Search */}
          <div className="flex-1 relative group">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
            <input
              type="text"
              placeholder="Search products, suppliers, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/60 backdrop-blur-sm text-gray-700 placeholder-gray-500 shadow-sm transition-all duration-200 text-sm sm:text-base"
            />
            <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
          </div>
          
          {/* Enhanced Controls */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border rounded-lg sm:rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base ${
                showFilters 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="font-medium hidden sm:inline">Filters</span>
            </button>
            
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 sm:px-4 py-2 sm:py-3 pr-8 sm:pr-10 border border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/60 backdrop-blur-sm text-gray-700 shadow-sm appearance-none cursor-pointer text-sm sm:text-base"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name A-Z</option>
                <option value="price">Price Low-High</option>
                <option value="rating">Highest Rated</option>
              </select>
              <TrendingUp className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 pointer-events-none" />
            </div>
            
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 sm:p-3 transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 sm:p-3 transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Categories */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/20 shadow-lg p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
          <Store className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          Product Categories
        </h3>
        
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-md hover:scale-105 border border-gray-200'
            }`}
          >
            All Products
          </button>
          
          <button
            onClick={() => setSelectedCategory('featured')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 ${
              selectedCategory === 'featured'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg transform scale-105'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:shadow-md hover:scale-105 border border-yellow-200'
            }`}
          >
            <Star className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Featured</span>
          </button>
          
          <button
            onClick={() => setSelectedCategory('recommended')}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 ${
              selectedCategory === 'recommended'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg transform scale-105'
                : 'bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-md hover:scale-105 border border-green-200'
            }`}
          >
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Recommended</span>
          </button>
          
          {MARKETPLACE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 ${
                selectedCategory === category.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                  : 'bg-white/60 text-gray-700 hover:bg-white hover:shadow-md hover:scale-105 border border-gray-200'
              }`}
            >
              <span className="text-sm sm:text-lg">{category.icon}</span>
              <span className="hidden sm:inline">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Results */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/20 shadow-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              {selectedCategory === 'all' && 'All Products'}
              {selectedCategory === 'featured' && 'Featured Products'}
              {selectedCategory === 'recommended' && 'Recommended for You'}
              {typeof selectedCategory === 'string' && selectedCategory !== 'all' && selectedCategory !== 'featured' && selectedCategory !== 'recommended' && 
                MARKETPLACE_CATEGORIES.find(cat => cat.id === selectedCategory)?.name
              }
              <span className="text-xs sm:text-sm font-normal text-gray-500 block">
                {displayProducts.length} product{displayProducts.length !== 1 ? 's' : ''} available
              </span>
            </div>
          </h2>
        </div>

        {displayProducts.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl sm:rounded-2xl p-8 sm:p-12 max-w-lg mx-auto border border-gray-100">
              <div className="text-gray-400 mb-6">
                <Search className="w-16 h-16 sm:w-20 sm:h-20 mx-auto" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">No products found</h3>
              
              {products.length === 0 ? (
                <div className="space-y-6">
                  <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
                    The marketplace is empty. Load sample data to get started with testing the ordering functionality.
                  </p>
                  <button
                    onClick={handleSeedData}
                    disabled={isSeeding}
                    className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base"
                  >
                    {isSeeding ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                    {isSeeding ? 'Loading Sample Data...' : 'Load Sample Data'}
                  </button>
                  <p className="text-xs sm:text-sm text-gray-500">
                    This will create 5 suppliers and 15+ products for testing
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 text-base sm:text-lg">Try adjusting your search or filters</p>
              )}
            </div>
          </div>
        ) : (
          <div className={`grid gap-4 sm:gap-6 lg:gap-8 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} view={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceBrowse; 