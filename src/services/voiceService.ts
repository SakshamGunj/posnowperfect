// Voice Recognition and AI Command Processing Service
import { toast } from 'react-hot-toast';
import { VoiceContextManager } from './voiceContextManager';
import { transcribeAudio } from './groqTranscriptionService';

// Custom voice toast function for compact notifications
const voiceToast = {
  success: (message: string) => toast.success(message, {
    duration: 1800,
    style: {
      background: 'rgba(16, 185, 129, 0.9)',
      color: '#fff',
      fontSize: '13px',
      padding: '8px 12px',
      borderRadius: '8px',
      maxWidth: '280px',
      backdropFilter: 'blur(6px)',
    },
  }),
  error: (message: string) => toast.error(message, {
    duration: 2200,
    style: {
      background: 'rgba(239, 68, 68, 0.9)',
      color: '#fff',
      fontSize: '13px',
      padding: '8px 12px',
      borderRadius: '8px',
      maxWidth: '280px',
      backdropFilter: 'blur(6px)',
    },
  }),
  info: (message: string, icon?: string) => toast(message, {
    icon: icon || '🎤',
    duration: 1500,
    style: {
      background: 'rgba(99, 102, 241, 0.9)',
      color: '#fff',
      fontSize: '13px',
      padding: '8px 12px',
      borderRadius: '8px',
      maxWidth: '280px',
      backdropFilter: 'blur(6px)',
    },
  }),
};

// Groq AI Configuration - Support environment variables for API key
const GROQ_API_KEY = (import.meta as any).env?.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Validate API key availability
const isGroqAPIKeyAvailable = (): boolean => {
  return !!GROQ_API_KEY && GROQ_API_KEY.trim().length > 0;
};

// Helper function to handle missing API key
const handleMissingAPIKey = (): void => {
  console.warn('🔑 Groq API key not found. Voice AI features will be limited.');
  console.warn('💡 Set VITE_GROQ_API_KEY environment variable to enable full AI functionality.');
};

// Log startup warning if API key is missing
if (!isGroqAPIKeyAvailable()) {
  console.warn('⚠️ VOICE AI SETUP REQUIRED ⚠️');
  console.warn('🔑 Groq API key not configured. Voice commands will use basic pattern matching.');
  console.warn('📋 Setup instructions:');
  console.warn('   1. Get free API key from https://groq.com/');
  console.warn('   2. Add VITE_GROQ_API_KEY to your environment variables');
  console.warn('   3. Restart your development server');
  console.warn('🎯 Advanced AI features will be enabled once configured.');
}

// Voice Command Types
export interface VoiceCommand {
  type: 'ORDER' | 'PLACE_ORDER' | 'PAYMENT' | 'TABLE_STATUS' | 'MENU_INQUIRY' | 'KOT_PRINT' | 'ORDER_CANCEL' | 'TABLE_MERGE' | 'TABLE_TRANSFER' | 'CUSTOMER' | 'INVENTORY' | 'UNKNOWN';
  tableNumber?: number;
  targetTableNumber?: number; // For merge/transfer operations
  menuItems?: Array<{
    name: string;
    quantity: number;
    category?: string;
  }>;
  // Payment-specific extensions
  discount?: {
    type: 'amount' | 'percentage';
    value: number;
  };
  splitPayments?: Array<{
    method: 'UPI' | 'CASH' | 'BANK' | 'CREDIT';
    amount: number;
  }>;
  creditAmount?: number; // If paying partially with customer credit
  paymentMethod?: 'UPI' | 'CASH' | 'BANK';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  confidence: number;
  originalText: string;
  isIncomplete?: boolean;
  missingFields?: ('tableNumber' | 'menuItems' | 'paymentMethod' | 'customerName' | 'targetTableNumber')[];
}

// Voice Recognition States
export type VoiceState = 'idle' | 'listening' | 'processing' | 'executing' | 'error';

// Command Completeness Check Result
interface CompletenessCheckResult {
  isComplete: boolean;
  missingFields: ('tableNumber' | 'menuItems' | 'paymentMethod' | 'customerName' | 'targetTableNumber')[];
  contextualMessage: string;
}

// Incomplete Command Context
export interface IncompleteCommandContext {
  command: Partial<VoiceCommand>;
  missingFields: ('tableNumber' | 'menuItems' | 'paymentMethod' | 'customerName' | 'targetTableNumber')[];
  contextualMessage: string;
  transcript: string;
}

// Voice Service Singleton Class
export class VoiceService {
  private static instance: VoiceService | null = null;
  private recognition: any = null;
  private isListening = false;
  private hasPermission = false;
  private isContinuousMode = false; // New flag for continuous listening
  private shouldRestart = false; // Flag to control auto-restart
  private isPushToTalkMode = false; // New flag for push-to-talk mode
  private accumulatedTranscript = ''; // Accumulate all speech during push-to-talk
  private restaurantContext?: { name: string; slug: string; id: string };
  private onStateChange?: (state: VoiceState) => void;
  private onTranscriptChange?: (transcript: string) => void;
  private onCommandDetected?: (command: VoiceCommand) => void;
  private onIncompleteCommand?: (context: IncompleteCommandContext) => void;

  private constructor() {
    this.initializeRecognition();
  }

