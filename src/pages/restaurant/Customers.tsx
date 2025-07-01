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
  Copy,
  Clock,
  TrendingUp,
  Star,
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { CustomerService } from '@/services/customerService';
import { OrderService } from '@/services/orderService';
import { GamificationIntegrationService } from '@/services/gamificationIntegrationService';
import { CreditService, CreditTransaction } from '@/services/creditService';
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
  const [customerCreditHistory, setCustomerCreditHistory] = useState<CreditTransaction[]>([]);
  const [loadingGamification, setLoadingGamification] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [selectedSpin, setSelectedSpin] = useState<any>(null);
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
      
      // Load customer orders - Enhanced approach
      console.log('🔍 Loading orders for customer:', customer.name, customer.phone);
      
      // Method 1: Try loading by orderHistory array (existing method)
      let orders: Order[] = [];
      if (customer.orderHistory && customer.orderHistory.length > 0) {
        const result = await OrderService.getOrdersByIds(customer.orderHistory, restaurant.id);
        if (result.success && result.data) {
          orders = result.data;
          console.log('📋 Loaded orders from orderHistory:', orders.length);
        }
      }
      
      // Method 2: Search for orders by phone number and customer details (comprehensive fallback)
      if (orders.length === 0 && customer.phone) {
        console.log('📞 Searching orders by phone number:', customer.phone);
        const allOrdersResult = await OrderService.getOrdersForRestaurant(restaurant.id, 1000); // Get more orders
        if (allOrdersResult.success && allOrdersResult.data) {
          // Filter orders that match this customer
          const customerOrders = allOrdersResult.data.filter(order => {
            // Check if order notes contain customer phone or name
            const notesMatch = order.notes?.includes(customer.phone || '') || 
                              (customer.name && order.notes?.includes(customer.name)) ||
                              order.notes?.includes('Customer Portal');
            
            // Check if customerId matches
            const customerIdMatch = order.customerId === customer.id;
            
            // Check if customer phone/name is in order customer fields
            const customerMatch = order.customerPhone?.includes(customer.phone || '') ||
                                 order.customerName?.toLowerCase().includes(customer.name?.toLowerCase() || '');
            
            return notesMatch || customerIdMatch || customerMatch;
          });
          
          orders = customerOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          console.log('🔍 Found orders by search:', orders.length);
        }
      }
      
      // Method 3: Final fallback - check recent orders for any mention of customer
      if (orders.length === 0 && (customer.name || customer.email)) {
        console.log('📧 Searching orders by name/email');
        const allOrdersResult = await OrderService.getOrdersForRestaurant(restaurant.id, 500);
        if (allOrdersResult.success && allOrdersResult.data) {
          const customerOrders = allOrdersResult.data.filter(order => {
            const searchTerms = [customer.name, customer.email, customer.phone].filter(Boolean);
            return searchTerms.some(term => 
              order.notes?.toLowerCase().includes(term?.toLowerCase() || '') ||
              order.customerName?.toLowerCase().includes(term?.toLowerCase() || '') ||
              order.customerPhone?.includes(term || '') ||
              order.customerEmail?.toLowerCase().includes(term?.toLowerCase() || '')
            );
          });
          
          orders = customerOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          console.log('🎯 Found orders by name/email search:', orders.length);
        }
      }
      
      setCustomerOrders(orders);
      console.log('✅ Final order count for customer:', orders.length);

      // Load customer credit history
      if (customer.phone || customer.name) {
        setLoadingCredits(true);
        try {
          const creditResult = await CreditService.getCreditTransactions(restaurant.id);
          if (creditResult.success && creditResult.data) {
            // Filter credits for this customer by phone, name, or order IDs
            const customerCredits = creditResult.data.filter(credit => 
              (customer.phone && credit.customerPhone?.includes(customer.phone)) ||
              (customer.name && credit.customerName?.toLowerCase().includes(customer.name.toLowerCase())) ||
              orders.some(order => order.id === credit.orderId)
            );
            
            setCustomerCreditHistory(customerCredits);
            console.log('💳 Found credit transactions for customer:', customerCredits.length);
          } else {
            setCustomerCreditHistory([]);
          }
        } catch (error) {
          console.error('Error loading credit history:', error);
          setCustomerCreditHistory([]);
        } finally {
          setLoadingCredits(false);
        }
      } else {
        setCustomerCreditHistory([]);
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
      setCustomerCreditHistory([]);
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

  // Helper function to get order type display
  const getOrderTypeInfo = (order: Order) => {
    // Check for takeaway orders
    if (order.type === 'takeaway' || order.tableId === 'takeaway-order') {
      return {
        type: 'Takeaway',
        icon: '📦',
        color: 'bg-orange-100 text-orange-800',
        description: 'Takeaway Order'
      };
    }
    
    // Check for menu portal orders
    if (order.tableId === 'customer-portal' || 
        (order.notes && order.notes.includes('Customer Portal Order'))) {
      return {
        type: 'Menu Portal',
        icon: '📱',
        color: 'bg-blue-100 text-blue-800',
        description: 'Online Menu Portal Order'
      };
    }
    
    // Check for table-specific portal orders
    if (order.notes && order.notes.includes('Table:') && order.notes.includes('Customer Portal')) {
      const tableMatch = order.notes.match(/Table: ([^|]+)/);
      const tableName = tableMatch ? tableMatch[1].trim() : 'Unknown Table';
      return {
        type: 'Table Portal',
        icon: '🪑',
        color: 'bg-purple-100 text-purple-800',
        description: `Table-specific portal order (${tableName})`
      };
    }
    
    // Default to dine-in
    return {
      type: 'Dine In',
      icon: '🍽️',
      color: 'bg-green-100 text-green-800',
      description: 'Restaurant Dine-in Order'
    };
  };

  // Calculate credit summary for customer
  const calculateCreditSummary = () => {
    if (customerCreditHistory.length === 0) {
      return {
        totalCredits: 0,
        pendingAmount: 0,
        paidAmount: 0,
        totalTransactions: 0
      };
    }

    const totalCredits = customerCreditHistory.reduce((sum, credit) => sum + (credit.totalAmount - credit.amountReceived), 0);
    const pendingAmount = customerCreditHistory.reduce((sum, credit) => {
      const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
      const remaining = credit.totalAmount - totalPaid;
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
    const paidAmount = customerCreditHistory.reduce((sum, credit) => {
      return sum + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
    }, 0);

    return {
      totalCredits,
      pendingAmount,
      paidAmount,
      totalTransactions: customerCreditHistory.length
    };
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
          <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => {
              setShowOrdersModal(false);
              setCustomerGamificationHistory(null);
              setCustomerLoyaltyInfo(null);
              setSelectedCustomer(null);
            }}></div>
            
            <div className="inline-block w-full max-w-4xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl max-h-[95vh] overflow-y-auto">
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      {selectedCustomer.name || 'Customer'} - Complete Profile
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-600 mt-1">
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{selectedCustomer.visitCount} visits</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{formatCurrency(selectedCustomer.totalSpent)} spent</span>
                      </div>
                      {customerOrders.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{formatCurrency(customerOrders.reduce((sum, order) => sum + order.total, 0) / customerOrders.length)} avg order</span>
                        </div>
                      )}
                      {customerGamificationHistory && (
                        <div className="flex items-center space-x-1">
                          <Gift className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{customerGamificationHistory.stats.totalSpins} spins</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowOrdersModal(false);
                      setCustomerGamificationHistory(null);
                      setCustomerLoyaltyInfo(null);
                      setSelectedCustomer(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 self-start sm:self-center"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-6">
                {/* Loyalty Points Section */}
                {customerLoyaltyInfo && (
                  <div className="mb-6 sm:mb-8">
                    <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                      <Award className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600" />
                      Loyalty Status & Points
                    </h4>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-3 sm:p-6 rounded-lg border border-purple-200">
                      {/* Current Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl sm:text-3xl">
                            {customerLoyaltyInfo.loyaltyInfo.currentThreshold?.badgeIcon || '🥉'}
                          </div>
                          <div>
                            <h5 className="text-lg sm:text-xl font-bold text-gray-900">
                              {customerLoyaltyInfo.loyaltyInfo.currentThreshold?.name || 'Bronze Member'}
                            </h5>
                            <p className="text-gray-600 text-sm sm:text-base">
                              {customerLoyaltyInfo.loyaltyInfo.currentPoints} loyalty points
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs sm:text-sm text-gray-600">Member since</div>
                          <div className="font-medium text-gray-900 text-sm sm:text-base">
                            {new Date(customerLoyaltyInfo.loyaltyInfo.memberSince).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Progress to Next Level */}
                      {customerLoyaltyInfo.loyaltyInfo.nextThreshold && (
                        <div className="mb-4 sm:mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-medium text-gray-700">
                              Progress to {customerLoyaltyInfo.loyaltyInfo.nextThreshold.name}
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-gray-700">
                              {customerLoyaltyInfo.loyaltyInfo.pointsToNext} points to go
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 sm:h-3 rounded-full transition-all duration-300"
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
                          <h6 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Current Level Benefits:</h6>
                          <div className="grid grid-cols-1 gap-2">
                            {customerLoyaltyInfo.loyaltyInfo.currentThreshold.benefits.map((benefit: string, idx: number) => (
                              <div key={idx} className="flex items-center text-xs sm:text-sm text-gray-600">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 mr-2 flex-shrink-0" />
                                {benefit}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
                        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-purple-600">
                            {customerLoyaltyInfo.loyaltyInfo.totalSpins || 0}
                          </div>
                          <div className="text-xs text-gray-600">Gamification Spins</div>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-blue-600">
                            {customerLoyaltyInfo.loyaltyInfo.totalPointsEarned}
                          </div>
                          <div className="text-xs text-gray-600">Points Earned</div>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-white rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-green-600">
                            {customerLoyaltyInfo.loyaltyInfo.currentPoints}
                          </div>
                          <div className="text-xs text-gray-600">Current Balance</div>
                        </div>
                      </div>

                      {/* Next Level Preview */}
                      {customerLoyaltyInfo.loyaltyInfo.nextThreshold && (
                        <div className="mt-4 p-2 sm:p-3 bg-white rounded-lg border border-dashed border-purple-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-base sm:text-lg">{customerLoyaltyInfo.loyaltyInfo.nextThreshold.badgeIcon}</span>
                              <div>
                                <div className="font-medium text-gray-900 text-sm sm:text-base">
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
                <div className="mb-6 sm:mb-8">
                  <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                    <Gift className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600" />
                    Gamification Activity
                  </h4>
                  
                  {loadingGamification ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-purple-600 mr-2"></div>
                      <span className="text-gray-600 text-sm sm:text-base">Loading gamification history...</span>
                    </div>
                  ) : customerGamificationHistory ? (
                    <div className="space-y-4">
                      {/* Gamification Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 hover:bg-purple-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                                {customerGamificationHistory.stats.totalSpins}
                              </div>
                              <div className="text-xs sm:text-sm text-purple-600 font-medium">Total Spins</div>
                            </div>
                            <div className="text-xl sm:text-3xl">🎰</div>
                          </div>
                          <div className="text-xs text-purple-500 mt-1">
                            {customerGamificationHistory.stats.totalSpins > 0 && customerGamificationHistory.stats.totalCoupons > 0 && (
                              `${((customerGamificationHistory.stats.totalCoupons / customerGamificationHistory.stats.totalSpins) * 100).toFixed(1)}% win rate`
                            )}
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 hover:bg-green-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-green-600">
                                {customerGamificationHistory.stats.totalCoupons}
                              </div>
                              <div className="text-xs sm:text-sm text-green-600 font-medium">Coupons Earned</div>
                            </div>
                            <div className="text-xl sm:text-3xl">🎟️</div>
                          </div>
                          <div className="text-xs text-green-500 mt-1">
                            {customerGamificationHistory.stats.totalCoupons - customerGamificationHistory.stats.redeemedCoupons} unused
                          </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 hover:bg-blue-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                {customerGamificationHistory.stats.redeemedCoupons}
                              </div>
                              <div className="text-xs sm:text-sm text-blue-600 font-medium">Coupons Used</div>
                            </div>
                            <div className="text-xl sm:text-3xl">✅</div>
                          </div>
                          <div className="text-xs text-blue-500 mt-1">
                            {customerGamificationHistory.stats.totalCoupons > 0 && (
                              `${((customerGamificationHistory.stats.redeemedCoupons / customerGamificationHistory.stats.totalCoupons) * 100).toFixed(1)}% redemption rate`
                            )}
                          </div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 hover:bg-orange-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                                {formatCurrency(customerGamificationHistory.stats.totalDiscountEarned)}
                              </div>
                              <div className="text-xs sm:text-sm text-orange-600 font-medium">Total Rewards</div>
                            </div>
                            <div className="text-xl sm:text-3xl">💰</div>
                          </div>
                          <div className="text-xs text-orange-500 mt-1">
                            {formatCurrency(customerGamificationHistory.stats.totalDiscountUsed)} used
                          </div>
                        </div>
                      </div>

                      {/* Engagement Summary */}
                      {customerGamificationHistory.stats.firstSpinDate && (
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h6 className="font-medium text-gray-900 mb-1 text-sm sm:text-base">Gamification Journey</h6>
                              <div className="text-xs sm:text-sm text-gray-600">
                                <div>Started: {new Date(customerGamificationHistory.stats.firstSpinDate).toLocaleDateString()}</div>
                                {customerGamificationHistory.stats.lastSpinDate && (
                                  <div>Last Activity: {new Date(customerGamificationHistory.stats.lastSpinDate).toLocaleDateString()}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="text-xs sm:text-sm text-gray-600">Engagement Level</div>
                              <div className="font-bold text-sm sm:text-lg">
                                {customerGamificationHistory.stats.totalSpins >= 20 ? (
                                  <span className="text-purple-600">🏆 VIP Player</span>
                                ) : customerGamificationHistory.stats.totalSpins >= 10 ? (
                                  <span className="text-blue-600">⭐ Regular Player</span>
                                ) : customerGamificationHistory.stats.totalSpins >= 5 ? (
                                  <span className="text-green-600">🎯 Active Player</span>
                                ) : (
                                  <span className="text-gray-600">🌱 New Player</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recent Spins */}
                      {customerGamificationHistory.spins.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900 text-sm sm:text-base">Spin Wheel History</h5>
                            <span className="text-xs sm:text-sm text-gray-500">
                              {customerGamificationHistory.spins.length} total spins
                            </span>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {customerGamificationHistory.spins.map((spin: any, idx: number) => (
                              <button
                                key={spin.id || idx} 
                                onClick={() => setSelectedSpin(spin)}
                                className="w-full flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-blue-300 group"
                              >
                                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                  <div className="text-xl sm:text-2xl flex-shrink-0">
                                    {spin.resultMessage.includes('luck') ? '😔' : 
                                     spin.resultMessage.includes('%') ? '💯' : 
                                     spin.resultMessage.includes('Free') ? '🎁' : 
                                     spin.resultMessage.includes('discount') ? '🏷️' : '🎊'}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="font-medium text-gray-900 group-hover:text-blue-700 text-xs sm:text-sm truncate">{spin.resultMessage}</div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(spin.spinDate).toLocaleDateString()} at {new Date(spin.spinDate).toLocaleTimeString()}
                                    </div>
                                    {spin.pointsEarned > 0 && (
                                      <div className="text-xs text-purple-600 font-medium">
                                        +{spin.pointsEarned} loyalty points earned
                                      </div>
                                    )}
                                    {spin.couponCode && (
                                      <div className="text-xs text-blue-600 font-mono truncate">
                                        Coupon: {spin.couponCode}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                                  <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-blue-500 mb-1" />
                                  {spin.isClaimed && (
                                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                      Claimed
                                    </span>
                                  )}
                                  {spin.isRedeemed && (
                                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                      Redeemed
                                    </span>
                                  )}
                                  {!spin.isClaimed && !spin.resultMessage.includes('luck') && (
                                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                          
                          {/* Show All Spins Button */}
                          {customerGamificationHistory.spins.length > 5 && (
                            <div className="mt-3 text-center">
                              <button 
                                onClick={() => {
                                  // Toggle showing all spins vs just first 5
                                  const container = document.querySelector('.space-y-2.max-h-60');
                                  if (container) {
                                    container.classList.toggle('max-h-60');
                                    container.classList.toggle('max-h-96');
                                  }
                                }}
                                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View All Spins ({customerGamificationHistory.spins.length})
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Gamification Coupons */}
                      {customerGamificationHistory.coupons.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900 text-sm sm:text-base">Gamification Coupons</h5>
                            <span className="text-xs sm:text-sm text-gray-500">
                              {customerGamificationHistory.coupons.filter((c: any) => c.usageCount === 0).length} active
                            </span>
                          </div>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {customerGamificationHistory.coupons.map((coupon: any, idx: number) => {
                              const isExpired = new Date(coupon.validity.endDate) < new Date();
                              const isUsed = coupon.usageCount > 0;
                              const isActive = !isExpired && !isUsed;
                              
                              return (
                                <div key={coupon.id || idx} className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                                  isActive ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                                  isUsed ? 'bg-blue-50 border-blue-200' :
                                  'bg-gray-50 border-gray-200'
                                }`}>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <div className="text-base sm:text-lg">
                                          {coupon.type === 'percentage' ? '💯' : 
                                           coupon.type === 'fixed_amount' ? '💰' : 
                                           coupon.type === 'free_item' ? '🎁' : '🎟️'}
                                        </div>
                                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{coupon.name}</div>
                                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded-full font-medium ${
                                          isActive ? 'bg-green-100 text-green-800' :
                                          isUsed ? 'bg-blue-100 text-blue-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {isUsed ? 'Used' : isExpired ? 'Expired' : 'Available'}
                                        </span>
                                      </div>
                                      
                                      <div className="space-y-1">
                                        <div className="text-sm text-gray-600 flex items-center space-x-2">
                                          <span className="font-mono font-bold bg-gray-100 px-2 py-1 rounded">
                                            {coupon.code}
                                          </span>
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(coupon.code);
                                              toast.success('Coupon code copied to clipboard!');
                                            }}
                                            className="text-blue-600 hover:text-blue-800 transition-colors"
                                            title="Copy coupon code"
                                          >
                                            <Copy className="w-4 h-4" />
                                          </button>
                                        </div>
                                        
                                        <div className="text-sm text-gray-500">
                                          <div>
                                            Value: <span className="font-medium">
                                              {coupon.type === 'percentage' ? `${coupon.value}% off` :
                                               coupon.type === 'fixed_amount' ? formatCurrency(coupon.value) :
                                               coupon.description || 'Special offer'}
                                            </span>
                                          </div>
                                          <div>
                                            Expires: <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                              {new Date(coupon.validity.endDate).toLocaleDateString()}
                                            </span>
                                          </div>
                                          {coupon.metadata?.spinWheelName && (
                                            <div className="text-xs text-purple-600">
                                              From: {coupon.metadata.spinWheelName}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {isUsed && coupon.usedAt && (
                                      <div className="text-right text-xs text-gray-500">
                                        <div>Used on</div>
                                        <div>{new Date(coupon.usedAt).toLocaleDateString()}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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

                {/* Credit History Section */}
                <div className="mb-6 sm:mb-8">
                  <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-red-600" />
                    Credit History & Payment Status
                  </h4>
                  
                  {loadingCredits ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-red-600 mr-2"></div>
                      <span className="text-gray-600 text-sm sm:text-base">Loading credit information...</span>
                    </div>
                  ) : customerCreditHistory.length > 0 ? (
                    <div className="space-y-4">
                      {/* Credit Summary Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 hover:bg-red-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-red-600">
                                {formatCurrency(calculateCreditSummary().totalCredits)}
                              </div>
                              <div className="text-xs sm:text-sm text-red-600 font-medium">Total Credits</div>
                            </div>
                            <div className="text-xl sm:text-3xl">💳</div>
                          </div>
                          <div className="text-xs text-red-500 mt-1">
                            {calculateCreditSummary().totalTransactions} transactions
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 hover:bg-orange-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                                {formatCurrency(calculateCreditSummary().pendingAmount)}
                              </div>
                              <div className="text-xs sm:text-sm text-orange-600 font-medium">Pending</div>
                            </div>
                            <div className="text-xl sm:text-3xl">⏳</div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 hover:bg-green-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-green-600">
                                {formatCurrency(calculateCreditSummary().paidAmount)}
                              </div>
                              <div className="text-xs sm:text-sm text-green-600 font-medium">Paid Back</div>
                            </div>
                            <div className="text-xl sm:text-3xl">✅</div>
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 hover:bg-blue-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                {calculateCreditSummary().pendingAmount > 0 ? 
                                  `${((calculateCreditSummary().paidAmount / (calculateCreditSummary().paidAmount + calculateCreditSummary().pendingAmount)) * 100).toFixed(1)}%` : 
                                  '100%'
                                }
                              </div>
                              <div className="text-xs sm:text-sm text-blue-600 font-medium">Payment Rate</div>
                            </div>
                            <div className="text-xl sm:text-3xl">📊</div>
                          </div>
                        </div>
                      </div>

                      {/* Credit Transactions */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Credit Transactions</h5>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {customerCreditHistory.map((credit) => {
                            const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
                            const remainingAmount = credit.totalAmount - totalPaid;
                            
                            return (
                              <div key={credit.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <div className="text-lg">💳</div>
                                      <div>
                                        <h6 className="font-medium text-gray-900 text-sm">
                                          Order #{credit.orderId} - Table {credit.tableNumber}
                                        </h6>
                                        <div className="text-xs text-gray-500">
                                          {new Date(credit.createdAt instanceof Date ? credit.createdAt : credit.createdAt.toDate()).toLocaleDateString()} at {new Date(credit.createdAt instanceof Date ? credit.createdAt : credit.createdAt.toDate()).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-600">Total:</span>
                                        <div className="font-medium">{formatCurrency(credit.totalAmount)}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Paid:</span>
                                        <div className="font-medium text-green-600">{formatCurrency(totalPaid)}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Remaining:</span>
                                        <div className="font-medium text-red-600">{formatCurrency(remainingAmount)}</div>
                                      </div>
                                    </div>

                                    {/* Payment History */}
                                    {credit.paymentHistory && credit.paymentHistory.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-gray-100">
                                        <div className="text-xs text-gray-600 mb-1">Payment History:</div>
                                        <div className="space-y-1">
                                          {credit.paymentHistory.map((payment, idx) => (
                                            <div key={idx} className="flex justify-between text-xs">
                                              <span>{formatCurrency(payment.amount)} via {payment.paymentMethod}</span>
                                              <span className="text-gray-500">
                                                {new Date(payment.paidAt instanceof Date ? payment.paidAt : payment.paidAt.toDate()).toLocaleDateString()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="text-right">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      credit.status === 'paid' 
                                        ? 'bg-green-100 text-green-800'
                                        : credit.status === 'partially_paid'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {credit.status === 'paid' ? 'Fully Paid' : 
                                       credit.status === 'partially_paid' ? 'Partially Paid' : 'Pending'}
                                    </span>
                                    
                                    {credit.notes && (
                                      <div className="text-xs text-gray-500 mt-1 max-w-32">
                                        {credit.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h5 className="text-lg font-medium text-gray-600 mb-2">No Credit History</h5>
                      <p className="text-gray-500">This customer has no credit transactions on record.</p>
                    </div>
                  )}
                </div>

                {/* Order Analytics */}
                {customerOrders.length > 0 && (
                  <div className="mb-6 sm:mb-8">
                    <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                      <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                      Order Analytics ({customerOrders.length} orders)
                    </h4>
                    
                    <div className="space-y-4 sm:space-y-6">
                      {/* Order Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                {customerOrders.length}
                              </div>
                              <div className="text-xs sm:text-sm text-blue-600 font-medium">Total Orders</div>
                            </div>
                            <div className="text-xl sm:text-2xl">📊</div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-green-600">
                                {formatCurrency(customerOrders.reduce((sum, order) => sum + order.total, 0))}
                              </div>
                              <div className="text-xs sm:text-sm text-green-600 font-medium">Total Spent</div>
                            </div>
                            <div className="text-xl sm:text-2xl">💰</div>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                                {formatCurrency(customerOrders.reduce((sum, order) => sum + order.total, 0) / customerOrders.length)}
                              </div>
                              <div className="text-xs sm:text-sm text-purple-600 font-medium">Avg Order</div>
                            </div>
                            <div className="text-xl sm:text-2xl">📈</div>
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                                {customerOrders.filter(order => order.status === 'completed').length}
                              </div>
                              <div className="text-xs sm:text-sm text-orange-600 font-medium">Completed</div>
                            </div>
                            <div className="text-xl sm:text-2xl">✅</div>
                          </div>
                        </div>
                      </div>

                      {/* Order Type Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-green-600">
                                {customerOrders.filter(order => getOrderTypeInfo(order).type === 'Dine In').length}
                              </div>
                              <div className="text-xs sm:text-sm text-green-600 font-medium">Dine In</div>
                            </div>
                            <div className="text-xl sm:text-2xl">🍽️</div>
                          </div>
                          <div className="text-xs text-green-500 mt-1">
                            {customerOrders.length > 0 ? ((customerOrders.filter(order => getOrderTypeInfo(order).type === 'Dine In').length / customerOrders.length) * 100).toFixed(1) : 0}% of orders
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                {customerOrders.filter(order => getOrderTypeInfo(order).type === 'Menu Portal').length}
                              </div>
                              <div className="text-xs sm:text-sm text-blue-600 font-medium">Menu Portal</div>
                            </div>
                            <div className="text-xl sm:text-2xl">📱</div>
                          </div>
                          <div className="text-xs text-blue-500 mt-1">
                            {customerOrders.length > 0 ? ((customerOrders.filter(order => getOrderTypeInfo(order).type === 'Menu Portal').length / customerOrders.length) * 100).toFixed(1) : 0}% of orders
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                                {customerOrders.filter(order => getOrderTypeInfo(order).type === 'Takeaway').length}
                              </div>
                              <div className="text-xs sm:text-sm text-orange-600 font-medium">Takeaway</div>
                            </div>
                            <div className="text-xl sm:text-2xl">📦</div>
                          </div>
                          <div className="text-xs text-orange-500 mt-1">
                            {customerOrders.length > 0 ? ((customerOrders.filter(order => getOrderTypeInfo(order).type === 'Takeaway').length / customerOrders.length) * 100).toFixed(1) : 0}% of orders
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                                {customerOrders.filter(order => getOrderTypeInfo(order).type === 'Table Portal').length}
                              </div>
                              <div className="text-xs sm:text-sm text-purple-600 font-medium">Table Portal</div>
                            </div>
                            <div className="text-xl sm:text-2xl">🪑</div>
                          </div>
                          <div className="text-xs text-purple-500 mt-1">
                            {customerOrders.length > 0 ? ((customerOrders.filter(order => getOrderTypeInfo(order).type === 'Table Portal').length / customerOrders.length) * 100).toFixed(1) : 0}% of orders
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Order History */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Recent Orders</h5>
                      <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                        {customerOrders.map((order) => (
                          <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-5 hover:shadow-md transition-shadow">
                            {/* Order Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-3">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <div className="text-xl sm:text-2xl">
                                  {order.status === 'completed' ? '✅' : 
                                   order.status === 'cancelled' ? '❌' : 
                                   order.status === 'preparing' ? '👨‍🍳' : 
                                   order.status === 'ready' ? '🔔' : '⏳'}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h6 className="font-semibold text-gray-900 text-sm sm:text-lg">
                                      Order #{order.orderNumber}
                                    </h6>
                                    {/* Order Type Badge */}
                                    {(() => {
                                      const orderTypeInfo = getOrderTypeInfo(order);
                                      return (
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${orderTypeInfo.color}`}>
                                          {orderTypeInfo.icon} {orderTypeInfo.type}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    {/* Enhanced Table/Location Info */}
                                    {(() => {
                                      const orderTypeInfo = getOrderTypeInfo(order);
                                      if (orderTypeInfo.type === 'Takeaway') {
                                        return (
                                          <div className="flex items-center space-x-1">
                                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>Takeaway Counter</span>
                                          </div>
                                        );
                                      } else if (orderTypeInfo.type === 'Menu Portal') {
                                        return (
                                          <div className="flex items-center space-x-1">
                                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>Online Portal</span>
                                          </div>
                                        );
                                      } else if (orderTypeInfo.type === 'Table Portal' && order.notes) {
                                        const tableMatch = order.notes.match(/Table: ([^|]+)/);
                                        const tableName = tableMatch ? tableMatch[1].trim() : 'Table Portal';
                                        return (
                                          <div className="flex items-center space-x-1">
                                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>{tableName}</span>
                                          </div>
                                        );
                                      } else if (order.tableId && order.tableId !== 'customer-portal' && order.tableId !== 'takeaway-order') {
                                        return (
                                          <div className="flex items-center space-x-1">
                                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                                            <span>Table {order.tableId}</span>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {/* Customer Name if available */}
                                    {(order.customerName || order.customerPhone) && (
                                      <div className="flex items-center space-x-1">
                                        <User className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span>{order.customerName || order.customerPhone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-left sm:text-right">
                                <div className="text-lg sm:text-2xl font-bold text-gray-900">
                                  {formatCurrency(order.total)}
                                </div>
                                <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                                  order.status === 'completed' 
                                    ? 'bg-green-100 text-green-800'
                                    : order.status === 'cancelled'
                                    ? 'bg-red-100 text-red-800'
                                    : order.status === 'preparing'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : order.status === 'ready'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Order Items */}
                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                              <h6 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center">
                                <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                Items Ordered ({order.items.length})
                              </h6>
                              <div className="space-y-2">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start sm:items-center py-2 border-b border-gray-200 last:border-b-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-gray-900 text-xs sm:text-sm">
                                        {item.quantity}x {item.name}
                                      </div>
                                      {item.customizations && item.customizations.length > 0 && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Customizations: {item.customizations.join(', ')}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <div className="text-xs text-blue-600 mt-1">
                                          Note: {item.notes}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                      <div className="font-semibold text-gray-900 text-xs sm:text-sm">
                                        {formatCurrency(item.total)}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {formatCurrency(item.price)} each
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Order Summary */}
                            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 sm:p-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs sm:text-sm">
                                  <span className="text-gray-600">Subtotal:</span>
                                  <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs sm:text-sm">
                                  <span className="text-gray-600">Tax:</span>
                                  <span className="font-medium">{formatCurrency(order.tax)}</span>
                                </div>
                                {order.discount > 0 && (
                                  <div className="flex justify-between text-xs sm:text-sm text-green-600">
                                    <span>Discount Applied:</span>
                                    <span className="font-medium">-{formatCurrency(order.discount)}</span>
                                  </div>
                                )}
                                <div className="border-t border-gray-300 pt-2 mt-2">
                                  <div className="flex justify-between text-sm sm:text-lg font-bold">
                                    <span className="text-gray-900">Total:</span>
                                    <span className="text-blue-600">{formatCurrency(order.total)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Order Notes */}
                            {order.notes && (
                              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start space-x-2">
                                  <div className="text-yellow-600 mt-0.5">📝</div>
                                  <div>
                                    <span className="text-xs sm:text-sm font-medium text-yellow-800">Order Notes:</span>
                                    <p className="text-xs sm:text-sm text-yellow-700 mt-1">{order.notes}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spin Details Modal */}
      {selectedSpin && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={() => setSelectedSpin(null)}></div>
            
            <div className="inline-block w-full max-w-2xl my-4 sm:my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              {/* Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="text-2xl sm:text-3xl">
                      {selectedSpin.resultMessage.includes('luck') ? '😔' : 
                       selectedSpin.resultMessage.includes('%') ? '💯' : 
                       selectedSpin.resultMessage.includes('Free') ? '🎁' : 
                       selectedSpin.resultMessage.includes('discount') ? '🏷️' : '🎊'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg sm:text-xl font-bold">Spin Details</h3>
                      <p className="text-purple-100 text-sm sm:text-base truncate">{selectedSpin.resultMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSpin(null)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Date & Time</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(selectedSpin.spinDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(selectedSpin.spinDate).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Star className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Loyalty Points</span>
                    </div>
                    <div className="text-lg font-semibold text-purple-600">
                      {selectedSpin.pointsEarned > 0 ? `+${selectedSpin.pointsEarned}` : '0'} points
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedSpin.pointsEarned > 0 ? 'Earned from this spin' : 'No points earned'}
                    </div>
                  </div>
                </div>

                {/* Coupon Information */}
                {selectedSpin.couponCode && (
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Gift className="w-5 h-5 mr-2 text-green-600" />
                      Coupon Details
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Coupon Code</label>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 font-mono text-lg font-bold text-center">
                            {selectedSpin.couponCode}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedSpin.couponCode);
                              toast.success('Coupon code copied to clipboard!');
                            }}
                            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Reward Value</label>
                          <div className="mt-1 text-lg font-semibold text-green-600">
                            {selectedSpin.resultMessage}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700">Status</label>
                          <div className="mt-1">
                            {selectedSpin.isRedeemed ? (
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                                ✅ Redeemed
                              </span>
                            ) : selectedSpin.isClaimed ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                                🎯 Claimed
                              </span>
                            ) : selectedSpin.resultMessage.includes('luck') ? (
                              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full font-medium">
                                😔 No Prize
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full font-medium">
                                ⏳ Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Redemption Status */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Redemption Status</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Spin Completed</span>
                      <span className="text-green-600 font-medium">✅ Yes</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Reward Claimed</span>
                      <span className={selectedSpin.isClaimed ? "text-green-600 font-medium" : "text-gray-500"}>
                        {selectedSpin.isClaimed ? "✅ Yes" : "❌ No"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Coupon Used</span>
                      <span className={selectedSpin.isRedeemed ? "text-green-600 font-medium" : "text-gray-500"}>
                        {selectedSpin.isRedeemed ? "✅ Yes" : "❌ No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  {selectedSpin.couponCode && !selectedSpin.isRedeemed && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedSpin.couponCode);
                        toast.success('Coupon code copied! Customer can use this now.');
                      }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy for Customer</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => setSelectedSpin(null)}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 