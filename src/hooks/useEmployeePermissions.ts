import { useMemo } from 'react';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { EmployeeService, AVAILABLE_MODULES } from '@/services/employeeService';
import { Employee, User } from '@/types';

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

    // For employees, we need to check their specific permissions
    // Since we converted employee to user format, we need to fetch employee data
    const hasPermission = (moduleId: string): boolean => {
      if (isOwner) return true;
      
      // For now, we'll use a basic permission system
      // In a real implementation, you'd fetch the employee's permissions from the database
      
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
  }, [user]);
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