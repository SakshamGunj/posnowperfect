import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Brain, Loader2 } from 'lucide-react';
import { useVoice } from '@/contexts/VoiceContext';
import { VoiceService } from '@/services/voiceService';
import { toast } from 'react-hot-toast';

// Custom styles for animations
const styles = `
  .animation-delay-150 { animation-delay: 150ms; }
  .animation-delay-300 { animation-delay: 300ms; }
  .shadow-3xl { box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25); }
  .hover\\:shadow-3xl:hover { box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.35); }
`;

// Safe wrapper component for VoiceButton
const SafeVoiceButton: React.FC = () => {
  try {
    const voiceContext = useVoice();
    console.log('🎤 VoiceButton: Voice context available:', !!voiceContext);
    return <VoiceButtonInner {...voiceContext} />;
  } catch (error) {
    console.warn('VoiceButton: Voice context not available, hiding button');
    return null;
  }
};

// Inner component that actually renders the button
const VoiceButtonInner: React.FC<any> = ({
  isSupported,
  hasPermission,
  isListening,
  state,
  transcript,
  requestPermission,
  startListening,
  stopListening,
}) => {

  const [showTranscript, setShowTranscript] = useState(false);

  // Auto-hide transcript after 3 seconds
  useEffect(() => {
    if (transcript) {
      setShowTranscript(true);
      const timer = setTimeout(() => setShowTranscript(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [transcript]);

  // Handle permission request on first use
  const handleFirstUse = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    handleRecordStart();
  };

  // Handle button click - now works like WhatsApp voice message
  const handleClick = () => {
    // Don't do anything on click - we use mouse/touch events instead
  };

  // Handle mouse/touch down - start push-to-talk recording
  const handleRecordStart = () => {
    if (!isSupported) {
      toast.error('Voice commands not supported in this browser.');
      return;
    }

    if (state === 'processing' || state === 'executing') {
      toast('Please wait, processing previous command...', { icon: '⏳' });
      return;
    }

    console.log('🎙️ VoiceButton: Starting push-to-talk recording');
    
    // Start push-to-talk recording mode using VoiceService directly
    const voiceService = VoiceService.getInstance();
    voiceService.startPushToTalkRecording();
  };

  // Handle mouse/touch up - stop push-to-talk recording and process
  const handleRecordStop = () => {
    if (isListening) {
      console.log('🛑 VoiceButton: Stopping push-to-talk recording');
      
      // Stop push-to-talk recording using VoiceService directly
      const voiceService = VoiceService.getInstance();
      voiceService.stopPushToTalkRecording();
    }
  };

  // Get button color based on state
  const getButtonColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600 shadow-red-500/50';
      case 'processing':
        return 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/50';
      case 'executing':
        return 'bg-green-500 hover:bg-green-600 shadow-green-500/50';
      case 'error':
        return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/50';
      default:
        return isListening ? 
          'bg-red-500 hover:bg-red-600 shadow-red-500/50' : 
          'bg-gray-700 hover:bg-gray-600 shadow-gray-500/50';
    }
  };

  // Get button icon based on state
  const getButtonIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-8 w-8 text-white drop-shadow-lg animate-pulse" />;
      case 'processing':
        return <Loader2 className="h-8 w-8 text-white drop-shadow-lg animate-spin" />;
      case 'executing':
        return <Brain className="h-8 w-8 text-white drop-shadow-lg animate-bounce" />;
      case 'error':
        return <MicOff className="h-8 w-8 text-white drop-shadow-lg" />;
      default:
        return isListening ? 
          <Mic className="h-8 w-8 text-white drop-shadow-lg animate-pulse" /> :
          <Mic className="h-8 w-8 text-white drop-shadow-lg hover:scale-110 transition-transform duration-200" />;
    }
  };

  // Get state text
  const getStateText = () => {
    switch (state) {
      case 'listening':
        return 'Recording... (Release to send)';
      case 'processing':
        return 'Processing...';
      case 'executing':
        return 'Executing...';
      case 'error':
        return 'Error';
      default:
        return 'Hold to record';
    }
  };

  // Additional check using the static method
  if (!isSupported || !VoiceService.isSupported()) {
    return null; // Hide button if not supported
  }

  return (
    <>
      {/* Add custom styles */}
      <style>{styles}</style>
      
      {/* Voice Button */}
      <div className="fixed bottom-28 right-4 lg:bottom-6 lg:right-6 z-50">
        {/* Transcript Bubble */}
        {showTranscript && transcript && (
          <div className="absolute bottom-24 right-0 mb-2 max-w-xs animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gray-900/95 backdrop-blur-md text-white text-sm rounded-xl px-4 py-3 shadow-2xl border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1 font-medium">You said:</div>
              <div className="font-medium leading-relaxed">{transcript}</div>
              {/* Arrow pointing to button */}
              <div className="absolute -bottom-1 right-8 w-3 h-3 bg-gray-900/95 border-r border-b border-gray-700/50 transform rotate-45"></div>
            </div>
          </div>
        )}

        {/* State Indicator */}
        {state !== 'idle' && (
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap animate-in fade-in-0 duration-200">
            <div className="bg-gray-900/95 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-xl border border-gray-700/50 font-medium">
              {getStateText()}
            </div>
          </div>
        )}

        {/* Main Voice Button */}
        <button
          onMouseDown={hasPermission ? handleRecordStart : handleFirstUse}
          onMouseUp={handleRecordStop}
          onMouseLeave={handleRecordStop}
          onTouchStart={hasPermission ? handleRecordStart : handleFirstUse}
          onTouchEnd={handleRecordStop}
          disabled={!isSupported}
          className={`
            relative h-20 w-20 rounded-full shadow-2xl transition-all duration-300 transform
            ${getButtonColor()}
            ${isListening ? 'ring-4 ring-red-300 ring-opacity-50 scale-110' : ''}
            active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50
            backdrop-blur-lg border-2 border-white/30
            hover:shadow-3xl hover:scale-105
            before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r 
            before:from-white/20 before:to-transparent before:opacity-50
            select-none
          `}
          style={{
            background: state === 'listening' || isListening ? 
              'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)' :
              state === 'processing' ? 
              'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)' :
              state === 'executing' ? 
              'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' :
              'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)'
          }}
          aria-label={`Voice command button - Hold to record`}
        >
          {/* Animated ripple effects for listening */}
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30"></div>
              <div className="absolute inset-2 rounded-full bg-red-300 animate-ping opacity-20 animation-delay-150"></div>
              <div className="absolute inset-4 rounded-full bg-red-200 animate-ping opacity-10 animation-delay-300"></div>
            </>
          )}
          
          {/* Inner glow effect */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/30 to-transparent opacity-60"></div>
          
          {/* Button icon */}
          <div className="relative z-10 flex items-center justify-center h-full w-full">
            {getButtonIcon()}
          </div>

          {/* Subtle outer ring */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-white/20 to-white/5 opacity-50 blur-sm"></div>
        </button>


      </div>
    </>
  );
};

export default SafeVoiceButton; 