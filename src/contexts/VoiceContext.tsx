import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { voiceService, VoiceCommand, VoiceState, VoiceService, IncompleteCommandContext } from '@/services/voiceService';
import { VoiceContextManager } from '@/services/voiceContextManager';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { IncompleteCommandDialog } from '@/components/voice/IncompleteCommandDialog';

// Voice Context Interface
interface VoiceContextType {
  isSupported: boolean;
  hasPermission: boolean;
  isListening: boolean;
  isContinuousMode: boolean;
  state: VoiceState;
  transcript: string;
  lastCommand: VoiceCommand | null;
  incompleteCommandContext: IncompleteCommandContext | null;
  requestPermission: () => Promise<boolean>;
  startListening: () => void;
  startContinuousListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  executeCommand: (command: VoiceCommand) => Promise<void>;
  clearIncompleteCommand: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

interface VoiceProviderProps {
  children: ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  const [isSupported] = useState(VoiceService.isSupported());
  const [hasPermission, setHasPermission] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [incompleteCommandContext, setIncompleteCommandContext] = useState<IncompleteCommandContext | null>(null);
  
  const { user } = useRestaurantAuth();
  const { restaurant } = useRestaurant();

  useEffect(() => {
    if (!isSupported) {
      toast.error('Voice commands are not supported in this browser.');
      return;
    }

    // Set up voice service event listeners
    voiceService.setOnStateChange((newState: VoiceState) => {
      setState(newState);
      setIsListening(voiceService.getIsListening());
      setIsContinuousMode(voiceService.getIsContinuousMode());
    });

    voiceService.setOnTranscriptChange((newTranscript: string) => {
      setTranscript(newTranscript);
    });

    voiceService.setOnCommandDetected(async (command: VoiceCommand) => {
      setLastCommand(command);
      executeCommand(command);
    });

    voiceService.setOnIncompleteCommand((context: IncompleteCommandContext) => {
      setIncompleteCommandContext(context);
    });

    // Check if permission was previously granted
    checkExistingPermission();
  }, []);

  // Check for stored context on restaurant change
  useEffect(() => {
    if (restaurant?.id) {
      const storedContext = VoiceContextManager.getContext(restaurant.id);
      if (storedContext) {
        console.log('🧠 VoiceContext: Found stored context on restaurant load:', storedContext);
        setIncompleteCommandContext(storedContext);
      }
    }
  }, [restaurant?.id]);

  // Set restaurant context when restaurant changes
  useEffect(() => {
    console.log('🎤 VoiceContext: Restaurant changed, updating voice service context:', restaurant?.slug);
    if (restaurant) {
      voiceService.setRestaurantContext({
        name: restaurant.name,
        slug: restaurant.slug,
        id: restaurant.id
      });
    } else {
      voiceService.clearRestaurantContext();
    }
  }, [restaurant]);

  const checkExistingPermission = async () => {
    try {
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setHasPermission(permissions.state === 'granted');
    } catch (error) {
      console.log('Could not check microphone permission');
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    const granted = await voiceService.requestPermission();
    setHasPermission(granted);
    return granted;
  };

  const startListening = () => {
    if (!hasPermission) {
      toast.error('Please grant microphone permission first.');
      return;
    }
    voiceService.startListening();
  };

  const startContinuousListening = () => {
    if (!hasPermission) {
      toast.error('Please grant microphone permission first.');
      return;
    }
    voiceService.startContinuousListening();
  };

  const stopListening = () => {
    voiceService.stopListening();
  };

  const toggleListening = () => {
    voiceService.toggleListening();
  };

  const clearIncompleteCommand = () => {
    setIncompleteCommandContext(null);
    // Also clear from localStorage
    if (restaurant?.id) {
      VoiceContextManager.clearContext();
    }
  };

  const executeCommand = async (command: VoiceCommand): Promise<void> => {
    try {
      // If we have an incomplete command context, try to merge first
      if (incompleteCommandContext && !command.isIncomplete) {
        const mergedCommand = await voiceService.mergeIncompleteCommand(incompleteCommandContext, command.originalText);
        
        if (mergedCommand) {
          // Successfully merged, clear incomplete context and execute the complete command
          setIncompleteCommandContext(null);
          setState('executing');
          console.log('🎯 VoiceContext: Executing merged command:', mergedCommand);
          
          // Execute the merged command
          await executeCommandInternal(mergedCommand);
          return;
        }
        // If merge failed, clear incomplete context and continue with normal processing
        setIncompleteCommandContext(null);
      }
      
      setState('executing');
      console.log('🎯 VoiceContext: Executing command:', command);
      
      await executeCommandInternal(command);
    } catch (error) {
      console.error('Error executing voice command:', error);
      toast.error('Failed to execute command.');
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const executeCommandInternal = async (command: VoiceCommand): Promise<void> => {
    switch (command.type) {
        case 'ORDER':
          await executeOrderCommand(command);
          break;
        case 'PLACE_ORDER':
          await executePlaceOrderCommand(command);
          break;
        case 'PAYMENT':
          await executePaymentCommand(command);
          break;
        case 'KOT_PRINT':
          await executeKotPrintCommand(command);
          break;
        case 'ORDER_CANCEL':
          await executeOrderCancelCommand(command);
          break;
        case 'TABLE_MERGE':
          await executeTableMergeCommand(command);
          break;
        case 'TABLE_TRANSFER':
          await executeTableTransferCommand(command);
          break;
        case 'TABLE_STATUS':
          await executeTableStatusCommand(command);
          break;
        case 'CUSTOMER':
          await executeCustomerCommand(command);
          break;
        case 'MENU_INQUIRY':
          await executeMenuInquiryCommand(command);
          break;
        default:
          toast.error('Command not recognized. Please try again.');
      }
      
      setState('idle');
  };

  const executeOrderCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber, menuItems } = command;
    
    console.log('🍽️ VoiceContext: Executing order command:', { tableNumber, menuItems, hasUser: !!user });
    
    if (!tableNumber || !menuItems || menuItems.length === 0) {
      toast.error('Please specify table number and menu items.');
      return;
    }

    // Always dispatch the event - let the receiving component handle auth
    const event = new CustomEvent('voiceOrderCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceOrderCommand event');
  };

  const executePlaceOrderCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber, menuItems } = command;
    
