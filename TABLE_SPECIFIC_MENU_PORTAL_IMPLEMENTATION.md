# Table-Specific Menu Portal Implementation

## Overview
This implementation adds the ability to create table-specific menu portal links while maintaining the existing general menu portal functionality.

## Features Implemented

### 1. **Dual Portal Options**
- **Single Portal Link**: One link for entire restaurant (existing functionality)
- **Table-Specific Links**: Separate links for each table with table tracking

### 2. **URL Structure**
- **General Portal**: `/:slug/menu-portal`
- **Table-Specific Portal**: `/:slug/menu-portal/:tableId`

### 3. **CustomerMenuPortal Enhancements**
- Added portal type selection (Single vs Table-Specific)
- Table loading from database
- Table-specific URL and QR code generation
- Tables organized by floor/area
- Individual copy/download actions for each table

### 4. **CustomerOrderingPage Enhancements**
- Handles tableId parameter from URL
- Loads specific table information when tableId provided
- Displays table info in header (Table number, area, capacity)
- Orders created with correct table association

### 5. **KitchenDisplay (KDS) Enhancements**
- Shows table information for table-specific orders
- Differentiates between general online orders and table-specific orders
- Displays table number, area, and capacity for table orders

### 6. **Order Tracking**
- Orders from table-specific links include table information
- Table details added to order notes
- KDS displays proper table context

## Implementation Details

### Files Modified:
1. **src/App.tsx** - Added table-specific route
2. **src/pages/restaurant/CustomerMenuPortal.tsx** - Portal type selection and table management
3. **src/pages/public/CustomerOrderingPage.tsx** - Table-specific URL handling
4. **src/pages/restaurant/KitchenDisplay.tsx** - Enhanced table display

### Key Functions Added:
- `loadTables()` - Loads restaurant tables
- `generateTableSpecificUrl(tableId)` - Creates table-specific URLs
- `generateTableSpecificQR(tableId)` - Creates table-specific QR codes
- `copyTableUrl(tableId)` - Copies table URL to clipboard
- `downloadTableQR(tableId, tableNumber)` - Downloads table QR code

### Database Integration:
- Uses existing TableService for table management
- Orders created with proper tableId association
- No database schema changes required

## Usage Instructions

### For Restaurant Owners:
1. Go to Customer Portal settings
2. Choose between "Single Portal Link" or "Table-Specific Links"
3. For table-specific:
   - View tables organized by area/floor
   - Copy individual table URLs
   - Download QR codes for each table
   - Print and place QR codes at respective tables

### For Customers:
1. **General Portal**: Scan general QR code → orders show as "Online Order"
2. **Table-Specific**: Scan table QR code → orders show with table information

### For Kitchen Staff:
- Orders now display table information when from table-specific links
- Easy identification of which table placed the order
- Same workflow for order preparation

## Benefits

1. **Better Order Tracking**: Kitchen knows exactly which table ordered
2. **Improved Service**: Staff can deliver orders to correct tables
3. **Flexible Setup**: Restaurant can choose single or table-specific approach
4. **No Breaking Changes**: Existing functionality preserved
5. **Scalable**: Works with any number of tables and areas

## Technical Notes

- Backward compatible with existing portal functionality
- Uses existing table management system
- No additional database setup required
- Responsive design for mobile devices
- Real-time order tracking maintained 