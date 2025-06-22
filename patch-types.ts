// Temporary patch file to fix critical build errors

// Add missing types for CustomerOrderingPage
declare global {
  interface CustomerPortalSettings {
    location?: {
      latitude: number;
      longitude: number;
      address: string;
      radius: number;
    };
    customization?: {
      primaryColor?: string;
      orderingInstructions?: string;
    };
    security: {
      phoneVerification: boolean;
      locationVerification: boolean;
      operatingHours: {
        enabled: boolean;
        open: string;
        close: string;
      };
      maxOrderValue?: number;
    };
  }
}

export {}; 