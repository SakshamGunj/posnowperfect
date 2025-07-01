import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { 
  Expense, 
  CreateExpenseRequest, 
  UpdateExpenseRequest, 
  ExpenseFilters, 
  ExpenseStats,
  ExpenseAnalytics,
  ApiResponse 
} from '@/types';
import { generateId } from '@/lib/utils';

// Collections
const EXPENSES_COLLECTION = 'expenses';

// Cache for expenses
const expenseCache = new Map<string, { 
  expenses: Expense[]; 
  timestamp: number; 
  expiresAt: number; 
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class ExpenseService {
  // Create new expense
  static async createExpense(
    restaurantId: string, 
    data: CreateExpenseRequest, 
    createdBy: string
  ): Promise<ApiResponse<Expense>> {
    try {
      // First, get the category name from the category service
      let categoryName = data.categoryId;
      try {
        const { ExpenseCategoryService } = await import('./expenseCategoryService');
        const categoryResult = await ExpenseCategoryService.getCategoryById(restaurantId, data.categoryId);
        if (categoryResult.success && categoryResult.data) {
          categoryName = categoryResult.data.name;
        }
      } catch (error) {
        console.warn('Failed to fetch category name, using ID:', error);
      }

      const expenseData = {
        id: generateId(),
        restaurantId,
        categoryId: data.categoryId,
        categoryName: categoryName, // Now properly populated with actual category name
        title: data.title,
        description: data.description || '',
        amount: data.amount,
        currency: 'INR', // Default to INR, can be made configurable
        paymentMethod: data.paymentMethod,
        expenseDate: Timestamp.fromDate(data.expenseDate),
        dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
        paidDate: null,
        status: 'approved' as const,
        approvedBy: createdBy,
        approvedAt: Timestamp.now(),
        rejectionReason: null,
        vendor: data.vendor || null,
        receiptImage: data.receiptImage || null,
        invoiceNumber: data.invoiceNumber || null,
        reference: data.reference || null,
        notes: data.notes || null,
        isRecurring: data.isRecurring || false,
        recurrence: data.recurrence || null,
        tags: data.tags || [],
        createdBy,
        updatedBy: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const expensesRef = collection(db, 'restaurants', restaurantId, EXPENSES_COLLECTION);
      const docRef = await addDoc(expensesRef, expenseData);

      // Clear cache
      this.clearCache(restaurantId);

      const expense = this.convertFirestoreDoc({ ...expenseData, id: docRef.id }, docRef.id);

      console.log('✅ Expense created successfully:', expense.id);
      
      return {
        success: true,
        data: expense,
        message: 'Expense created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get all expenses for restaurant
  static async getExpensesForRestaurant(
    restaurantId: string,
    filters?: ExpenseFilters,
    pagination?: { limit?: number; startAfter?: QueryDocumentSnapshot<DocumentData> }
  ): Promise<ApiResponse<Expense[]>> {
    try {
      // Check cache first
      const cacheKey = `${restaurantId}_${JSON.stringify(filters)}`;
      const cached = expenseCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt && !filters?.dateRange) {
        return {
          success: true,
          data: cached.expenses,
        };
      }

      const expensesRef = collection(db, 'restaurants', restaurantId, EXPENSES_COLLECTION);
      let q = query(expensesRef, orderBy('createdAt', 'desc'));

      // Apply filters
      if (filters) {
        if (filters.categoryIds && filters.categoryIds.length > 0) {
          q = query(q, where('categoryId', 'in', filters.categoryIds));
        }
        if (filters.status && filters.status.length > 0) {
          q = query(q, where('status', 'in', filters.status));
        }
        if (filters.paymentMethods && filters.paymentMethods.length > 0) {
          q = query(q, where('paymentMethod', 'in', filters.paymentMethods));
        }
        if (filters.isRecurring !== undefined) {
          q = query(q, where('isRecurring', '==', filters.isRecurring));
        }
      }

      // Apply pagination
      if (pagination?.limit) {
        q = query(q, limit(pagination.limit));
      }
      if (pagination?.startAfter) {
        q = query(q, startAfter(pagination.startAfter));
      }

      const querySnapshot = await getDocs(q);
      let expenses = querySnapshot.docs.map(doc =>
        this.convertFirestoreDoc(doc.data(), doc.id)
      );

      // Ensure category names are properly populated for all expenses
      expenses = await this.populateCategoryNames(restaurantId, expenses);

      // Apply client-side filters for complex queries
      if (filters) {
        if (filters.dateRange) {
          expenses = expenses.filter(expense => {
            const expenseDate = expense.expenseDate;
            return expenseDate >= filters.dateRange!.start && expenseDate <= filters.dateRange!.end;
          });
        }
        if (filters.amountRange) {
          expenses = expenses.filter(expense => 
            expense.amount >= (filters.amountRange!.min || 0) && 
            expense.amount <= (filters.amountRange!.max || Infinity)
          );
        }
        if (filters.vendors && filters.vendors.length > 0) {
          expenses = expenses.filter(expense => 
            expense.vendor && filters.vendors!.includes(expense.vendor.name)
          );
        }
        if (filters.tags && filters.tags.length > 0) {
          expenses = expenses.filter(expense => 
            expense.tags && expense.tags.some(tag => filters.tags!.includes(tag))
          );
        }
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          expenses = expenses.filter(expense => 
            expense.title.toLowerCase().includes(searchLower) ||
            expense.description?.toLowerCase().includes(searchLower) ||
            expense.vendor?.name.toLowerCase().includes(searchLower)
          );
        }
      }

      // Cache the results (only if no complex filters)
      if (!filters?.dateRange && !filters?.amountRange && !filters?.searchTerm) {
        expenseCache.set(cacheKey, {
          expenses,
          timestamp: Date.now(),
          expiresAt: Date.now() + CACHE_DURATION,
        });
      }

      return {
        success: true,
        data: expenses,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expenses:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get expense by ID
  static async getExpenseById(restaurantId: string, expenseId: string): Promise<ApiResponse<Expense>> {
    try {
      const docRef = doc(db, 'restaurants', restaurantId, EXPENSES_COLLECTION, expenseId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return {
          success: false,
          error: 'Expense not found',
        };
      }

      const expense = this.convertFirestoreDoc(docSnapshot.data(), docSnapshot.id);

      return {
        success: true,
        data: expense,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Update expense
  static async updateExpense(
    restaurantId: string, 
    expenseId: string, 
    updates: UpdateExpenseRequest, 
    updatedBy: string
  ): Promise<ApiResponse<Expense>> {
    try {
      const docRef = doc(db, 'restaurants', restaurantId, EXPENSES_COLLECTION, expenseId);
      
      const updateData: any = {
        ...updates,
        updatedBy,
        updatedAt: Timestamp.now(),
      };

      // Convert dates to Timestamps
      if (updates.expenseDate) {
        updateData.expenseDate = Timestamp.fromDate(updates.expenseDate);
      }
      if (updates.dueDate) {
        updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      }

      await updateDoc(docRef, updateData);

      // Clear cache
      this.clearCache(restaurantId);

      // Get updated expense
      const result = await this.getExpenseById(restaurantId, expenseId);
      
      console.log('✅ Expense updated successfully:', expenseId);
      
      return result;
    } catch (error: any) {
      console.error('❌ Failed to update expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Delete expense
  static async deleteExpense(restaurantId: string, expenseId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, 'restaurants', restaurantId, EXPENSES_COLLECTION, expenseId);
      await deleteDoc(docRef);

      // Clear cache
      this.clearCache(restaurantId);

      console.log('✅ Expense deleted successfully:', expenseId);
      
      return {
        success: true,
        message: 'Expense deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Approve expense
  static async approveExpense(
    restaurantId: string, 
    expenseId: string, 
    approvedBy: string
  ): Promise<ApiResponse<Expense>> {
    try {
      const updates = {
        status: 'approved' as const,
        approvedBy,
        approvedAt: new Date(),
        rejectionReason: null,
      };

      return await this.updateExpense(restaurantId, expenseId, updates, approvedBy);
    } catch (error: any) {
      console.error('❌ Failed to approve expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Reject expense
  static async rejectExpense(
    restaurantId: string, 
    expenseId: string, 
    rejectionReason: string, 
    rejectedBy: string
  ): Promise<ApiResponse<Expense>> {
    try {
      const updates = {
        status: 'rejected' as const,
        rejectionReason,
        approvedBy: null,
        approvedAt: null,
      };

      return await this.updateExpense(restaurantId, expenseId, updates, rejectedBy);
    } catch (error: any) {
      console.error('❌ Failed to reject expense:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Mark expense as paid
  static async markAsPaid(
    restaurantId: string, 
    expenseId: string, 
    updatedBy: string
  ): Promise<ApiResponse<Expense>> {
    try {
      const updates = {
        status: 'paid' as const,
        paidDate: new Date(),
      };

      return await this.updateExpense(restaurantId, expenseId, updates, updatedBy);
    } catch (error: any) {
      console.error('❌ Failed to mark expense as paid:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get expense statistics for dashboard
  static async getExpenseStats(restaurantId: string): Promise<ApiResponse<ExpenseStats>> {
    try {
      const result = await this.getExpensesForRestaurant(restaurantId);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch expenses'
        };
      }

      const expenses = result.data;
      const now = new Date();
      
      // Create proper date boundaries for accurate filtering
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

      // Filter expenses by time periods with proper date comparison
      const todayExpenses = expenses
        .filter(e => e.expenseDate >= todayStart && e.expenseDate <= todayEnd)
        .reduce((sum, e) => sum + e.amount, 0);

      const weekExpenses = expenses
        .filter(e => e.expenseDate >= weekStart)
        .reduce((sum, e) => sum + e.amount, 0);

      const monthExpenses = expenses
        .filter(e => e.expenseDate >= monthStart)
        .reduce((sum, e) => sum + e.amount, 0);

      const yearExpenses = expenses
        .filter(e => e.expenseDate >= yearStart)
        .reduce((sum, e) => sum + e.amount, 0);

      const pendingExpenses = expenses.filter(e => e.status === 'pending').length;
      const overdueExpenses = expenses.filter(e => 
        e.dueDate && e.dueDate < now && e.status !== 'paid'
      ).length;
      const recurringExpenses = expenses.filter(e => e.isRecurring).length;

      // Calculate averages
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const currentDay = now.getDate();
      const avgDailyExpense = currentDay > 0 ? monthExpenses / currentDay : 0;
      const currentMonth = now.getMonth() + 1;
      const avgMonthlyExpense = currentMonth > 0 ? yearExpenses / currentMonth : 0;

      // Find top category with improved category name handling
      const categoryTotals = new Map<string, { amount: number; name: string }>();
      expenses.forEach(expense => {
        const categoryId = expense.categoryId;
        const categoryName = expense.categoryName || expense.categoryId || 'Unknown';
        const current = categoryTotals.get(categoryId) || { amount: 0, name: categoryName };
        categoryTotals.set(categoryId, {
          amount: current.amount + expense.amount,
          name: categoryName // Use the most recent/best category name
        });
      });

      const topCategoryEntry = Array.from(categoryTotals.entries())
        .sort(([,a], [,b]) => b.amount - a.amount)[0];

      const topCategory = topCategoryEntry ? {
        id: topCategoryEntry[0],
        name: topCategoryEntry[1].name,
        amount: topCategoryEntry[1].amount
      } : {
        id: '',
        name: 'No expenses',
        amount: 0
      };

      const stats: ExpenseStats = {
        todayExpenses,
        weekExpenses,
        monthExpenses,
        yearExpenses,
        pendingExpenses,
        overdueExpenses,
        recurringExpenses,
        avgDailyExpense,
        avgMonthlyExpense,
        topCategory,
        totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
        totalExpenseCount: expenses.length,
        approvedExpenses: expenses.filter(e => e.status === 'approved').length,
        paidExpenses: expenses.filter(e => e.status === 'paid').length,
        rejectedExpenses: expenses.filter(e => e.status === 'rejected').length,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense stats:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get expense analytics
  static async getExpenseAnalytics(restaurantId: string): Promise<ApiResponse<ExpenseAnalytics>> {
    try {
      const result = await this.getExpensesForRestaurant(restaurantId);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch expenses'
        };
      }

      const expenses = result.data;
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const monthlyExpenses = expenses
        .filter(e => e.expenseDate >= monthStart)
        .reduce((sum, e) => sum + e.amount, 0);

      const yearlyExpenses = expenses
        .filter(e => e.expenseDate >= yearStart)
        .reduce((sum, e) => sum + e.amount, 0);

      const averageMonthlyExpense = yearlyExpenses / (now.getMonth() + 1);

      // Category breakdown
      const categoryMap = new Map<string, { amount: number; count: number }>();
      expenses.forEach(expense => {
        const key = expense.categoryId;
        const current = categoryMap.get(key) || { amount: 0, count: 0 };
        categoryMap.set(key, {
          amount: current.amount + expense.amount,
          count: current.count + 1,
        });
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
        const expense = expenses.find(e => e.categoryId === categoryId);
        return {
          categoryId,
          categoryName: expense?.categoryName || categoryId,
          amount: data.amount,
          percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
          count: data.count,
        };
      });

      // Monthly trends (last 12 months)
      const monthlyTrends = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const monthExpenses = expenses.filter(e => 
          e.expenseDate >= date && e.expenseDate < nextMonth
        );
        
        monthlyTrends.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          amount: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
          count: monthExpenses.length,
        });
      }

      // Top vendors
      const vendorMap = new Map<string, { amount: number; count: number }>();
      expenses.forEach(expense => {
        if (expense.vendor?.name) {
          const current = vendorMap.get(expense.vendor.name) || { amount: 0, count: 0 };
          vendorMap.set(expense.vendor.name, {
            amount: current.amount + expense.amount,
            count: current.count + 1,
          });
        }
      });

      const topVendors = Array.from(vendorMap.entries())
        .map(([vendorName, data]) => ({
          vendorName,
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Payment method breakdown
      const paymentMethodMap = new Map<string, { amount: number; count: number }>();
      expenses.forEach(expense => {
        const current = paymentMethodMap.get(expense.paymentMethod) || { amount: 0, count: 0 };
        paymentMethodMap.set(expense.paymentMethod, {
          amount: current.amount + expense.amount,
          count: current.count + 1,
        });
      });

      const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
        method: method as any,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        count: data.count,
      }));

      const analytics: ExpenseAnalytics = {
        totalExpenses,
        monthlyExpenses,
        yearlyExpenses,
        averageMonthlyExpense,
        categoryBreakdown,
        monthlyTrends,
        topVendors,
        budgetPerformance: [], // Will be populated when budget feature is implemented
        paymentMethodBreakdown,
      };

      return {
        success: true,
        data: analytics,
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense analytics:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Subscribe to expenses (real-time)
  static subscribeToExpenses(
    restaurantId: string,
    callback: (expenses: Expense[]) => void,
    filters?: ExpenseFilters
  ): () => void {
    try {
      const expensesRef = collection(db, 'restaurants', restaurantId, EXPENSES_COLLECTION);
      let q = query(expensesRef, orderBy('createdAt', 'desc'));

      // Apply basic filters
      if (filters?.categoryIds && filters.categoryIds.length > 0) {
        q = query(q, where('categoryId', 'in', filters.categoryIds));
      }
      if (filters?.status && filters.status.length > 0) {
        q = query(q, where('status', 'in', filters.status));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let expenses = querySnapshot.docs.map(doc =>
          this.convertFirestoreDoc(doc.data(), doc.id)
        );

        // Apply client-side filters
        if (filters) {
          if (filters.dateRange) {
            expenses = expenses.filter(expense => {
              const expenseDate = expense.expenseDate;
              return expenseDate >= filters.dateRange!.start && expenseDate <= filters.dateRange!.end;
            });
          }
          if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            expenses = expenses.filter(expense => 
              expense.title.toLowerCase().includes(searchLower) ||
              expense.description?.toLowerCase().includes(searchLower) ||
              expense.vendor?.name.toLowerCase().includes(searchLower)
            );
          }
        }

        callback(expenses);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Failed to subscribe to expenses:', error);
      return () => {};
    }
  }

  // Convert Firestore document to Expense object
  private static convertFirestoreDoc(data: any, id: string): Expense {
    return {
      id,
      restaurantId: data.restaurantId,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      title: data.title,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      expenseDate: data.expenseDate?.toDate() || new Date(),
      dueDate: data.dueDate?.toDate() || null,
      paidDate: data.paidDate?.toDate() || null,
      status: data.status,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt?.toDate() || null,
      rejectionReason: data.rejectionReason,
      vendor: data.vendor,
      receiptImage: data.receiptImage,
      invoiceNumber: data.invoiceNumber,
      reference: data.reference,
      notes: data.notes,
      isRecurring: data.isRecurring || false,
      recurrence: data.recurrence,
      tags: data.tags || [],
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  // Clear cache
  static clearCache(restaurantId: string): void {
    Array.from(expenseCache.keys()).forEach(key => {
      if (key.startsWith(restaurantId)) {
        expenseCache.delete(key);
      }
    });
  }

  // Helper method to populate category names for expenses
  private static async populateCategoryNames(restaurantId: string, expenses: Expense[]): Promise<Expense[]> {
    try {
      // Get all unique category IDs that need names
      const categoryIds = [...new Set(expenses.map(e => e.categoryId))];
      const categoryMap = new Map<string, string>();

      // Import the category service dynamically to avoid circular dependencies
      const { ExpenseCategoryService } = await import('./expenseCategoryService');
      const categoriesResult = await ExpenseCategoryService.getCategoriesForRestaurant(restaurantId);
      
      if (categoriesResult.success && categoriesResult.data) {
        categoriesResult.data.forEach(category => {
          categoryMap.set(category.id, category.name);
        });
      }

      // Update expense category names
      return expenses.map(expense => ({
        ...expense,
        categoryName: categoryMap.get(expense.categoryId) || expense.categoryName || expense.categoryId
      }));
    } catch (error) {
      console.warn('Failed to populate category names:', error);
      return expenses;
    }
  }

  // Get expenses for a specific date range (used by reports)
  static async getExpensesForPeriod(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApiResponse<Expense[]>> {
    try {
      // Create filter with date range
      const filters: ExpenseFilters = {
        dateRange: {
          start: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0),
          end: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)
        }
      };

      // Use the existing method with proper filters
      const result = await this.getExpensesForRestaurant(restaurantId, filters);
      
      if (result.success && result.data) {
        console.log(`📊 Retrieved ${result.data.length} expenses for period ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      }

      return result;
    } catch (error: any) {
      console.error('❌ Failed to get expenses for period:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get expense summary for a specific period
  static async getExpenseSummaryForPeriod(
    restaurantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApiResponse<{
    totalAmount: number;
    expenseCount: number;
    categoryBreakdown: { [key: string]: number };
    averageExpense: number;
    largestExpense: number;
    expenses: Expense[];
  }>> {
    try {
      const result = await this.getExpensesForPeriod(restaurantId, startDate, endDate);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to fetch expenses for period'
        };
      }

      const expenses = result.data;
      const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
      const expenseCount = expenses.length;
      const averageExpense = expenseCount > 0 ? totalAmount / expenseCount : 0;
      const largestExpense = expenseCount > 0 ? Math.max(...expenses.map(e => e.amount)) : 0;

      // Create category breakdown with proper names
      const categoryBreakdown = expenses.reduce((acc: { [key: string]: number }, expense) => {
        const categoryName = expense.categoryName || expense.categoryId || 'Unknown';
        acc[categoryName] = (acc[categoryName] || 0) + expense.amount;
        return acc;
      }, {});

      return {
        success: true,
        data: {
          totalAmount,
          expenseCount,
          categoryBreakdown,
          averageExpense,
          largestExpense,
          expenses
        }
      };
    } catch (error: any) {
      console.error('❌ Failed to get expense summary for period:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
} 