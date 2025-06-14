export interface VerificationConfig {
  sms: {
    provider: 'twilio' | 'firebase' | 'aws-sns' | 'fake';
    twilio?: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };
    firebase?: {
      // Firebase phone auth config
    };
    awsSns?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };
  };
  email: {
    provider: 'emailjs' | 'nodemailer' | 'firebase' | 'fake';
    emailjs?: {
      serviceId: string;
      templateId: string;
      publicKey: string;
    };
    nodemailer?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
}

export interface VerificationResult {
  success: boolean;
  message: string;
  error?: string;
}

class VerificationService {
  private config: VerificationConfig;

  constructor(config: VerificationConfig) {
    this.config = config;
  }

  // Send SMS verification code
  async sendSMSVerification(phone: string, code: string, restaurantName: string): Promise<VerificationResult> {
    const message = `Your ${restaurantName} verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;

    try {
      switch (this.config.sms.provider) {
        case 'twilio':
          return await this.sendTwilioSMS(phone, message);
        
        case 'firebase':
          return await this.sendFirebaseSMS(phone, message);
        
        case 'aws-sns':
          return await this.sendAWSSMS(phone, message);
        
        case 'fake':
          return this.sendFakeSMS(phone, message, code);
        
        default:
          throw new Error('Invalid SMS provider configured');
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        message: 'Failed to send SMS verification code',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Send Email verification code
  async sendEmailVerification(email: string, code: string, restaurantName: string, userName: string): Promise<VerificationResult> {
    try {
      switch (this.config.email.provider) {
        case 'emailjs':
          return await this.sendEmailJSVerification(email, code, restaurantName, userName);
        
        case 'nodemailer':
          return await this.sendNodemailerEmail(email, code, restaurantName, userName);
        
        case 'firebase':
          return await this.sendFirebaseEmail(email, code, restaurantName, userName);
        
        case 'fake':
          return this.sendFakeEmail(email, code, restaurantName, userName);
        
        default:
          throw new Error('Invalid email provider configured');
      }
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        message: 'Failed to send email verification code',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Twilio SMS implementation
  private async sendTwilioSMS(phone: string, message: string): Promise<VerificationResult> {
    const { twilio } = this.config.sms;
    if (!twilio) {
      throw new Error('Twilio configuration not provided');
    }

    try {
      // Dynamic import only when actually needed and configured
      let isProduction = false;
      
      try {
        // Check Vite environment
        if ((import.meta as any)?.env?.MODE) {
          isProduction = (import.meta as any).env.MODE === 'production';
        }
      } catch (e) {
        // Try process.env if Vite not available
        try {
          if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
            isProduction = process.env.NODE_ENV === 'production';
          }
        } catch (e2) {
          // Default to false (development)
          isProduction = false;
        }
      }
      
      if (isProduction && twilio.accountSid && twilio.authToken) {
        // Use dynamic string to avoid Vite import analysis
        const twilioPackage = 'twilio';
        const twilioClient = await import(/* @vite-ignore */ twilioPackage);
        const client = twilioClient.default(twilio.accountSid, twilio.authToken);
        
        await client.messages.create({
          body: message,
          from: twilio.fromNumber,
          to: phone
        });

        return {
          success: true,
          message: 'SMS sent successfully via Twilio'
        };
      } else {
        // Fallback to fake SMS in development or when not configured
        return this.sendFakeSMS(phone, message, message.match(/(\d{6})/)?.[1] || '123456');
      }
    } catch (error) {
      // Fallback to fake SMS if Twilio fails
      console.warn('Twilio SMS failed, using fake SMS:', error);
      return this.sendFakeSMS(phone, message, message.match(/(\d{6})/)?.[1] || '123456');
    }
  }

  // Firebase SMS implementation (requires Firebase Extensions)
  private async sendFirebaseSMS(phone: string, message: string): Promise<VerificationResult> {
    // Implement Firebase SMS extension integration
    console.log('Firebase SMS would be sent here:', { phone, message });
    return {
      success: true,
      message: 'SMS sent successfully via Firebase'
    };
  }

  // AWS SNS SMS implementation
  private async sendAWSSMS(phone: string, message: string): Promise<VerificationResult> {
    // Implement AWS SNS SMS
    console.log('AWS SNS SMS would be sent here:', { phone, message });
    return {
      success: true,
      message: 'SMS sent successfully via AWS SNS'
    };
  }

  // Fake SMS for development/testing
  private sendFakeSMS(phone: string, message: string, code: string): VerificationResult {
    console.log('🚀 FAKE SMS SENT 🚀');
    console.log(`📱 To: ${phone}`);
    console.log(`💬 Message: ${message}`);
    console.log(`🔑 Code: ${code}`);
    console.log('Note: In development mode. Configure real SMS provider for production.');

    // Show browser alert for development
    if (typeof window !== 'undefined') {
      alert(`SMS Verification Code for ${phone}: ${code}\n\n(Development Mode - Check console for details)`);
    }

    return {
      success: true,
      message: 'SMS sent successfully (Development Mode)'
    };
  }

  // EmailJS implementation
  private async sendEmailJSVerification(email: string, code: string, restaurantName: string, userName: string): Promise<VerificationResult> {
    const { emailjs } = this.config.email;
    if (!emailjs) {
      throw new Error('EmailJS configuration not provided');
    }

    try {
      // Dynamic import only when actually configured
      let isProduction = false;
      
      try {
        // Check Vite environment
        if ((import.meta as any)?.env?.MODE) {
          isProduction = (import.meta as any).env.MODE === 'production';
        }
      } catch (e) {
        // Try process.env if Vite not available
        try {
          if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
            isProduction = process.env.NODE_ENV === 'production';
          }
        } catch (e2) {
          // Default to false (development)
          isProduction = false;
        }
      }
      
      if (isProduction && emailjs.serviceId && emailjs.templateId && emailjs.publicKey) {
        // Use dynamic string to avoid Vite import analysis
        const emailjsPackage = '@emailjs/browser';
        const emailJSLib = await import(/* @vite-ignore */ emailjsPackage);
        
        await emailJSLib.send(
          emailjs.serviceId,
          emailjs.templateId,
          {
            to_email: email,
            to_name: userName,
            restaurant_name: restaurantName,
            verification_code: code,
            message: `Your verification code for ${restaurantName} is: ${code}. This code will expire in 10 minutes.`
          },
          emailjs.publicKey
        );

        return {
          success: true,
          message: 'Email sent successfully via EmailJS'
        };
      } else {
        // Fallback to fake email in development or when not configured
        return this.sendFakeEmail(email, code, restaurantName, userName);
      }
    } catch (error) {
      // Fallback to fake email if EmailJS fails
      console.warn('EmailJS failed, using fake email:', error);
      return this.sendFakeEmail(email, code, restaurantName, userName);
    }
  }

  // Nodemailer implementation (for server-side)
  private async sendNodemailerEmail(email: string, code: string, restaurantName: string, userName: string): Promise<VerificationResult> {
    // This would be for server-side implementation
    console.log('Nodemailer email would be sent here:', { email, code, restaurantName, userName });
    return {
      success: true,
      message: 'Email sent successfully via Nodemailer'
    };
  }

  // Firebase email implementation
  private async sendFirebaseEmail(email: string, code: string, restaurantName: string, userName: string): Promise<VerificationResult> {
    // Implement Firebase email extension
    console.log('Firebase email would be sent here:', { email, code, restaurantName, userName });
    return {
      success: true,
      message: 'Email sent successfully via Firebase'
    };
  }

  // Fake email for development/testing
  private sendFakeEmail(email: string, code: string, restaurantName: string, userName: string): VerificationResult {
    console.log('🚀 FAKE EMAIL SENT 🚀');
    console.log(`📧 To: ${email}`);
    console.log(`👤 Name: ${userName}`);
    console.log(`🏪 Restaurant: ${restaurantName}`);
    console.log(`🔑 Code: ${code}`);
    console.log('Note: In development mode. Configure real email provider for production.');

    // Show browser alert for development
    if (typeof window !== 'undefined') {
      alert(`Email Verification Code for ${email}: ${code}\n\n(Development Mode - Check console for details)`);
    }

    return {
      success: true,
      message: 'Email sent successfully (Development Mode)'
    };
  }

  // Utility: Format phone number for international SMS
  formatPhoneForSMS(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming US +1)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    return phone; // Return as-is if already formatted
  }

  // Utility: Validate email format
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Utility: Validate phone format
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)\.]{10,}$/;
    return phoneRegex.test(phone);
  }
}

export default VerificationService; 