import { 
  createSupplier, 
  createProduct, 
  getSuppliers 
} from './marketplaceService';
import { 
  Supplier, 
  MarketplaceProduct, 
  MarketplaceCategory,
  PricingTier 
} from '../types';

// Sample Suppliers
const sampleSuppliers: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'John Smith',
    businessName: 'Fresh Farm Supplies',
    email: 'john@freshfarmsupplies.com',
    phone: '+1-555-0101',
    address: {
      street: '123 Farm Road',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'USA'
    },
    logo: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=200&h=200&fit=crop&crop=center',
    description: 'Premium fresh produce and organic vegetables sourced directly from local farms. We specialize in high-quality ingredients for restaurants.',
    categories: ['vegetables', 'meat', 'dairy'],
    rating: 4.8,
    totalReviews: 127,
    isVerified: true,
    certifications: ['Organic Certified', 'Food Safety', 'USDA Approved'],
    minimumOrderAmount: 100,
    deliveryAreas: ['Austin', 'San Antonio', 'Houston'],
    deliveryFee: 15,
    freeDeliveryThreshold: 500,
    businessLicense: 'TX-FS-001234',
    taxId: '74-1234567',
    isActive: true,
    joinedAt: new Date('2023-01-15'),
    lastActiveAt: new Date()
  },
  {
    name: 'Maria Rodriguez',
    businessName: 'Wholesale Meat Co',
    email: 'maria@wholesalemeat.com',
    phone: '+1-555-0102',
    address: {
      street: '456 Industrial Blvd',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      country: 'USA'
    },
    logo: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=200&h=200&fit=crop&crop=center',
    description: 'Premier wholesale meat supplier specializing in premium cuts, poultry, and seafood. USDA inspected facilities with 24/7 cold chain management.',
    categories: ['meat', 'frozen'],
    rating: 4.9,
    totalReviews: 89,
    isVerified: true,
    certifications: ['USDA Inspected', 'HACCP Certified', 'Halal Certified'],
    minimumOrderAmount: 200,
    deliveryAreas: ['Dallas', 'Fort Worth', 'Austin'],
    deliveryFee: 25,
    freeDeliveryThreshold: 750,
    businessLicense: 'TX-MT-005678',
    taxId: '75-5678901',
    isActive: true,
    joinedAt: new Date('2023-02-20'),
    lastActiveAt: new Date()
  },
  {
    name: 'David Chen',
    businessName: 'Restaurant Equipment Plus',
    email: 'david@restaurantequipmentplus.com',
    phone: '+1-555-0103',
    address: {
      street: '789 Commercial Ave',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      country: 'USA'
    },
    logo: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=200&h=200&fit=crop&crop=center',
    description: 'Complete restaurant equipment solutions from small appliances to commercial kitchen setups. Expert installation and 24/7 support available.',
    categories: ['equipment', 'packaging'],
    rating: 4.7,
    totalReviews: 156,
    isVerified: true,
    certifications: ['NSF Certified', 'Energy Star Partner'],
    minimumOrderAmount: 150,
    deliveryAreas: ['Houston', 'Austin', 'San Antonio'],
    deliveryFee: 30,
    freeDeliveryThreshold: 1000,
    businessLicense: 'TX-EQ-009012',
    taxId: '77-9012345',
    isActive: true,
    joinedAt: new Date('2023-03-10'),
    lastActiveAt: new Date()
  },
  {
    name: 'Sarah Johnson',
    businessName: 'Spice World International',
    email: 'sarah@spiceworld.com',
    phone: '+1-555-0104',
    address: {
      street: '321 Spice Street',
      city: 'San Antonio',
      state: 'TX',
      zipCode: '78201',
      country: 'USA'
    },
    logo: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&h=200&fit=crop&crop=center',
    description: 'Premium spices and seasonings from around the world. We offer bulk quantities with competitive pricing for restaurants and food services.',
    categories: ['spices', 'grains'],
    rating: 4.6,
    totalReviews: 78,
    isVerified: true,
    certifications: ['Organic Certified', 'Fair Trade'],
    minimumOrderAmount: 75,
    deliveryAreas: ['San Antonio', 'Austin', 'Houston'],
    deliveryFee: 10,
    freeDeliveryThreshold: 300,
    businessLicense: 'TX-SP-003456',
    taxId: '78-3456789',
    isActive: true,
    joinedAt: new Date('2023-04-05'),
    lastActiveAt: new Date()
  },
  {
    name: 'Mike Thompson',
    businessName: 'Dairy Fresh Direct',
    email: 'mike@dairyfreshdirect.com',
    phone: '+1-555-0105',
    address: {
      street: '555 Dairy Lane',
      city: 'Austin',
      state: 'TX',
      zipCode: '78705',
      country: 'USA'
    },
    description: 'Premium dairy products from local farms. Fresh milk, cheese, butter, and cream delivered daily.',
    categories: ['dairy'],
    rating: 4.5,
    totalReviews: 94,
    isVerified: true,
    certifications: ['Grade A Dairy', 'Organic Certified'],
    minimumOrderAmount: 80,
    deliveryAreas: ['Austin', 'Round Rock', 'Cedar Park'],
    deliveryFee: 12,
    freeDeliveryThreshold: 400,
    businessLicense: 'TX-DA-007890',
    taxId: '78-7890123',
    isActive: true,
    joinedAt: new Date('2023-05-12'),
    lastActiveAt: new Date()
  }
];