    console.log('🍽️ VoiceContext: Executing place order command:', { tableNumber, menuItems, hasUser: !!user });
    
    if (!tableNumber) {
      toast.error('Please specify table number for placing order.');
      return;
    }

    // If we have menu items (from completed voice context), treat it as an order with items
    if (menuItems && menuItems.length > 0) {
      console.log('🎯 VoiceContext: Place order has menu items, executing as order command');
      
      // Execute as order command to add items and place order
      const event = new CustomEvent('voiceOrderCommand', {
        detail: { 
          command: {
            ...command,
            type: 'ORDER' // Change type to ORDER so it adds items and places order
          }
        }
      });
      window.dispatchEvent(event);
      console.log('🎯 VoiceContext: Dispatched voiceOrderCommand event with menu items');
    } else {
      // No menu items, just dispatch regular place order event
    const event = new CustomEvent('voicePlaceOrderCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voicePlaceOrderCommand event');
    }
  };

  const executePaymentCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber, paymentMethod } = command;
    
    console.log('💳 VoiceContext: Executing payment command:', { tableNumber, paymentMethod, hasUser: !!user });
    
    if (!tableNumber) {
      toast.error('Please specify table number for payment.');
      return;
    }

    // Emit payment command event
    const event = new CustomEvent('voicePaymentCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voicePaymentCommand event');
  };

  const executeKotPrintCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber } = command;
    
    console.log('🧾 VoiceContext: Executing KOT print command:', { tableNumber, hasUser: !!user });
    
    if (!tableNumber) {
      toast.error('Please specify table number for KOT printing.');
      return;
    }

    // Emit KOT print command event
    const event = new CustomEvent('voiceKotPrintCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceKotPrintCommand event');
  };

  const executeOrderCancelCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber } = command;
    
    console.log('❌ VoiceContext: Executing order cancel command:', { tableNumber, hasUser: !!user });
    
    if (!tableNumber) {
      toast.error('Please specify table number for order cancellation.');
      return;
    }

    // Emit order cancel command event
    const event = new CustomEvent('voiceOrderCancelCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceOrderCancelCommand event');
  };

  const executeTableMergeCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber, targetTableNumber } = command;
    
    console.log('🔗 VoiceContext: Executing table merge command:', { tableNumber, targetTableNumber, hasUser: !!user });
    
    if (!tableNumber || !targetTableNumber) {
      toast.error('Please specify both source and target table numbers for merging.');
      return;
    }

    // Emit table merge command event
    const event = new CustomEvent('voiceTableMergeCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceTableMergeCommand event');
  };

  const executeTableTransferCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber, targetTableNumber } = command;
    
    console.log('📤 VoiceContext: Executing table transfer command:', { tableNumber, targetTableNumber, hasUser: !!user });
    
    if (!tableNumber || !targetTableNumber) {
      toast.error('Please specify both source and target table numbers for transfer.');
      return;
    }

    // Emit table transfer command event
    const event = new CustomEvent('voiceTableTransferCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceTableTransferCommand event');
  };

  const executeTableStatusCommand = async (command: VoiceCommand): Promise<void> => {
    const { tableNumber } = command;
    
    console.log('🏓 VoiceContext: Executing table status command:', { tableNumber, hasUser: !!user });
    
    if (!tableNumber) {
      toast.error('Please specify table number for status update.');
      return;
    }

    // Emit table status command event
    const event = new CustomEvent('voiceTableStatusCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceTableStatusCommand event');
  };

  const executeCustomerCommand = async (command: VoiceCommand): Promise<void> => {
    const { customerName, customerPhone } = command;
    
    console.log('👤 VoiceContext: Executing customer command:', { customerName, customerPhone, hasUser: !!user });
    
    if (!customerName && !customerPhone) {
      toast.error('Please specify customer name or phone number.');
      return;
    }

    // Emit customer command event
    const event = new CustomEvent('voiceCustomerCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceCustomerCommand event');
  };

  const executeMenuInquiryCommand = async (command: VoiceCommand): Promise<void> => {
    console.log('📋 VoiceContext: Executing menu inquiry command:', { hasUser: !!user });
    
    // Emit menu inquiry command event
    const event = new CustomEvent('voiceMenuInquiryCommand', {
      detail: { command }
    });
    window.dispatchEvent(event);
    console.log('🎯 VoiceContext: Dispatched voiceMenuInquiryCommand event');
  };

  return (
    <VoiceContext.Provider
      value={{
        isSupported,
        hasPermission,
        isListening,
        isContinuousMode,
        state,
        transcript,
        lastCommand,
        incompleteCommandContext,
        requestPermission,
        startListening,
        startContinuousListening,
        stopListening,
        toggleListening,
        executeCommand,
        clearIncompleteCommand,
      }}
    >
      {children}
      
      {/* Incomplete Command Dialog */}
        <IncompleteCommandDialog
        isVisible={!!incompleteCommandContext}
        context={incompleteCommandContext || undefined}
          onClose={clearIncompleteCommand}
        onRetryVoice={startListening}
        />
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

export default VoiceContext; 