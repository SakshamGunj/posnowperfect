import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { 
  Employee, 
  CreateEmployeeRequest, 
  UpdateEmployeeRequest, 
  EmployeePermission,
  ModulePermission,
  ApiResponse 
} from '@/types';
import bcrypt from 'bcryptjs';

// Available modules for permission assignment
export const AVAILABLE_MODULES: ModulePermission[] = [
  // Core Operations
  {
    id: 'orders',
    name: 'Orders Management',
    description: 'View and manage customer orders',
    category: 'core',
    icon: 'ShoppingBag',
    defaultAccess: true
  },
  {
    id: 'take_order',
    name: 'Take Orders',
    description: 'Create new orders and process payments',
    category: 'core',
    icon: 'Plus',
    defaultAccess: true
  },
  {
    id: 'tables',
    name: 'Table Management',
    description: 'Manage table status and reservations',
    category: 'core',
    icon: 'Grid3X3',
    defaultAccess: true
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    description: 'Process payments and generate bills',
    category: 'core',
    icon: 'Receipt',
    defaultAccess: true
  },
  
  // Management Features
  {
    id: 'menu',
    name: 'Menu Management',
    description: 'Add, edit, and manage menu items',
    category: 'management',
    icon: 'ChefHat',
    defaultAccess: false
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Track and manage inventory levels',
    category: 'management',
    icon: 'Package',
    defaultAccess: false
  },
  {
    id: 'customers',
    name: 'Customer Management',
    description: 'Manage customer information and loyalty',
    category: 'management',
    icon: 'Users',
    defaultAccess: false
  },
  {
    id: 'coupons',
    name: 'Coupon Management',
    description: 'Create and manage discount coupons',
    category: 'management',
    icon: 'Gift',
    defaultAccess: false
  },
  {
    id: 'credits',
    name: 'Credit Management',
    description: 'Manage customer credits and payments',
    category: 'management',
    icon: 'CreditCard',
    defaultAccess: false
  },
  
  // Reports & Analytics
  {
    id: 'reports',
    name: 'Reports & Analytics',
    description: 'View sales reports and analytics',
    category: 'reports',
    icon: 'BarChart3',
    defaultAccess: false
  },
  {
    id: 'dashboard',
    name: 'Dashboard Analytics',
    description: 'View dashboard statistics and insights',
    category: 'reports',
    icon: 'TrendingUp',
    defaultAccess: true
  },
  
  // Settings & Configuration
  {
    id: 'settings',
    name: 'Restaurant Settings',
    description: 'Manage restaurant configuration and preferences',
    category: 'settings',
    icon: 'Settings',
    defaultAccess: false
  },
  {
    id: 'employees',
    name: 'Employee Management',
    description: 'Manage staff and their permissions (Owner only)',
    category: 'settings',
    icon: 'UserPlus',
    defaultAccess: false
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Order bulk supplies and manage wholesale orders',
    category: 'management',
    icon: 'ShoppingCart',
    defaultAccess: false
  }
];

// Simple password hashing (for demo purposes - in production use bcrypt)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

export class EmployeeService {
  // Get default permissions for new employees
  static getDefaultPermissions(): EmployeePermission[] {
    return AVAILABLE_MODULES.map(module => ({
      module: module.id,
      access: module.defaultAccess
    }));
  }

  // Create a new employee
  static async createEmployee(
    restaurantId: string, 
    ownerId: string, 
    employeeData: CreateEmployeeRequest
  ): Promise<ApiResponse<Employee>> {
    try {
      // Check if email already exists
      const existingEmployeeQuery = query(
        collection(db, 'employees'),
        where('restaurantId', '==', restaurantId),
        where('email', '==', employeeData.email)
      );
      const existingEmployees = await getDocs(existingEmployeeQuery);
      
      if (!existingEmployees.empty) {
        return {
          success: false,
          error: 'An employee with this email already exists'
        };
      }

      // Check if PIN already exists
      const existingPinQuery = query(
        collection(db, 'employees'),
        where('restaurantId', '==', restaurantId),
        where('pin', '==', employeeData.pin)
      );
      const existingPins = await getDocs(existingPinQuery);
      
      if (!existingPins.empty) {
        return {
          success: false,
          error: 'An employee with this PIN already exists'
        };
      }

      // Hash the password
      const hashedPassword = await hashPassword(employeeData.password);

      // Create employee document
      const employeeDoc = {
        restaurantId,
        name: employeeData.name,
        email: employeeData.email,
        passwordHash: hashedPassword,
        pin: employeeData.pin,
        role: employeeData.role,
        permissions: employeeData.permissions,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: ownerId
      };

      const docRef = await addDoc(collection(db, 'employees'), employeeDoc);

      const employee: Employee = {
        id: docRef.id,
        restaurantId,
        name: employeeData.name,
        email: employeeData.email,
        pin: employeeData.pin,
        role: employeeData.role,
        permissions: employeeData.permissions,
        isActive: true,
        createdAt: employeeDoc.createdAt.toDate(),
        updatedAt: employeeDoc.updatedAt.toDate(),
        createdBy: ownerId
      };

      return {
        success: true,
        data: employee,
        message: 'Employee created successfully'
      };
    } catch (error) {
      console.error('Error creating employee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create employee'
      };
    }
  }