// Function to create sample products for each supplier
const createSampleProductsForSupplier = (supplierId: string, supplierName: string): Omit<MarketplaceProduct, 'id' | 'createdAt' | 'updatedAt'>[] => {
  const products: Omit<MarketplaceProduct, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  switch (supplierName) {
    case 'Fresh Farm Supplies':
      products.push(
        {
          supplierId,
          supplierName,
          name: 'Premium Organic Tomatoes',
          description: 'Vine-ripened organic tomatoes perfect for sauces, salads, and cooking. Harvested at peak ripeness for maximum flavor.',
          category: 'vegetables',
          subcategory: 'Fresh Vegetables',
          images: [
            'https://images.unsplash.com/photo-1592841200221-4e2f32d8e2cd?w=400&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1546470427-e26264ab2b24?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 10,
          maximumOrderQuantity: 500,
          pricingTiers: [
            { minQuantity: 10, maxQuantity: 49, pricePerUnit: 3.50 },
            { minQuantity: 50, maxQuantity: 99, pricePerUnit: 3.25, discountPercentage: 7 },
            { minQuantity: 100, pricePerUnit: 2.95, discountPercentage: 16 }
          ],
          specifications: {
            origin: 'Local Texas Farms',
            certifications: ['Organic', 'Non-GMO'],
            shelfLife: '5-7 days',
            storageRequirements: 'Cool, dry place'
          },
          isAvailable: true,
          stockQuantity: 1000,
          qualityGrade: 'A',
          certifications: ['Organic', 'USDA Certified'],
          tags: ['fresh', 'local', 'organic', 'featured'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Fresh Yellow Onions',
          description: 'Premium yellow onions ideal for cooking, soups, and sauces. Sweet flavor and long shelf life.',
          category: 'vegetables',
          subcategory: 'Root Vegetables',
          images: [
            'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 25,
          maximumOrderQuantity: 200,
          pricingTiers: [
            { minQuantity: 25, maxQuantity: 49, pricePerUnit: 1.20 },
            { minQuantity: 50, maxQuantity: 99, pricePerUnit: 1.10, discountPercentage: 8 },
            { minQuantity: 100, pricePerUnit: 0.95, discountPercentage: 21 }
          ],
          specifications: {
            origin: 'Local Texas Farms',
            shelfLife: '30-45 days',
            storageRequirements: 'Cool, dry, well-ventilated area'
          },
          isAvailable: true,
          stockQuantity: 800,
          qualityGrade: 'A',
          certifications: [],
          tags: ['fresh', 'local', 'bulk'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Organic Baby Spinach',
          description: 'Fresh organic baby spinach leaves, perfect for salads, smoothies, and cooking.',
          category: 'vegetables',
          subcategory: 'Fresh Vegetables',
          images: [
            'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 5,
          maximumOrderQuantity: 100,
          pricingTiers: [
            { minQuantity: 5, maxQuantity: 14, pricePerUnit: 4.50 },
            { minQuantity: 15, maxQuantity: 29, pricePerUnit: 4.20, discountPercentage: 7 },
            { minQuantity: 30, pricePerUnit: 3.85, discountPercentage: 14 }
          ],
          specifications: {
            origin: 'Local Organic Farms',
            shelfLife: '3-5 days',
            storageRequirements: 'Refrigerated'
          },
          isAvailable: true,
          stockQuantity: 200,
          qualityGrade: 'A',
          certifications: ['Organic', 'USDA Certified'],
          tags: ['fresh', 'organic', 'trending'],
          isActive: true
        }
      );
      break;

    case 'Wholesale Meat Co':
      products.push(
        {
          supplierId,
          supplierName,
          name: 'Premium Chicken Breast',
          description: 'Fresh, boneless, skinless chicken breast from free-range chickens. Perfect for grilling, roasting, or frying.',
          category: 'meat',
          subcategory: 'Fresh Chicken',
          images: [
            'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 20,
          maximumOrderQuantity: 300,
          pricingTiers: [
            { minQuantity: 20, maxQuantity: 49, pricePerUnit: 6.50 },
            { minQuantity: 50, maxQuantity: 99, pricePerUnit: 6.20, discountPercentage: 5 },
            { minQuantity: 100, pricePerUnit: 5.85, discountPercentage: 10 }
          ],
          specifications: {
            origin: 'Texas Farms',
            brand: 'Premium Poultry',
            storageRequirements: 'Keep refrigerated 32-38°F',
            shelfLife: '3-5 days refrigerated'
          },
          isAvailable: true,
          stockQuantity: 500,
          qualityGrade: 'A',
          certifications: ['Free-Range', 'Antibiotic-Free'],
          tags: ['fresh', 'premium', 'trending'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Ground Beef 80/20',
          description: 'Fresh ground beef with 80% lean meat, 20% fat ratio. Perfect for burgers, meatballs, and various dishes.',
          category: 'meat',
          subcategory: 'Fresh Beef',
          images: [
            'https://images.unsplash.com/photo-1529693662653-9d480530a697?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 15,
          maximumOrderQuantity: 200,
          pricingTiers: [
            { minQuantity: 15, maxQuantity: 49, pricePerUnit: 5.95 },
            { minQuantity: 50, maxQuantity: 99, pricePerUnit: 5.65, discountPercentage: 5 },
            { minQuantity: 100, pricePerUnit: 5.25, discountPercentage: 12 }
          ],
          specifications: {
            origin: 'Texas Beef',
            storageRequirements: 'Keep refrigerated 32-38°F',
            shelfLife: '3-5 days refrigerated'
          },
          isAvailable: true,
          stockQuantity: 400,
          qualityGrade: 'A',
          certifications: ['USDA Inspected'],
          tags: ['fresh', 'local'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Fresh Salmon Fillets',
          description: 'Premium Atlantic salmon fillets, fresh and sustainably sourced. Rich in omega-3 fatty acids.',
          category: 'meat',
          subcategory: 'Fresh Seafood',
          images: [
            'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 10,
          maximumOrderQuantity: 150,
          pricingTiers: [
            { minQuantity: 10, maxQuantity: 24, pricePerUnit: 14.50 },
            { minQuantity: 25, maxQuantity: 49, pricePerUnit: 13.95, discountPercentage: 4 },
            { minQuantity: 50, pricePerUnit: 13.25, discountPercentage: 9 }
          ],
          specifications: {
            origin: 'Atlantic Ocean',
            storageRequirements: 'Keep refrigerated 32-38°F',
            shelfLife: '2-3 days refrigerated'
          },
          isAvailable: true,
          stockQuantity: 150,
          qualityGrade: 'Premium',
          certifications: ['Sustainably Sourced', 'MSC Certified'],
          tags: ['fresh', 'premium', 'seafood', 'featured'],
          isActive: true
        }
      );
      break;

    case 'Restaurant Equipment Plus':
      products.push(
        {
          supplierId,
          supplierName,
          name: 'Commercial Food Processor',
          description: 'Heavy-duty 20-cup commercial food processor with multiple blade attachments. Perfect for high-volume food preparation.',
          category: 'equipment',
          subcategory: 'Small Appliances',
          images: [
            'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'unit',
          minimumOrderQuantity: 1,
          maximumOrderQuantity: 10,
          pricingTiers: [
            { minQuantity: 1, maxQuantity: 2, pricePerUnit: 450.00 },
            { minQuantity: 3, maxQuantity: 5, pricePerUnit: 425.00, discountPercentage: 6 },
            { minQuantity: 6, pricePerUnit: 395.00, discountPercentage: 12 }
          ],
          specifications: {
            brand: 'ProChef',
            dimensions: '16" x 11" x 18"',
            weight: '25 lbs',
            certifications: ['NSF Certified']
          },
          isAvailable: true,
          stockQuantity: 25,
          qualityGrade: 'Premium',
          certifications: ['NSF', 'UL Listed'],
          tags: ['equipment', 'commercial', 'heavy-duty'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Stainless Steel Mixing Bowls Set',
          description: 'Professional grade stainless steel mixing bowls in various sizes. Dishwasher safe and built to last.',
          category: 'equipment',
          subcategory: 'Utensils',
          images: [
            'https://images.unsplash.com/photo-1585515656973-c0eefc2b7b12?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'set',
          minimumOrderQuantity: 2,
          maximumOrderQuantity: 50,
          pricingTiers: [
            { minQuantity: 2, maxQuantity: 9, pricePerUnit: 85.00 },
            { minQuantity: 10, maxQuantity: 19, pricePerUnit: 78.00, discountPercentage: 8 },
            { minQuantity: 20, pricePerUnit: 72.00, discountPercentage: 15 }
          ],
          specifications: {
            brand: 'ChefMaster',
            dimensions: 'Set of 6: 1qt, 2qt, 3qt, 4qt, 6qt, 8qt',
            weight: '8 lbs per set'
          },
          isAvailable: true,
          stockQuantity: 100,
          qualityGrade: 'Premium',
          certifications: ['NSF'],
          tags: ['equipment', 'stainless-steel', 'durable'],
          isActive: true
        }
      );
      break;

    case 'Spice World International':
      products.push(
        {
          supplierId,
          supplierName,
          name: 'Premium Black Pepper',
          description: 'Freshly ground premium black pepper from Malabar coast. Rich, aromatic flavor perfect for all cuisines.',
          category: 'spices',
          subcategory: 'Whole Spices',
          images: [
            'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 5,
          maximumOrderQuantity: 100,
          pricingTiers: [
            { minQuantity: 5, maxQuantity: 14, pricePerUnit: 12.50 },
            { minQuantity: 15, maxQuantity: 29, pricePerUnit: 11.25, discountPercentage: 10 },
            { minQuantity: 30, pricePerUnit: 9.95, discountPercentage: 20 }
          ],
          specifications: {
            origin: 'Kerala, India',
            shelfLife: '24 months',
            storageRequirements: 'Cool, dry place'
          },
          isAvailable: true,
          stockQuantity: 200,
          qualityGrade: 'Premium',
          certifications: ['Organic', 'Fair Trade'],
          tags: ['spice', 'premium', 'imported'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Himalayan Pink Salt',
          description: 'Pure Himalayan pink salt with natural minerals. Perfect for seasoning and finishing dishes.',
          category: 'spices',
          subcategory: 'Salt',
          images: [
            'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 10,
          maximumOrderQuantity: 200,
          pricingTiers: [
            { minQuantity: 10, maxQuantity: 24, pricePerUnit: 8.50 },
            { minQuantity: 25, maxQuantity: 49, pricePerUnit: 7.65, discountPercentage: 10 },
            { minQuantity: 50, pricePerUnit: 6.80, discountPercentage: 20 }
          ],
          specifications: {
            origin: 'Pakistan',
            shelfLife: 'Indefinite',
            storageRequirements: 'Dry place'
          },
          isAvailable: true,
          stockQuantity: 300,
          qualityGrade: 'Premium',
          certifications: ['Natural', 'Unrefined'],
          tags: ['salt', 'natural', 'premium', 'featured'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Basmati Rice Premium',
          description: 'Aged basmati rice with long grains and aromatic flavor. Perfect for biryanis, pilafs, and side dishes.',
          category: 'grains',
          subcategory: 'Rice',
          images: [
            'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 20,
          maximumOrderQuantity: 500,
          pricingTiers: [
            { minQuantity: 20, maxQuantity: 49, pricePerUnit: 4.25 },
            { minQuantity: 50, maxQuantity: 99, pricePerUnit: 3.95, discountPercentage: 7 },
            { minQuantity: 100, pricePerUnit: 3.50, discountPercentage: 18 }
          ],
          specifications: {
            origin: 'India',
            brand: 'Royal Harvest',
            shelfLife: '18 months',
            storageRequirements: 'Cool, dry place'
          },
          isAvailable: true,
          stockQuantity: 1000,
          qualityGrade: 'Premium',
          certifications: ['Non-GMO'],
          tags: ['grain', 'premium', 'aromatic'],
          isActive: true
        }
      );
      break;

    case 'Dairy Fresh Direct':
      products.push(
        {
          supplierId,
          supplierName,
          name: 'Heavy Cream 36%',
          description: 'Rich heavy cream with 36% fat content. Perfect for sauces, soups, and desserts.',
          category: 'dairy',
          subcategory: 'Milk & Cream',
          images: [
            'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'qt',
          minimumOrderQuantity: 12,
          maximumOrderQuantity: 100,
          pricingTiers: [
            { minQuantity: 12, maxQuantity: 23, pricePerUnit: 8.50 },
            { minQuantity: 24, maxQuantity: 47, pricePerUnit: 8.00, discountPercentage: 6 },
            { minQuantity: 48, pricePerUnit: 7.45, discountPercentage: 12 }
          ],
          specifications: {
            origin: 'Local Dairy',
            shelfLife: '14 days refrigerated',
            storageRequirements: 'Keep refrigerated 32-38°F'
          },
          isAvailable: true,
          stockQuantity: 200,
          qualityGrade: 'A',
          certifications: ['Grade A Pasteurized'],
          tags: ['dairy', 'fresh', 'local'],
          isActive: true
        },
        {
          supplierId,
          supplierName,
          name: 'Aged Cheddar Cheese',
          description: 'Sharp aged cheddar cheese, perfect for melting or serving. Aged for 12 months for rich flavor.',
          category: 'dairy',
          subcategory: 'Cheese',
          images: [
            'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&h=400&fit=crop&crop=center'
          ],
          unit: 'lb',
          minimumOrderQuantity: 5,
          maximumOrderQuantity: 100,
          pricingTiers: [
            { minQuantity: 5, maxQuantity: 14, pricePerUnit: 12.50 },
            { minQuantity: 15, maxQuantity: 29, pricePerUnit: 11.75, discountPercentage: 6 },
            { minQuantity: 30, pricePerUnit: 10.95, discountPercentage: 12 }
          ],
          specifications: {
            origin: 'Local Artisan Dairy',
            shelfLife: '60 days refrigerated',
            storageRequirements: 'Keep refrigerated 32-38°F'
          },
          isAvailable: true,
          stockQuantity: 150,
          qualityGrade: 'Premium',
          certifications: ['Artisan Made', 'Natural'],
          tags: ['dairy', 'aged', 'premium', 'featured'],
          isActive: true
        }
      );
      break;
  }

  return products;
};

// Main seeding function
export const seedMarketplaceData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🌱 Starting marketplace data seeding...');

    // Check if suppliers already exist
    const existingSuppliers = await getSuppliers();
    if (existingSuppliers.length > 0) {
      return {
        success: false,
        message: 'Marketplace already has suppliers. Clear data first if you want to reseed.'
      };
    }

    // Create suppliers
    console.log('📦 Creating suppliers...');
    const supplierIds: { [key: string]: string } = {};
    
    for (const supplierData of sampleSuppliers) {
      try {
        const supplierId = await createSupplier(supplierData);
        supplierIds[supplierData.businessName] = supplierId;
        console.log(`✅ Created supplier: ${supplierData.businessName}`);
      } catch (error) {
        console.error(`❌ Failed to create supplier ${supplierData.businessName}:`, error);
      }
    }

    // Create products for each supplier
    console.log('🛍️ Creating products...');
    let totalProducts = 0;
    
    for (const [businessName, supplierId] of Object.entries(supplierIds)) {
      const products = createSampleProductsForSupplier(supplierId, businessName);
      
      for (const productData of products) {
        try {
          await createProduct(productData);
          totalProducts++;
          console.log(`✅ Created product: ${productData.name}`);
        } catch (error) {
          console.error(`❌ Failed to create product ${productData.name}:`, error);
        }
      }
    }

    console.log('🎉 Marketplace seeding completed!');
    
    return {
      success: true,
      message: `Successfully created ${Object.keys(supplierIds).length} suppliers and ${totalProducts} products in the marketplace!`
    };

  } catch (error) {
    console.error('❌ Error seeding marketplace data:', error);
    return {
      success: false,
      message: 'Failed to seed marketplace data. Check console for details.'
    };
  }
};

// Function to clear all marketplace data (for testing)
export const clearMarketplaceData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Note: This would require additional delete functions in marketplaceService
    // For now, just return a message
    return {
      success: false,
      message: 'Clear function not implemented yet. Manually delete from Firebase console if needed.'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to clear marketplace data.'
    };
  }
}; 