import { useMemo, useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { AVAILABLE_MODULES, EmployeeService } from '@/services/employeeService';
import { Employee } from '@/types';

export interface EmployeePermissions {
  hasPermission: (moduleId: string) => boolean;
  canAccess: (moduleId: string) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isEmployee: boolean;
  accessibleModules: string[];
}

export function useEmployeePermissions(): EmployeePermissions {
  const { user } = useRestaurantAuth();
  const { restaurant } = useRestaurant();
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch employee data when user changes
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!user || !restaurant || user.role === 'owner') {
        return; // No need to fetch for owners or when no user/restaurant
      }

      if (user.role === 'manager' || user.role === 'staff') {
        setLoading(true);
        try {
          console.log('🔍 Fetching employee permissions for user:', user.email);
          const result = await EmployeeService.getEmployees(restaurant.id);
          if (result.success && result.data) {
            // Find the employee by email
            const employee = result.data.find((emp: Employee) => emp.email === user.email);
            if (employee) {
              console.log('✅ Found employee data with permissions:', employee.permissions?.length || 0, 'permissions');
              setEmployeeData(employee);
            } else {
              console.warn('❌ Employee not found in restaurant employee list:', user.email);
            }
          }
        } catch (error) {
          console.error('❌ Failed to fetch employee data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchEmployeeData();
  }, [user, restaurant]);

  return useMemo(() => {
    if (!user) {
      return {
        hasPermission: () => false,
        canAccess: () => false,
        isOwner: false,
        isManager: false,
        isStaff: false,
        isEmployee: false,
        accessibleModules: []
      };
    }

    const isOwner = user.role === 'owner';
    const isManager = user.role === 'manager';
    const isStaff = user.role === 'staff';
    const isEmployee = isManager || isStaff;

    // Owners have access to everything
    if (isOwner) {
      return {
        hasPermission: () => true,
        canAccess: () => true,
        isOwner: true,
        isManager: false,
        isStaff: false,
        isEmployee: false,
        accessibleModules: AVAILABLE_MODULES?.map((m) => m.id) || []
      };
    }

    // For employees, check their specific permissions from the database
    const hasPermission = (moduleId: string): boolean => {
      if (isOwner) return true;
      
      // If we have employee data with permissions, use those
      if (employeeData && employeeData.permissions) {
        const permission = employeeData.permissions.find(p => p.module === moduleId);
        const hasAccess = permission ? permission.access : false;
        
        if (hasAccess) {
          console.log(`✅ Permission granted for ${moduleId}:`, hasAccess);
        } else {
          console.log(`❌ Permission denied for ${moduleId}`);
        }
        
        return hasAccess;
      }
      
      // Fallback to basic permissions while loading employee data
      if (loading) {
        console.log(`⏳ Still loading employee data, denying access to ${moduleId}`);
        return false;
      }
      
      // If no employee data found, fall back to basic role-based permissions
      console.warn(`⚠️ No employee data found, using basic role permissions for ${moduleId}`);
      
      // Basic permissions for managers
      if (isManager) {
        const managerModules = [
          'orders', 'take_order', 'tables', 'billing', 'dashboard',
          'menu', 'inventory', 'customers', 'reports'
        ];
        return managerModules.includes(moduleId);
      }
      
      // Basic permissions for staff
      if (isStaff) {
        const staffModules = [
          'orders', 'take_order', 'tables', 'billing', 'dashboard'
        ];
        return staffModules.includes(moduleId);
      }
      
      return false;
    };

    const canAccess = (moduleId: string): boolean => {
      return hasPermission(moduleId);
    };

    const getAccessibleModules = (): string[] => {
      if (isOwner) {
        return AVAILABLE_MODULES?.map((m) => m.id) || [];
      }
      
      // If we have employee data, use their specific permissions
      if (employeeData && employeeData.permissions) {
        const accessibleModules = employeeData.permissions
          .filter(p => p.access)
          .map(p => p.module);
        
        console.log('📋 Employee accessible modules:', accessibleModules);
        return accessibleModules;
      }
      
      // Fallback to basic role permissions
      if (isManager) {
        return [
          'orders', 'take_order', 'tables', 'billing', 'dashboard',
          'menu', 'inventory', 'customers', 'reports'
        ];
      }
      
      if (isStaff) {
        return ['orders', 'take_order', 'tables', 'billing', 'dashboard'];
      }
      
      return [];
    };

    return {
      hasPermission,
      canAccess,
      isOwner,
      isManager,
      isStaff,
      isEmployee,
      accessibleModules: getAccessibleModules()
    };
  }, [user, employeeData, loading]);
}

// Helper function to check if user can access a specific route
export function useCanAccessRoute(moduleId: string): boolean {
  const { canAccess } = useEmployeePermissions();
  return canAccess(moduleId);
}

// Helper function to get user role display
export function useUserRoleDisplay(): string {
  const { user } = useRestaurantAuth();
  
  if (!user) return 'Guest';
  
  switch (user.role) {
    case 'owner':
      return 'Owner';
    case 'manager':
      return 'Manager';
    case 'staff':
      return 'Staff';
    default:
      return 'User';
  }
} 