  // Get all employees for a restaurant
  static async getEmployees(restaurantId: string): Promise<ApiResponse<Employee[]>> {
    try {
      const q = query(
        collection(db, 'employees'),
        where('restaurantId', '==', restaurantId)
      );

      const querySnapshot = await getDocs(q);
      const employees: Employee[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        employees.push({
          id: doc.id,
          restaurantId: data.restaurantId,
          name: data.name,
          email: data.email,
          pin: data.pin,
          role: data.role,
          permissions: data.permissions || [],
          isActive: data.isActive,
          lastLoginAt: data.lastLoginAt?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy
        });
      });

      // Sort employees by creation date (newest first) in JavaScript
      employees.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        success: true,
        data: employees
      };
    } catch (error) {
      console.error('Error fetching employees:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch employees'
      };
    }
  }

  // Get employee by ID
  static async getEmployee(employeeId: string): Promise<ApiResponse<Employee>> {
    try {
      const docRef = doc(db, 'employees', employeeId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Employee not found'
        };
      }

      const data = docSnap.data();
      const employee: Employee = {
        id: docSnap.id,
        restaurantId: data.restaurantId,
        name: data.name,
        email: data.email,
        pin: data.pin,
        role: data.role,
        permissions: data.permissions || [],
        isActive: data.isActive,
        lastLoginAt: data.lastLoginAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        createdBy: data.createdBy
      };

      return {
        success: true,
        data: employee
      };
    } catch (error) {
      console.error('Error fetching employee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch employee'
      };
    }
  }

  // Update employee
  static async updateEmployee(
    employeeId: string, 
    updates: UpdateEmployeeRequest
  ): Promise<ApiResponse<Employee>> {
    try {
      const docRef = doc(db, 'employees', employeeId);
      
      // Prepare update data
      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.email) updateData.email = updates.email;
      if (updates.pin) updateData.pin = updates.pin;
      if (updates.role) updateData.role = updates.role;
      if (updates.permissions) updateData.permissions = updates.permissions;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      
      if (updates.password) {
        updateData.passwordHash = await hashPassword(updates.password);
      }

      await updateDoc(docRef, updateData);

      // Fetch updated employee
      const updatedEmployee = await this.getEmployee(employeeId);
      return updatedEmployee;
    } catch (error) {
      console.error('Error updating employee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update employee'
      };
    }
  }

  // Delete employee
  static async deleteEmployee(employeeId: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, 'employees', employeeId);
      await deleteDoc(docRef);

      return {
        success: true,
        message: 'Employee deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting employee:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete employee'
      };
    }
  }

  // Employee login with email and password
  static async loginEmployee(
    email: string, 
    password: string, 
    restaurantId: string
  ): Promise<ApiResponse<Employee>> {
    try {
      const q = query(
        collection(db, 'employees'),
        where('restaurantId', '==', restaurantId),
        where('email', '==', email)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();

      // Check if employee is active
      if (!employeeData.isActive) {
        return {
          success: false,
          error: 'Your account has been deactivated. Contact your manager.'
        };
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, employeeData.passwordHash);
      
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Update last login time
      await updateDoc(doc(db, 'employees', employeeDoc.id), {
        lastLoginAt: Timestamp.now()
      });

      const employee: Employee = {
        id: employeeDoc.id,
        restaurantId: employeeData.restaurantId,
        name: employeeData.name,
        email: employeeData.email,
        pin: employeeData.pin,
        role: employeeData.role,
        permissions: employeeData.permissions || [],
        isActive: employeeData.isActive,
        lastLoginAt: new Date(),
        createdAt: employeeData.createdAt.toDate(),
        updatedAt: employeeData.updatedAt.toDate(),
        createdBy: employeeData.createdBy
      };

      return {
        success: true,
        data: employee,
        message: 'Login successful'
      };
    } catch (error) {
      console.error('Error during employee login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  // Employee login with PIN
  static async loginEmployeeWithPin(
    pin: string, 
    restaurantId: string
  ): Promise<ApiResponse<Employee>> {
    try {
      const q = query(
        collection(db, 'employees'),
        where('restaurantId', '==', restaurantId),
        where('pin', '==', pin)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return {
          success: false,
          error: 'Invalid PIN'
        };
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();

      // Check if employee is active
      if (!employeeData.isActive) {
        return {
          success: false,
          error: 'Your account has been deactivated. Contact your manager.'
        };
      }

      // Update last login time
      await updateDoc(doc(db, 'employees', employeeDoc.id), {
        lastLoginAt: Timestamp.now()
      });

      const employee: Employee = {
        id: employeeDoc.id,
        restaurantId: employeeData.restaurantId,
        name: employeeData.name,
        email: employeeData.email,
        pin: employeeData.pin,
        role: employeeData.role,
        permissions: employeeData.permissions || [],
        isActive: employeeData.isActive,
        lastLoginAt: new Date(),
        createdAt: employeeData.createdAt.toDate(),
        updatedAt: employeeData.updatedAt.toDate(),
        createdBy: employeeData.createdBy
      };

      return {
        success: true,
        data: employee,
        message: 'Login successful'
      };
    } catch (error) {
      console.error('Error during employee PIN login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  // Check if employee has permission for a module
  static hasPermission(employee: Employee, moduleId: string): boolean {
    if (!employee || !employee.permissions) return false;
    
    const permission = employee.permissions.find(p => p.module === moduleId);
    return permission ? permission.access : false;
  }

  // Get employee's accessible modules
  static getAccessibleModules(employee: Employee): ModulePermission[] {
    if (!employee || !employee.permissions) return [];
    
    return AVAILABLE_MODULES.filter(module => {
      const permission = employee.permissions.find(p => p.module === module.id);
      return permission ? permission.access : false;
    });
  }
} 