import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { Table, TableStatus, ApiResponse } from '@/types';
import { generateId } from '@/lib/utils';
import { TableAreaService } from './tableAreaService';

// Enhanced smart caching system for tables
class TableCache {
  private static readonly CACHE_KEY = 'tenverse_pos_tables';
  private static readonly CACHE_EXPIRY_KEY = 'tenverse_pos_tables_expiry';
  private static readonly CACHE_VERSION_KEY = 'tenverse_pos_tables_version';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (longer for tables)
  
  // Get all tables from localStorage with version check
  static getTables(restaurantId: string): { tables: Table[], isStale: boolean } {
    try {
      const cacheKey = `${this.CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
     
      
      const cached = localStorage.getItem(cacheKey);
      const expiry = localStorage.getItem(expiryKey);
      
      
      if (cached && expiry) {
        const tables = JSON.parse(cached).map(this.parseTableDates);
        const isStale = Date.now() >= parseInt(expiry);
        
        if (!isStale) {
          console.log('🚀 Table cache hit for restaurant:', restaurantId, '- Fresh data');
        } else {
          console.log('⚠️ Table cache hit for restaurant:', restaurantId, '- Stale data, will refresh');
        }
        
        return { tables, isStale };
      }
      
      return { tables: [], isStale: true };
    } catch (error) {
      console.error('Failed to get tables from cache:', error);
      return { tables: [], isStale: true };
    }
  }
  
  // Store tables in localStorage with versioning
  static setTables(restaurantId: string, tables: Table[], version?: string): void {
    try {
      const cacheKey = `${this.CACHE_KEY}_${restaurantId}`;
      const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
      const versionKey = `${this.CACHE_VERSION_KEY}_${restaurantId}`;
      
      localStorage.setItem(cacheKey, JSON.stringify(tables));
      localStorage.setItem(expiryKey, (Date.now() + this.CACHE_DURATION).toString());
      
      if (version) {
        localStorage.setItem(versionKey, version);
      }
      
      console.log('💾 Tables cached for restaurant:', restaurantId, 'Count:', tables.length);
    } catch (error) {
      console.error('Failed to cache tables:', error);
    }
  }
  
  // Add single table to cache (for create operations)
  static addTable(restaurantId: string, table: Table): Table[] {
    const { tables } = this.getTables(restaurantId);
    const updatedTables = [...tables, table];
    this.setTables(restaurantId, updatedTables);
    console.log('➕ Table added to cache:', table.number);
    return updatedTables;
  }
  
  // Update single table in cache (for update operations)
  static updateTable(restaurantId: string, updatedTable: Table): Table[] {
    const { tables } = this.getTables(restaurantId);
    const updatedTables = tables.map(t => t.id === updatedTable.id ? updatedTable : t);
    this.setTables(restaurantId, updatedTables);
    console.log('✏️ Table updated in cache:', updatedTable.number);
    return updatedTables;
  }
  
  // Remove table from cache (for delete operations)
  static removeTable(restaurantId: string, tableId: string): Table[] {
    const { tables } = this.getTables(restaurantId);
    const updatedTables = tables.filter(t => t.id !== tableId);
    this.setTables(restaurantId, updatedTables);
    console.log('🗑️ Table removed from cache:', tableId);
    return updatedTables;
  }
  
  // Bulk update tables (for sync operations)
  static bulkUpdateTables(restaurantId: string, updates: Partial<Table>[]): Table[] {
    const { tables } = this.getTables(restaurantId);
    const updatedTables = tables.map(table => {
      const update = updates.find(u => u.id === table.id);
      return update ? { ...table, ...update } : table;
    });
    this.setTables(restaurantId, updatedTables);
    console.log('📦 Bulk table updates applied to cache:', updates.length, 'updates');
    return updatedTables;
  }
  
  // Get areas from cached tables
  static getAreas(restaurantId: string): string[] {
    const { tables } = this.getTables(restaurantId);
    return [...new Set(tables.map(table => table.area))].sort();
  }
  
  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    const cacheKey = `${this.CACHE_KEY}_${restaurantId}`;
    const expiryKey = `${this.CACHE_EXPIRY_KEY}_${restaurantId}`;
    const versionKey = `${this.CACHE_VERSION_KEY}_${restaurantId}`;
    
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(expiryKey);
    localStorage.removeItem(versionKey);
    console.log('🧹 Table cache cleared for restaurant:', restaurantId);
  }
  
  // Check if cache needs refresh
  static needsRefresh(restaurantId: string): boolean {
    const { isStale } = this.getTables(restaurantId);
    return isStale;
  }
  
  // Parse date strings back to Date objects
  private static parseTableDates(table: any): Table {
    return {
      ...table,
      createdAt: new Date(table.createdAt),
      updatedAt: new Date(table.updatedAt),
      reservedAt: table.reservedAt ? new Date(table.reservedAt) : undefined,
      // Ensure backward compatibility for existing tables
      areaId: table.areaId || table.area || 'default-area',
      isActive: table.isActive !== undefined ? table.isActive : true,
    };
  }
  
  // Get cache statistics for debugging
  static getCacheStats(restaurantId: string): {
    cached: boolean;
    count: number;
    isStale: boolean;
    areas: string[];
  } {
    const { tables, isStale } = this.getTables(restaurantId);
    return {
      cached: tables.length > 0,
      count: tables.length,
      isStale,
      areas: this.getAreas(restaurantId),
    };
  }
}

export class TableService {
  private static readonly TABLES_COLLECTION = 'tables';
  
  // Get all tables for restaurant (with smart caching)
  static async getTablesForRestaurant(restaurantId: string): Promise<ApiResponse<Table[]>> {
    try {
      // Try cache first
      const { tables: cachedTables, isStale } = TableCache.getTables(restaurantId);
      if (cachedTables.length > 0 && !isStale) {
        return {
          success: true,
          data: cachedTables,
        };
      }
      
      console.log('🔍 Fetching tables from Firebase for restaurant:', restaurantId);
      
      // Fetch from Firebase - simplified query without orderBy to avoid index requirement
      // We'll sort the results in client-side code
      const q = query(
        collection(db, 'restaurants', restaurantId, this.TABLES_COLLECTION)
      );
      
      const querySnapshot = await getDocs(q);
      const freshTables = querySnapshot.docs.map(doc => 
        this.convertFirestoreDoc(doc.data(), doc.id)
      );
      
      // Sort tables by area, then by number (client-side sorting)
      freshTables.sort((a, b) => {
        // First sort by area
        if (a.area !== b.area) {
          return a.area.localeCompare(b.area);
        }
        // Then sort by table number (as numbers if possible, otherwise as strings)
        const aNumber = parseInt(a.number);
        const bNumber = parseInt(b.number);
        if (!isNaN(aNumber) && !isNaN(bNumber)) {
          return aNumber - bNumber;
        }
        return a.number.localeCompare(b.number);
      });
      
      // Cache the results
      TableCache.setTables(restaurantId, freshTables);
      
      console.log('✅ Tables loaded, sorted, and cached:', freshTables.length);
      
      return {
        success: true,
        data: freshTables,
      };
    } catch (error: any) {
      console.error('❌ Failed to get tables:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Initialize default tables for new restaurant
  static async initializeDefaultTables(restaurantId: string): Promise<ApiResponse<Table[]>> {
    try {
      // Check if tables already exist
      const existingTables = await this.getTablesForRestaurant(restaurantId);
      if (existingTables.success && existingTables.data && existingTables.data.length > 0) {
        return existingTables;
      }
      
      console.log('🎯 Creating default tables and areas for restaurant:', restaurantId);
      
      // First, create the default table area
      const areaResult = await TableAreaService.createTableArea(restaurantId, {
        name: 'Main Dining',
        description: 'Main dining area',
        isActive: true,
        sortOrder: 1,
      });

      if (!areaResult.success || !areaResult.data) {
        throw new Error('Failed to create default table area');
      }

      const defaultArea = areaResult.data;
      
      const batch = writeBatch(db);
      const defaultTables: Omit<Table, 'id'>[] = [
        {
          restaurantId,
          number: '1',
          area: defaultArea.name,
          areaId: defaultArea.id,
          capacity: 4,
          status: 'available',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          number: '2',
          area: defaultArea.name,
          areaId: defaultArea.id,
          capacity: 4,
          status: 'available',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          number: '3',
          area: defaultArea.name,
          areaId: defaultArea.id,
          capacity: 6,
          status: 'available',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          restaurantId,
          number: '4',
          area: defaultArea.name,
          areaId: defaultArea.id,
          capacity: 2,
          status: 'available',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      const tables: Table[] = [];
      
      for (const tableData of defaultTables) {
        const tableId = generateId();
        const table: Table = {
          id: tableId,
          ...tableData,
        };
        
        const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
        batch.set(tableRef, {
          ...table,
          createdAt: Timestamp.fromDate(table.createdAt),
          updatedAt: Timestamp.fromDate(table.updatedAt),
        });
        
        tables.push(table);
      }
      
      await batch.commit();
      
      // Cache the new tables
      TableCache.setTables(restaurantId, tables);
      
      console.log('✅ Default tables and areas created and cached');
      
      return {
        success: true,
        data: tables,
        message: 'Default tables and areas created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create default tables:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Create a new table
  static async createTable(tableData: Omit<Table, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Table>> {
    try {
      const tableId = generateId();
      const table: Table = {
        id: tableId,
        ...tableData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const tableRef = doc(db, 'restaurants', tableData.restaurantId, this.TABLES_COLLECTION, tableId);
      
      await setDoc(tableRef, {
        ...table,
        createdAt: Timestamp.fromDate(table.createdAt),
        updatedAt: Timestamp.fromDate(table.updatedAt),
      });
      
      // Add to cache
      TableCache.addTable(tableData.restaurantId, table);
      
      console.log('✅ Table created and cached:', table.number);
      
      return {
        success: true,
        data: table,
        message: 'Table created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create table:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Update table
  static async updateTable(tableId: string, restaurantId: string, updates: Partial<Table>): Promise<ApiResponse<Table>> {
    try {
      const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
      
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(tableRef, updateData);
      
      // Get updated table from cache and update it
      const { tables } = TableCache.getTables(restaurantId);
      const tableIndex = tables.findIndex(t => t.id === tableId);
      
      if (tableIndex !== -1) {
        const updatedTable = {
          ...tables[tableIndex],
          ...updates,
          updatedAt: new Date(),
        };
        
        TableCache.updateTable(restaurantId, updatedTable);
        
        return {
          success: true,
          data: updatedTable,
          message: 'Table updated successfully',
        };
      }
      
      // Fallback: fetch from Firebase
      const result = await this.getTableById(tableId, restaurantId);
      return result;
      
    } catch (error: any) {
      console.error('❌ Failed to update table:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Delete table
  static async deleteTable(tableId: string, restaurantId: string): Promise<ApiResponse<void>> {
    try {
      const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
      await deleteDoc(tableRef);
      
      // Remove from cache
      TableCache.removeTable(restaurantId, tableId);
      
      console.log('✅ Table deleted and removed from cache');
      
      return {
        success: true,
        message: 'Table deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete table:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get table by ID
  static async getTableById(tableId: string, restaurantId: string): Promise<ApiResponse<Table>> {
    try {
      // Try cache first
      const { tables } = TableCache.getTables(restaurantId);
      const cachedTable = tables.find(t => t.id === tableId);
      
      if (cachedTable) {
        return {
          success: true,
          data: cachedTable,
        };
      }
      
      // Fetch from Firebase
      const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
      const docSnap = await getDoc(tableRef);
      
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Table not found',
        };
      }
      
      const table = this.convertFirestoreDoc(docSnap.data(), docSnap.id);
      
      return {
        success: true,
        data: table,
      };
    } catch (error: any) {
      console.error('❌ Failed to get table by ID:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Get available tables
  static async getAvailableTables(restaurantId: string): Promise<ApiResponse<Table[]>> {
    const result = await this.getTablesForRestaurant(restaurantId);
    
    if (result.success && result.data) {
      const availableTables = result.data.filter(table => table.status === 'available');
      return {
        success: true,
        data: availableTables,
      };
    }
    
    return result;
  }
  
  // Get unique areas
  static async getTableAreas(restaurantId: string): Promise<ApiResponse<string[]>> {
    const result = await this.getTablesForRestaurant(restaurantId);
    
    if (result.success && result.data) {
      const areas = [...new Set(result.data.map(table => table.area))];
      return {
        success: true,
        data: areas,
      };
    }
    
    return {
      success: false,
      error: result.error,
    };
  }
  
  // Subscribe to table changes (real-time updates)
  static subscribeToTables(
    restaurantId: string,
    callback: (tables: Table[]) => void
  ): () => void {
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      collection(db, 'restaurants', restaurantId, this.TABLES_COLLECTION)
    );
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const tables = querySnapshot.docs.map(doc =>
          this.convertFirestoreDoc(doc.data(), doc.id)
        );
        
        // Sort tables by area, then by number (client-side sorting)
        tables.sort((a, b) => {
          // First sort by area
          if (a.area !== b.area) {
            return a.area.localeCompare(b.area);
          }
          // Then sort by table number (as numbers if possible, otherwise as strings)
          const aNumber = parseInt(a.number);
          const bNumber = parseInt(b.number);
          if (!isNaN(aNumber) && !isNaN(bNumber)) {
            return aNumber - bNumber;
          }
          return a.number.localeCompare(b.number);
        });
        
        // Update cache
        TableCache.setTables(restaurantId, tables);
        
        callback(tables);
      },
      (error) => {
        console.error('Table subscription error:', error);
      }
    );
  }
  
  // Transfer orders from one table to another
  static async transferTable(
    sourceTableId: string,
    targetTableId: string,
    restaurantId: string
  ): Promise<ApiResponse<void>> {
    try {
      const batch = writeBatch(db);
      
      // Get both tables
      const sourceTableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, sourceTableId);
      const targetTableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, targetTableId);
      
      // Update source table to available
      batch.update(sourceTableRef, {
        status: 'available',
        currentOrderId: null,
        updatedAt: Timestamp.now(),
      });
      
      // Update target table to occupied
      batch.update(targetTableRef, {
        status: 'occupied',
        updatedAt: Timestamp.now(),
      });
      
      await batch.commit();
      
      // Update cache
      const { tables } = TableCache.getTables(restaurantId);
      const updatedTables = tables.map(table => {
        if (table.id === sourceTableId) {
          return { ...table, status: 'available' as TableStatus, currentOrderId: undefined };
        }
        if (table.id === targetTableId) {
          return { ...table, status: 'occupied' as TableStatus };
        }
        return table;
      });
      
      TableCache.setTables(restaurantId, updatedTables);
      
      return {
        success: true,
        message: 'Table transfer completed successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to transfer table:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Merge multiple tables
  static async mergeTables(
    tableIds: string[],
    restaurantId: string
  ): Promise<ApiResponse<{ mergedTableId: string }>> {
    try {
      const batch = writeBatch(db);
      
      // Update all tables to occupied and mark them as merged
      tableIds.forEach(tableId => {
        const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
        batch.update(tableRef, {
          status: 'occupied',
          updatedAt: Timestamp.now(),
        });
      });
      
      await batch.commit();
      
      // Update cache
      const { tables } = TableCache.getTables(restaurantId);
      const updatedTables = tables.map(table => {
        if (tableIds.includes(table.id)) {
          return { ...table, status: 'occupied' as TableStatus };
        }
        return table;
      });
      
      TableCache.setTables(restaurantId, updatedTables);
      
      // Return the first table as the primary merged table
      return {
        success: true,
        data: { mergedTableId: tableIds[0] },
        message: 'Tables merged successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to merge tables:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }
  
  // Unmerge tables and make them available
  static async unmergeTables(
    tableIds: string[],
    restaurantId: string
  ): Promise<ApiResponse<void>> {
    try {
      const batch = writeBatch(db);
      
      // Update all tables to available
      tableIds.forEach(tableId => {
        const tableRef = doc(db, 'restaurants', restaurantId, this.TABLES_COLLECTION, tableId);
        batch.update(tableRef, {
          status: 'available',
          currentOrderId: null,
          updatedAt: Timestamp.now(),
        });
      });
      
      await batch.commit();
      
      // Update cache
      const { tables } = TableCache.getTables(restaurantId);
      const updatedTables = tables.map(table => {
        if (tableIds.includes(table.id)) {
          return { ...table, status: 'available' as TableStatus, currentOrderId: undefined };
        }
        return table;
      });
      
      TableCache.setTables(restaurantId, updatedTables);
      
      return {
        success: true,
        message: 'Tables unmerged and made available',
      };
    } catch (error: any) {
      console.error('❌ Failed to unmerge tables:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Clear cache for restaurant
  static clearCache(restaurantId: string): void {
    TableCache.clearCache(restaurantId);
  }
  
  // Convert Firestore document to Table object
  private static convertFirestoreDoc(data: any, id: string): Table {
    return {
      id,
      restaurantId: data.restaurantId,
      number: data.number,
      area: data.area,
      areaId: data.areaId || data.area || 'default-area', // Backward compatibility
      capacity: data.capacity,
      status: data.status,
      currentOrderId: data.currentOrderId,
      reservedAt: data.reservedAt?.toDate(),
      reservedFor: data.reservedFor,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true, // Default to active for existing tables
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
} 