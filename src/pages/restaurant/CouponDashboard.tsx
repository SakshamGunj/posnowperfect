import { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { 
  Gift, 
  Plus, 
  Download,
  TrendingUp,
  Users,
  Percent,
  DollarSign,
  BarChart3,
  CheckCircle,
  Clock,
  X,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CouponService } from '@/services/couponService';
import { GamificationIntegrationService } from '@/services/gamificationIntegrationService';
import { CouponType, CustomerSegment, PaymentMethodRestriction, Coupon } from '@/types/coupon';

export default function CouponDashboard() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  
  // Gamification coupon search and redeem states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showGamificationSection, setShowGamificationSection] = useState(false);
  const [redeemingCoupon, setRedeemingCoupon] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    type: 'percentage_discount' as CouponType,
    value: 0,
    startDate: '',
    endDate: '',
    usageLimit: '',
    perCustomerLimit: '',
    validDays: [] as string[],
    validHours: { start: '00:00', end: '23:59' },
    customerSegments: [] as string[],
    minimumOrderValue: '',
    applicableCategories: [] as string[],
    excludedCategories: [] as string[],
    paymentMethods: 'all' as PaymentMethodRestriction,
    buyQuantity: 2,
    getQuantity: 1,
    buyCategories: [] as string[],
    getCategories: [] as string[],
    getDiscount: 100,
    terms: ''
  });

  // Sample data for dropdowns
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Fetch coupons on component mount
  useEffect(() => {
    const fetchCoupons = async () => {
      if (!restaurant?.id) {
        console.log('No restaurant ID available');
        return;
      }
      
      try {
        console.log('Fetching coupons for restaurant:', restaurant.id);
        setLoadingCoupons(true);
        const response = await CouponService.getCouponsForRestaurant(restaurant.id);
        console.log('Fetch coupons response:', response);
        
        if (response.success && response.data) {
          console.log('Found coupons:', response.data);
          setCoupons(response.data);
        } else {
          console.error('Failed to fetch coupons:', response.error);
        }
      } catch (error) {
        console.error('Error fetching coupons:', error);
        toast.error('Failed to load coupons');
      } finally {
        setLoadingCoupons(false);
      }
    };

    fetchCoupons();
  }, [restaurant?.id]);
  
  // Gamification coupon handlers
  const handleSearchGamificationCoupons = async () => {
    if (!restaurant?.id) return;
    
    setIsSearching(true);
    try {
      const result = await GamificationIntegrationService.searchGamificationCoupons(
        restaurant.id,
        searchTerm
      );
      
      if (result.success && result.data) {
        setSearchResults(result.data);
        if (result.data.length === 0 && searchTerm) {
          toast.success('No coupons found');
        }
      } else {
        toast.error(result.error || 'Failed to search coupons');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching coupons:', error);
      toast.error('Failed to search coupons');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRedeemCoupon = async (couponCode: string) => {
    if (!restaurant?.id) return;
    
    setRedeemingCoupon(couponCode);
    try {
      const result = await GamificationIntegrationService.redeemGamificationCoupon(
        restaurant.id,
        couponCode
      );
      
      if (result.success) {
        toast.success(result.message || 'Coupon redeemed successfully!');
        // Refresh search results
        handleSearchGamificationCoupons();
      } else {
        toast.error(result.error || 'Failed to redeem coupon');
      }
    } catch (error) {
      console.error('Error redeeming coupon:', error);
      toast.error('Failed to redeem coupon');
    } finally {
      setRedeemingCoupon(null);
    }
  };
  
  // Form handlers
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant?.id) return;
    
    setLoading(true);
    try {
      // Validate required fields
      if (!formData.name || !formData.description || !formData.code) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      // Create coupon object that matches the Coupon type exactly
      const couponData = {
        restaurantId: restaurant.id, // Add the missing restaurantId
        name: formData.name,
        description: formData.description,
        code: formData.code,
        type: formData.type,
        status: 'active' as const,
        validity: {
          startDate: formData.startDate ? new Date(formData.startDate) : new Date(),
          endDate: formData.endDate ? new Date(formData.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          validDays: formData.validDays.length > 0 ? formData.validDays : daysOfWeek,
          ...(formData.usageLimit && { usageLimit: parseInt(formData.usageLimit) }),
          ...(formData.perCustomerLimit && { perCustomerLimit: parseInt(formData.perCustomerLimit) })
        },
        targeting: {
          customerSegments: ['all' as CustomerSegment],
          ...(formData.minimumOrderValue && { minOrderValue: parseFloat(formData.minimumOrderValue) }),
          applicableMenuItems: [],
          excludedMenuItems: [],
          applicableCategories: formData.applicableCategories,
          excludedCategories: formData.excludedCategories,
          paymentMethodRestriction: formData.paymentMethods as PaymentMethodRestriction
        },
        config: formData.type === 'percentage_discount' ? {
          percentage: formData.value
        } : formData.type === 'fixed_amount' ? {
          discountAmount: formData.value,
          ...(formData.minimumOrderValue && { minimumOrderValue: parseFloat(formData.minimumOrderValue) })
        } : formData.type === 'buy_x_get_y' ? {
          buyXGetY: {
          buyQuantity: formData.buyQuantity,
          getQuantity: formData.getQuantity,
            getDiscountPercentage: formData.getDiscount
          }
        } : {},
        termsAndConditions: formData.terms || '',
        createdBy: 'admin'
      } as any; // Temporarily bypass TypeScript to test functionality
      
      // Debug: Log the coupon data being sent
      console.log('Creating coupon with data:', couponData);
      console.log('Restaurant ID:', restaurant.id);
      
      // Actually save the coupon to the database
      const response = await CouponService.createCoupon(restaurant.id, couponData);
      
      console.log('Create coupon response:', response);
      
      if (response.success && response.data) {
        // Add the new coupon to the local state
        setCoupons(prev => [response.data!, ...prev]);
      toast.success(`Coupon "${formData.name}" created successfully!`);
      } else {
        console.error('Failed to create coupon:', response.error);
        throw new Error(response.error || 'Failed to create coupon');
      }
      
      // Reset form and close modals
      setFormData({
        name: '',
        description: '',
        code: '',
        type: 'percentage_discount',
        value: 0,
        startDate: '',
        endDate: '',
        usageLimit: '',
        perCustomerLimit: '',
        validDays: [],
        validHours: { start: '00:00', end: '23:59' },
        customerSegments: [],
        minimumOrderValue: '',
        applicableCategories: [],
        excludedCategories: [],
        paymentMethods: 'all',
        buyQuantity: 2,
        getQuantity: 1,
        buyCategories: [],
        getCategories: [],
        getDiscount: 100,
        terms: ''
      });
      setShowCustomForm(false);
      setShowCreateModal(false);
      
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error('Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  if (!restaurant) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Gift className="w-8 h-8 mr-3 text-pink-600" />
                Coupon Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your restaurant's promotional campaigns and track performance
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                className="btn btn-outline flex items-center"
                onClick={() => setShowGamificationSection(!showGamificationSection)}
              >
                <Target className="w-4 h-4 mr-2" />
                {showGamificationSection ? 'Hide' : 'Show'} Spin Wheel Coupons
              </button>
              <button 
                className="btn btn-outline flex items-center"
                onClick={() => toast.success('Export functionality coming soon!')}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <button 
                className="btn btn-theme-primary flex items-center"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Coupons</p>
                <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Gift className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Coupons</p>
                <p className="text-2xl font-bold text-gray-900">{coupons.filter(c => c.status === 'active').length}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Usage</p>
                <p className="text-2xl font-bold text-gray-900">{coupons.reduce((sum, c) => sum + c.usageCount, 0)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-gray-900">{coupons.filter(c => c.status === 'expired').length}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Savings</p>
                <p className="text-2xl font-bold text-gray-900">₹0</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Draft Coupons</p>
                <p className="text-2xl font-bold text-gray-900">{coupons.filter(c => c.status === 'draft').length}</p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Gamification Coupons Section */}
        {showGamificationSection && (
          <div className="card p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-purple-600" />
                  Spin Wheel Coupons
                </h2>
                <p className="text-gray-600 text-sm">Search and redeem coupons generated from spin wheel game</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by coupon code, customer name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchGamificationCoupons()}
                />
              </div>
              <button
                onClick={handleSearchGamificationCoupons}
                disabled={isSearching}
                className="btn btn-theme-primary flex items-center"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </button>
              
                              <button
                  onClick={() => {
                    setSearchTerm('');
                    handleSearchGamificationCoupons();
                  }}
                  disabled={isSearching}
                  className="btn btn-outline flex items-center"
                >
                  Show All
                </button>
                
                <button
                  onClick={async () => {
                    if (!restaurant?.id) return;
                    
                    // Create a test gamification coupon
                    const testCoupon = {
                      name: 'Test Spin Wheel Reward',
                      description: 'Test reward from spin wheel game: 10% off. Winner: Test User (1234567890)',
                      code: 'TEST' + Date.now().toString().slice(-4),
                      type: 'percentage_discount' as const,
                      status: 'active' as const,
                      createdBy: user?.id || 'test-user',
                      restaurantId: restaurant.id,
                      termsAndConditions: 'Valid for one-time use only. Cannot be combined with other offers.',
                      validity: {
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        usageLimit: 1,
                        perCustomerLimit: 1,
                        validDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                      },
                      targeting: {
                        customerSegments: ['all' as const],
                        minOrderValue: 0,
                        applicableCategories: [],
                        excludedCategories: [],
                        paymentMethodRestriction: 'all' as const
                      },
                      config: {
                        percentage: 10,
                        maxDiscountAmount: 500
                      },
                      metadata: {
                        source: 'gamification_spin_wheel',
                        spinRecordId: 'test-spin-123',
                        userId: 'test-user-123',
                        userName: 'Test User',
                        userPhone: '1234567890',
                        spinDate: new Date(),
                        segmentId: 'test-segment',
                        segmentColor: '#ff0000'
                      }
                    };
                    
                    try {
                      const result = await CouponService.createCoupon(restaurant.id, testCoupon);
                      if (result.success) {
                        toast.success('Test coupon created successfully!');
                        handleSearchGamificationCoupons();
                      } else {
                        toast.error('Failed to create test coupon: ' + result.error);
                      }
                    } catch (error) {
                      console.error('Error creating test coupon:', error);
                      toast.error('Error creating test coupon');
                    }
                  }}
                  className="btn btn-secondary flex items-center"
                >
                  🧪 Create Test Coupon
                </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Search Results ({searchResults.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((coupon) => (
                    <div key={coupon.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{coupon.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{coupon.description}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          coupon.usageCount > 0 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {coupon.usageCount > 0 ? 'Used' : 'Available'}
                        </span>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Coupon Code:</span>
                          <code className="bg-white px-2 py-1 rounded text-sm font-mono border">
                            {coupon.code}
                  </code>
                </div>
              </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Customer:</span>
                          <span className="font-medium">{coupon.metadata?.userName}</span>
                </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{coupon.metadata?.userPhone}</span>
                </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Spin Date:</span>
                          <span className="font-medium">
                            {coupon.metadata?.spinDate ? new Date(coupon.metadata.spinDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Expires:</span>
                          <span className="font-medium">
                            {new Date(coupon.validity.endDate).toLocaleDateString()}
                          </span>
              </div>
            </div>

                      <button
                        onClick={() => handleRedeemCoupon(coupon.code)}
                        disabled={coupon.usageCount > 0 || redeemingCoupon === coupon.code}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                          coupon.usageCount > 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {redeemingCoupon === coupon.code ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Redeeming...
              </div>
                        ) : coupon.usageCount > 0 ? (
                          'Already Redeemed'
                        ) : (
                          'Redeem Coupon'
                        )}
                      </button>
                </div>
                  ))}
              </div>
                </div>
            ) : searchTerm && !isSearching ? (
              <div className="text-center py-8">
                <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons found</h3>
                <p className="text-gray-500">Try searching with a different coupon code, name, or phone number.</p>
                </div>
            ) : (
              <div className="text-center py-8">
                <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Search for Spin Wheel Coupons</h3>
                <p className="text-gray-500">Enter a coupon code, customer name, or phone number to find and redeem spin wheel coupons.</p>
              </div>
            )}
            </div>
        )}

        {/* Your Coupons */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Coupons</h2>
          
          {loadingCoupons ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading coupons...</span>
              </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons yet</h3>
              <p className="text-gray-500 mb-4">Create your first coupon to start offering promotions to your customers.</p>
              <button 
                className="btn btn-theme-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Coupon
              </button>
                </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coupons.map((coupon, index) => {
                const getColorByIndex = (index: number) => {
                  const colors = [
                    'from-pink-500 to-pink-600',
                    'from-blue-500 to-blue-600', 
                    'from-green-500 to-green-600',
                    'from-purple-500 to-purple-600',
                    'from-orange-500 to-orange-600',
                    'from-indigo-500 to-indigo-600'
                  ];
                  return colors[index % colors.length];
                };

                const getIconByType = (type: CouponType) => {
                  switch(type) {
                    case 'percentage_discount': return <Percent className="w-8 h-8" />;
                    case 'fixed_amount': return <DollarSign className="w-8 h-8" />;
                    case 'buy_x_get_y': return <Gift className="w-8 h-8" />;
                    default: return <Gift className="w-8 h-8" />;
                  }
                };

                const getStatusColor = (status: string) => {
                  switch(status) {
                    case 'active': return 'bg-green-500/20 text-green-100';
                    case 'draft': return 'bg-yellow-500/20 text-yellow-100';
                    case 'expired': return 'bg-red-500/20 text-red-100';
                    case 'paused': return 'bg-gray-500/20 text-gray-100';
                    default: return 'bg-white/20 text-white';
                  }
                };

                const usageLimit = coupon.validity?.usageLimit || 0;
                const usagePercentage = usageLimit > 0 ? (coupon.usageCount / usageLimit) * 100 : 0;

                return (
                  <div key={coupon.id} className={`bg-gradient-to-r ${getColorByIndex(index)} rounded-xl p-6 text-white`}>
              <div className="flex items-center justify-between mb-4">
                      {getIconByType(coupon.type)}
                      <span className={`px-2 py-1 rounded-full text-sm ${getStatusColor(coupon.status)}`}>
                        {coupon.status.charAt(0).toUpperCase() + coupon.status.slice(1)}
                      </span>
              </div>
                    <h3 className="text-xl font-bold mb-2">{coupon.name}</h3>
                    <p className="opacity-90 mb-4">{coupon.description}</p>
              <div className="bg-white/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Code:</span>
                        <code className="bg-white text-gray-800 px-2 py-1 rounded text-sm font-mono">
                          {coupon.code}
                  </code>
                </div>
              </div>
                    {usageLimit > 0 && (
              <div className="mt-4 text-sm">
                <div className="flex justify-between">
                          <span>Used: {coupon.usageCount}/{usageLimit}</span>
                          <span>{Math.round(usagePercentage)}% usage</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                          <div className="bg-white h-2 rounded-full" style={{ width: `${Math.min(usagePercentage, 100)}%` }}></div>
                </div>
              </div>
                    )}
            </div>
                );
              })}
          </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">
              🎉 Coupon Dashboard is now live! Features include:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-4">
                <Percent className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Percentage Discounts</p>
                <p className="text-gray-500 text-xs">10%, 20%, 50% off</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="font-medium">Fixed Amount Off</p>
                <p className="text-gray-500 text-xs">₹50, ₹100, ₹200 off</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <Gift className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="font-medium">BOGO Deals</p>
                <p className="text-gray-500 text-xs">Buy X Get Y Free</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <BarChart3 className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <p className="font-medium">Smart Analytics</p>
                <p className="text-gray-500 text-xs">Usage tracking & insights</p>
              </div>
            </div>
          </div>
        </div>

        {/* Create Coupon Modal */}
        {showCreateModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto"
            onClick={() => setShowCreateModal(false)}
          >
            <div className="min-h-full flex items-center justify-center p-4">
              <div 
                className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                      <Plus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Create New Coupon</h3>
                      <p className="text-sm text-gray-500">Set up a promotional offer for your customers</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                  {/* Quick Templates */}
                  {!showCustomForm && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Templates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      onClick={() => {
                            setFormData({
                              ...formData,
                              name: '20% Welcome Discount',
                              description: 'Get 20% off on your first order',
                              type: 'percentage_discount',
                              value: 20,
                              code: 'WELCOME20'
                            });
                            setShowCustomForm(true);
                      }}
                    >
                      <div className="flex items-center mb-2">
                        <Percent className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="font-medium">Welcome Discount</span>
                      </div>
                      <p className="text-sm text-gray-600">20% off for new customers</p>
                          <div className="mt-2 text-xs text-blue-600">Click to customize</div>
                    </button>

                    <button 
                      className="text-left p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                      onClick={() => {
                            setFormData({
                              ...formData,
                              name: 'Fixed ₹100 Off',
                              description: 'Get ₹100 off on orders above ₹500',
                              type: 'fixed_amount',
                              value: 100,
                              code: 'SAVE100',
                              minimumOrderValue: '500'
                            });
                            setShowCustomForm(true);
                      }}
                    >
                      <div className="flex items-center mb-2">
                        <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                        <span className="font-medium">Fixed Amount Off</span>
                      </div>
                      <p className="text-sm text-gray-600">₹100 off on orders above ₹500</p>
                          <div className="mt-2 text-xs text-green-600">Click to customize</div>
                    </button>

                    <button 
                      className="text-left p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                      onClick={() => {
                            setFormData({
                              ...formData,
                              name: 'Buy 1 Get 1 Free',
                              description: 'Free item on qualifying purchase',
                              type: 'buy_x_get_y',
                              value: 0,
                              code: 'BUY1GET1',
                              buyQuantity: 1,
                              getQuantity: 1
                            });
                            setShowCustomForm(true);
                      }}
                    >
                      <div className="flex items-center mb-2">
                        <Gift className="w-5 h-5 text-purple-600 mr-2" />
                        <span className="font-medium">Buy 1 Get 1 Free</span>
                      </div>
                      <p className="text-sm text-gray-600">Free item on qualifying purchase</p>
                          <div className="mt-2 text-xs text-purple-600">Click to customize</div>
                    </button>

                    <button 
                      className="text-left p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
                          onClick={() => setShowCustomForm(true)}
                    >
                      <div className="flex items-center mb-2">
                            <Target className="w-5 h-5 text-orange-600 mr-2" />
                        <span className="font-medium">Custom Coupon</span>
                      </div>
                          <p className="text-sm text-gray-600">Create from scratch with all options</p>
                          <div className="mt-2 text-xs text-orange-600">Full customization</div>
                    </button>
            </div>
          </div>
        )}

                  {/* Custom Form */}
        {showCustomForm && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Basic Information */}
                        <div className="space-y-4">
                        <h5 className="text-md font-medium text-gray-900">Basic Information</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Coupon Name *
                            </label>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="e.g., Welcome Discount"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Coupon Code *
                            </label>
                            <div className="flex">
                              <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="WELCOME20"
                                required
                              />
                              <button
                                type="button"
                                onClick={generateCouponCode}
                                className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 text-sm"
                              >
                                Generate
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description *
                          </label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                            placeholder="Brief description of the offer"
                            required
                          />
                      </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Discount Type
                            </label>
                            <select
                              value={formData.type}
                              onChange={(e) => handleInputChange('type', e.target.value as CouponType)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="percentage_discount">Percentage Discount</option>
                              <option value="fixed_amount">Fixed Amount Off</option>
                              <option value="buy_x_get_y">Buy X Get Y</option>
                            </select>
                          </div>
                          
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                              {formData.type === 'percentage_discount' ? 'Percentage (%)' : 
                               formData.type === 'fixed_amount' ? 'Amount (₹)' : 'Value'}
                              </label>
                              <input
                                type="number"
                                value={formData.value}
                                onChange={(e) => handleInputChange('value', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                min="0"
                              max={formData.type === 'percentage_discount' ? 100 : undefined}
                              />
                            </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                    <button 
                      type="button"
                          onClick={() => {
                            setShowCustomForm(false);
                            setShowCreateModal(false);
                          }}
                          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {loading ? (
                        <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Creating...
                        </>
                      ) : (
                            'Create Coupon'
                      )}
                    </button>
                 </div>
               </form>
                  )}
                </div>
               </div>
             </div>
           </div>
         )}
      </main>
    </div>
  );
}