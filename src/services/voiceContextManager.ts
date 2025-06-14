// Voice Command Context Manager for handling incomplete commands
import { VoiceCommand, IncompleteCommandContext } from './voiceService';

interface StoredVoiceContext {
  command: Partial<VoiceCommand>;
  missingFields: ('tableNumber' | 'menuItems' | 'paymentMethod' | 'customerName' | 'targetTableNumber')[];
  contextualMessage: string;
  transcript: string;
  timestamp: number;
  restaurantId: string;
}

export class VoiceContextManager {
  private static readonly CONTEXT_KEY = 'tenverse_voice_context';
  private static readonly CONTEXT_EXPIRY = 5 * 60 * 1000; // 5 minutes

  // Store incomplete command context in localStorage
  static storeContext(context: IncompleteCommandContext, restaurantId: string): void {
    try {
      const storedContext: StoredVoiceContext = {
        command: context.command,
        missingFields: context.missingFields,
        contextualMessage: context.contextualMessage,
        transcript: context.transcript,
        timestamp: Date.now(),
        restaurantId
      };

      localStorage.setItem(this.CONTEXT_KEY, JSON.stringify(storedContext));
      console.log('🧠 Voice context stored:', storedContext);
    } catch (error) {
      console.error('Failed to store voice context:', error);
    }
  }

  // Retrieve and validate stored context
  static getContext(restaurantId: string): IncompleteCommandContext | null {
    try {
      const stored = localStorage.getItem(this.CONTEXT_KEY);
      if (!stored) return null;

      const context: StoredVoiceContext = JSON.parse(stored);
      
      // Check if context is expired
      if (Date.now() - context.timestamp > this.CONTEXT_EXPIRY) {
        this.clearContext();
        console.log('🕒 Voice context expired and cleared');
        return null;
      }

      // Check if context is for the correct restaurant
      if (context.restaurantId !== restaurantId) {
        console.log('🏪 Voice context for different restaurant, ignoring');
        return null;
      }

      console.log('🧠 Voice context retrieved:', context);
      return {
        command: context.command,
        missingFields: context.missingFields,
        contextualMessage: context.contextualMessage,
        transcript: context.transcript
      };
    } catch (error) {
      console.error('Failed to get voice context:', error);
      this.clearContext();
      return null;
    }
  }

  // Clear stored context
  static clearContext(): void {
    try {
      localStorage.removeItem(this.CONTEXT_KEY);
      console.log('🧠 Voice context cleared');
    } catch (error) {
      console.error('Failed to clear voice context:', error);
    }
  }

  // Check if we have stored context
  static hasContext(restaurantId: string): boolean {
    return this.getContext(restaurantId) !== null;
  }

