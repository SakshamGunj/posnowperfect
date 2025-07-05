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
        setSelectedCredit(null);
        setPaymentAmount('');
        setPaymentNotes('');
        loadCredits(); // Refresh the list
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

  const getRemainingAmount = (credit: CreditTransaction): number => {
    const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
    return credit.totalAmount - totalPaid;
  };

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

  const totalPendingAmount = filteredCredits
    .filter(credit => credit.status !== 'paid')
    .reduce((sum, credit) => sum + getRemainingAmount(credit), 0);

  const totalCredits = filteredCredits.length;
  const pendingCredits = filteredCredits.filter(credit => credit.status === 'pending').length;
  const partiallyPaidCredits = filteredCredits.filter(credit => credit.status === 'partially_paid').length;

  if (!restaurant) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Credit Management</h1>
              </div>
              <p className="text-gray-600">Manage customer credits and payments</p>
            </div>
            
            <div className="flex items-center gap-3">
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
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{totalCredits}</div>
            <div className="text-xs sm:text-sm text-gray-600">Total Credits</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">{pendingCredits}</div>
            <div className="text-xs sm:text-sm text-gray-600">Pending</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{partiallyPaidCredits}</div>
            <div className="text-xs sm:text-sm text-gray-600">Partial</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(totalPendingAmount)}</div>
            <div className="text-xs sm:text-sm text-gray-600">Amount Due</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer name, phone, order ID, or table..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
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
        ) : filteredCredits.length === 0 ? (
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
          <div className="space-y-4">
            {filteredCredits.map((credit) => {
              const remainingAmount = getRemainingAmount(credit);
              const totalPaid = credit.amountReceived + (credit.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
              
              return (
                <div key={credit.id} className="card p-3 sm:p-4 lg:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(credit.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(credit.status)}`}>
                              {credit.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {credit.createdAt.toDate().toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-1 text-gray-600 mb-1">
                              <User className="w-3 h-3" />
                              <span>Customer</span>
                            </div>
                            <div className="font-medium">{credit.customerName}</div>
                            {credit.customerPhone && (
                              <div className="text-gray-500 text-xs">{credit.customerPhone}</div>
                            )}
                          </div>
                          
                          <div>
                            <div className="text-gray-600 mb-1">Table & Order</div>
                            <div className="font-medium">Table {credit.tableNumber}</div>
                            <div className="text-gray-500 text-xs">Order: {credit.orderId}</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <div className="text-gray-600 mb-1">Payment Details</div>
                            <div className="font-medium">{formatCurrency(credit.totalAmount)} total</div>
                            <div className="text-green-600 text-xs">{formatCurrency(totalPaid)} paid</div>
                          </div>
                          
                          <div>
                            <div className="text-gray-600 mb-1">Remaining</div>
                            <div className="font-bold text-red-600">{formatCurrency(remainingAmount)}</div>
                            <div className="text-gray-500 text-xs capitalize">{credit.paymentMethod}</div>
                          </div>
                        </div>
                      </div>
                      
                      {credit.paymentHistory && credit.paymentHistory.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600 mb-2">Payment History:</div>
                          <div className="space-y-1">
                            {credit.paymentHistory.map((payment) => (
                              <div key={payment.id} className="flex flex-col sm:flex-row sm:justify-between text-xs gap-1">
                                <span>{payment.paidAt.toDate().toLocaleDateString()} - {payment.paymentMethod}</span>
                                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {credit.status !== 'paid' && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            setSelectedCredit(credit);
                            setPaymentAmount(remainingAmount.toString());
                            setShowPaymentModal(true);
                          }}
                          className="btn btn-theme-primary text-sm px-4 py-2 w-full sm:w-auto min-h-[44px] flex items-center justify-center"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Record Payment</span>
                          <span className="sm:hidden">Pay</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedCredit && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowPaymentModal(false)}></div>
              
              <div className="inline-block w-full max-w-md mx-4 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
                    <button 
                      onClick={() => setShowPaymentModal(false)} 
                      className="text-gray-400 hover:text-gray-600 p-2 -mr-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Payment for {selectedCredit.customerName}
                  </p>
                </div>

                <div className="px-4 sm:px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-medium">{formatCurrency(selectedCredit.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Already Paid:</span>
                        <span className="text-green-600">{formatCurrency(selectedCredit.amountReceived + (selectedCredit.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0))}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Remaining:</span>
                        <span className="text-red-600">{formatCurrency(getRemainingAmount(selectedCredit))}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      max={getRemainingAmount(selectedCredit)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter payment amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>

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

                <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMakePayment}
                    disabled={isProcessingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isProcessingPayment ? 'Processing...' : `Record Payment`}
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