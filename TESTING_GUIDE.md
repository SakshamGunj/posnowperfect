# 🧪 TenVerse POS Testing Guide

## Prerequisites Setup

### 1. Firebase Project Setup
Ensure your Firebase project (`testapployalty`) is properly configured:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project (if not done)
firebase init
```

### 2. Create Super Admin Account
**IMPORTANT**: Create the admin account in Firebase Console first:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project (`testapployalty`)
3. Navigate to **Authentication** → **Users**
4. Click **Add User**
5. Email: `gunj06saksham@gmail.com`
6. Password: `admin123`
7. Click **Add User**

### 3. Deploy Firestore Security Rules
```bash
# Deploy the security rules
firebase deploy --only firestore:rules
```

### 4. Start Development Server
```bash
# Install dependencies (if not done)
npm install

# Start the development server
npm run dev
```

## 🔧 Testing Scenarios

### Phase 1: Admin Portal Testing

#### 1.1 Admin Login Test
- **URL**: `http://localhost:5173/admin/login`
- **Expected**: Professional dark login page with glassmorphism design
- **Credentials**: 
  - Email: `gunj06saksham@gmail.com`
  - Password: `admin123`
- **Test Cases**:
  - ✅ Valid credentials → Redirect to admin dashboard
  - ❌ Invalid email → Error message
  - ❌ Invalid password → Error message
  - ❌ Empty fields → Validation errors

#### 1.2 Admin Dashboard Test
- **URL**: `http://localhost:5173/admin/dashboard` (after login)
- **Expected**: Modern admin dashboard with stats cards
- **Test Cases**:
  - ✅ Dashboard loads with empty state
  - ✅ Stats show 0 restaurants initially
  - ✅ "New Restaurant" button is visible
  - ✅ Search and filter components work
  - ✅ Logout button redirects to login

### Phase 2: Restaurant Creation Testing

#### 2.1 Create Restaurant Flow
Click **"New Restaurant"** button and test:

**Test Restaurant 1 - Pizza Place**:
- Business Type: `Restaurant`
- Name: `Mario's Pizza Palace`
- Owner Name: `Mario Rossi`
- Owner Email: `mario@mariospizza.com`
- Phone: `+1 (555) 123-4567`
- Address: `123 Main St, New York, NY 10001`

**Expected Results**:
- ✅ Unique slug generated: `marios-pizza-palace`
- ✅ Success toast message
- ✅ Credentials modal appears with:
  - Restaurant URL: `http://localhost:5173/marios-pizza-palace`
  - Email: `mario@mariospizza.com`
  - Auto-generated 12-char password
  - Auto-generated 4-digit PIN
- ✅ Copy buttons work for all credentials
- ✅ Restaurant appears in dashboard list

**Test Restaurant 2 - Coffee Shop**:
- Business Type: `Cafe`
- Name: `Brew & Bean Café`
- Owner Name: `Sarah Johnson`
- Owner Email: `sarah@brewbean.com`
- Phone: `+1 (555) 987-6543`

**Expected Results**:
- ✅ Yellow theme indicators (cafe type)
- ✅ Slug: `brew-bean-cafe`
- ✅ Credentials generated successfully

**Test Restaurant 3 - Bar**:
- Business Type: `Bar`
- Name: `The Tipsy Owl`
- Owner Name: `Jake Miller`
- Owner Email: `jake@tipsyowl.com`

**Expected Results**:
- ✅ Purple theme indicators (bar type)
- ✅ Slug: `the-tipsy-owl`
- ✅ Credentials generated successfully

#### 2.2 Dashboard Management Test
After creating restaurants:
- ✅ Stats update correctly (3 total, 3 active, 0 inactive)
- ✅ Search functionality works
- ✅ Filter by business type works
- ✅ Restaurant cards show correct info
- ✅ Status badges show "Active"
- ✅ Action buttons work:
  - External link opens restaurant URL
  - Copy button copies URL
  - Power button toggles status

### Phase 3: Restaurant Portal Testing

#### 3.1 Restaurant URL Access
For each created restaurant, test direct URL access:

**Mario's Pizza Palace**:
- **URL**: `http://localhost:5173/marios-pizza-palace`
- **Expected**: Restaurant dashboard with green theme
- **Test**: Not logged in → Should show login prompt or redirect

**Brew & Bean Café**:
- **URL**: `http://localhost:5173/brew-bean-cafe`
- **Expected**: Restaurant dashboard with yellow theme

**The Tipsy Owl**:
- **URL**: `http://localhost:5173/the-tipsy-owl`
- **Expected**: Restaurant dashboard with purple theme

#### 3.2 Restaurant Login Test
For each restaurant, test login:

**URL**: `http://localhost:5173/{slug}/login`

**Test Mario's Pizza Login**:
- Email: `mario@mariospizza.com`
- Password: (use generated password from creation)
- **Expected**: 
  - ✅ Green theme throughout login page
  - ✅ Successful login → Redirect to restaurant dashboard
  - ✅ Dashboard shows restaurant-specific data

