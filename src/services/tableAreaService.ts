import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,

  orderBy,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirebaseError } from '@/lib/firebase';
import { TableArea, ApiResponse } from '@/types';
import { generateId } from '@/lib/utils';

export class TableAreaService {
  private static readonly COLLECTION = 'tableAreas';

  // Get all table areas for a restaurant
  static async getTableAreasForRestaurant(restaurantId: string): Promise<ApiResponse<TableArea[]>> {
    try {
      const q = query(
        collection(db, 'restaurants', restaurantId, this.COLLECTION),
        orderBy('sortOrder', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const areas = querySnapshot.docs.map(doc =>
        this.convertFirestoreTableArea(doc.data(), doc.id)
      );

      return {
        success: true,
        data: areas,
      };
    } catch (error: any) {
      console.error('❌ Failed to get table areas:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Create a new table area
  static async createTableArea(
    restaurantId: string,
    areaData: Omit<TableArea, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<TableArea>> {
    try {
      const areaId = generateId();
      const now = new Date();

      const area: TableArea = {
        id: areaId,
        restaurantId,
        ...areaData,
        createdAt: now,
        updatedAt: now,
      };

      const areaRef = doc(db, 'restaurants', restaurantId, this.COLLECTION, areaId);

      await setDoc(areaRef, {
        ...area,
        createdAt: Timestamp.fromDate(area.createdAt),
        updatedAt: Timestamp.fromDate(area.updatedAt),
      });

      console.log('✅ Table area created:', area.name);

      return {
        success: true,
        data: area,
        message: 'Table area created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create table area:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Update a table area
  static async updateTableArea(
    restaurantId: string,
    areaId: string,
    updates: Partial<Omit<TableArea, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<TableArea>> {
    try {
      const areaRef = doc(db, 'restaurants', restaurantId, this.COLLECTION, areaId);

      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(areaRef, updateData);

      // Get updated area
      const updatedDoc = await getDoc(areaRef);
      if (!updatedDoc.exists()) {
        return {
          success: false,
          error: 'Table area not found after update',
        };
      }

      const updatedArea = this.convertFirestoreTableArea(updatedDoc.data(), updatedDoc.id);

      console.log('✅ Table area updated:', updatedArea.name);

      return {
        success: true,
        data: updatedArea,
        message: 'Table area updated successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to update table area:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Delete a table area
  static async deleteTableArea(restaurantId: string, areaId: string): Promise<ApiResponse<void>> {
    try {
      const areaRef = doc(db, 'restaurants', restaurantId, this.COLLECTION, areaId);
      await deleteDoc(areaRef);

      console.log('✅ Table area deleted:', areaId);

      return {
        success: true,
        message: 'Table area deleted successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to delete table area:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Get a single table area
  static async getTableAreaById(restaurantId: string, areaId: string): Promise<ApiResponse<TableArea>> {
    try {
      const areaRef = doc(db, 'restaurants', restaurantId, this.COLLECTION, areaId);
      const docSnap = await getDoc(areaRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Table area not found',
        };
      }

      const area = this.convertFirestoreTableArea(docSnap.data(), docSnap.id);

      return {
        success: true,
        data: area,
      };
    } catch (error: any) {
      console.error('❌ Failed to get table area:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Create default table areas for new restaurants
  static async createDefaultAreas(restaurantId: string): Promise<ApiResponse<TableArea[]>> {
    try {
      const defaultAreas = [
        { name: 'Main Dining', description: 'Main dining area', isActive: true, sortOrder: 1 },
        { name: 'Bar Area', description: 'Bar and lounge area', isActive: true, sortOrder: 2 },
        { name: 'Patio', description: 'Outdoor seating area', isActive: true, sortOrder: 3 },
        { name: 'VIP Room', description: 'Private dining area', isActive: true, sortOrder: 4 },
      ];

      const createdAreas: TableArea[] = [];

      for (const areaData of defaultAreas) {
        const result = await this.createTableArea(restaurantId, areaData);
        if (result.success && result.data) {
          createdAreas.push(result.data);
        }
      }

      return {
        success: true,
        data: createdAreas,
        message: 'Default table areas created successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to create default areas:', error);
      return {
        success: false,
        error: handleFirebaseError(error),
      };
    }
  }

  // Convert Firestore document to TableArea object
  private static convertFirestoreTableArea(data: any, id: string): TableArea {
    return {
      id,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
} 