  // Merge stored context with new voice input
  static mergeContextWithNewInput(
    storedContext: IncompleteCommandContext,
    newTranscript: string
  ): { success: boolean; command?: VoiceCommand; message?: string } {
    try {
      const normalizedInput = newTranscript.toLowerCase().trim();
      const mergedCommand: Partial<VoiceCommand> = { ...storedContext.command };
      let resolved = false;
      let responseMessage = '';

      // Handle missing table number
      if (storedContext.missingFields.includes('tableNumber')) {
        const tableMatch = normalizedInput.match(/(?:table\s*)?(\d+)/);
        if (tableMatch) {
          mergedCommand.tableNumber = parseInt(tableMatch[1]);
          resolved = true;
          responseMessage = `Table ${mergedCommand.tableNumber} selected`;
        } else if (normalizedInput.includes('table')) {
          return { success: false, message: 'Please specify a table number (e.g., "table 5")' };
        }
      }

      // Handle missing target table (for merge/transfer)
      if (storedContext.missingFields.includes('targetTableNumber')) {
        const tableMatch = normalizedInput.match(/(?:table\s*)?(\d+)/);
        if (tableMatch) {
          mergedCommand.targetTableNumber = parseInt(tableMatch[1]);
          resolved = true;
          responseMessage = `Target table ${mergedCommand.targetTableNumber} selected`;
        }
      }

      // Handle missing command type (KOT, Order, Payment)
      if (!mergedCommand.type || mergedCommand.type === 'UNKNOWN') {
        if (normalizedInput.includes('kot') || normalizedInput.includes('kitchen')) {
          mergedCommand.type = 'KOT_PRINT';
          resolved = true;
          responseMessage = 'KOT print command selected';
        } else if (normalizedInput.includes('order') || normalizedInput.includes('place')) {
          mergedCommand.type = 'PLACE_ORDER';
          resolved = true;
          responseMessage = 'Place order command selected';
        } else if (normalizedInput.includes('payment') || normalizedInput.includes('bill') || normalizedInput.includes('pay')) {
          mergedCommand.type = 'PAYMENT';
          resolved = true;
          responseMessage = 'Payment command selected';
        }
      }

      // Handle missing payment method
      if (storedContext.missingFields.includes('paymentMethod')) {
        if (normalizedInput.includes('upi')) {
          mergedCommand.paymentMethod = 'UPI';
          resolved = true;
          responseMessage = 'UPI payment selected';
        } else if (normalizedInput.includes('cash')) {
          mergedCommand.paymentMethod = 'CASH';
          resolved = true;
          responseMessage = 'Cash payment selected';
        } else if (normalizedInput.includes('bank') || normalizedInput.includes('card')) {
          mergedCommand.paymentMethod = 'BANK';
          resolved = true;
          responseMessage = 'Bank payment selected';
        }
      }

      // Handle missing menu items for orders
      if (storedContext.missingFields.includes('menuItems')) {
        // Parse multiple menu items from the input
        const menuItems = this.parseMultipleMenuItemsFromInput(normalizedInput);
        if (menuItems.length > 0) {
          mergedCommand.menuItems = menuItems;
          resolved = true;
          const itemsText = menuItems.map(item => `${item.quantity}x ${item.name}`).join(', ');
          responseMessage = `Added ${itemsText} to order`;
        } else {
          // If we can't parse specific items, treat the whole input as a menu item
          const cleanInput = normalizedInput
            .replace(/^\d+\s*/, '') // Remove leading numbers
            .replace(/\b(x|times|pieces?|items?)\b/g, '') // Remove quantity words
            .trim();
          
          if (cleanInput.length > 2) {
            const menuItem = {
              name: cleanInput.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' '),
              quantity: 1,
              category: 'Unknown'
            };
            mergedCommand.menuItems = [menuItem];
            resolved = true;
            responseMessage = `Added 1x ${menuItem.name} to order`;
          }
        }
      }

      // Handle missing customer name
      if (storedContext.missingFields.includes('customerName')) {
        // Extract name from input (exclude common command words)
        const excludeWords = ['customer', 'add', 'create', 'register', 'new', 'name', 'is', 'the'];
        const words = normalizedInput.split(' ').filter(word => 
          word.length > 1 && !excludeWords.includes(word) && !/^\d+$/.test(word)
        );
        
        if (words.length > 0) {
          mergedCommand.customerName = words.map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          resolved = true;
          responseMessage = `Customer name set to ${mergedCommand.customerName}`;
        }
      }

      if (resolved) {
        // Create complete command
        const completeCommand: VoiceCommand = {
          type: mergedCommand.type || 'UNKNOWN',
          tableNumber: mergedCommand.tableNumber,
          targetTableNumber: mergedCommand.targetTableNumber,
          menuItems: mergedCommand.menuItems,
          paymentMethod: mergedCommand.paymentMethod,
          customerName: mergedCommand.customerName,
          customerPhone: mergedCommand.customerPhone,
          customerEmail: mergedCommand.customerEmail,
          customerAddress: mergedCommand.customerAddress,
          confidence: 0.9, // High confidence for merged commands
          originalText: `${storedContext.transcript} + ${newTranscript}`,
          isIncomplete: false
        };

        console.log('✅ Successfully merged voice context:', completeCommand);
        return { success: true, command: completeCommand, message: responseMessage };
      }

      return { success: false, message: 'Could not understand the additional information provided' };
    } catch (error) {
      console.error('Error merging voice context:', error);
      return { success: false, message: 'Error processing voice context' };
    }
  }

  // Parse multiple menu items from voice input
  private static parseMultipleMenuItemsFromInput(input: string): Array<{ name: string; quantity: number; category?: string }> {
    try {
      const items: Array<{ name: string; quantity: number; category?: string }> = [];
      
      // Split by common separators (and, comma, plus)
      const separators = /\s+(?:and|,|&|\+)\s+/gi;
      let segments = input.split(separators);
      
      // If no separators found, try to detect multiple items in sequence
      if (segments.length === 1) {
        // Look for pattern: "2 chicken wings 3 burgers 1 pizza"
        const sequencePattern = /(\d+\s+[a-zA-Z\s]+?)(?=\d+\s+[a-zA-Z]|$)/g;
        const sequenceMatches = input.match(sequencePattern);
        if (sequenceMatches && sequenceMatches.length > 1) {
          segments = sequenceMatches;
        }
      }
      
      for (let segment of segments) {
        segment = segment.trim();
        if (segment.length < 2) continue;
        
        const parsedItem = this.parseMenuItemFromInput(segment);
        if (parsedItem) {
          items.push(parsedItem);
        }
      }
      
      return items;
    } catch (error) {
      console.error('Error parsing multiple menu items from input:', error);
      return [];
    }
  }

  // Parse menu item from voice input
  private static parseMenuItemFromInput(input: string): { name: string; quantity: number; category?: string } | null {
    try {
      // Look for quantity patterns: "2 chicken wings", "three burgers", "1x pizza"
      const quantityPatterns = [
        /^(\d+)\s*x?\s*(.+)$/i,  // "2 chicken wings" or "2x pizza"
        /^(\w+)\s+(.+)$/i        // "two burgers" (word numbers)
      ];

      let quantity = 1;
      let itemName = input.trim();

      // Try to extract quantity
      for (const pattern of quantityPatterns) {
        const match = input.match(pattern);
        if (match) {
          const quantityStr = match[1].toLowerCase();
          
          // Convert word numbers to digits
          const wordNumbers: { [key: string]: number } = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
          };
          
          if (wordNumbers[quantityStr]) {
            quantity = wordNumbers[quantityStr];
            itemName = match[2];
          } else if (/^\d+$/.test(quantityStr)) {
            quantity = parseInt(quantityStr);
            itemName = match[2];
          }
          break;
        }
      }

      // Clean up the item name
      itemName = itemName
        .replace(/\b(x|times|pieces?|items?|orders?)\b/gi, '') // Remove quantity words
        .replace(/^\s*[-,]\s*/, '') // Remove leading dashes or commas
        .trim();

      // Capitalize properly
      if (itemName.length > 2) {
        const formattedName = itemName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        return {
          name: formattedName,
          quantity: Math.max(1, quantity), // Ensure at least 1
          category: 'Voice Order'
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing menu item from input:', error);
      return null;
    }
  }

  // Generate contextual prompts for missing information
  static generateContextualPrompt(context: IncompleteCommandContext): string {
    const missingFields = context.missingFields;
    const command = context.command;

    if (missingFields.includes('tableNumber')) {
      if (command.type === 'KOT_PRINT') {
        return 'Which table do you want to print KOT for? (e.g., "table 5")';
      } else if (command.type === 'PLACE_ORDER') {
        return 'Which table do you want to place order for? (e.g., "table 3")';
      } else if (command.type === 'PAYMENT') {
        return 'Which table do you want to process payment for? (e.g., "table 2")';
      } else {
        return 'Which table number? (e.g., "table 4")';
      }
    }

    if (missingFields.includes('targetTableNumber')) {
      return 'Which table do you want to transfer/merge to? (e.g., "table 8")';
    }

    if (!command.type || command.type === 'UNKNOWN') {
      if (command.tableNumber) {
        return `What action for table ${command.tableNumber}? Say "KOT", "Order", or "Payment"`;
      } else {
        return 'What do you want to do? Say "KOT", "Order", or "Payment"';
      }
    }

    if (missingFields.includes('paymentMethod')) {
      return 'Which payment method? Say "UPI", "Cash", or "Bank"';
    }

    if (missingFields.includes('customerName')) {
      return 'What is the customer name?';
    }

    if (missingFields.includes('menuItems')) {
      if (command.tableNumber) {
        return `What items would you like to order for table ${command.tableNumber}? (e.g., "chicken wings", "2 burgers and 3 pizzas", "chicken, burger, pizza")`;
      } else {
        return 'What items would you like to order? (e.g., "chicken wings", "2 burgers and 3 pizzas", "chicken, burger, pizza")';
      }
    }

    return 'Please provide the missing information to complete your command';
  }
} 