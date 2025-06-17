import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Building2,
  Shield,
  Plus,
  LogOut,
  Search,
  Store,
  Power,
  PowerOff,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Copy,
  ExternalLink,
} from 'lucide-react';

import { AdminService } from '@/services/adminService';
import { RestaurantService } from '@/services/restaurantService';
import { Restaurant, BusinessType, CreateRestaurantRequest, RestaurantCredentials } from '@/types';
import { getBusinessTypeDisplayName, formatDate } from '@/lib/utils';

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | BusinessType>('all');
  const [showCredentials, setShowCredentials] = useState<RestaurantCredentials | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CreateRestaurantRequest>({
    mode: 'onChange',
  });

  // Load restaurants
  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      console.log('🔍 Loading restaurants for admin dashboard...');
      const result = await RestaurantService.getAllRestaurantsForAdmin();
      console.log('📊 Load restaurants result:', result);
      
      if (result.success && result.data) {
        console.log('✅ Successfully loaded restaurants:', result.data.length);
        setRestaurants(result.data);
      } else {
        console.error('❌ Failed to load restaurants:', result.error);
        toast.error(result.error || 'Failed to load restaurants');
      }
    } catch (error) {
      console.error('❌ Exception loading restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRestaurant = async (data: CreateRestaurantRequest) => {
    try {
      const result = await RestaurantService.createRestaurantByAdmin(data);
      
      if (result.success && result.data) {
        toast.success('Restaurant created successfully!');
        setShowCredentials(result.data);
        setShowCreateModal(false);
        reset();
        loadRestaurants();
      } else {
        toast.error(result.error || 'Failed to create restaurant');
      }
    } catch (error) {
      toast.error('Failed to create restaurant');
    }
  };

  const handleToggleStatus = async (restaurant: Restaurant) => {
    try {
      const result = await RestaurantService.toggleRestaurantStatus(
        restaurant.id,
        !restaurant.isActive
      );
      
      if (result.success) {
        toast.success(`Restaurant ${!restaurant.isActive ? 'activated' : 'deactivated'}`);
        loadRestaurants();
      } else {
        toast.error(result.error || 'Failed to update restaurant');
      }
    } catch (error) {
      toast.error('Failed to update restaurant');
    }
  };

  const handleLogout = async () => {
    try {
      await AdminService.logoutAdmin();
      window.location.href = '/admin/login';
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         restaurant.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || restaurant.businessType === filterType;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: restaurants.length,
    active: restaurants.filter(r => r.isActive).length,
    inactive: restaurants.filter(r => !r.isActive).length,
    restaurants: restaurants.filter(r => r.businessType === 'restaurant').length,
    cafes: restaurants.filter(r => r.businessType === 'cafe').length,
    bars: restaurants.filter(r => r.businessType === 'bar').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-sm text-gray-500">TenVerse POS Management</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2 inline" />
                New Restaurant
              </button>
              
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Restaurants</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-3xl font-bold text-red-600">{stats.inactive}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Business Types</p>
                <p className="text-xl font-bold text-gray-900">
                  {stats.restaurants}R • {stats.cafes}C • {stats.bars}B
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="restaurant">Restaurants</option>
              <option value="cafe">Cafés</option>
              <option value="bar">Bars</option>
            </select>
          </div>
        </div>

        {/* Restaurants List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading restaurants...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No restaurants found</h3>
              <p className="text-gray-600">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Create your first restaurant to get started.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Restaurant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                            restaurant.businessType === 'restaurant' ? 'bg-green-100' :
                            restaurant.businessType === 'cafe' ? 'bg-yellow-100' : 'bg-purple-100'
                          }`}>
                            <Store className={`w-5 h-5 ${
                              restaurant.businessType === 'restaurant' ? 'text-green-600' :
                              restaurant.businessType === 'cafe' ? 'text-yellow-600' : 'text-purple-600'
                            }`} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{restaurant.name}</div>
                            <div className="text-sm text-gray-500">/{restaurant.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          restaurant.businessType === 'restaurant' ? 'bg-green-100 text-green-800' :
                          restaurant.businessType === 'cafe' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {getBusinessTypeDisplayName(restaurant.businessType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          restaurant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {restaurant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(restaurant.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => window.open(`/${restaurant.slug}`, '_blank')}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="View Restaurant"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/${restaurant.slug}`)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                            title="Copy URL"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(restaurant)}
                            className={`p-1 rounded hover:bg-gray-50 ${
                              restaurant.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                            }`}
                            title={restaurant.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {restaurant.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Restaurant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Restaurant</h2>
              <p className="text-gray-600">Set up a new POS system for a restaurant</p>
            </div>
            
            <form onSubmit={handleSubmit(handleCreateRestaurant)} className="p-6 space-y-6">
              {/* Business Type */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Business Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {['restaurant', 'cafe', 'bar'].map((type) => (
                    <label key={type} className="relative">
                      <input
                        {...register('businessType', { required: true })}
                        type="radio"
                        value={type}
                        className="sr-only"
                      />
                      <div className="border-2 border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50">
                        <div className="text-sm font-medium">{getBusinessTypeDisplayName(type as BusinessType)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Restaurant Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Pizza Palace"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                  <input
                    {...register('ownerName', { required: 'Owner name is required' })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                  {errors.ownerName && <p className="text-red-500 text-sm mt-1">{errors.ownerName.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email</label>
                  <input
                    {...register('ownerEmail', { 
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                    })}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="owner@restaurant.com"
                  />
                  {errors.ownerEmail && <p className="text-red-500 text-sm mt-1">{errors.ownerEmail.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">Login Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Password</label>
                    <input
                      {...register('ownerPassword', { 
                        required: 'Password is required',
                        minLength: { value: 6, message: 'Password must be at least 6 characters' }
                      })}
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter secure password"
                    />
                    {errors.ownerPassword && <p className="text-red-500 text-sm mt-1">{errors.ownerPassword.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label>
                    <input
                      {...register('ownerPin', { 
                        required: 'PIN is required',
                        pattern: { value: /^\d{4}$/, message: 'PIN must be exactly 4 digits' }
                      })}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-widest"
                      placeholder="1234"
                    />
                    {errors.ownerPin && <p className="text-red-500 text-sm mt-1">{errors.ownerPin.message}</p>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  {...register('address')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    reset();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                  Create Restaurant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Restaurant Created Successfully! 🎉</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Login Credentials</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">URL:</span>
                      <button
                        onClick={() => copyToClipboard(showCredentials.restaurantUrl)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <button
                        onClick={() => copyToClipboard(showCredentials.ownerEmail)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Password:</span>
                      <button
                        onClick={() => copyToClipboard(showCredentials.ownerPassword)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">PIN:</span>
                      <button
                        onClick={() => copyToClipboard(showCredentials.ownerPin)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => copyToClipboard(showCredentials.loginInstructions)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy All Instructions
                </button>
              </div>
              
              <button
                onClick={() => setShowCredentials(null)}
                className="w-full mt-4 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 