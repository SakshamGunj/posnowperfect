import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Customer, ApiResponse, PaginationOptions } from '@/types';

export class CustomerService {
  private static getCollection(restaurantId: string) {
    return collection(db, `restaurants/${restaurantId}/customers`);
  }

  static async createCustomer(
    restaurantId: string,
    customerData: Partial<Customer>
  ): Promise<ApiResponse<Customer>> {
    try {
      // Check for existing customer with same phone if phone is provided
      if (customerData.phone) {
        const existingCustomers = await this.searchCustomers(restaurantId, customerData.phone);
        if (existingCustomers.success && existingCustomers.data && existingCustomers.data.length > 0) {
          const existing = existingCustomers.data[0];
          return {
            success: false,
            error: `Customer with phone ${customerData.phone} already exists as "${existing.name || 'Unnamed Customer'}"`,
            data: existing
          };
        }
      }

      const customer: Omit<Customer, 'id'> = {
        restaurantId,
        name: customerData.name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        address: customerData.address || '',
        orderHistory: [],
        totalSpent: 0,
        visitCount: 0,
        lastVisit: undefined,
        preferences: customerData.preferences || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(this.getCollection(restaurantId), {
        ...customer,
        createdAt: Timestamp.fromDate(customer.createdAt),
        updatedAt: Timestamp.fromDate(customer.updatedAt),
        lastVisit: customer.lastVisit ? Timestamp.fromDate(customer.lastVisit) : null,
      });

      const createdCustomer: Customer = {
        ...customer,
        id: docRef.id,
      };

      return {
        success: true,
        data: createdCustomer,
        message: 'Customer created successfully',
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return {
        success: false,
        error: 'Failed to create customer',
      };
    }
  }

  static async updateCustomer(
    customerId: string,
    restaurantId: string,
    updates: Partial<Customer>
  ): Promise<ApiResponse<Customer>> {
    try {
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Convert dates if provided
      if (updates.lastVisit && updates.lastVisit instanceof Date) {
        updateData.lastVisit = Timestamp.fromDate(updates.lastVisit);
      }

      await updateDoc(customerRef, updateData);

      const updatedDoc = await getDoc(customerRef);
      const updatedData = updatedDoc.data();

      if (!updatedData) {
        return {
          success: false,
          error: 'Customer data not found'
        };
      }

      const customer: Customer = {
        id: updatedDoc.id,
        restaurantId: updatedData.restaurantId,
        name: updatedData.name || '',
        email: updatedData.email || '',
        phone: updatedData.phone || '',
        address: updatedData.address || '',
        orderHistory: updatedData.orderHistory || [],
        totalSpent: updatedData.totalSpent || 0,
        visitCount: updatedData.visitCount || 0,
        lastVisit: updatedData.lastVisit?.toDate(),
        preferences: updatedData.preferences || [],
        createdAt: updatedData.createdAt?.toDate() || new Date(),
        updatedAt: updatedData.updatedAt?.toDate() || new Date(),
      };

      return {
        success: true,
        data: customer,
        message: 'Customer updated successfully',
      };
    } catch (error) {
      console.error('Error updating customer:', error);
      return {
        success: false,
        error: 'Failed to update customer',
      };
    }
  }

  static async deleteCustomer(
    customerId: string,
    restaurantId: string
  ): Promise<ApiResponse<void>> {
    try {
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      await deleteDoc(customerRef);

      return {
        success: true,
        message: 'Customer deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting customer:', error);
      return {
        success: false,
        error: 'Failed to delete customer',
      };
    }
  }

  static async getCustomerById(
    customerId: string,
    restaurantId: string
  ): Promise<ApiResponse<Customer>> {
    try {
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      const data = customerDoc.data();

      const customer: Customer = {
        id: customerDoc.id,
        restaurantId: data.restaurantId,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        orderHistory: data.orderHistory || [],
        totalSpent: data.totalSpent || 0,
        visitCount: data.visitCount || 0,
        lastVisit: data.lastVisit?.toDate(),
        preferences: data.preferences || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      console.error('Error fetching customer:', error);
      return {
        success: false,
        error: 'Failed to fetch customer',
      };
    }
  }

  static async getCustomersForRestaurant(
    restaurantId: string,
    options: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<ApiResponse<Customer[]>> {
    try {
      const q = query(
        this.getCollection(restaurantId),
        limit(options.limit)
      );

      const querySnapshot = await getDocs(q);
      const customers: Customer[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        customers.push({
          id: doc.id,
          restaurantId: data.restaurantId,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          orderHistory: data.orderHistory || [],
          totalSpent: data.totalSpent || 0,
          visitCount: data.visitCount || 0,
          lastVisit: data.lastVisit?.toDate(),
          preferences: data.preferences || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      return {
        success: true,
        data: customers,
      };
    } catch (error) {
      console.error('Error fetching customers:', error);
      return {
        success: false,
        error: 'Failed to fetch customers',
      };
    }
  }

  static async searchCustomers(
    restaurantId: string,
    searchTerm: string
  ): Promise<ApiResponse<Customer[]>> {
    try {
      const customersResult = await this.getCustomersForRestaurant(restaurantId);
      
      if (!customersResult.success || !customersResult.data) {
        return customersResult;
      }

      const filteredCustomers = customersResult.data.filter(customer =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      );

      return {
        success: true,
        data: filteredCustomers,
      };
    } catch (error) {
      console.error('Error searching customers:', error);
      return {
        success: false,
        error: 'Failed to search customers',
      };
    }
  }

  static async addOrderToCustomer(
    customerId: string,
    restaurantId: string,
    orderId: string,
    orderTotal: number
  ): Promise<ApiResponse<void>> {
    try {
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      const currentData = customerDoc.data();
      const currentOrderHistory = currentData.orderHistory || [];
      const currentTotalSpent = currentData.totalSpent || 0;
      const currentVisitCount = currentData.visitCount || 0;

      await updateDoc(customerRef, {
        orderHistory: [...currentOrderHistory, orderId],
        totalSpent: currentTotalSpent + orderTotal,
        visitCount: currentVisitCount + 1,
        lastVisit: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      return {
        success: true,
        message: 'Customer order updated successfully',
      };
    } catch (error) {
      console.error('Error adding order to customer:', error);
      return {
        success: false,
        error: 'Failed to add order to customer',
      };
    }
  }

  static async getCustomerOrderHistory(
    customerId: string,
    restaurantId: string
  ): Promise<ApiResponse<string[]>> {
    try {
      const customerRef = doc(db, `restaurants/${restaurantId}/customers`, customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        return {
          success: false,
          error: 'Customer not found',
        };
      }

      const data = customerDoc.data();
      const orderHistory = data.orderHistory || [];

      return {
        success: true,
        data: orderHistory,
      };
    } catch (error) {
      console.error('Error fetching customer order history:', error);
      return {
        success: false,
        error: 'Failed to fetch customer order history',
      };
    }
  }
} 