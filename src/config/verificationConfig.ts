import { VerificationConfig } from '../services/verificationService';

// Development configuration - uses fake providers that show alerts/console logs
export const developmentConfig: VerificationConfig = {
  sms: {
    provider: 'fake', // Shows alert/console for development
  },
  email: {
    provider: 'fake', // Shows alert/console for development
  }
};

// Helper function to get environment variables safely
const getEnvVar = (key: string): string => {
  // Try Vite environment variables first
  try {
    if ((import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {
    // Vite not available, continue to next option
  }
  
  // Try process.env for other environments
  try {
    if (typeof process !== 'undefined' && process.env?.[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Process not available, continue
  }
  
  return '';
};

// Production configuration with real providers
export const productionConfig: VerificationConfig = {
  sms: {
    provider: 'twilio', // or 'firebase', 'aws-sns'
    twilio: {
      accountSid: getEnvVar('REACT_APP_TWILIO_ACCOUNT_SID'),
      authToken: getEnvVar('REACT_APP_TWILIO_AUTH_TOKEN'),
      fromNumber: getEnvVar('REACT_APP_TWILIO_FROM_NUMBER'),
    }
  },
  email: {
    provider: 'emailjs', // or 'firebase', 'nodemailer'
    emailjs: {
      serviceId: getEnvVar('REACT_APP_EMAILJS_SERVICE_ID'),
      templateId: getEnvVar('REACT_APP_EMAILJS_TEMPLATE_ID'),
      publicKey: getEnvVar('REACT_APP_EMAILJS_PUBLIC_KEY'),
    }
  }
};

// Get configuration based on environment
export const getVerificationConfig = (): VerificationConfig => {
  let isDevelopment = true; // Default to development
  
  // Try to detect environment
  try {
    // Check Vite environment
    if ((import.meta as any)?.env?.MODE) {
      isDevelopment = (import.meta as any).env.MODE === 'development';
    }
  } catch (e) {
    // Try process.env if Vite not available
    try {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
        isDevelopment = process.env.NODE_ENV === 'development';
      }
    } catch (e2) {
      // Default to development if we can't determine
      isDevelopment = true;
    }
  }
  
  return isDevelopment ? developmentConfig : productionConfig;
};

// Environment variables template for .env file
export const ENV_TEMPLATE = `
# Twilio SMS Configuration (Optional - for production SMS)
REACT_APP_TWILIO_ACCOUNT_SID=your_twilio_account_sid
REACT_APP_TWILIO_AUTH_TOKEN=your_twilio_auth_token
REACT_APP_TWILIO_FROM_NUMBER=your_twilio_phone_number

# EmailJS Configuration (Optional - for production email)
REACT_APP_EMAILJS_SERVICE_ID=your_emailjs_service_id
REACT_APP_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
REACT_APP_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# Alternative: Firebase Extensions for SMS/Email
# REACT_APP_USE_FIREBASE_MESSAGING=true

# Alternative: AWS SNS for SMS
# REACT_APP_AWS_ACCESS_KEY_ID=your_aws_access_key
# REACT_APP_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
# REACT_APP_AWS_REGION=your_aws_region
`;

export default getVerificationConfig; 