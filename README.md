# 🍽️ Restaurant POS System

A comprehensive Point of Sale system designed specifically for restaurants with modern features and real-time operations.

## ✨ Features

### 📊 **Dashboard & Analytics**
- Real-time sales analytics
- Revenue tracking and trends
- Order status monitoring
- Customer insights and metrics

### 🍽️ **Order Management**
- Professional POS workflow
- Stay-on-page ordering (no redirects)
- KOT (Kitchen Order Ticket) printing
- Multiple orders per table support
- Order status tracking (placed → confirmed → preparing → ready → delivered)

### 💳 **Payment Processing**
- **Three Payment Methods**: UPI, Cash, Bank
- **Discount System**: Amount or percentage discounts with reason tracking
- **Customer Integration**: Link customers during payment
- **Receipt Generation**: Professional bill printing
- **Combined Billing**: Handle multiple orders in single payment

### 👥 **Customer Management**
- Customer database with full CRUD operations
- Real-time search by name or phone
- Order history tracking per customer
- Customer stats (visits, total spent, last visit)
- Create customers directly from payment flow
- Export customer data to CSV

### 🏪 **Table Management**
- Visual table layout
- Table status tracking (available → occupied → reserved → cleaning)
- Multiple table areas support
- Table capacity management

### 📋 **Menu Management**
- Category-based menu organization
- Item variants and options
- Price management
- Availability controls
- Preparation time tracking
- Allergen information

### 📦 **Inventory Management**
- Stock level monitoring
- Low stock alerts
- Purchase tracking
- Unit conversions
- Supplier management

### 🎨 **Modern UI/UX**
- **Professional Navigation**: Comprehensive navbar with all sections
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live order status and notifications
- **Modern Interface**: Clean, intuitive design
- **Accessibility**: Keyboard navigation and screen reader support

### 🔐 **Authentication & Security**
- Role-based access control
- Secure user authentication
- Restaurant-specific data isolation
- Session management

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase account
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd restaurant-pos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project
   - Enable Firestore and Authentication
   - Add your Firebase config to environment variables
   - Set up Firestore security rules

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   ```
   http://localhost:5173
   ```

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── common/         # Common UI elements
│   ├── inventory/      # Inventory management
│   ├── layouts/        # Layout components (navbar, etc.)
│   └── restaurant/     # Restaurant-specific components
├── contexts/           # React contexts for state management
├── lib/               # Utilities and configurations
├── pages/             # Page components
│   ├── admin/         # Admin dashboard pages
│   └── restaurant/    # Restaurant POS pages
├── services/          # Firebase services and API calls
└── types/             # TypeScript type definitions
```

## 💻 Core Pages

### Restaurant POS
- **Dashboard** (`/restaurant/dashboard`) - Analytics and overview
- **Tables** (`/restaurant/tables`) - Table management and status
- **Take Order** (`/restaurant/table/:id`) - Main POS interface
- **Orders** (`/restaurant/orders`) - Order history and management
- **Menu** (`/restaurant/menu`) - Menu item and category management
- **Inventory** (`/restaurant/inventory`) - Stock management
- **Customers** (`/restaurant/customers`) - Customer database
- **Settings** (`/restaurant/settings`) - Restaurant configuration

## 🔧 Technical Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Firebase Firestore, Firebase Auth
- **Build Tool**: Vite
- **UI Components**: Lucide React icons
- **Forms**: React Hook Form
- **Routing**: React Router DOM
- **Notifications**: React Hot Toast

## 🎯 Key Workflows

### Order Taking Process
1. Select table → Add items to cart → Place order
2. Auto-print KOT to kitchen
3. Show "Print KOT" + "Payment" buttons
4. When adding more items: hide KOT/Payment, show "Place Order"
5. Process payment with customer linking and discounts

### Payment Flow
1. Select payment method (UPI/Cash/Bank)
2. Search and link customer (optional)
3. Apply discounts (amount/percentage)
4. Complete payment
5. Auto-generate and print receipt

### Customer Management
1. Search customers by name or phone
2. View order history and stats
3. Create new customers on-the-fly
4. Export customer data
5. Track customer loyalty metrics

## 🏃‍♂️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Variables
Create a `.env` file with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🔄 Real-time Features

- **Live Order Updates**: Orders update in real-time across all devices
- **Table Status**: Live table availability and status changes
- **Inventory Alerts**: Real-time low stock notifications
- **Customer Search**: Instant search results as you type

## 📱 Mobile Support

The application is fully responsive and optimized for:
- **Desktop**: Full dashboard and management interface
- **Tablet**: Optimized POS interface for servers
- **Mobile**: Quick order taking and basic management

## 🎨 UI Features

- **Professional Navigation**: Fixed navbar with all sections
- **Modern Design**: Clean, modern interface with proper spacing
- **Dark/Light Themes**: Consistent theming throughout
- **Loading States**: Proper loading indicators
- **Error Handling**: User-friendly error messages
- **Toast Notifications**: Real-time feedback for actions

## 🔒 Security

- **Authentication Required**: All routes protected
- **Restaurant Isolation**: Data separated by restaurant
- **Role-based Access**: Different permissions for different roles
- **Secure API**: Firebase security rules protect data

## 📈 Analytics & Reporting

- **Sales Analytics**: Daily, weekly, monthly reports
- **Popular Items**: Track best-selling menu items
- **Customer Insights**: Customer behavior and preferences
- **Revenue Tracking**: Detailed financial reporting

## 🛠️ Customization

The system is designed to be customizable:
- **Restaurant Branding**: Logo, colors, and themes
- **Menu Categories**: Flexible category system
- **Payment Methods**: Configurable payment options
- **Tax Settings**: Adjustable tax rates
- **Currency**: Multi-currency support

## 📞 Support

For support or questions about the Restaurant POS System, please refer to the documentation or contact the development team.

---

**Built with ❤️ for modern restaurants** 