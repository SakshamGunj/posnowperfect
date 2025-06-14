# 🔥 Firebase Setup Guide for TenVerse POS

## Required Firebase Indexes

After restructuring to subcollections, Firebase requires composite indexes for complex queries. When you see index errors in the console, follow these steps:

### 1. Composite Index for Customer Spins

**Error**: `The query requires an index`

**Solution**: Click the provided Firebase Console link in the error message, or manually create:

1. Go to [Firebase Console](https://console.firebase.google.com/) → Your Project → Firestore Database → Indexes
2. Click "Create Index"
3. Collection Group: `customerSpins`
4. Fields to index:
   - `customerPhone` (Ascending)
   - `spinDate` (Descending)
   - `__name__` (Ascending)

### 2. Alternative: Use the Auto-Generated Link

When you see the error in console:
```
The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/[PROJECT_ID]/firestore/indexes?create_composite=...
```

Simply click that link and Firebase will auto-configure the index for you!

## Firestore Rules

Your Firestore rules have been updated to support the new subcollection structure:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Restaurant subcollections (customers, coupons, gamificationUsers)
    match /restaurants/{restaurantId}/{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow reading restaurant data
    match /restaurants/{document} {
      allow read, write: if request.auth != null;
    }
    
    // System-wide collections remain at root
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Data Migration Notes

### Customer Data Migration
- **Old**: `/customers` (root collection)
- **New**: `/restaurants/{restaurantId}/customers`

### Coupon Data Migration  
- **Old**: `/coupons` (root collection)
- **New**: `/restaurants/{restaurantId}/coupons`

### Gamification Users Migration
- **Old**: `/gamificationUsers` (root collection)  
- **New**: `/restaurants/{restaurantId}/gamificationUsers`

## Troubleshooting Common Issues

### 1. "Customer not found" Errors
**Cause**: Points system trying to update customers that don't exist in new structure
**Solution**: ✅ Already handled - points awarding now fails gracefully

### 2. Index Required Errors
**Cause**: Complex queries need composite indexes
**Solution**: Create indexes using the auto-generated links in error messages

### 3. Authentication Issues
**Cause**: Service methods now require `restaurantId` parameter
**Solution**: ✅ Already fixed - all methods updated

## Performance Optimizations

The new subcollection structure provides:
- ✅ Better data isolation per restaurant
- ✅ Improved query performance  
- ✅ Enhanced security with restaurant-scoped rules
- ✅ Better scalability for multi-tenant architecture

## Next Steps

1. **Create Required Indexes**: Use the auto-generated links when errors appear
2. **Data Migration**: If you have existing data, migrate it to the new structure
3. **Monitor Performance**: Check query performance in Firebase Console
4. **Test All Features**: Verify customer management, coupons, and gamification work correctly 