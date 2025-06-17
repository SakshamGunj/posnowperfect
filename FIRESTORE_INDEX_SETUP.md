# Firestore Index Setup for Credits

## Issue
The Credits functionality requires a composite index in Firestore for optimal performance when querying credit transactions.

## Quick Fix Applied
✅ **Already Fixed**: The code has been updated to work without the index by sorting results on the client side.

## Optional: Set Up Firestore Index for Better Performance

If you want to set up the proper Firestore index for better performance (recommended for production), follow these steps:

### Method 1: Using Firebase Console (Easiest)

1. **Click the Index Link**: When you see the error in console, click the provided link:
   ```
   https://console.firebase.google.com/v1/r/project/testapployalty/firestore/indexes?create_composite=...
   ```

2. **Create Index**: This will automatically create the required index for you.

### Method 2: Manual Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`testapployalty`)
3. Go to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Set up the index with these fields:
   - **Collection ID**: `creditTransactions`
   - **Fields**:
     - `restaurantId` (Ascending)
     - `createdAt` (Descending)

### Method 3: Using Firebase CLI

1. Install Firebase CLI if not already installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firestore in your project:
   ```bash
   firebase init firestore
   ```

4. Create `firestore.indexes.json` file:
   ```json
   {
     "indexes": [
       {
         "collectionGroup": "creditTransactions",
         "queryScope": "COLLECTION",
         "fields": [
           {
             "fieldPath": "restaurantId",
             "order": "ASCENDING"
           },
           {
             "fieldPath": "createdAt",
             "order": "DESCENDING"
           }
         ]
       }
     ],
     "fieldOverrides": []
   }
   ```

5. Deploy the indexes:
   ```bash
   firebase deploy --only firestore:indexes
   ```

## Current Status

✅ **Credits functionality is working** - The immediate fix has been applied  
⚠️ **Index setup is optional** - For better performance with large datasets  
🚀 **Ready to use** - You can start using Credits right away  

## Testing Credits

1. Go to your restaurant dashboard
2. Click on "Credit Management" in Quick Actions
3. Or use the navigation menu → Quick Menu → Credits
4. The page should load without errors now! 