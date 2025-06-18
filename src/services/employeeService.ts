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
  // =================== CORE OPERATIONS ===================
  {
    id: 'orders',
    name: 'Orders Management',
    description: 'View, manage, and track customer orders across all channels',
    category: 'core',
    icon: 'ShoppingBag',
    defaultAccess: true
  },
  {
    id: 'take_order',
    name: 'Take Orders',
    description: 'Create new orders, add items, and process customer requests',
    category: 'core',
    icon: 'Plus',
    defaultAccess: true
  },
  {
    id: 'order_modification',
    name: 'Order Modification',
    description: 'Edit, cancel, and modify existing orders',
    category: 'core',
    icon: 'Edit',
    defaultAccess: true
  },
  {
    id: 'tables',
    name: 'Table Management',
    description: 'Manage table status, reservations, and seating arrangements',
    category: 'core',
    icon: 'Grid3X3',
    defaultAccess: true
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    description: 'Process payments, generate bills, and handle transactions',
    category: 'core',
    icon: 'Receipt',
    defaultAccess: true
  },
  {
    id: 'kitchen_display',
    name: 'Kitchen Display System',
    description: 'Access kitchen display, manage KOT printing, and track preparation',
    category: 'core',
    icon: 'ChefHat',
    defaultAccess: true
  },

  // =================== ADVANCED OPERATIONS ===================
  {
    id: 'voice_commands',
    name: 'Voice Command System',
    description: 'Use voice commands for orders, payments, and table management',
    category: 'management',
    icon: 'Mic',
    defaultAccess: false
  },
  {
    id: 'table_operations',
    name: 'Advanced Table Operations',
    description: 'Table merging, transfers, and advanced table management',
    category: 'management',
    icon: 'ArrowLeftRight',
    defaultAccess: false
  },
  {
    id: 'bulk_operations',
    name: 'Bulk Operations',
    description: 'Bulk menu imports, bulk table operations, and mass updates',
    category: 'management',
    icon: 'Database',
    defaultAccess: false
  },

  // =================== MENU & INVENTORY ===================
  {
    id: 'menu',
    name: 'Menu Management',
    description: 'Add, edit, and manage menu items, categories, and pricing',
    category: 'management',
    icon: 'ChefHat',
    defaultAccess: false
  },
  {
    id: 'menu_categories',
    name: 'Category Management',
    description: 'Create and manage menu categories and organization',
    category: 'management',
    icon: 'FolderOpen',
    defaultAccess: false
  },
  {
    id: 'variant_management',
    name: 'Product Variants',
    description: 'Manage menu item variants, sizes, and customizations',
    category: 'management',
    icon: 'Settings',
    defaultAccess: false
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Track inventory levels, manage stock, and monitor usage',
    category: 'management',
    icon: 'Package',
    defaultAccess: false
  },
  {
    id: 'inventory_alerts',
    name: 'Inventory Alerts',
    description: 'Receive and manage low stock alerts and notifications',
    category: 'management',
    icon: 'AlertTriangle',
    defaultAccess: false
  },
  {
    id: 'supplier_management',
    name: 'Supplier Management',
    description: 'Manage suppliers, procurement, and vendor relationships',
    category: 'management',
    icon: 'Truck',
    defaultAccess: false
  },

  // =================== CUSTOMER MANAGEMENT ===================
  {
    id: 'customers',
    name: 'Customer Management',
    description: 'Manage customer profiles, preferences, and contact information',
    category: 'management',
    icon: 'Users',
    defaultAccess: false
  },
  {
    id: 'customer_history',
    name: 'Customer Order History',
    description: 'View customer order history, preferences, and visit patterns',
    category: 'management',
    icon: 'History',
    defaultAccess: false
  },
  {
    id: 'loyalty_points',
    name: 'Loyalty Points System',
    description: 'Manage customer loyalty points, tiers, and rewards',
    category: 'management',
    icon: 'Star',
    defaultAccess: false
  },
  {
    id: 'customer_insights',
    name: 'Customer Analytics',
    description: 'Access customer behavior analytics and insights',
    category: 'management',
    icon: 'TrendingUp',
    defaultAccess: false
  },

  // =================== GAMIFICATION & PROMOTIONS ===================
  {
    id: 'gamification',
    name: 'Gamification System',
    description: 'Manage spin wheels, games, and customer engagement tools',
    category: 'management',
    icon: 'Gamepad2',
    defaultAccess: false
  },
  {
    id: 'spin_wheel_management',
    name: 'Spin Wheel Configuration',
    description: 'Create and configure spin wheel games and rewards',
    category: 'management',
    icon: 'RotateCcw',
    defaultAccess: false
  },
  {
    id: 'coupons',
    name: 'Coupon Management',
    description: 'Create, edit, and manage discount coupons and promotions',
    category: 'management',
    icon: 'Gift',
    defaultAccess: false
  },
  {
    id: 'promotions',
    name: 'Promotions & Campaigns',
    description: 'Design and manage marketing campaigns and special offers',
    category: 'management',
    icon: 'Megaphone',
    defaultAccess: false
  },
  {
    id: 'rewards_redemption',
    name: 'Rewards Redemption',
    description: 'Process reward claims and coupon redemptions',
    category: 'management',
    icon: 'Award',
    defaultAccess: false
  },

  // =================== FINANCIAL MANAGEMENT ===================
  {
    id: 'credits',
    name: 'Credit Management',
    description: 'Manage customer credits, payments, and account balances',
    category: 'management',
    icon: 'CreditCard',
    defaultAccess: false
  },
  {
    id: 'payment_methods',
    name: 'Payment Methods',
    description: 'Configure and manage accepted payment methods',
    category: 'management',
    icon: 'Wallet',
    defaultAccess: false
  },
  {
    id: 'discounts',
    name: 'Discount Management',
    description: 'Apply discounts, manage pricing rules, and special rates',
    category: 'management',
    icon: 'Percent',
    defaultAccess: false
  },
  {
    id: 'refunds',
    name: 'Refunds & Returns',
    description: 'Process refunds, returns, and payment reversals',
    category: 'management',
    icon: 'RotateCcw',
    defaultAccess: false
  },

  // =================== MARKETPLACE & PROCUREMENT ===================
  {
    id: 'marketplace',
    name: 'Marketplace Access',
    description: 'Access wholesale marketplace and supplier catalog',
    category: 'management',
    icon: 'ShoppingCart',
    defaultAccess: false
  },
  {
    id: 'marketplace_ordering',
    name: 'Marketplace Ordering',
    description: 'Place orders for bulk supplies and manage procurement',
    category: 'management',
    icon: 'PackageCheck',
    defaultAccess: false
  },
  {
    id: 'marketplace_analytics',
    name: 'Procurement Analytics',
    description: 'View marketplace spending, supplier performance, and cost savings',
    category: 'management',
    icon: 'BarChart3',
    defaultAccess: false
  },
  {
    id: 'supplier_contracts',
    name: 'Supplier Contracts',
    description: 'Manage long-term supplier contracts and agreements',
    category: 'management',
    icon: 'FileText',
    defaultAccess: false
  },

  // =================== REPORTS & ANALYTICS ===================
  {
    id: 'reports',
    name: 'Sales Reports',
    description: 'Generate and view detailed sales reports and analytics',
    category: 'reports',
    icon: 'BarChart3',
    defaultAccess: false
  },
  {
    id: 'dashboard',
    name: 'Dashboard Analytics',
    description: 'View dashboard statistics, KPIs, and business insights',
    category: 'reports',
    icon: 'TrendingUp',
    defaultAccess: true
  },
  {
    id: 'financial_reports',
    name: 'Financial Reports',
    description: 'Access P&L, revenue reports, and financial analytics',
    category: 'reports',
    icon: 'DollarSign',
    defaultAccess: false
  },
  {
    id: 'inventory_reports',
    name: 'Inventory Reports',
    description: 'View inventory usage, waste reports, and stock analytics',
    category: 'reports',
    icon: 'Package',
    defaultAccess: false
  },
  {
    id: 'customer_reports',
    name: 'Customer Reports',
    description: 'Generate customer behavior, loyalty, and satisfaction reports',
    category: 'reports',
    icon: 'Users',
    defaultAccess: false
  },
  {
    id: 'staff_performance',
    name: 'Staff Performance Reports',
    description: 'View employee performance metrics and productivity reports',
    category: 'reports',
    icon: 'UserCheck',
    defaultAccess: false
  },
  {
    id: 'export_data',
    name: 'Data Export',
    description: 'Export reports and data in various formats (PDF, Excel, CSV)',
    category: 'reports',
    icon: 'Download',
    defaultAccess: false
  },

  // =================== SYSTEM SETTINGS ===================
  {
    id: 'settings',
    name: 'Restaurant Settings',
    description: 'Manage restaurant configuration, preferences, and system settings',
    category: 'settings',
    icon: 'Settings',
    defaultAccess: false
  },
  {
    id: 'employees',
    name: 'Employee Management',
    description: 'Manage staff accounts, permissions, and access control (Owner only)',
    category: 'settings',
    icon: 'UserPlus',
    defaultAccess: false
  },
  {
    id: 'system_configuration',
    name: 'System Configuration',
    description: 'Configure POS system settings, integrations, and preferences',
    category: 'settings',
    icon: 'Cog',
    defaultAccess: false
  },
  {
    id: 'backup_restore',
    name: 'Backup & Restore',
    description: 'Manage data backups, restore operations, and data recovery',
    category: 'settings',
    icon: 'Database',
    defaultAccess: false
  },
  {
    id: 'security_settings',
    name: 'Security Settings',
    description: 'Manage security policies, access controls, and audit logs',
    category: 'settings',
    icon: 'Shield',
    defaultAccess: false
  },

  // =================== COMMUNICATION & NOTIFICATIONS ===================
  {
    id: 'notifications',
    name: 'Notification Management',
    description: 'Manage system notifications, alerts, and communication settings',
    category: 'settings',
    icon: 'Bell',
    defaultAccess: false
  },
  {
    id: 'customer_communication',
    name: 'Customer Communication',
    description: 'Send SMS, email notifications, and customer updates',
    category: 'management',
    icon: 'MessageSquare',
    defaultAccess: false
  },
  {
    id: 'marketing_tools',
    name: 'Marketing Tools',
    description: 'Access marketing automation, campaigns, and customer outreach',
    category: 'management',
    icon: 'Megaphone',
    defaultAccess: false
  },

  // =================== ADVANCED FEATURES ===================
  {
    id: 'api_access',
    name: 'API Access',
    description: 'Access to restaurant APIs and third-party integrations',
    category: 'settings',
    icon: 'Code',
    defaultAccess: false
  },
  {
    id: 'multi_location',
    name: 'Multi-Location Management',
    description: 'Manage multiple restaurant locations and branch operations',
    category: 'settings',
    icon: 'MapPin',
    defaultAccess: false
  },
  {
    id: 'franchise_management',
    name: 'Franchise Management',
    description: 'Manage franchise operations, royalties, and brand compliance',
    category: 'settings',
    icon: 'Building',
    defaultAccess: false
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Access AI-powered insights, predictive analytics, and business intelligence',
    category: 'reports',
    icon: 'Brain',
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