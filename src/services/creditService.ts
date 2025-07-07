import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CreditTransaction {
  id?: string;
  restaurantId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  orderId: string;
  tableNumber: string;
  totalAmount: number;
  amountReceived: number;
  creditAmount: number;
  paymentMethod: string;
  status: 'pending' | 'paid' | 'partially_paid';
  createdAt: Timestamp;
  paidAt?: Timestamp;
  notes?: string;
  paymentHistory: CreditPayment[];
}

export interface CreditPayment {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: Timestamp;
  notes?: string;
}

export class CreditService {
  // Create a new credit transaction
  static async createCreditTransaction(data: {
    restaurantId: string;
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    orderId: string;
    tableNumber: string;
    totalAmount: number;
    amountReceived: number;
    paymentMethod: string;
    notes?: string;
  }): Promise<{ success: boolean; creditId?: string; error?: string }> {
    try {
      const creditAmount = data.totalAmount - data.amountReceived;
      
      const creditTransaction: Omit<CreditTransaction, 'id'> = {
        restaurantId: data.restaurantId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        orderId: data.orderId,
        tableNumber: data.tableNumber,
        totalAmount: data.totalAmount,
        amountReceived: data.amountReceived,
        creditAmount,
        paymentMethod: data.paymentMethod,
        status: 'pending',
        createdAt: Timestamp.now(),
        notes: data.notes,
        paymentHistory: []
      };

      const docRef = await addDoc(collection(db, 'creditTransactions'), creditTransaction);
      
      return { success: true, creditId: docRef.id };
    } catch (error) {
      console.error('Error creating credit transaction:', error);
      return { success: false, error: 'Failed to create credit transaction' };
    }
  }

  // Get all credit transactions for a restaurant
  static async getCreditTransactions(restaurantId: string): Promise<{ success: boolean; data?: CreditTransaction[]; error?: string }> {
    try {
      const q = query(
        collection(db, 'creditTransactions'),
        where('restaurantId', '==', restaurantId)
      );

      const querySnapshot = await getDocs(q);
      const transactions: CreditTransaction[] = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() } as CreditTransaction);
      });

      // Sort by createdAt in descending order on the client side
      transactions.sort((a, b) => {
        try {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt.toMillis();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt.toMillis();
          return bTime - aTime;
        } catch (error) {
          // Fallback sorting if timestamp conversion fails
          console.warn('Error sorting credit transactions by date:', error);
          return 0;
        }
      });

      return { success: true, data: transactions };
    } catch (error) {
      console.error('Error fetching credit transactions:', error);
      return { success: false, error: 'Failed to fetch credit transactions' };
    }
  }

  // Make a payment towards a credit
  static async makePayment(
    creditId: string,
    paymentAmount: number,
    paymentMethod: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const creditRef = doc(db, 'creditTransactions', creditId);
      const creditDoc = await getDoc(creditRef);
      
      if (!creditDoc.exists()) {
        return { success: false, error: 'Credit transaction not found' };
      }

      const creditData = creditDoc.data() as CreditTransaction;
      const newPayment: CreditPayment = {
        id: Date.now().toString(),
        amount: paymentAmount,
        paymentMethod,
        paidAt: Timestamp.now(),
        notes
      };

      const updatedPaymentHistory = [...(creditData.paymentHistory || []), newPayment];
      const totalPaid = creditData.amountReceived + updatedPaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
      const remainingCredit = creditData.totalAmount - totalPaid;

      let newStatus: 'pending' | 'paid' | 'partially_paid' = 'pending';
      if (remainingCredit <= 0) {
        newStatus = 'paid';
      } else if (totalPaid > creditData.amountReceived) {
        newStatus = 'partially_paid';
      }

      const updateData: any = {
        paymentHistory: updatedPaymentHistory,
        status: newStatus
      };

      if (newStatus === 'paid') {
        updateData.paidAt = Timestamp.now();
      }

      await updateDoc(creditRef, updateData);

      return { success: true };
    } catch (error) {
      console.error('Error making credit payment:', error);
      return { success: false, error: 'Failed to process payment' };
    }
  }

  // Pay all dues for a customer
  static async payAllDuesForCustomer(
    restaurantId: string,
    customerName: string,
    customerPhone: string,
    paymentMethod: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const q = query(
        collection(db, 'creditTransactions'),
        where('restaurantId', '==', restaurantId),
        where('customerName', '==', customerName),
        where('customerPhone', '==', customerPhone)
      );

      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      
      let paymentsMade = 0;

      querySnapshot.forEach((docSnap) => {
        const creditData = docSnap.data() as CreditTransaction;
        if (creditData.status !== 'paid') {
          const totalPaid = creditData.amountReceived + (creditData.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
          const remainingAmount = creditData.totalAmount - totalPaid;

          if (remainingAmount > 0) {
            const newPayment: CreditPayment = {
              id: Date.now().toString() + Math.random(),
              amount: remainingAmount,
              paymentMethod: paymentMethod,
              paidAt: Timestamp.now(),
              notes: notes || 'Full settlement of dues.'
            };
            
            const updatedPaymentHistory = [...(creditData.paymentHistory || []), newPayment];

            batch.update(docSnap.ref, {
              paymentHistory: updatedPaymentHistory,
              status: 'paid',
              paidAt: Timestamp.now()
            });
            paymentsMade++;
          }
        }
      });
      
      if (paymentsMade === 0) {
        return { success: true, error: 'No outstanding dues to pay.' };
      }

      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error('Error settling all dues:', error);
      return { success: false, error: 'Failed to settle all dues.' };
    }
  }

  // Get credit summary for a restaurant
  static async getCreditSummary(restaurantId: string): Promise<{
    success: boolean;
    data?: {
      totalPendingCredits: number;
      totalCreditAmount: number;
      totalTransactions: number;
      recentTransactions: CreditTransaction[];
    };
    error?: string;
  }> {
    try {
      const result = await this.getCreditTransactions(restaurantId);
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const transactions = result.data;
      const pendingTransactions = transactions.filter(t => t.status === 'pending' || t.status === 'partially_paid');
      
      const totalPendingCredits = pendingTransactions.length;
      const totalCreditAmount = pendingTransactions.reduce((sum, t) => {
        const totalPaid = t.amountReceived + (t.paymentHistory || []).reduce((pSum, p) => pSum + p.amount, 0);
        return sum + (t.totalAmount - totalPaid);
      }, 0);

      return {
        success: true,
        data: {
          totalPendingCredits,
          totalCreditAmount,
          totalTransactions: transactions.length,
          recentTransactions: transactions.slice(0, 10)
        }
      };
    } catch (error) {
      console.error('Error getting credit summary:', error);
      return { success: false, error: 'Failed to get credit summary' };
    }
  }
} 