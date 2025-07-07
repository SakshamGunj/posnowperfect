# Voice Customer Management Features

## Overview
Added comprehensive voice commands for customer management to the POS system. Staff can now add customers to the CRM using natural voice commands.

## Voice Commands Supported

### Basic Customer Addition
- "add customer John Smith phone 9876543210"
- "register customer Mary Johnson phone 9876543210 email mary@gmail.com"
- "create customer David phone 9123456789"
- "new customer Sarah email sarah@example.com phone 9988776655"

### Voice Command Patterns
The system supports flexible voice patterns:
- **Name**: Any combination of first and last names
- **Phone**: 10-digit Indian format numbers (automatically extracted)
- **Email**: Standard email format (optional)
- **Keywords**: add/register/create/new + customer

## Technical Implementation

### 1. Voice Service Updates
- **VoiceCommand Interface**: Added `CUSTOMER` type with fields:
  - `customerName?: string`
  - `customerPhone?: string` 
  - `customerEmail?: string`
  - `customerAddress?: string`

### 2. AI Processing (Groq API)
- Enhanced system prompt with customer command examples
- Intelligent parsing of name, phone, and email from voice input
- Fallback regex parsing for robust extraction

### 3. Command Dispatching
- **VoiceContext**: Added `executeCustomerCommand()` function
- **Event System**: Uses `voiceCustomerCommand` custom events
- **Global Listening**: Both Tables and TakeOrder components handle customer commands

### 4. Customer Service Integration
- **Duplicate Detection**: Automatically checks for existing customers by phone
- **Smart Error Handling**: Provides clear feedback for duplicates
- **CRM Integration**: Seamlessly adds to restaurant's customer database
- **Voice Tagging**: Marks customers as 'voice_added' for tracking

## Features & Benefits

### 🎤 Natural Language Processing
- Extracts customer information from conversational speech
- Handles various name formats and phone number presentations
- Optional email extraction with validation

### 🔍 Duplicate Prevention
- Automatic phone number matching
- Clear messaging when customer already exists
- Shows existing customer name for reference

### 📱 Multi-Component Support
- Works from Tables page (global access)
- Works from TakeOrder page (during order processing)
- Consistent behavior across all restaurant views

### 🏷️ Smart Categorization
- Tags voice-added customers with 'voice_added' preference
- Maintains full CRM integration with visit count, spending history
- Ready for loyalty program integration

## Example Usage Scenarios

### Scenario 1: Quick Customer Registration
**Voice**: "add customer John Doe phone 9876543210"
**Result**: 
- ✅ Customer "John Doe" added to CRM
- 📱 Phone: 9876543210 saved
- 🏷️ Tagged as voice-added
- 🎉 Success toast: "Successfully added John Doe to CRM!"

### Scenario 2: Customer with Email
**Voice**: "register customer Sarah Wilson email sarah@gmail.com phone 9988776655"
**Result**:
- ✅ Customer "Sarah Wilson" added to CRM
- 📱 Phone: 9988776655 saved
- 📧 Email: sarah@gmail.com saved
- 🎉 Success toast: "Successfully added Sarah Wilson to CRM!"
- 🎉 Additional toast: "Email sarah@gmail.com saved for Sarah Wilson"

### Scenario 3: Duplicate Detection
**Voice**: "add customer John phone 9876543210"
**Result** (if customer exists):
- ❌ Error toast: "Customer with phone 9876543210 already exists as 'John Doe'"
- 🔍 Shows existing customer information

## Error Handling

### Voice Recognition Failures
- Fallback regex parsing for common patterns
- Graceful degradation with helpful error messages
- Retry suggestions for unclear commands

### Data Validation
- Phone number format validation (10 digits)
- Email format validation when provided
- Required field checking (name or phone must be provided)

### Database Integration
- Firestore error handling
- Network failure recovery
- Transaction safety for customer creation

## Integration Points

### Voice Service Integration
- Seamlessly integrates with existing voice command infrastructure
- Uses same AI processing pipeline as order/payment commands
- Maintains consistent voice feedback patterns

### CRM System Integration
- Full integration with CustomerService
- Maintains all existing CRM features
- Compatible with customer analytics and reporting

### Restaurant Context
- Automatically uses current restaurant context
- Maintains restaurant-specific customer databases
- No cross-restaurant data leakage

## Future Enhancements

### Potential Additions
1. **Address Capture**: "add customer John phone 123 address 123 Main St"
2. **Customer Updates**: "update customer John add email john@example.com"
3. **Customer Search**: "find customer with phone 9876543210"
4. **Preference Setting**: "set customer John preference vegetarian"
5. **Order Association**: "add customer John to table 5 order"

### Advanced Features
1. **Voice Customer Lookup**: During order taking
2. **Loyalty Point Updates**: Via voice commands
3. **Customer History**: Voice queries for past orders
4. **Bulk Operations**: Voice-driven customer management

## Testing & Validation

### Test Voice Commands
```
"add customer John Smith phone 9876543210"
"register customer Mary email mary@test.com phone 9123456789" 
"create customer David Wilson phone 9988776655"
"new customer phone 9876543210 name Sarah"
```

### Expected Behaviors
- ✅ Successful customer creation with proper data
- ✅ Duplicate detection and prevention
- ✅ Clear success/error messaging
- ✅ CRM integration verification
- ✅ Voice feedback and confirmation

## Deployment Notes

### Requirements
- Voice recognition support (Chrome/Edge recommended)
- Microphone permissions
- Active internet connection for AI processing
- Firebase Firestore access
- **Groq API Key** for advanced voice AI features

### API Key Setup
To enable advanced voice AI features and audio transcription:

1. **Get a free Groq API key**:
   - Visit https://groq.com/
   - Sign up for a free account
   - Generate an API key from your dashboard

2. **Configure environment variables**:
   - Add `VITE_GROQ_API_KEY=your_groq_api_key_here` to your environment
   - For development: Create `.env.local` file in project root
   - For production: Set environment variable in your hosting platform

3. **Verify configuration**:
   - Restart your development server
   - Voice commands will show enhanced AI processing
   - Without API key, system falls back to basic pattern matching

### Environment Variables Template
```env
# Required for advanced voice AI features
VITE_GROQ_API_KEY=your_groq_api_key_here

# Other configuration variables
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

### Security Notes
- ⚠️ **Never commit API keys to version control**
- ✅ Use environment variables for all sensitive data
- ✅ Add `.env.local` to your `.gitignore` file
- ✅ Use different API keys for development and production

### Performance Considerations
- Duplicate checking adds ~200ms to customer creation
- Voice processing typically completes in 1-3 seconds
- Network-dependent for AI command analysis
- Local fallback parsing for offline scenarios

## Support & Troubleshooting

### Common Issues
1. **Microphone not working**: Check browser permissions
2. **Commands not recognized**: Speak clearly, retry command
3. **Duplicate errors**: Check existing customer database
4. **Network issues**: Voice commands require internet connectivity

### Debug Information
- All voice commands logged to browser console
- Customer creation attempts tracked
- Error details available in console logs
- Toast messages provide real-time feedback 