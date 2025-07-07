import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CreditCard,
  User,
  Phone,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  X
} from 'lucide-react';

import { useRestaurant } from '@/contexts/RestaurantContext';
import { CreditService, CreditTransaction } from '@/services/creditService';
import { formatCurrency } from '@/lib/utils';

// Helpers for status display
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'partially_paid':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'paid':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'partially_paid':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'paid':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

// Helper to calculate remaining amount for a credit transaction
const getRemainingAmount = (credit: CreditTransaction): number => {
  const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
  return credit.totalAmount - totalPaid;
};

export default function Credits() {
  const navigate = useNavigate();
  const { restaurant } = useRestaurant();
  
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partially_paid' | 'paid'>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditTransaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // State for the new "Pay All Dues" modal
  const [showPayAllDuesModal, setShowPayAllDuesModal] = useState(false);
  const [selectedGroupForPayment, setSelectedGroupForPayment] = useState<(typeof customerGroups)[0] | null>(null);
  const [payAllMethod, setPayAllMethod] = useState('cash');
  const [payAllNotes, setPayAllNotes] = useState('');

  // Customer credits modal
  const [showCustomerCreditsModal, setShowCustomerCreditsModal] = useState(false);
  const [selectedCustomerCredits, setSelectedCustomerCredits] = useState<CreditTransaction[]>([]);

  // Load credits on component mount
  useEffect(() => {
    if (restaurant?.id) {
      loadCredits();
    }
  }, [restaurant?.id]);

  // Filter credits based on search and status
  useEffect(() => {
    let filtered = credits;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(credit =>
        credit.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credit.customerPhone?.includes(searchTerm) ||
        credit.orderId.includes(searchTerm) ||
        credit.tableNumber.includes(searchTerm)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(credit => credit.status === statusFilter);
    }

    setFilteredCredits(filtered);
  }, [credits, searchTerm, statusFilter]);

  // This effect will keep the customer details modal synced with the latest data
  useEffect(() => {
    // If the modal is open and we have a selected customer
    if (showCustomerCreditsModal && selectedCustomerCredits.length > 0) {
      const customerIdentifier = selectedCustomerCredits[0].customerName;
      const customerPhoneIdentifier = selectedCustomerCredits[0].customerPhone;

      // Find the updated group of credits for this customer from the main `credits` list
      const updatedCreditsForCustomer = credits.filter(
        c => c.customerName === customerIdentifier && c.customerPhone === customerPhoneIdentifier
      );

      // Update the state that populates the modal
      if(updatedCreditsForCustomer.length > 0) {
        setSelectedCustomerCredits(updatedCreditsForCustomer);
      } else {
        // All credits for this customer might have been settled and they are no longer in the main list
        // in some views. In this case, close the modal as there's nothing to show.
        setShowCustomerCreditsModal(false);
      }
    }
  }, [credits, showCustomerCreditsModal]); // Rerun when main `credits` list changes

  // Group credits by customer
  const groupedCredits = filteredCredits.reduce((groups, credit) => {
    const key = `${credit.customerName}-${credit.customerPhone || ''}`;
    if (!groups[key]) {
      groups[key] = {
        customerName: credit.customerName,
        customerPhone: credit.customerPhone || '',
        credits: [],
        totalCreditAmount: 0,
        hasUnpaidCredits: false
      };
    }
    groups[key].credits.push(credit);
    
    const remainingAmount = getRemainingAmount(credit);
    if (credit.status !== 'paid') {
      groups[key].totalCreditAmount += remainingAmount;
      groups[key].hasUnpaidCredits = true;
    }
    
    return groups;
  }, {} as Record<string, {
    customerName: string;
    customerPhone: string;
    credits: CreditTransaction[];
    totalCreditAmount: number;
    hasUnpaidCredits: boolean;
  }>);

  const customerGroups = Object.values(groupedCredits);

  const loadCredits = async () => {
    if (!restaurant?.id) return;

    try {
      setIsLoading(true);
      const result = await CreditService.getCreditTransactions(restaurant.id);
      
      if (result.success && result.data) {
        setCredits(result.data);
      } else {
        toast.error('Failed to load credits');
      }
    } catch (error) {
      console.error('Error loading credits:', error);
      toast.error('Failed to load credits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPayAllDuesModal = (group: (typeof customerGroups)[0]) => {
    if (group.totalCreditAmount > 0) {
      setSelectedGroupForPayment(group);
      setPayAllMethod('cash');
      setPayAllNotes('');
      setShowPayAllDuesModal(true);
    } else {
      toast('This customer has no outstanding dues.');
    }
  };

  const handleConfirmPayAllDues = async () => {
    if (!restaurant || !selectedGroupForPayment) return;

    const toastId = toast.loading(`Processing payment for ${selectedGroupForPayment.customerName}...`);
    try {
      const result = await CreditService.payAllDuesForCustomer(
        restaurant.id,
        selectedGroupForPayment.customerName,
        selectedGroupForPayment.customerPhone,
        payAllMethod,
        payAllNotes
      );

      if (result.success) {
        toast.success(`All dues for ${selectedGroupForPayment.customerName} have been cleared.`, { id: toastId });
        loadCredits(); // Refresh the data
      } else {
        toast.error(result.error || 'Failed to clear dues.', { id: toastId });
      }
    } catch (error) {
      console.error('Error clearing all dues:', error);
      toast.error('An unexpected error occurred.', { id: toastId });
    } finally {
      setShowPayAllDuesModal(false);
      setSelectedGroupForPayment(null);
    }
  };

  const handleMakePayment = async () => {
    if (!selectedCredit || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    const remainingAmount = getRemainingAmount(selectedCredit);
    if (amount > remainingAmount) {
      toast.error(`Payment amount cannot exceed remaining credit of ${formatCurrency(remainingAmount)}`);
      return;
    }

    try {
      setIsProcessingPayment(true);
      
      const result = await CreditService.makePayment(
        selectedCredit.id!,
        amount,
        paymentMethod,
        paymentNotes
      );

      if (result.success) {
        toast.success(`Payment of ${formatCurrency(amount)} recorded successfully`);
        setShowPaymentModal(false);
        // We no longer close this modal automatically, so the user can see the update.
        // setShowCustomerCreditsModal(false); 
        setSelectedCredit(null);
        setPaymentAmount('');
        setPaymentNotes('');
        loadCredits(); // Refresh the list, which will trigger the useEffect to update the modal
      } else {
        toast.error(result.error || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const totalPendingAmount = customerGroups.reduce((sum, group) => sum + group.totalCreditAmount, 0);

  const totalCredits = customerGroups.length;
  const pendingCredits = customerGroups.filter(group => group.hasUnpaidCredits).length;
  const partiallyPaidCredits = customerGroups.filter(group => 
    group.credits.some(credit => credit.status === 'partially_paid')
  ).length;

  if (!restaurant) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Credits</h1>
                <p className="text-sm text-gray-600 mt-1 hidden sm:block">Manage customer credits and payments</p>
              </div>
            </div>
            
            <button
              onClick={loadCredits}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh credits"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{totalCredits}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-lg sm:text-xl font-bold text-yellow-600">{pendingCredits}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-lg sm:text-xl font-bold text-orange-600">{partiallyPaidCredits}</div>
            <div className="text-xs text-gray-600">Partial</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border">
            <div className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(totalPendingAmount)}</div>
            <div className="text-xs text-gray-600">Amount Due</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customer, phone, order ID..."
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
            
            <div className="sm:w-40">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Credits List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading credits...</p>
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No credits found' : 'No credits yet'}
            </h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Credits will appear here when customers make partial payments.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customerGroups.map(group => (
              <div key={group.customerName + group.customerPhone} className="bg-white rounded-lg shadow-sm border p-4 flex flex-col justify-between">
                      <div>
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="font-bold text-gray-900 pr-2">{group.customerName}</h3>
                      {group.customerPhone && <p className="text-sm text-gray-500">{group.customerPhone}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{group.credits.length} credit{group.credits.length > 1 ? 's' : ''}</span>
                      <div className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(group.hasUnpaidCredits ? 'pending' : 'paid')}`}>
                        {group.hasUnpaidCredits ? 'Pending' : 'Paid'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">Outstanding</span>
                      <span className="font-bold text-red-600">{formatCurrency(group.totalCreditAmount)}</span>
                    </div>
                    </div>
                  </div>
                  
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                      setShowCustomerCreditsModal(true);
                        setSelectedCustomerCredits(group.credits);
                      }}
                    className="btn btn-secondary btn-sm"
                    >
                    <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </button>
                    {group.hasUnpaidCredits && (
                      <button
                      onClick={() => handleOpenPayAllDuesModal(group)}
                      className="btn btn-success btn-sm"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                        Pay Now
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customer Credits Modal */}
        {showCustomerCreditsModal && selectedCustomerCredits.length > 0 && (
          <CustomerCreditsModal
            isOpen={showCustomerCreditsModal}
            onClose={() => setShowCustomerCreditsModal(false)}
            credits={selectedCustomerCredits}
            onMakePayment={handleMakePayment}
          />
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedCredit && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPaymentModal(false)}></div>
            
            <div className="relative w-full max-w-md mx-4 mb-0 sm:mb-4 bg-white shadow-xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="text-gray-400 hover:text-gray-600 p-2 -mr-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Customer Info */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">{selectedCredit.customerName}</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Table {selectedCredit.tableNumber} • #{selectedCredit.orderId.slice(-6)}
                  </p>
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-medium">{formatCurrency(selectedCredit.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Already Paid:</span>
                      <span className="text-green-600">{formatCurrency(selectedCredit.amountReceived + (selectedCredit.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0))}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Remaining:</span>
                      <span className="text-red-600">{formatCurrency(getRemainingAmount(selectedCredit))}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    max={getRemainingAmount(selectedCredit)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="Enter amount"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any notes about this payment..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakePayment}
                  disabled={isProcessingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isProcessingPayment ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pay All Dues Modal */}
        {showPayAllDuesModal && selectedGroupForPayment && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowPayAllDuesModal(false)}></div>
            
            <div className="relative w-full max-w-md mx-4 mb-0 sm:mb-4 bg-white shadow-xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
                <h3 className="text-lg font-semibold text-gray-900">Pay All Dues for {selectedGroupForPayment.customerName}</h3>
                <button 
                  onClick={() => setShowPayAllDuesModal(false)} 
                  className="text-gray-400 hover:text-gray-600 p-2 -mr-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Customer Info */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">{selectedGroupForPayment.customerName}</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {selectedGroupForPayment.customerPhone} • {selectedGroupForPayment.credits.length} credit{selectedGroupForPayment.credits.length > 1 ? 's' : ''}
                  </p>
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Outstanding:</span>
                      <span className="font-medium text-red-600">{formatCurrency(selectedGroupForPayment.totalCreditAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <select
                        value={payAllMethod}
                        onChange={(e) => setPayAllMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="flex justify-between">
                      <span>Notes (Optional):</span>
                      <textarea
                        value={payAllNotes}
                        onChange={(e) => setPayAllNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Add any notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Confirmation */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowPayAllDuesModal(false)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayAllDues}
                    disabled={isProcessingPayment || !selectedGroupForPayment || selectedGroupForPayment.totalCreditAmount <= 0}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CustomerCreditsModal({
  isOpen,
  onClose,
  credits,
  onMakePayment,
}) {
  if (!isOpen || !credits.length) return null;

  const totalCreditAmount = credits.reduce((sum, credit) => sum + credit.totalAmount, 0);
  
  const totalPaidAmount = credits.reduce((sum, credit) => {
    const individualTotalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
    return sum + individualTotalPaid;
  }, 0);
  
  const outstandingAmount = totalCreditAmount - totalPaidAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl mx-4 mb-0 sm:mb-4 bg-white shadow-xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              All Credits for {credits[0]?.customerName}
            </h3>
            <p className="text-sm text-gray-600">
              {credits[0]?.customerPhone} • {credits.length} credit{credits.length > 1 ? 's' : ''}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-2 -mr-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-blue-600 mb-1">Total Credits</div>
              <div className="font-bold text-blue-900">{formatCurrency(totalCreditAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Total Paid</div>
              <div className="font-bold text-green-700">{formatCurrency(totalPaidAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Outstanding</div>
              <div className="font-bold text-red-600">{formatCurrency(outstandingAmount)}</div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {credits.map((credit) => {
            const remainingAmount = getRemainingAmount(credit);
            const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
            
            return (
              <div key={credit.id} className="border border-gray-200 rounded-lg p-4">
                {/* Credit Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(credit.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(credit.status)}`}>
                      {credit.status === 'partially_paid' ? 'PARTIAL' : credit.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Table {credit.tableNumber}</div>
                    <div className="text-xs text-gray-500">#{credit.orderId.slice(-6)}</div>
                  </div>
                </div>
                
                {/* Date */}
                <div className="flex items-center gap-1 mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{credit.createdAt.toDate().toLocaleDateString()}</span>
                </div>
                
                {/* Amount Details */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Total</div>
                      <div className="font-semibold text-sm">{formatCurrency(credit.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Paid</div>
                      <div className="font-semibold text-sm text-green-600">{formatCurrency(totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Remaining</div>
                      <div className="font-bold text-sm text-red-600">{formatCurrency(remainingAmount)}</div>
                    </div>
                  </div>
                </div>
                
                {/* Payment History */}
                {credit.paymentHistory && credit.paymentHistory.length > 0 && (
                  <div className="border-t border-gray-200 pt-3 mb-3">
                    <div className="text-xs text-gray-600 mb-2">Payment History:</div>
                    <div className="space-y-1">
                      {credit.paymentHistory.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center text-xs bg-gray-100 rounded p-2">
                          <div>
                            <div>{payment.paidAt.toDate().toLocaleDateString()}</div>
                            <div className="text-gray-500">{payment.paymentMethod}</div>
                          </div>
                          <div className="font-semibold text-green-600">{formatCurrency(payment.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Action Button for this specific credit */}
                {credit.status !== 'paid' && (
                  <button
                    onClick={() => {
                      onMakePayment(credit);
                      onClose();
                    }}
                    className="w-full bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pay {formatCurrency(remainingAmount)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 