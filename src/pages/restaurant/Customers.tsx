import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Edit3,
  Trash2,
  Eye,
  X,
  Filter,
  Download,
  UserPlus,
  ShoppingBag,
  Gift,
  Award,
  CheckCircle,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { CustomerService } from '@/services/customerService';
import { OrderService } from '@/services/orderService';
import { GamificationIntegrationService } from '@/services/gamificationIntegrationService';
import { Customer, Order } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  preferences: string;
}

export default function Customers() {
  const { restaurant } = useRestaurant();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerGamificationHistory, setCustomerGamificationHistory] = useState<any>(null);
  const [customerLoyaltyInfo, setCustomerLoyaltyInfo] = useState<any>(null);
  const [loadingGamification, setLoadingGamification] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'visits' | 'spent' | 'lastVisit'>('lastVisit');

  const { register, handleSubmit, reset, setValue } = useForm<CustomerForm>();

  useEffect(() => {
    if (restaurant) {
      loadCustomers();
    }
  }, [restaurant]);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, sortBy]);

  const loadCustomers = async () => {
    if (!restaurant) return;

    try {
      setIsLoading(true);
      const result = await CustomerService.getCustomersForRestaurant(restaurant.id);
      if (result.success && result.data) {
        // Sort by creation date (newest first) since we removed orderBy from query
        const sortedCustomers = result.data.sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bDate - aDate;
        });
        setCustomers(sortedCustomers);
      }
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = [...customers];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.phone?.includes(searchTerm)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'visits':
          return b.visitCount - a.visitCount;
        case 'spent':
          return b.totalSpent - a.totalSpent;
        case 'lastVisit':
          const aDate = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
          const bDate = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
          return bDate - aDate;
        default:
          return 0;
      }
    });

    setFilteredCustomers(filtered);
  };

  const handleCreateCustomer = async (data: CustomerForm) => {
    if (!restaurant) return;

    try {
      setIsCreating(true);
      const customerData = {
        ...data,
        preferences: data.preferences ? data.preferences.split(',').map(p => p.trim()) : [],
      };

      const result = await CustomerService.createCustomer(restaurant.id, customerData);
      if (result.success) {
        toast.success('Customer created successfully');
        setShowCreateModal(false);
        reset();
        await loadCustomers();
      } else {
        toast.error(result.error || 'Failed to create customer');
      }
    } catch (error) {
      toast.error('Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setValue('name', customer.name || '');
    setValue('email', customer.email || '');
    setValue('phone', customer.phone || '');
    setValue('address', customer.address || '');
    setValue('preferences', customer.preferences?.join(', ') || '');
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (data: CustomerForm) => {
    if (!restaurant || !selectedCustomer) return;

    try {
      setIsUpdating(true);
      const updateData = {
        ...data,
        preferences: data.preferences ? data.preferences.split(',').map(p => p.trim()) : [],
      };

      const result = await CustomerService.updateCustomer(
        selectedCustomer.id,
        restaurant.id,
        updateData
      );
      
      if (result.success) {
        toast.success('Customer updated successfully');
        setShowEditModal(false);
        setSelectedCustomer(null);
        reset();
        await loadCustomers();
      } else {
        toast.error(result.error || 'Failed to update customer');
      }
    } catch (error) {
      toast.error('Failed to update customer');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!restaurant || !confirm(`Are you sure you want to delete customer "${customer.name || customer.phone}"?`)) {
      return;
    }

    try {
      const result = await CustomerService.deleteCustomer(customer.id, restaurant.id);
      if (result.success) {
        toast.success('Customer deleted successfully');
        await loadCustomers();
      } else {
        toast.error(result.error || 'Failed to delete customer');
      }
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleViewOrders = async (customer: Customer) => {
    if (!restaurant) return;

    try {
      setSelectedCustomer(customer);
      setShowOrdersModal(true);
      
      // Load customer orders
      if (customer.orderHistory.length > 0) {
        const result = await OrderService.getOrdersByIds(customer.orderHistory, restaurant.id);
        if (result.success && result.data) {
          setCustomerOrders(result.data);
        } else {
          console.error('Failed to load customer orders:', result.error);
          setCustomerOrders([]);
        }
      } else {
        setCustomerOrders([]);
      }

      // Load customer gamification history and loyalty info
      if (customer.phone) {
        setLoadingGamification(true);
        try {
          // Load gamification history
          const gamificationResult = await GamificationIntegrationService.getCustomerGamificationHistory(
            restaurant.id,
            customer.phone
          );
          
          if (gamificationResult.success && gamificationResult.data) {
            setCustomerGamificationHistory(gamificationResult.data);
          } else {
            console.log('No gamification history found for customer:', gamificationResult.error);
            setCustomerGamificationHistory(null);
          }

          // Load loyalty information
          const loyaltyResult = await GamificationIntegrationService.getCustomerLoyaltyInfo(
            restaurant.id,
            customer.phone
          );
          
          if (loyaltyResult.success && loyaltyResult.data) {
            setCustomerLoyaltyInfo(loyaltyResult.data);
          } else {
            console.log('No loyalty info found for customer:', loyaltyResult.error);
            setCustomerLoyaltyInfo(null);
          }
        } catch (error) {
          console.error('Error loading gamification data:', error);
          setCustomerGamificationHistory(null);
          setCustomerLoyaltyInfo(null);
        } finally {
          setLoadingGamification(false);
        }
      } else {
        setCustomerGamificationHistory(null);
        setCustomerLoyaltyInfo(null);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast.error('Failed to load customer data');
              setCustomerOrders([]);
        setCustomerGamificationHistory(null);
        setCustomerLoyaltyInfo(null);
    }
  };

  const exportCustomers = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Address', 'Total Spent', 'Visit Count', 'Last Visit'].join(','),
      ...filteredCustomers.map(customer => [
        customer.name || '',
        customer.email || '',
        customer.phone || '',
        customer.address || '',
        customer.totalSpent.toString(),
        customer.visitCount.toString(),
        customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
              <p className="text-gray-600 mt-1">Manage your customer database and relationships</p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={exportCustomers}
                className="btn btn-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-theme-primary"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Customer
              </button>
            </div>
          </div>
        </div>
        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="lastVisit">Last Visit</option>
                <option value="name">Name</option>
                <option value="visits">Most Visits</option>
                <option value="spent">Highest Spent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(customers.reduce((sum, c) => sum + c.totalSpent, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    customers.length > 0 
                      ? customers.reduce((sum, c) => sum + (c.visitCount > 0 ? c.totalSpent / c.visitCount : 0), 0) / customers.length
                      : 0
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Repeat Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter(c => c.visitCount > 1).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Customers ({filteredCustomers.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading customers...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-theme-primary"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add First Customer
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Visit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {customer.name || 'N/A'}
                          </div>
                          {customer.address && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {customer.address}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {customer.phone && (
                            <div className="text-sm text-gray-900 flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.visitCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.totalSpent)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {customer.lastVisit 
                            ? new Date(customer.lastVisit).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewOrders(customer)}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                            title="View Orders"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                            title="Edit Customer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowCreateModal(false)}></div>
            
            <div className="inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Customer</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(handleCreateCustomer)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    {...register('phone', { required: 'Phone is required' })}
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    {...register('address')}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Customer address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferences
                  </label>
                  <input
                    {...register('preferences')}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Dietary preferences, separated by commas"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="btn btn-theme-primary"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Customer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowEditModal(false)}></div>
            
            <div className="inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Customer</h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(handleUpdateCustomer)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    {...register('phone', { required: 'Phone is required' })}
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    {...register('address')}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Customer address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferences
                  </label>
                  <input
                    {...register('preferences')}
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Dietary preferences, separated by commas"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn btn-theme-primary"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 mr-2" />
                        Update Customer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customer Orders Modal */}
      {showOrdersModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => {
              setShowOrdersModal(false);
              setCustomerGamificationHistory(null);
              setCustomerLoyaltyInfo(null);
              setSelectedCustomer(null);
            }}></div>
            
            <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedCustomer.name || 'Customer'} - Order History
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedCustomer.visitCount} visits • {formatCurrency(selectedCustomer.totalSpent)} total spent
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowOrdersModal(false);
                      setCustomerGamificationHistory(null);
                      setCustomerLoyaltyInfo(null);
                      setSelectedCustomer(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Loyalty Points Section */}
                {customerLoyaltyInfo && (
                  <div className="mb-8">
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Award className="w-5 h-5 mr-2 text-purple-600" />
                      Loyalty Status & Points
                    </h4>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                      {/* Current Status */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="text-3xl">
                            {customerLoyaltyInfo.loyaltyInfo.currentThreshold?.badgeIcon || '🥉'}
                          </div>
                          <div>
                            <h5 className="text-xl font-bold text-gray-900">
                              {customerLoyaltyInfo.loyaltyInfo.currentThreshold?.name || 'Bronze Member'}
                            </h5>
                            <p className="text-gray-600">
                              {customerLoyaltyInfo.loyaltyInfo.currentPoints} loyalty points
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Member since</div>
                          <div className="font-medium text-gray-900">
                            {new Date(customerLoyaltyInfo.loyaltyInfo.memberSince).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Progress to Next Level */}
                      {customerLoyaltyInfo.loyaltyInfo.nextThreshold && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Progress to {customerLoyaltyInfo.loyaltyInfo.nextThreshold.name}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {customerLoyaltyInfo.loyaltyInfo.pointsToNext} points to go
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                              style={{ width: `${customerLoyaltyInfo.loyaltyInfo.progressToNext}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {customerLoyaltyInfo.loyaltyInfo.progressToNext.toFixed(1)}% complete
                          </div>
                        </div>
                      )}

                      {/* Current Level Benefits */}
                      {customerLoyaltyInfo.loyaltyInfo.currentThreshold?.benefits && (
                        <div className="mb-4">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Current Level Benefits:</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {customerLoyaltyInfo.loyaltyInfo.currentThreshold.benefits.map((benefit: string, idx: number) => (
                              <div key={idx} className="flex items-center text-sm text-gray-600">
                                <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                                {benefit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {customerLoyaltyInfo.loyaltyInfo.totalSpins}
                          </div>
                          <div className="text-xs text-gray-600">Total Spins</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {customerLoyaltyInfo.loyaltyInfo.totalPointsEarned}
                          </div>
                          <div className="text-xs text-gray-600">Points Earned</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg md:col-span-1 col-span-2">
                          <div className="text-2xl font-bold text-green-600">
                            {customerLoyaltyInfo.loyaltyInfo.currentPoints}
                          </div>
                          <div className="text-xs text-gray-600">Current Balance</div>
                        </div>
                      </div>

                      {/* Next Level Preview */}
                      {customerLoyaltyInfo.loyaltyInfo.nextThreshold && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-dashed border-purple-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{customerLoyaltyInfo.loyaltyInfo.nextThreshold.badgeIcon}</span>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {customerLoyaltyInfo.loyaltyInfo.nextThreshold.name}
                                </div>
                                <div className="text-xs text-gray-600">
                                  Unlock at {customerLoyaltyInfo.loyaltyInfo.nextThreshold.pointsRequired} points
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Next Level
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Gamification History Section */}
                <div className="mb-8">
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Gift className="w-5 h-5 mr-2 text-purple-600" />
                    Gamification Activity
                  </h4>
                  
                  {loadingGamification ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-2"></div>
                      <span className="text-gray-600">Loading gamification history...</span>
                    </div>
                  ) : customerGamificationHistory ? (
                    <div className="space-y-4">
                      {/* Gamification Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="text-2xl font-bold text-purple-600">
                            {customerGamificationHistory.stats.totalSpins}
                          </div>
                          <div className="text-sm text-purple-600">Total Spins</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="text-2xl font-bold text-green-600">
                            {customerGamificationHistory.stats.totalCoupons}
                          </div>
                          <div className="text-sm text-green-600">Coupons Earned</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-2xl font-bold text-blue-600">
                            {customerGamificationHistory.stats.redeemedCoupons}
                          </div>
                          <div className="text-sm text-blue-600">Coupons Used</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatCurrency(customerGamificationHistory.stats.totalDiscountEarned)}
                          </div>
                          <div className="text-sm text-orange-600">Total Rewards</div>
                        </div>
                      </div>

                      {/* Recent Spins */}
                      {customerGamificationHistory.spins.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-3">Recent Spins</h5>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {customerGamificationHistory.spins.slice(0, 5).map((spin: any, idx: number) => (
                              <div key={spin.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <div className="text-2xl">
                                    {spin.resultMessage.includes('luck') ? '😔' : 
                                     spin.resultMessage.includes('%') ? '💯' : 
                                     spin.resultMessage.includes('Free') ? '🎁' : '🎊'}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{spin.resultMessage}</div>
                                    <div className="text-sm text-gray-500">
                                      {new Date(spin.spinDate).toLocaleDateString()} at {new Date(spin.spinDate).toLocaleTimeString()}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {spin.isClaimed && spin.couponCode && (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                      Claimed
                                    </span>
                                  )}
                                  {spin.isRedeemed && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                      Redeemed
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Coupons */}
                      {customerGamificationHistory.coupons.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-3">Gamification Coupons</h5>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {customerGamificationHistory.coupons.map((coupon: any, idx: number) => (
                              <div key={coupon.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <div className="font-medium text-gray-900">{coupon.name}</div>
                                  <div className="text-sm text-gray-500">
                                    Code: <span className="font-mono font-bold">{coupon.code}</span> • 
                                    Expires: {new Date(coupon.validity.endDate).toLocaleDateString()}
                                  </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  coupon.usageCount > 0 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {coupon.usageCount > 0 ? 'Used' : 'Available'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Activity Timeline */}
                      {customerGamificationHistory.stats.firstSpinDate && (
                        <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                          <div>First spin: {new Date(customerGamificationHistory.stats.firstSpinDate).toLocaleDateString()}</div>
                          {customerGamificationHistory.stats.lastSpinDate && (
                            <div>Last spin: {new Date(customerGamificationHistory.stats.lastSpinDate).toLocaleDateString()}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h5 className="text-lg font-medium text-gray-600 mb-2">No Gamification Activity</h5>
                      <p className="text-gray-500">This customer hasn't participated in any spin wheel games yet.</p>
                    </div>
                  )}
                </div>

                {/* Order History Section */}
                {customerOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Order History</h4>
                    <p className="text-gray-600">
                      This customer hasn't placed any orders yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Order History ({customerOrders.length} orders)
                    </h4>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {customerOrders.map((order) => (
                        <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h5 className="font-medium text-gray-900">
                                Order #{order.orderNumber}
                              </h5>
                              <p className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString()} at{' '}
                                {new Date(order.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-medium text-gray-900">
                                {formatCurrency(order.total)}
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                order.status === 'completed' 
                                  ? 'bg-green-100 text-green-800'
                                  : order.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <span className="font-medium mr-2">Table:</span>
                              {order.tableId || 'N/A'}
                            </div>
                            
                            <div className="border-t pt-2">
                              <h6 className="text-sm font-medium text-gray-700 mb-1">Items:</h6>
                              <div className="space-y-1">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span>{item.quantity}x {item.name}</span>
                                    <span className="text-gray-600">{formatCurrency(item.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="border-t pt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Tax:</span>
                                <span>{formatCurrency(order.tax)}</span>
                              </div>
                              {order.discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                  <span>Discount:</span>
                                  <span>-{formatCurrency(order.discount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium">
                                <span>Total:</span>
                                <span>{formatCurrency(order.total)}</span>
                              </div>
                            </div>

                            {order.notes && (
                              <div className="border-t pt-2">
                                <span className="text-sm font-medium text-gray-700">Notes:</span>
                                <p className="text-sm text-gray-600 mt-1">{order.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 