  // Initialize Web Speech API
  private initializeRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure for optimal recording
    this.recognition.continuous = true; // Keep listening continuously
    this.recognition.interimResults = true; // Show live transcript
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('🎤 Voice recognition started');
      this.isListening = true;
      this.setState('listening');
    };

    this.recognition.onend = () => {
      console.log('🎤 Voice recognition ended');
      this.isListening = false;
      
      // Handle different end scenarios
      if (this.isPushToTalkMode) {
        // Push-to-talk mode: process accumulated transcript when recording ends
        console.log('🎯 Push-to-talk recording ended, processing accumulated transcript');
        if (this.accumulatedTranscript.trim()) {
          this.processVoiceCommand(this.accumulatedTranscript.trim(), this.restaurantContext);
        }
        // Reset push-to-talk state
        this.isPushToTalkMode = false;
        this.accumulatedTranscript = '';
      } else if (this.isContinuousMode && this.shouldRestart) {
        // Continuous mode: auto-restart
        console.log('🔄 Restarting voice recognition for continuous mode');
        setTimeout(() => {
          if (this.shouldRestart && this.isContinuousMode) {
            this.startListening();
          }
        }, 100);
      } else {
        // Single-shot mode: go to idle
        setTimeout(() => {
          if (!this.isListening && !this.shouldRestart) {
            this.setState('idle');
          }
        }, 100);
      }
    };

    this.recognition.onresult = (event: any) => {
      // Handle both interim and final results
      let currentTranscript = '';
      let isFinal = false;
      
      // Build complete transcript from all results
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        currentTranscript += result[0].transcript;
        if (result.isFinal) {
          isFinal = true;
        }
      }
      
      currentTranscript = currentTranscript.trim();
      
      if (currentTranscript) {
        if (this.isPushToTalkMode) {
          // Push-to-talk mode: accumulate all speech, don't process until button release
          this.accumulatedTranscript = currentTranscript;
          console.log('🎙️ Push-to-talk accumulating:', this.accumulatedTranscript);
          this.onTranscriptChange?.(this.accumulatedTranscript);
          // Don't process yet - wait for button release
        } else {
          // Normal mode: process final results immediately
          console.log('🗣️ Transcript:', currentTranscript, 'Final:', isFinal);
          this.onTranscriptChange?.(currentTranscript);
          
          if (isFinal) {
            const confidence = event.results[event.resultIndex][0].confidence;
            console.log('🎯 Processing final transcript with confidence:', confidence);
            
            if (confidence > 0.3 || true) {
              this.processVoiceCommand(currentTranscript, this.restaurantContext);
            } else {
              console.warn('🔇 Low confidence, skipping:', confidence);
              this.setState('error');
              voiceToast.error('Could not understand. Please speak clearly.');
            }
          }
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('🚨 Speech recognition error:', event.error);
      
      // Handle different error types
      switch (event.error) {
        case 'no-speech':
          // In push-to-talk or continuous mode, don't show error for no speech
          if (!this.isPushToTalkMode && !this.isContinuousMode) {
            voiceToast.error('No speech detected. Please try again.');
            this.setState('error');
          }
          break;
        case 'audio-capture':
          voiceToast.error('Microphone not accessible.');
          this.setState('error');
          this.shouldRestart = false;
          this.isPushToTalkMode = false;
          break;
        case 'not-allowed':
          voiceToast.error('Microphone permission denied.');
          this.setState('error');
          this.shouldRestart = false;
          this.isPushToTalkMode = false;
          break;
        case 'network':
          if (this.isContinuousMode && this.shouldRestart) {
            console.log('🌐 Network error, will retry...');
          } else if (!this.isPushToTalkMode) {
            voiceToast.error('Network error. Please try again.');
            this.setState('error');
          }
          break;
        default:
          console.warn('🤷‍♂️ Other speech error:', event.error);
          if (!this.isContinuousMode && !this.isPushToTalkMode) {
            voiceToast.error('Voice recognition error. Please try again.');
            this.setState('error');
          }
      }
    };
  }

  // Process voice command using Groq AI with enhanced context handling
  private async processVoiceCommand(transcript: string, restaurantContext?: { name: string; slug: string; id: string }) {
    try {
      console.log('🤖 Processing voice command:', transcript);
      this.setState('processing');
      
      // Check if we have stored context from previous incomplete command
      const restaurantId = restaurantContext?.id || '';
      const storedContext = VoiceContextManager.getContext(restaurantId);
      
      if (storedContext) {
        console.log('🧠 Found stored voice context, attempting to merge:', storedContext);
        
        // Try to merge stored context with new input
        const mergeResult = VoiceContextManager.mergeContextWithNewInput(storedContext, transcript);
        
        if (mergeResult.success && mergeResult.command) {
          console.log('✅ Successfully merged voice context into complete command:', mergeResult.command);
          
          // Clear the stored context
          VoiceContextManager.clearContext();
          
          // Show success message
          voiceToast.success(mergeResult.message || 'Command completed!');
          
          // Execute the merged command
          this.setState('executing');
          this.onCommandDetected?.(mergeResult.command);
          
          setTimeout(() => {
            this.setState('idle');
          }, 1000);
          return;
        } else {
          // Merge failed, show error and clear context
          console.log('❌ Failed to merge voice context:', mergeResult.message);
          voiceToast.error(mergeResult.message || 'Could not understand the additional information');
          VoiceContextManager.clearContext();
          // Continue with normal processing below
        }
      }
      
      let command: VoiceCommand;
      
      try {
        // Check if AI is available, otherwise skip directly to fallback
        if (isGroqAPIKeyAvailable()) {
          command = await this.analyzeWithGroq(transcript, restaurantContext);
          console.log('🤖 AI Command Analysis:', command);
        } else {
          throw new Error('Groq API key not configured');
        }
      } catch (aiError) {
        console.warn('🤖 AI analysis failed, using fallback parser:', aiError);
        
        // Show a helpful message once per session about AI being unavailable
        if (!sessionStorage.getItem('voice_ai_fallback_notified')) {
          const isAPIKeyMissing = !isGroqAPIKeyAvailable();
          const message = isAPIKeyMissing 
            ? '🔑 Voice AI requires VITE_GROQ_API_KEY - using basic parsing'
            : '🔄 Voice AI temporarily unavailable, using local parsing';
          voiceToast.info(message, '🎤');
          sessionStorage.setItem('voice_ai_fallback_notified', 'true');
        }
        
        // Fallback to simple parsing
        command = this.parseCommandFallback(transcript);
        console.log('🔄 Fallback Command Analysis:', command);
      }
      
      // Check if command is complete
      const completenessCheck = this.checkCommandCompleteness(command);
      
      if (!completenessCheck.isComplete) {
        // Command is incomplete - store context and show helpful dialog
        const incompleteContext: IncompleteCommandContext = {
          command,
          missingFields: completenessCheck.missingFields,
          contextualMessage: completenessCheck.contextualMessage,
          transcript
        };
        
        // Store context in localStorage
        VoiceContextManager.storeContext(incompleteContext, restaurantId);
        
        // Generate contextual prompt
        const contextualPrompt = VoiceContextManager.generateContextualPrompt(incompleteContext);
        
        // Trigger the dialog
        this.onIncompleteCommand?.(incompleteContext);
        this.setState('idle');
        
        // Show contextual prompt
        voiceToast.info(contextualPrompt, '💡');
        console.log('💾 Stored incomplete command context:', incompleteContext);
        return;
      }
      
      // Clear any previous incomplete command context
      VoiceContextManager.clearContext();
      
      // Provide specific feedback based on command type
      switch (command.type) {
        case 'ORDER':
          const itemsText = command.menuItems?.map(item => `${item.quantity}x ${item.name}`).join(', ') || 'items';
          voiceToast.success(`🛒 Adding: ${itemsText} ${command.tableNumber ? `table ${command.tableNumber}` : ''}`);
          break;
        case 'PLACE_ORDER':
          voiceToast.success(`🍽️ Placing order ${command.tableNumber ? `table ${command.tableNumber}` : ''}`);
          break;
        case 'PAYMENT':
          voiceToast.success(`💳 Payment ${command.tableNumber ? `table ${command.tableNumber}` : ''}${command.paymentMethod ? ` via ${command.paymentMethod}` : ''}`);
          break;
        case 'KOT_PRINT':
          voiceToast.success(`🧾 Printing KOT${command.tableNumber ? ` table ${command.tableNumber}` : ''}`);
          break;
        case 'ORDER_CANCEL':
          voiceToast.success(`❌ Canceling order${command.tableNumber ? ` table ${command.tableNumber}` : ''}`);
          break;
        case 'TABLE_MERGE':
          voiceToast.success(`🔗 Merging table ${command.tableNumber} → ${command.targetTableNumber}`);
          break;
        case 'TABLE_TRANSFER':
          voiceToast.success(`📤 Transfer table ${command.tableNumber} → ${command.targetTableNumber}`);
          break;
        case 'TABLE_STATUS':
          voiceToast.success(`🏓 Table ${command.tableNumber} status updated`);
          break;
        case 'CUSTOMER':
          const customerInfo = command.customerName ? `${command.customerName}` : 'customer';
          voiceToast.success(`👤 Adding ${customerInfo} to CRM`);
          break;
        case 'INVENTORY':
          if (!command.menuItems || command.menuItems.length === 0) {
            voiceToast.error('Could not understand the inventory items.');
          } else {
            voiceToast.success(`📊 Inventory updated for ${command.menuItems.map(item => `${item.quantity}x ${item.name}`).join(', ')}`);
          }
          break;
        case 'MENU_INQUIRY':
          voiceToast.info(`📋 Menu inquiry`, '🔍');
          break;
        default:
          voiceToast.info(`Processing: ${command.type}`);
      }
      
      this.setState('executing');
      this.onCommandDetected?.(command);
      
      // Reset state after brief delay
      setTimeout(() => {
        this.setState('idle');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Voice command processing failed:', error);
      this.setState('error');
      voiceToast.error('Sorry, I couldn\'t understand that command');
      
      setTimeout(() => {
        this.setState('idle');
      }, 2000);
    }
  }

  // Enhanced check for command completeness with better context detection
  private checkCommandCompleteness(command: VoiceCommand): CompletenessCheckResult {
    const missingFields: ('tableNumber' | 'menuItems' | 'paymentMethod' | 'customerName' | 'targetTableNumber')[] = [];
    let contextualMessage = '';

    // Handle case where we have table number but unclear command type
    if (command.type === 'UNKNOWN' && command.tableNumber) {
      contextualMessage = `Table ${command.tableNumber} selected - what would you like to do? Say "KOT", "Order", or "Payment"`;
      return {
        isComplete: false,
        missingFields: [],
        contextualMessage
      };
    }

    // Handle partial commands from transcript analysis
    const transcript = command.originalText.toLowerCase();
    
    // If we detect action words but no table
    if (!command.tableNumber) {
      if (transcript.includes('kot') || transcript.includes('kitchen')) {
        command.type = 'KOT_PRINT';
        missingFields.push('tableNumber');
        contextualMessage = 'KOT print command detected - which table number?';
      } else if (transcript.includes('order') || transcript.includes('place')) {
        command.type = 'PLACE_ORDER';
        missingFields.push('tableNumber');
        contextualMessage = 'Place order command detected - which table number?';
      } else if (transcript.includes('payment') || transcript.includes('bill') || transcript.includes('pay')) {
        command.type = 'PAYMENT';
        missingFields.push('tableNumber');
        contextualMessage = 'Payment command detected - which table number?';
      }
    }

    // Standard completeness checks for known command types
    switch (command.type) {
      case 'ORDER':
      case 'PLACE_ORDER':
        if (!command.tableNumber) missingFields.push('tableNumber');
        if (!command.menuItems || command.menuItems.length === 0) missingFields.push('menuItems');
        break;
      case 'PAYMENT':
        if (!command.tableNumber) missingFields.push('tableNumber');
        break;
      case 'KOT_PRINT':
      case 'ORDER_CANCEL':
      case 'TABLE_STATUS':
        if (!command.tableNumber) missingFields.push('tableNumber');
        break;
      case 'TABLE_MERGE':
      case 'TABLE_TRANSFER':
        if (!command.tableNumber) missingFields.push('tableNumber');
        if (!command.targetTableNumber) missingFields.push('targetTableNumber');
        break;
      case 'INVENTORY':
        if (!command.menuItems || command.menuItems.length === 0) missingFields.push('menuItems');
        break;
      case 'CUSTOMER':
        if (!command.customerName && !command.customerPhone) missingFields.push('customerName');
        break;
    }
    
    // Generate contextual messages for specific missing fields
    if (missingFields.length > 0 && !contextualMessage) {
      if (missingFields.includes('tableNumber')) {
        switch (command.type) {
          case 'KOT_PRINT':
            contextualMessage = 'Which table do you want to print KOT for?';
            break;
          case 'PLACE_ORDER':
            contextualMessage = 'Which table do you want to place order for?';
            break;
          case 'PAYMENT':
            contextualMessage = 'Which table do you want to process payment for?';
            break;
          default:
            contextualMessage = 'Please specify the table number.';
        }
      } else if (missingFields.includes('paymentMethod')) {
        contextualMessage = `Payment for table ${command.tableNumber} - which method? Say "UPI", "Cash", or "Bank"`;
      } else if (missingFields.includes('customerName')) {
        contextualMessage = 'What is the customer name?';
      } else if (missingFields.includes('targetTableNumber')) {
        contextualMessage = `${command.type} from table ${command.tableNumber} - to which table?`;
      } else if (missingFields.includes('menuItems')) {
        contextualMessage = 'Which menu items do you want to order?';
      }
    }
    
    const isComplete = missingFields.length === 0;
    
    return { isComplete, missingFields, contextualMessage };
  }

  // Fallback command parsing for when AI fails
  private parseCommandFallback(transcript: string): VoiceCommand {
    const text = transcript.toLowerCase();
    
    // Helper function to normalize speech input for better phonetic matching
    const normalizeSpeech = (text: string): string => {
      let normalized = text;
      
      // Common speech-to-text corrections
      const speechCorrections: { [key: string]: string } = {
        // KOT variations
        'koti': 'kot',
        'cot': 'kot',
        'cott': 'kot',
        'k o t': 'kot',
        'kitchen order': 'kot',
        'kitchen ticket': 'kot',
        
        // Order variations
        'ordr': 'order',
        'oder': 'order',
        'place order': 'order',
        'take order': 'order',
        'make order': 'order',
        
        // Payment variations
        'paymnt': 'payment',
        'pay bill': 'payment',
        'settle bill': 'payment',
        'complete payment': 'payment',
        'process payment': 'payment',
        'u p i': 'upi',
        
        // Table variations
        'tabel': 'table',
        'tabl': 'table',
        'tabol': 'table',
        
        // Customer variations
        'custmr': 'customer',
        'client': 'customer',
        'guest': 'customer',
        
        // Common pronunciation fixes
        'numbr': 'number',
        'phon': 'phone',
        'mobil': 'mobile',
        'contct': 'contact',
        'cancl': 'cancel',
        'delet': 'delete',
        'remov': 'remove',
        'transferr': 'transfer',
        'mov': 'move',
        'shft': 'shift',
        'swch': 'switch',
        'merg': 'merge',
        'combin': 'combine',
        'joi': 'join'
      };
      
      // Apply corrections
      for (const [wrong, correct] of Object.entries(speechCorrections)) {
        normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'g'), correct);
      }
      
      // Fix common spacing issues with numbers
      normalized = normalized.replace(/(\d)\s+(\d)/g, '$1$2'); // "9 1 2 3" -> "9123"
      normalized = normalized.replace(/number\s*(\d+)/g, '$1'); // "number 5" -> "5"
      
      return normalized;
    };
    
    // Helper function to convert word numbers to digits
    const convertWordNumbers = (text: string): string => {
      const wordNumbers: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15'
      };
      
      let result = text;
      for (const [word, digit] of Object.entries(wordNumbers)) {
        result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
      }
      return result;
    };
    
    // Normalize and process the text
    const normalizedText = normalizeSpeech(text);
    const processedText = convertWordNumbers(normalizedText);
    
    // Extract table number with multiple patterns and phonetic variations
    const tablePatterns = [
      /(?:table|tabel|tabl|tabol)\s+(?:number\s+)?(\d+)/,
      /(\d+)\s+(?:table|tabel|tabl|tabol)/,
      /(?:number\s+)?(\d+)/
    ];
    
    let tableNumber: number | null = null;
    for (const pattern of tablePatterns) {
      const match = processedText.match(pattern);
      if (match) {
        tableNumber = parseInt(match[1]);
        break;
      }
    }
    
    console.log('🔄 Enhanced fallback parsing for:', text);
    console.log('📝 Normalized:', normalizedText, '| Processed:', processedText, '| Table:', tableNumber);
    
    // KOT Commands - Handle phonetic variations
    const kotVariations = ['kot', 'koti', 'cot', 'cott', 'kitchen order', 'kitchen ticket', 'k o t', 'print kot', 'print kitchen'];
    if (kotVariations.some(variation => processedText.includes(variation))) {
      console.log('📋 KOT command detected with variation:', text);
      return {
        type: 'KOT_PRINT',
        tableNumber: tableNumber || undefined,
        confidence: 0.85,
        originalText: transcript,
      };
    }
    
    // Customer commands - Enhanced with phonetic variations
    const customerVariations = ['customer', 'custmr', 'client', 'guest', 'new customer', 'add customer', 'register customer', 'create customer'];
    if (customerVariations.some(variation => processedText.includes(variation))) {
      console.log('👤 Customer command detected with variation:', text);
      
      // Extract customer name - improved name detection
      let customerName = '';
      const namePatterns = [
        /(?:customer|custmr|client|guest|name)\s+(?:name\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/,
        /(?:add|new|create|register)\s+(?:customer|custmr|client|guest)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/,
        /(?:customer|custmr|client|guest)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(?:phone|number|mobile)/
      ];
      
      for (const pattern of namePatterns) {
        const nameMatch = processedText.match(pattern);
        if (nameMatch && nameMatch[1]) {
          customerName = nameMatch[1].trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          break;
        }
      }
      
      // Extract phone number - handle spoken digits and variations
      let customerPhone = '';
      const phonePatterns = [
        /(?:phone|number|mobile|contact)(?:\s+number)?\s*[:\s]*(\d{10})/,
        /(?:phone|number|mobile|contact)(?:\s+number)?\s*[:\s]*(\d{4}\s*\d{3}\s*\d{3})/,
        /(?:phone|number|mobile|contact)(?:\s+number)?\s*[:\s]*(\d{3}\s*\d{3}\s*\d{4})/,
        /(\d{10})/,
        /(\d{4}\s*\d{3}\s*\d{3})/,
        /(\d{3}\s*\d{3}\s*\d{4})/
      ];
      
      for (const pattern of phonePatterns) {
        const phoneMatch = processedText.match(pattern);
        if (phoneMatch && phoneMatch[1]) {
          customerPhone = phoneMatch[1].replace(/\s+/g, ''); // Remove spaces
          if (customerPhone.length === 10) {
            break;
          }
        }
      }
      
      // Extract email if present
      let customerEmail = '';
      const emailMatch = processedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        customerEmail = emailMatch[1];
      }
      
      console.log('👤 Extracted customer data:', { customerName, customerPhone, customerEmail });
      
      return {
        type: 'CUSTOMER',
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        confidence: 0.85,
        originalText: transcript,
      };
    }
    
    // Place Order commands - Enhanced with phonetic variations (HIGHEST PRIORITY)
    const orderVariations = ['order', 'ordr', 'oder', 'place order', 'take order', 'make order'];
    if (orderVariations.some(variation => processedText.includes(variation))) {
      console.log('🍽️ Place order command detected with variation:', text, '| Table:', tableNumber);
      
      // Enhanced multiple item parsing
      const menuItems: Array<{name: string, quantity: number}> = [];
      
      // Enhanced food word list with multi-word items
      const foodWords = [
        'chicken wings', 'buffalo wings', 'hot wings', 'chicken wing', 'wing',
        'beef burger', 'chicken burger', 'cheese burger', 'burger', 
        'margherita pizza', 'cheese pizza', 'pepperoni pizza', 'pizza',
        'caesar salad', 'garden salad', 'greek salad', 'salad',
        'grilled chicken', 'fried chicken', 'chicken breast', 'chicken',
        'grilled fish', 'fried fish', 'fish fillet', 'fish',
        'spaghetti', 'penne pasta', 'pasta marinara', 'pasta',
        'fresh orange juice', 'orange juice', 'apple juice', 'grape juice', 'juice',
        'french fries', 'fries', 'sandwich', 'rice', 'dal', 'curry', 'bread', 'naan', 'roti', 'biryani',
        'paneer', 'mutton', 'beef', 'pork', 'prawns', 'crab', 'lobster', 'noodles', 'momos', 
        'samosa', 'pakora', 'dosa', 'idli', 'vada', 'uttapam', 'lassi', 'water', 'coke', 'coffee', 'tea', 'soup'
      ];
      
      // Parse multiple items using enhanced algorithm
      const parseMultipleItems = (text: string): Array<{name: string, quantity: number}> => {
        const items: Array<{name: string, quantity: number}> = [];
        
        // Remove table references and command words
        let cleanText = text
          .replace(/\b(?:table|tabel|tabl|number)\s*\d+\b/gi, '')
          .replace(/\b(?:order|ordr|oder|place|take|make)\b/gi, '')
          .trim();
        
        console.log('🔍 Clean text for parsing:', cleanText);
        
        // Split by common separators
        const separators = /\s+(?:and|,|&|\+)\s+/gi;
        let segments = cleanText.split(separators);
        
        // If no separators found, try to detect multiple items in sequence
        if (segments.length === 1) {
          // Look for pattern: "2 chicken wings 3 burgers 1 pizza"
          const sequencePattern = /(\d+\s+[a-zA-Z\s]+?)(?=\d+\s+[a-zA-Z]|$)/g;
          const sequenceMatches = cleanText.match(sequencePattern);
          if (sequenceMatches && sequenceMatches.length > 1) {
            segments = sequenceMatches;
          }
        }
        
        console.log('🔍 Segments to process:', segments);
        
        for (let segment of segments) {
          segment = segment.trim();
          if (segment.length < 2) continue;
          
          // Extract quantity and item name from each segment
          let quantity = 1;
          let itemName = segment;
          
          // Look for quantity patterns
          const quantityPatterns = [
            /^(\d+)\s*x?\s*(.+)$/i,                    // "2 chicken wings", "3x burgers"
            /^(one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i,  // "two burgers"
            /(.+?)\s+(\d+)$/i                          // "chicken wings 2"
          ];
          
          for (const pattern of quantityPatterns) {
            const match = segment.match(pattern);
            if (match) {
              const [, first, second] = match;
              
              // Determine which is quantity and which is item name
              if (/^\d+$/.test(first)) {
                quantity = parseInt(first);
                itemName = second;
              } else if (/^\d+$/.test(second)) {
                quantity = parseInt(second);
                itemName = first;
              } else {
                // Word numbers
                const wordNumbers: { [key: string]: number } = {
                  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                
                if (wordNumbers[first.toLowerCase()]) {
                  quantity = wordNumbers[first.toLowerCase()];
                  itemName = second;
                }
              }
              break;
            }
          }
          
          // Clean up item name
          itemName = itemName
            .replace(/\b(x|times|pieces?|items?|orders?)\b/gi, '')
            .replace(/^\s*[-,]\s*/, '')
            .trim();
          
          // Find matching food items (prioritize longer matches)
          const matchingFoods = foodWords
            .filter(food => {
              const itemLower = itemName.toLowerCase();
              const foodLower = food.toLowerCase();
              
              // Exact match or close match
              return itemLower === foodLower || 
                     itemLower.includes(foodLower) || 
                     foodLower.includes(itemLower) ||
                     // Word-by-word matching for multi-word items
                     (food.includes(' ') && 
                      food.split(' ').every(word => itemLower.includes(word.toLowerCase())));
            })
            .sort((a, b) => b.length - a.length); // Prioritize longer matches
          
          if (matchingFoods.length > 0) {
            const bestMatch = matchingFoods[0];
            
            // Format the name properly
            const formattedName = bestMatch.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            
            items.push({ 
              name: formattedName, 
              quantity: Math.max(1, quantity)
            });
            
            console.log(`✅ Parsed item: ${quantity}x ${formattedName} from "${segment}"`);
          } else {
            // If no exact food match, use the cleaned item name
            if (itemName.length > 2) {
              const formattedName = itemName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ');
              
              items.push({ 
                name: formattedName, 
                quantity: Math.max(1, quantity)
              });
              
              console.log(`📝 Added generic item: ${quantity}x ${formattedName} from "${segment}"`);
            }
          }
        }
        
        return items;
      };
      
      const parsedItems = parseMultipleItems(processedText);
      menuItems.push(...parsedItems);
      
      console.log('🎯 Final parsed menu items:', menuItems);
      
      return {
        type: 'PLACE_ORDER',
        tableNumber: tableNumber || undefined,
        menuItems: menuItems.length > 0 ? menuItems : undefined,
        confidence: 0.8,
        originalText: transcript,
      };
    }

    // Payment commands - Enhanced with phonetic variations
    const paymentVariations = ['payment', 'pay', 'bill', 'paymnt', 'pay bill', 'complete payment', 'process payment', 'settle', 'settle bill'];
    if (paymentVariations.some(variation => processedText.includes(variation))) {
      console.log('💳 Payment command detected with variation:', text);
      
      // Extract payment method
      let paymentMethod: 'UPI' | 'CASH' | 'BANK' | undefined;
      if (processedText.includes('upi') || processedText.includes('u p i')) {
        paymentMethod = 'UPI';
      } else if (processedText.includes('cash') || processedText.includes('cash payment')) {
        paymentMethod = 'CASH';
      } else if (processedText.includes('bank') || processedText.includes('card') || processedText.includes('debit') || processedText.includes('credit')) {
        paymentMethod = 'BANK';
      }
      
      return {
        type: 'PAYMENT',
        tableNumber: tableNumber || undefined,
        paymentMethod,
        confidence: 0.8,
        originalText: transcript,
      };
    }

    // Order Cancel commands - Enhanced with variations
    const cancelVariations = ['cancel', 'delete', 'remove', 'cancel order', 'delete order', 'remove order'];
    if (cancelVariations.some(variation => processedText.includes(variation))) {
      console.log('❌ Cancel order command detected:', text);
      return {
        type: 'ORDER_CANCEL',
        tableNumber: tableNumber || undefined,
        confidence: 0.8,
        originalText: transcript,
      };
    }

    // Table status commands - Enhanced with variations
    const statusVariations = ['make table', 'set table', 'table ready', 'table available', 'table occupied', 'ready table', 'available table'];
    if (statusVariations.some(variation => processedText.includes(variation))) {
      console.log('📊 Table status command detected:', text);
      return {
        type: 'TABLE_STATUS',
        tableNumber: tableNumber || undefined,
        confidence: 0.7,
        originalText: transcript,
      };
    }

    // Table merge commands
    const mergeVariations = ['merge', 'combine', 'join', 'merge table', 'combine table', 'join table'];
    if (mergeVariations.some(variation => processedText.includes(variation))) {
      console.log('🔗 Table merge command detected:', text);
      
      // Try to extract two table numbers
      const allTableMatches = processedText.match(/(\d+)/g);
      if (allTableMatches && allTableMatches.length >= 2) {
        return {
          type: 'TABLE_MERGE',
          tableNumber: parseInt(allTableMatches[0]),
          targetTableNumber: parseInt(allTableMatches[1]),
          confidence: 0.7,
          originalText: transcript,
        };
      }
    }

    // Table transfer commands
    const transferVariations = ['transfer', 'move', 'shift', 'switch', 'transfer table', 'move table'];
    if (transferVariations.some(variation => processedText.includes(variation))) {
      console.log('🔄 Table transfer command detected:', text);
      
      // Try to extract two table numbers
      const allTableMatches = processedText.match(/(\d+)/g);
      if (allTableMatches && allTableMatches.length >= 2) {
        return {
          type: 'TABLE_TRANSFER',
          tableNumber: parseInt(allTableMatches[0]),
          targetTableNumber: parseInt(allTableMatches[1]),
          confidence: 0.7,
          originalText: transcript,
        };
      }
    }

    // Menu inquiry commands
    const menuVariations = ['menu', 'what\'s available', 'show menu', 'food items', 'what do you have', 'available items'];
    if (menuVariations.some(variation => processedText.includes(variation))) {
      console.log('📋 Menu inquiry command detected:', text);
      return {
        type: 'MENU_INQUIRY',
        confidence: 0.7,
        originalText: transcript,
      };
    }

    console.log('❓ Unknown command, could not parse:', text);
    // Default fallback
    return {
      type: 'UNKNOWN',
      confidence: 0.3,
      originalText: transcript,
    };
  }

  // Public API methods
  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  public static isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  public async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.hasPermission = true;
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      this.hasPermission = false;
      return false;
    }
  }

  public startListening(): void {
    if (!this.recognition) {
      voiceToast.error('Voice recognition not initialized');
      return;
    }

    if (this.isListening) {
      console.warn('⚠️ Already listening');
      return;
    }

    try {
      this.shouldRestart = false; // Reset restart flag for single-shot mode
      this.isPushToTalkMode = false; // Regular listening mode
      this.accumulatedTranscript = ''; // Reset transcript
      this.recognition.start();
    } catch (error) {
      console.error('❌ Failed to start voice recognition:', error);
      this.setState('error');
    }
  }

  // NEW: Start push-to-talk recording mode
  public startPushToTalkRecording(): void {
    if (!this.recognition) {
      voiceToast.error('Voice recognition not initialized');
      return;
    }

    if (this.isListening) {
      console.warn('⚠️ Already listening');
      return;
    }

    try {
      console.log('🎙️ Starting push-to-talk recording mode');
      this.isPushToTalkMode = true;
      this.accumulatedTranscript = '';
      this.shouldRestart = false;
      this.isContinuousMode = false;
      this.recognition.start();
    } catch (error) {
      console.error('❌ Failed to start push-to-talk recording:', error);
      this.setState('error');
      this.isPushToTalkMode = false;
    }
  }

  // NEW: Stop push-to-talk recording and process command
  public stopPushToTalkRecording(): void {
    if (!this.isListening || !this.recognition) {
      console.warn('⚠️ Not currently recording');
      this.isPushToTalkMode = false;
      this.accumulatedTranscript = '';
      this.setState('idle');
      return;
    }

    if (!this.isPushToTalkMode) {
      console.warn('⚠️ Not in push-to-talk mode');
      return;
    }

    console.log('🛑 Stopping push-to-talk recording');
    
    try {
      // Stop the recognition - this will trigger onend which processes the accumulated transcript
      this.recognition.stop();
    } catch (error) {
      console.error('❌ Failed to stop push-to-talk recording:', error);
      this.isPushToTalkMode = false;
      this.accumulatedTranscript = '';
      this.setState('error');
    }
  }

  // Start continuous listening mode
  public startContinuousListening(): void {
    if (!this.recognition) {
      voiceToast.error('Voice recognition not initialized');
      return;
    }

    console.log('🔄 Starting continuous listening mode');
    this.isContinuousMode = true;
    this.shouldRestart = true;
    this.isPushToTalkMode = false; // Not push-to-talk mode
    this.accumulatedTranscript = ''; // Reset transcript
    
    voiceToast.info('🎤 Continuous listening enabled. Press again to stop.', '🔁');

    if (this.isListening) {
      console.log('✅ Already listening, switching to continuous mode');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('❌ Failed to start continuous voice recognition:', error);
      this.setState('error');
      this.isContinuousMode = false;
      this.shouldRestart = false;
    }
  }

  public stopListening(): void {
    if (!this.isListening || !this.recognition) {
      // Even if not currently listening, stop all modes
      this.isContinuousMode = false;
      this.shouldRestart = false;
      this.isPushToTalkMode = false;
      this.accumulatedTranscript = '';
      this.setState('idle');
      return;
    }

    console.log('🛑 Stopping voice recognition');
    
    // Store mode before stopping
    const wasContinuousMode = this.isContinuousMode;
    const wasPushToTalkMode = this.isPushToTalkMode;
    
    // Reset modes
    this.isContinuousMode = false;
    this.shouldRestart = false;
    
    // Don't reset push-to-talk mode here - let onend handle it
    if (!wasPushToTalkMode) {
      this.isPushToTalkMode = false;
      this.accumulatedTranscript = '';
    }

    if (wasContinuousMode) {
      voiceToast.info('🎤 Continuous listening stopped', '🛑');
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('❌ Failed to stop voice recognition:', error);
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsContinuousMode(): boolean {
    return this.isContinuousMode;
  }

  public getHasPermission(): boolean {
    return this.hasPermission;
  }

  public setRestaurantContext(context: { name: string; slug: string; id: string }): void {
    this.restaurantContext = context;
    console.log('🏪 Restaurant context set:', context);
  }

  public clearRestaurantContext(): void {
    this.restaurantContext = undefined;
    console.log('🏪 Restaurant context cleared');
  }

  public setOnStateChange(callback: (state: VoiceState) => void) {
    this.onStateChange = callback;
  }

  public setOnTranscriptChange(callback: (transcript: string) => void) {
    this.onTranscriptChange = callback;
  }

  public setOnCommandDetected(callback: (command: VoiceCommand) => void) {
    this.onCommandDetected = callback;
  }

  public setOnIncompleteCommand(callback: (context: IncompleteCommandContext) => void) {
    this.onIncompleteCommand = callback;
  }

  public isVoiceSupported(): boolean {
    return VoiceService.isSupported();
  }

  // Test method for voice command parsing (for debugging/demonstration)
  public testVoiceCommand(transcript: string): VoiceCommand {
    console.log('🧪 Testing voice command:', transcript);
    const result = this.parseCommandFallback(transcript);
    console.log('🧪 Test result:', result);
    return result;
  }

  // Set voice state
  private setState(state: VoiceState) {
    this.onStateChange?.(state);
  }

  public async mergeIncompleteCommand(context: IncompleteCommandContext, newTranscript: string): Promise<VoiceCommand | null> {
    try {
      // If the new transcript contains a table number and the original command was missing it,
      // try to merge them intelligently
      if (context.missingFields.includes('tableNumber') && newTranscript.toLowerCase().includes('table')) {
        // Extract table number from new transcript
        const tableMatch = newTranscript.match(/table\s+(\d+)/i);
        if (tableMatch) {
          const tableNumber = parseInt(tableMatch[1]);
          
          // Create a merged command by combining the original command with the new table number
          const mergedCommand: VoiceCommand = {
            ...context.command as VoiceCommand,
            tableNumber,
            originalText: `${context.transcript} ${newTranscript}`,
            confidence: Math.min((context.command as VoiceCommand).confidence, 0.9),
            isIncomplete: false
          };

          // Check if the merged command is now complete
          const completenessCheck = this.checkCommandCompleteness(mergedCommand);
          
          if (completenessCheck.isComplete) {
            console.log('✅ Successfully merged incomplete command with table number:', mergedCommand);
            return mergedCommand;
          }
        }
      }

      // If the above didn't work, try the original merge approach
      const mergedText = `${context.transcript} ${newTranscript}`;
      console.log('🔄 Attempting to merge commands:', { original: context.transcript, new: newTranscript, merged: mergedText });
      
      // Try to parse the merged command
      const mergedCommand = await this.analyzeWithGroq(mergedText, this.restaurantContext);
      
      // Check if the merged command is now complete
      const completenessCheck = this.checkCommandCompleteness(mergedCommand);
      
      if (completenessCheck.isComplete) {
        console.log('✅ Successfully merged incomplete command:', mergedCommand);
        return mergedCommand;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to merge commands:', error);
      return null;
    }
  }

  private async analyzeWithGroq(transcript: string, restaurantContext?: { name: string; slug: string; id: string }): Promise<VoiceCommand> {
    // Check if API key is available
    if (!isGroqAPIKeyAvailable()) {
      handleMissingAPIKey();
      throw new Error('Groq API key not configured. Cannot use AI analysis.');
    }

    const contextInfo = restaurantContext 
      ? `Restaurant: ${restaurantContext.name} (${restaurantContext.slug}). ` 
      : '';

    const systemPrompt = `${contextInfo} Extract info from voice commands and respond with JSON ONLY.

SPEECH FLEXIBILITY RULES:
1. PHONETIC VARIATIONS - Accept common pronunciation mistakes and variations:
   - KOT: "koti", "kot", "cot", "cott", "kitchen order", "kitchen ticket", "k o t"
   - ORDER: "order", "ordr", "oder", "place order", "take order", "make order"
   - PAYMENT: "payment", "pay", "bill", "paymnt", "pay bill", "complete payment", "process payment"
   - TABLE: "table", "tabel", "tabl", "table number", "tabol"
   - CUSTOMER: "customer", "custmr", "client", "guest", "new customer", "add customer"

2. CASUAL SPEECH PATTERNS - Handle informal language:
   - "koti table 2" → KOT_PRINT for table 2
   - "pay table 5" → PAYMENT for table 5  
   - "order pizza table 3" → PLACE_ORDER
   - "customer john 9123456789" → CUSTOMER registration
   - "cancel table 4" → ORDER_CANCEL for table 4

3. FLEXIBLE WORD ORDER - Commands can be in any order:
   - "table 2 koti" = "koti table 2" = "print kot table number 2"
   - "pizza order table 1" = "table 1 order pizza" = "order table 1 pizza"

COMMAND TYPES:
- PLACE_ORDER: ANY mention of "order" + food items + table (e.g., "order chicken table 1", "pizza order table 2", "table 3 burger order")
- PAYMENT: "payment", "pay", "bill", "settle", "complete" + table number + optional method(s).
   • Can include discount: "discount 10 percent" or "discount rupees 50" ➜ {discount:{type:'percentage',value:10}}
   • Can include credit: "half credit" or "credit 100" ➜ creditAmount.
   • Can include splits: "upi 100 cash 50" ➜ splitPayments array.
- KOT_PRINT: "kot", "koti", "cot", "kitchen order", "print kot", "kitchen ticket" + table number
- ORDER_CANCEL: "cancel", "delete", "remove", "cancel order" + table number
- TABLE_MERGE: "merge", "combine", "join" + two table numbers
- TABLE_TRANSFER: "transfer", "move", "shift", "switch" + source table + target table  
- TABLE_STATUS: "make table", "set table", "table ready", "table available", "table occupied" + table number
- CUSTOMER: "customer", "add customer", "new customer", "register" + name + phone (required) + optional email/address
- MENU_INQUIRY: "menu", "what's available", "show menu", "food items", "what do you have"
- INVENTORY: words like "inventory", "stock", "add", "remove", "increase", "decrease", "restock", "deduct" followed by quantity and item name. Respond with {"type":"INVENTORY","menuItems":[{"name":"item name","quantity":2}],"confidence":0.9}

IMPORTANT RULES:
1. ALWAYS prioritize PLACE_ORDER if the word "order" appears anywhere in the command
2. For KOT commands, any variation of "kot"/"koti"/"cot" should be KOT_PRINT
3. Handle numbers written as words: "one", "two", "three", etc.
4. Extract table numbers from anywhere in the sentence: "table 5", "table number 5", "5 table", "number 5"
5. For CUSTOMER commands, extract name and phone carefully. Phone can have spaces: "9135036 551"
6. Be very lenient with pronunciation - focus on intent rather than exact words
7. MULTIPLE ITEMS: Detect multiple menu items with individual quantities in a single order command

MULTIPLE ITEM PARSING RULES:
- Handle lists: "order 2 chicken wings and 3 burgers table 5"
- Handle comma separation: "order chicken wings, 2 burgers, pizza table 3"
- Handle "and" separation: "order chicken and fish and rice table 2"
- Individual quantities: "order 2 chicken wings 3 burgers 1 pizza table 4"
- Mixed patterns: "order 2 chicken wings and burger and 3 pizzas table 1"
- Default quantity: If no quantity specified, assume 1

CASUAL SPEECH EXAMPLES:
"koti table two" → {"type":"KOT_PRINT","tableNumber":2,"confidence":0.9}
"pay table five upi" → {"type":"PAYMENT","tableNumber":5,"paymentMethod":"UPI","confidence":0.9}  
"order chicken wings table one" → {"type":"PLACE_ORDER","tableNumber":1,"menuItems":[{"name":"chicken wings","quantity":1}],"confidence":0.9}
"order 2 chicken wings and 3 burgers table 5" → {"type":"PLACE_ORDER","tableNumber":5,"menuItems":[{"name":"chicken wings","quantity":2},{"name":"burgers","quantity":3}],"confidence":0.9}
"order chicken wings, 2 burgers, pizza table 3" → {"type":"PLACE_ORDER","tableNumber":3,"menuItems":[{"name":"chicken wings","quantity":1},{"name":"burgers","quantity":2},{"name":"pizza","quantity":1}],"confidence":0.9}
"customer rahul nine one three five zero three six five five one" → {"type":"CUSTOMER","customerName":"Rahul","customerPhone":"9135036551","confidence":0.9}
"cancel table three" → {"type":"ORDER_CANCEL","tableNumber":3,"confidence":0.9}

Example JSON responses:
{"type":"KOT_PRINT","tableNumber":2,"confidence":0.9,"originalText":"koti table number 2"}
{"type":"PLACE_ORDER","tableNumber":1,"menuItems":[{"name":"pizza","quantity":2}],"confidence":0.9,"originalText":"two pizza table one order"}
{"type":"PAYMENT","tableNumber":4,"paymentMethod":"CASH","confidence":0.8,"originalText":"pay table 4 cash"}
{"type":"CUSTOMER","customerName":"John Smith","customerPhone":"9876543210","confidence":0.9,"originalText":"customer john smith nine eight seven six five four three two one zero"}`;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcript }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response from Groq');
      }

      console.log('🤖 Groq response:', content);
      
      try {
        const command = JSON.parse(content) as VoiceCommand;
        command.originalText = transcript;
        return command;
      } catch (parseError) {
        console.warn('❌ Failed to parse Groq JSON response:', content);
        throw new Error('Invalid JSON response from AI');
      }
      
    } catch (error) {
      console.error('❌ Groq AI analysis failed:', error);
      throw error;
    }
  }

  // Public method for AI-powered menu item matching (for use by voice command handlers)
  public static async matchMenuItemsIntelligently(voiceItems: Array<{name: string, quantity: number}>, availableMenuItems: any[]): Promise<Array<{name: string, quantity: number, matchedItem?: any}>> {
    const instance = VoiceService.getInstance();
    return instance.matchMenuItemsWithAI(voiceItems, availableMenuItems);
  }

  // Enhanced AI-powered menu item matching
  private async matchMenuItemsWithAI(voiceItems: Array<{name: string, quantity: number}>, availableMenuItems: any[]): Promise<Array<{name: string, quantity: number, matchedItem?: any}>> {
    const matchedItems: Array<{name: string, quantity: number, matchedItem?: any}> = [];
    
    for (const voiceItem of voiceItems) {
      try {
        // First try exact and basic fuzzy matching
        const basicMatch = this.findBasicMenuMatch(voiceItem.name, availableMenuItems);
        if (basicMatch) {
          matchedItems.push({
            ...voiceItem,
            matchedItem: basicMatch
          });
          continue;
        }

        // If no basic match, use AI to find the best match
        const aiMatch = await this.findAIMenuMatch(voiceItem.name, availableMenuItems);
        if (aiMatch) {
          matchedItems.push({
            ...voiceItem,
            matchedItem: aiMatch
          });
        } else {
          // No match found, keep original
          matchedItems.push(voiceItem);
        }
      } catch (error) {
        console.error('Error matching menu item:', voiceItem.name, error);
        // Fallback to basic matching
        const basicMatch = this.findBasicMenuMatch(voiceItem.name, availableMenuItems);
        matchedItems.push({
          ...voiceItem,
          matchedItem: basicMatch
        });
      }
    }

    return matchedItems;
  }

  // Basic fuzzy matching for common cases
  private findBasicMenuMatch(voiceItemName: string, availableMenuItems: any[]): any {
    const searchTerm = voiceItemName.toLowerCase().trim();
    
    // 1. Exact match
    let match = availableMenuItems.find(item => 
      item.name.toLowerCase() === searchTerm
    );
    if (match) return match;

    // 2. Contains match (either direction)
    match = availableMenuItems.find(item => 
      item.name.toLowerCase().includes(searchTerm) || 
      searchTerm.includes(item.name.toLowerCase())
    );
    if (match) return match;

    // 3. Word-by-word fuzzy matching
    const searchWords = searchTerm.split(' ').filter(w => w.length > 2);
    if (searchWords.length > 0) {
      match = availableMenuItems.find(item => {
        const itemWords = item.name.toLowerCase().split(' ');
        return searchWords.some(searchWord => 
          itemWords.some((itemWord: string) => 
            itemWord.includes(searchWord) || searchWord.includes(itemWord)
          )
        );
      });
      if (match) return match;
    }

    return null;
  }

  // AI-powered menu item matching using Groq API
  private async findAIMenuMatch(voiceItemName: string, availableMenuItems: any[]): Promise<any> {
    // Check if API key is available
    if (!isGroqAPIKeyAvailable()) {
      console.warn('🔑 Groq API key not available for AI menu matching. Using fallback only.');
      return null;
    }

    try {
      const menuItemNames = availableMenuItems.map(item => item.name);
      
      const prompt = `Find the best menu item match for the voice command: "${voiceItemName}"

Available menu items:
${menuItemNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

Instructions:
1. Find the menu item that best matches the voice command
2. Consider phonetic similarities, abbreviations, and common variations
3. Look for items with similar ingredients or characteristics
4. If no close match exists, return "NO_MATCH"
5. Return ONLY the exact menu item name from the list above

Examples:
- "chilly pork" might match "Chilli Pork" or "Spicy Pork"
- "all time favorite chilly pork" might match "Chilli Pork" or "Special Pork Dish"
- "wings" might match "Chicken Wings" or "Buffalo Wings"
- "burger" might match "Beef Burger" or "Chicken Burger"

Voice command: "${voiceItemName}"
Best match:`;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const matchedName = data.choices[0]?.message?.content?.trim();
        
        if (matchedName && matchedName !== "NO_MATCH") {
          // Find the exact menu item by name
          const matchedItem = availableMenuItems.find(item => 
            item.name.toLowerCase() === matchedName.toLowerCase() ||
            item.name.toLowerCase().includes(matchedName.toLowerCase()) ||
            matchedName.toLowerCase().includes(item.name.toLowerCase())
          );
          
          if (matchedItem) {
            console.log(`🤖 AI matched "${voiceItemName}" → "${matchedItem.name}"`);
            return matchedItem;
          }
        }
      }
    } catch (error) {
      console.warn('AI menu matching failed, using fallback:', error);
    }

    return null;
  }

  // Toggle between single-shot and continuous listening
  public toggleListening(): void {
    if (this.isListening) {
      // If currently listening, stop
      this.stopListening();
    } else {
      // If not listening, start continuous mode
      this.startContinuousListening();
    }
  }

  // Public method to check if Groq AI features are available
  public static isGroqAIAvailable(): boolean {
    return isGroqAPIKeyAvailable();
  }

  // Public method to get setup instructions for Groq AI
  public static getGroqSetupInstructions(): string {
    if (isGroqAPIKeyAvailable()) {
      return 'Groq AI is properly configured and ready to use.';
    }
    
    return `To enable advanced voice AI features:
1. Get a free API key from https://groq.com/
2. Add VITE_GROQ_API_KEY to your environment variables
3. Restart your development server

Without this key, voice commands will use basic pattern matching.`;
  }

  // NEW: Get push-to-talk mode status
  public getIsPushToTalkMode(): boolean {
    return this.isPushToTalkMode;
  }

  // NEW: Get accumulated transcript in push-to-talk mode
  public getAccumulatedTranscript(): string {
    return this.accumulatedTranscript;
  }

  public async handleTranscribedAudio(file: Blob | File): Promise<void> {
    try {
      // Update UI state to processing
      this.setState('processing');

      // Obtain transcript via Groq Whisper
      const transcript = await transcribeAudio(file);
      console.log('🎤 Transcribed audio:', transcript);

      // Notify listeners about transcript
      this.onTranscriptChange?.(transcript);

      // Re-use existing flow to analyse and dispatch the voice command
      await this.processVoiceCommand(transcript, this.restaurantContext);
    } catch (error) {
      console.error('❌ Audio transcription failed:', error);
      voiceToast.error('Failed to transcribe audio');
      this.setState('error');
    }
  }

  // Convenience static wrapper so callers don’t have to fetch the singleton
  public static async processAudio(file: Blob | File): Promise<void> {
    const instance = VoiceService.getInstance();
    await instance.handleTranscribedAudio(file);
  }
}

// Export singleton instance
export const voiceService = VoiceService.getInstance();

// Type declarations for speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
} 