**Test PIN Login** (if implemented):
- PIN: (use generated 4-digit PIN)
- **Expected**: Quick login success

#### 3.3 Restaurant Dashboard Test
After successful login:
- ✅ Correct restaurant name in header
- ✅ Theme matches business type
- ✅ Navigation menu appropriate for POS
- ✅ User can access restaurant features
- ✅ Logout works correctly

### Phase 4: Error Handling Testing

#### 4.1 Invalid URLs
- **URL**: `http://localhost:5173/nonexistent-restaurant`
- **Expected**: 404 page with helpful message

#### 4.2 Inactive Restaurant Access
1. In admin dashboard, deactivate a restaurant
2. Try to access its URL
3. **Expected**: Error message or redirect

#### 4.3 Network Error Simulation
- Disconnect internet
- Try admin login
- **Expected**: Appropriate error messages

### Phase 5: Security Testing

#### 5.1 Unauthorized Access
- Try accessing admin dashboard without login
- **Expected**: Redirect to login page

#### 5.2 Cross-Restaurant Access
- Login to Restaurant A
- Try to access Restaurant B's URL
- **Expected**: Access denied or redirect

#### 5.3 Firestore Security
Check Firebase Console to verify:
- ✅ Super admin can see all data
- ✅ Restaurant owners can only see their data
- ✅ Proper data isolation between restaurants

## 🎯 Testing Checklist

### Admin Portal ✅
- [ ] Admin login with correct credentials
- [ ] Admin login with incorrect credentials
- [ ] Admin dashboard loads
- [ ] Restaurant creation flow
- [ ] Restaurant list management
- [ ] Search and filter functionality
- [ ] Restaurant status toggle
- [ ] URL copying and sharing
- [ ] Admin logout

### Restaurant Portal ✅
- [ ] Restaurant URL access (all 3 types)
- [ ] Restaurant login (email + password)
- [ ] PIN login (if implemented)
- [ ] Restaurant dashboard loading
- [ ] Theme consistency per business type
- [ ] Restaurant-specific data isolation
- [ ] Restaurant logout

### Data Integrity ✅
- [ ] Unique slug generation
- [ ] Conflict resolution for duplicate names
- [ ] Secure password generation
- [ ] PIN generation (4 digits)
- [ ] Firebase Authentication account creation
- [ ] Firestore document creation
- [ ] Proper user role assignment

### UI/UX ✅
- [ ] Responsive design on different screen sizes
- [ ] Theme switching between business types
- [ ] Loading states and error handling
- [ ] Toast notifications
- [ ] Copy-to-clipboard functionality
- [ ] Professional design consistency

### Security ✅
- [ ] Firestore security rules enforcement
- [ ] Authentication requirement
- [ ] Data isolation between restaurants
- [ ] Super admin privileges
- [ ] Restaurant owner limitations

## 🚀 Performance Testing

### Load Testing
- Create 10+ restaurants rapidly
- Check dashboard performance
- Verify Firebase quota usage

### Cache Testing
- Test restaurant data caching (5-minute TTL)
- Verify cache invalidation on updates

## 🐛 Common Issues & Solutions

### Issue: Admin account not found
**Solution**: Create admin account in Firebase Console first

### Issue: Firestore permission denied
**Solution**: Deploy security rules: `firebase deploy --only firestore:rules`

### Issue: Restaurant URL 404
**Solution**: Check if restaurant slug exists in Firestore

### Issue: Theme not applying
**Solution**: Verify CSS custom properties are set correctly

### Issue: Firebase connection error
**Solution**: Check Firebase config in environment variables

## 📊 Success Metrics

### Admin Portal Success
- ✅ Can create 3 different restaurant types
- ✅ All credentials generated and copyable
- ✅ Restaurant management actions work
- ✅ Search/filter functionality operational

### Restaurant Portal Success
- ✅ All 3 restaurants accessible via unique URLs
- ✅ Login works with generated credentials
- ✅ Themes apply correctly per business type
- ✅ Data isolation maintained

### Security Success
- ✅ Only super admin can manage restaurants
- ✅ Restaurant owners can only access their data
- ✅ Unauthorized access properly blocked

## 🎉 Test Completion

Once all tests pass, your TenVerse POS system is ready for production deployment!

**Next Steps**:
1. Deploy to production Firebase project
2. Set up custom domain
3. Configure production environment variables
4. Monitor system performance and usage

# Testing Guide: Table-Specific Menu Portal

## 🚀 **Quick Start Testing**

### **Step 1: Access the Application**
1. Open your browser and go to: `http://localhost:5174`
2. You'll be redirected to admin login
3. Login with your admin credentials

### **Step 2: Navigate to Customer Portal**
You now have **3 ways** to access the Customer Portal:

**Option A: From Dashboard**
1. Go to restaurant dashboard
2. Look for "Customer Portal" card in Quick Actions section
3. Click on it

