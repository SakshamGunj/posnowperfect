import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
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

// Available modules for permission assignment - COMPREHENSIVE SYSTEM
export const AVAILABLE_MODULES: ModulePermission[] = [
  // ===== CORE POS OPERATIONS =====
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
    id: 'order_edit',
    name: 'Edit Orders',
    description: 'Modify existing orders and items',
    category: 'core',
    icon: 'Edit',
    defaultAccess: false
  },
  {
    id: 'order_cancel',
    name: 'Cancel Orders',
    description: 'Cancel orders and process refunds',
    category: 'core',
    icon: 'X',
    defaultAccess: false
  },
  {
    id: 'order_status',
    name: 'Order Status Management',
    description: 'Update order status (confirmed, preparing, ready)',
    category: 'core',
    icon: 'Clock',
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
  {
    id: 'discounts',
    name: 'Apply Discounts',
    description: 'Apply percentage or fixed amount discounts',
    category: 'core',
    icon: 'Percent',
    defaultAccess: false
  },
  {
    id: 'kot_print',
    name: 'KOT Printing',
    description: 'Print Kitchen Order Tickets',
    category: 'core',
    icon: 'Printer',
    defaultAccess: true
  },
  
  // ===== TABLE MANAGEMENT =====
  {
    id: 'tables',
    name: 'Table Management',
    description: 'Manage table status and reservations',
    category: 'core',
    icon: 'Grid3X3',
    defaultAccess: true
  },
  {
    id: 'table_merge',
    name: 'Table Merge/Transfer',
    description: 'Merge tables and transfer orders between tables',
    category: 'core',
    icon: 'ArrowRightLeft',
    defaultAccess: false
  },
  {
    id: 'table_areas',
    name: 'Table Areas Management',
    description: 'Create and manage table areas/floors',
    category: 'management',
    icon: 'Map',
    defaultAccess: false
  },
  
  // ===== KITCHEN OPERATIONS =====
  {
    id: 'kitchen',
    name: 'Kitchen Display',
    description: 'Access kitchen display system',
    category: 'core',
    icon: 'ChefHat',
    defaultAccess: true
  },
  {
    id: 'kitchen_manage',
    name: 'Kitchen Order Management',
    description: 'Update order status from kitchen',
    category: 'core',
    icon: 'Timer',
    defaultAccess: false
  },
  
  // ===== MENU MANAGEMENT =====
  {
    id: 'menu',
    name: 'Menu Management',
    description: 'Add, edit, and manage menu items',
    category: 'management',
    icon: 'ChefHat',
    defaultAccess: false
  },
  {
    id: 'menu_categories',
    name: 'Category Management',
    description: 'Create and manage menu categories',
    category: 'management',
    icon: 'Folder',
    defaultAccess: false
  },
  {
    id: 'menu_pricing',
    name: 'Menu Pricing',
    description: 'Update menu item prices',
    category: 'management',
    icon: 'DollarSign',
    defaultAccess: false
  },
  {
    id: 'menu_availability',
    name: 'Menu Availability',
    description: 'Enable/disable menu items',
    category: 'management',
    icon: 'ToggleLeft',
    defaultAccess: false
  },
  {
    id: 'menu_variants',
    name: 'Menu Variants',
    description: 'Manage item variants and customizations',
    category: 'management',
    icon: 'Settings',
    defaultAccess: false
  },
  {
    id: 'bulk_menu_import',
    name: 'Bulk Menu Import',
    description: 'Import menu items in bulk',
    category: 'management',
    icon: 'Upload',
    defaultAccess: false
  },
  
  // ===== INVENTORY MANAGEMENT =====
  {
    id: 'inventory',
    name: 'Inventory Management',
    description: 'Track and manage inventory levels',
    category: 'management',
    icon: 'Package',
    defaultAccess: false
  },
  {
    id: 'inventory_restock',
    name: 'Inventory Restocking',
    description: 'Restock inventory items',
    category: 'management',
    icon: 'RefreshCw',
    defaultAccess: false
  },
  {
    id: 'inventory_adjustments',
    name: 'Inventory Adjustments',
    description: 'Make manual inventory adjustments',
    category: 'management',
    icon: 'Edit',
    defaultAccess: false
  },
  {
    id: 'inventory_alerts',
    name: 'Inventory Alerts',
    description: 'View and manage low stock alerts',
    category: 'management',
    icon: 'AlertTriangle',
    defaultAccess: false
  },
  {
    id: 'suppliers',
    name: 'Supplier Management',
    description: 'Manage suppliers and vendor information',
    category: 'management',
    icon: 'Truck',
    defaultAccess: false
  },
  
  // ===== CUSTOMER MANAGEMENT =====
  {
    id: 'customers',
    name: 'Customer Management',
    description: 'Manage customer information and loyalty',
    category: 'management',
    icon: 'Users',
    defaultAccess: false
  },
  {
    id: 'customer_create',
    name: 'Create Customers',
    description: 'Add new customers to database',
    category: 'management',
    icon: 'UserPlus',
    defaultAccess: true
  },
  {
    id: 'customer_edit',
    name: 'Edit Customer Info',
    description: 'Modify customer information',
    category: 'management',
    icon: 'UserCheck',
    defaultAccess: false
  },
  {
    id: 'customer_history',
    name: 'Customer Order History',
    description: 'View customer order history and analytics',
    category: 'management',
    icon: 'History',
    defaultAccess: false
  },
  {
    id: 'loyalty_points',
    name: 'Loyalty Points Management',
    description: 'Manage customer loyalty points',
    category: 'management',
    icon: 'Star',
    defaultAccess: false
  },
  {
    id: 'customer_export',
    name: 'Customer Data Export',
    description: 'Export customer data to CSV',
    category: 'management',
    icon: 'Download',
    defaultAccess: false
  },
  
  // ===== CREDIT MANAGEMENT =====
  {
    id: 'credits',
    name: 'Credit Management',
    description: 'Manage customer credits and payments',
    category: 'management',
    icon: 'CreditCard',
    defaultAccess: false
  },
  {
    id: 'credit_add',
    name: 'Add Customer Credit',
    description: 'Add credit to customer accounts',
    category: 'management',
    icon: 'Plus',
    defaultAccess: false
  },
  {
    id: 'credit_collect',
    name: 'Collect Credit Payments',
    description: 'Collect payments for outstanding credits',
    category: 'management',
    icon: 'DollarSign',
    defaultAccess: false
  },
  {
    id: 'credit_history',
    name: 'Credit Transaction History',
    description: 'View customer credit transaction history',
    category: 'management',
    icon: 'FileText',
    defaultAccess: false
  },
  
  // ===== COUPON & PROMOTIONS =====
  {
    id: 'coupons',
    name: 'Coupon Management',
    description: 'Create and manage discount coupons',
    category: 'management',
    icon: 'Gift',
    defaultAccess: false
  },
  {
    id: 'coupon_create',
    name: 'Create Coupons',
    description: 'Create new promotional coupons',
    category: 'management',
    icon: 'PlusCircle',
    defaultAccess: false
  },
  {
    id: 'coupon_apply',
    name: 'Apply Coupons',
    description: 'Apply coupons to customer orders',
    category: 'management',
    icon: 'Tag',
    defaultAccess: true
  },
  {
    id: 'coupon_analytics',
    name: 'Coupon Analytics',
    description: 'View coupon usage and effectiveness',
    category: 'reports',
    icon: 'BarChart',
    defaultAccess: false
  },
  
  // ===== GAMIFICATION & SPIN WHEEL =====
  {
    id: 'gamification',
    name: 'Gamification Dashboard',
    description: 'Manage spin wheel and customer games',
    category: 'management',
    icon: 'Gamepad2',
    defaultAccess: false
  },
  {
    id: 'spin_wheel_config',
    name: 'Spin Wheel Configuration',
    description: 'Configure spin wheel settings and rewards',
    category: 'management',
    icon: 'Target',
    defaultAccess: false
  },
  {
    id: 'spin_wheel_analytics',
    name: 'Spin Wheel Analytics',
    description: 'View spin wheel performance and engagement',
    category: 'reports',
    icon: 'TrendingUp',
    defaultAccess: false
  },
  {
    id: 'customer_spins',
    name: 'Customer Spin Management',
    description: 'View and manage customer spins',
    category: 'management',
    icon: 'RotateCcw',
    defaultAccess: false
  },
  {
    id: 'rewards_management',
    name: 'Rewards Management',
    description: 'Manage customer rewards and redemptions',
    category: 'management',
    icon: 'Award',
    defaultAccess: false
  },
  
  // ===== CUSTOMER PORTAL & DIGITAL =====
  {
    id: 'customer_portal',
    name: 'Customer Portal Management',
    description: 'Configure customer menu portal',
    category: 'management',
    icon: 'Smartphone',
    defaultAccess: false
  },
  {
    id: 'qr_codes',
    name: 'QR Code Management',
    description: 'Generate and manage QR codes',
    category: 'management',
    icon: 'QrCode',
    defaultAccess: false
  },
  {
    id: 'table_portals',
    name: 'Table-Specific Portals',
    description: 'Create table-specific menu links',
    category: 'management',
    icon: 'Link',
    defaultAccess: false
  },
  {
    id: 'portal_analytics',
    name: 'Portal Analytics',
    description: 'View customer portal usage analytics',
    category: 'reports',
    icon: 'Globe',
    defaultAccess: false
  },
  
  // ===== VOICE COMMANDS =====
  {
    id: 'voice_commands',
    name: 'Voice Commands',
    description: 'Use AI voice commands for operations',
    category: 'core',
    icon: 'Mic',
    defaultAccess: false
  },
  {
    id: 'voice_orders',
    name: 'Voice Order Taking',
    description: 'Take orders using voice commands',
    category: 'core',
    icon: 'MessageSquare',
    defaultAccess: false
  },
  {
    id: 'voice_customers',
    name: 'Voice Customer Management',
    description: 'Add customers using voice commands',
    category: 'management',
    icon: 'UserVoice',
    defaultAccess: false
  },
  
  // ===== MARKETPLACE (B2B) =====
  {
    id: 'marketplace',
    name: 'Marketplace Access',
    description: 'Access B2B marketplace for bulk ordering',
    category: 'management',
    icon: 'ShoppingCart',
    defaultAccess: false
  },
  {
    id: 'marketplace_orders',
    name: 'Marketplace Orders',
    description: 'Place and manage marketplace orders',
    category: 'management',
    icon: 'Package2',
    defaultAccess: false
  },
  {
    id: 'marketplace_analytics',
    name: 'Marketplace Analytics',
    description: 'View marketplace spending and supplier analytics',
    category: 'reports',
    icon: 'TrendingDown',
    defaultAccess: false
  },
  {
    id: 'supplier_reviews',
    name: 'Supplier Reviews',
    description: 'Review and rate suppliers',
    category: 'management',
    icon: 'Star',
    defaultAccess: false
  },
  
  // ===== REPORTS & ANALYTICS =====
  {
    id: 'dashboard',
    name: 'Dashboard Analytics',
    description: 'View dashboard statistics and insights',
    category: 'reports',
    icon: 'TrendingUp',
    defaultAccess: true
  },
  {
    id: 'reports',
    name: 'Sales Reports',
    description: 'View detailed sales reports and analytics',
    category: 'reports',
    icon: 'BarChart3',
    defaultAccess: false
  },
  {
    id: 'financial_reports',
    name: 'Financial Reports',
    description: 'View revenue, profit, and financial analytics',
    category: 'reports',
    icon: 'DollarSign',
    defaultAccess: false
  },
  {
    id: 'operational_reports',
    name: 'Operational Reports',
    description: 'View operational efficiency and performance reports',
    category: 'reports',
    icon: 'Activity',
    defaultAccess: false
  },
  {
    id: 'staff_analytics',
    name: 'Staff Performance Analytics',
    description: 'View staff performance and productivity reports',
    category: 'reports',
    icon: 'Users',
    defaultAccess: false
  },
  {
    id: 'customer_analytics',
    name: 'Customer Analytics',
    description: 'View customer behavior and preference analytics',
    category: 'reports',
    icon: 'UserCheck',
    defaultAccess: false
  },
  {
    id: 'export_reports',
    name: 'Export Reports',
    description: 'Export reports to PDF/Excel',
    category: 'reports',
    icon: 'Download',
    defaultAccess: false
  },
  
  // ===== SETTINGS & CONFIGURATION =====
  {
    id: 'settings',
    name: 'Restaurant Settings',
    description: 'Manage restaurant configuration and preferences',
    category: 'settings',
    icon: 'Settings',
    defaultAccess: false
  },
  {
    id: 'business_info',
    name: 'Business Information',
    description: 'Update restaurant business information',
    category: 'settings',
    icon: 'Building',
    defaultAccess: false
  },
  {
    id: 'payment_settings',
    name: 'Payment Settings',
    description: 'Configure payment methods and UPI settings',
    category: 'settings',
    icon: 'CreditCard',
    defaultAccess: false
  },
  {
    id: 'tax_settings',
    name: 'Tax Configuration',
    description: 'Configure tax rates and billing settings',
    category: 'settings',
    icon: 'Calculator',
    defaultAccess: false
  },
  {
    id: 'theme_settings',
    name: 'Theme & Branding',
    description: 'Customize restaurant theme and branding',
    category: 'settings',
    icon: 'Palette',
    defaultAccess: false
  },
  {
    id: 'operating_hours',
    name: 'Operating Hours',
    description: 'Set restaurant operating hours',
    category: 'settings',
    icon: 'Clock',
    defaultAccess: false
  },
  
  // ===== EMPLOYEE MANAGEMENT =====
  {
    id: 'employees',
    name: 'Employee Management',
    description: 'Manage staff and their permissions (Owner only)',
    category: 'settings',
    icon: 'UserPlus',
    defaultAccess: false
  },
  {
    id: 'employee_create',
    name: 'Create Employees',
    description: 'Add new employees to the system',
    category: 'settings',
    icon: 'UserPlus',
    defaultAccess: false
  },
  {
    id: 'employee_permissions',
    name: 'Employee Permissions',
    description: 'Assign and modify employee permissions',
    category: 'settings',
    icon: 'Shield',
    defaultAccess: false
  },
  {
    id: 'employee_analytics',
    name: 'Employee Analytics',
    description: 'View employee performance and activity',
    category: 'reports',
    icon: 'BarChart',
    defaultAccess: false
  },
  
  // ===== ADVANCED FEATURES =====
  {
    id: 'multi_location',
    name: 'Multi-Location Support',
    description: 'Manage multiple restaurant locations',
    category: 'settings',
    icon: 'MapPin',
    defaultAccess: false
  },
  {
    id: 'api_access',
    name: 'API Access',
    description: 'Access to restaurant APIs and integrations',
    category: 'settings',
    icon: 'Code',
    defaultAccess: false
  },
  {
    id: 'data_export',
    name: 'Data Export/Backup',
    description: 'Export restaurant data and create backups',
    category: 'settings',
    icon: 'Database',
    defaultAccess: false
  },
  {
    id: 'system_logs',
    name: 'System Logs',
    description: 'View system activity and audit logs',
    category: 'settings',
    icon: 'FileText',
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