**Option B: From Navigation Menu**
1. Click "Quick Menu" in the top navigation
2. Find "Customer Portal" in the dropdown
3. Click "Configure menu portal & QR codes"

**Option C: Direct URL**
- Go to: `http://localhost:5174/restaurant-slug/customer-portal`

---

## 🧪 **Testing Scenarios**

### **Scenario 1: Single Portal Link (Current Functionality)**

1. **Setup:**
   - Go to Customer Portal
   - Select "Single Portal Link" radio button
   - Copy the general portal URL

2. **Test:**
   - Open the URL in new tab/incognito window
   - Should show: `http://localhost:5174/restaurant-slug/menu-portal`
   - Verify NO table information in header
   - Place an order

3. **Expected Result:**
   - Order appears in KDS as "Online Order"
   - No table-specific information

### **Scenario 2: Table-Specific Links (New Functionality)**

1. **Setup:**
   - Go to Customer Portal
   - Select "Table-Specific Links" radio button
   - You should see tables organized by area/floor

2. **Test Each Table:**
   - Click "Copy" button for Table 1
   - Open the URL in new tab: `http://localhost:5174/restaurant-slug/menu-portal/table-id`
   - Verify table information appears in header: "Table 1 - Main Dining (4 seats)"
   - Place an order

3. **Expected Result:**
   - Order appears in KDS with table information: "Table 1 - Main Dining"
   - Shows table capacity and area

### **Scenario 3: QR Code Generation**

1. **Single Portal:**
   - Download general QR code
   - Scan with phone → should go to general portal

2. **Table-Specific:**
   - Download QR code for specific table
   - Scan with phone → should go to table-specific portal
   - Verify table info appears

### **Scenario 4: Kitchen Display Verification**

1. **Place Orders:**
   - Order from general portal
   - Order from Table 1 specific link
   - Order from Table 2 specific link

2. **Check KDS:**
   - Go to Kitchen Display (`/restaurant-slug/kitchen`)
   - Verify orders show correctly:
     - General: "Online Order"
     - Table 1: "Table 1 - Main Dining" 
     - Table 2: "Table 2 - Main Dining"

---

## 🔍 **What to Look For**

### **✅ Success Indicators:**

1. **Portal Type Selection:**
   - Radio buttons work properly
   - UI switches between single and table-specific views

2. **Table-Specific URLs:**
   - Each table has unique URL with tableId
   - Copy buttons work
   - URLs open correctly

3. **Customer Experience:**
   - Table info displays in header when using table-specific link
   - No table info for general portal
   - Ordering process works the same

4. **Kitchen Display:**
   - Clear differentiation between order types
   - Table information visible for table-specific orders
   - Proper order organization

### **❌ Issues to Watch For:**

1. **Navigation Issues:**
   - Customer Portal not appearing in menus
   - Broken links or 404 errors

2. **Table Loading:**
   - "No tables found" message when tables exist
   - Tables not organized by area properly

3. **URL Generation:**
   - Malformed URLs
   - Copy function not working

4. **Order Association:**
   - Orders not showing correct table information
   - Table info missing in KDS

---

## 🛠️ **Troubleshooting**

### **If Customer Portal doesn't appear in navigation:**
- Check if user has proper permissions
- Refresh the page
- Clear browser cache

### **If tables don't load:**
- Ensure tables exist in Tables section
- Check tables are marked as "active"
- Verify restaurant has tables created

### **If URLs don't work:**
- Check browser console for errors
- Verify restaurant slug is correct
- Ensure development server is running

### **If orders don't show table info:**
- Check that order was placed via table-specific URL
- Verify tableId is being passed correctly
- Check KDS is loading latest orders

---

## 📱 **Mobile Testing**

1. **Test on Mobile Device:**
   - Copy table-specific URL to phone
   - Verify responsive design works
   - Test ordering process on mobile

2. **QR Code Testing:**
   - Download QR codes
   - Scan with phone camera or QR app
   - Verify correct redirection

---

## 🎯 **Quick Validation Checklist**

- [ ] Customer Portal appears in dashboard quick actions
- [ ] Customer Portal appears in navigation quick menu
- [ ] Portal type selection works (Single vs Table-Specific)
- [ ] Tables load and display by area
- [ ] Table-specific URLs generate correctly
- [ ] Copy and download buttons work
- [ ] Table info shows in customer portal header
- [ ] Orders create with correct table association
- [ ] KDS shows table information for table-specific orders
- [ ] General portal still works as before
- [ ] QR codes generate and work properly
- [ ] Mobile responsive design works

---

## 📞 **Need Help?**

If you encounter any issues:

1. **Check Browser Console** for JavaScript errors
2. **Check Network Tab** for failed API calls  
3. **Verify Database** has tables created
4. **Clear Cache** and try again
5. **Test in Incognito Mode** to rule out cache issues

The implementation maintains backward compatibility, so existing functionality should continue working while new table-specific features are available when selected. 