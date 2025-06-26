import https from 'https';
import http from 'http';

// WhatsApp API Configuration
const API_CONFIG = {
  baseUrl: 'bhashsms.com',
  endpoint: '/api/sendmsg.php',
  user: 'TENVERSE_MEDIA',
  pass: '123456',
  sender: 'BUZWAP',
  phone: '7864910648', // Target phone number
  templateName: 'billsendingtoowner',
  priority: 'wa',
  stype: 'normal',
  params: 'weekend', // Single parameter as requested
  htype: 'image', // Document type
  documentUrl: 'https://i.ibb.co/9w4vXVY/Whats-App-Image-2022-07-26-at-2-57-21-PM.jpg'
};

/**
 * Send WhatsApp document using BhashSMS API
 */
function sendWhatsAppDocument() {
  console.log('🚀 Starting WhatsApp document send test...');
  console.log('📱 Target Phone:', API_CONFIG.phone);
  console.log('📄 Template:', API_CONFIG.templateName);
  console.log('📎 Document URL:', API_CONFIG.documentUrl);
  console.log('🏷️ Params:', API_CONFIG.params);
  
  // Construct the API URL with parameters
  const queryParams = new URLSearchParams({
    user: API_CONFIG.user,
    pass: API_CONFIG.pass,
    sender: API_CONFIG.sender,
    phone: API_CONFIG.phone,
    text: API_CONFIG.templateName,
    priority: API_CONFIG.priority,
    stype: API_CONFIG.stype,
    Params: API_CONFIG.params,
    htype: API_CONFIG.htype,
    url: API_CONFIG.documentUrl
  });

  const fullUrl = `http://${API_CONFIG.baseUrl}${API_CONFIG.endpoint}?${queryParams.toString()}`;
  
  console.log('\n🔗 API Request URL:');
  console.log(fullUrl);
  console.log('\n⏳ Sending request...\n');

  // Make HTTP request
  http.get(fullUrl, (response) => {
    let data = '';

    // Collect response data
    response.on('data', (chunk) => {
      data += chunk;
    });

    // Handle response completion
    response.on('end', () => {
      console.log('✅ Response received:');
      console.log('Status Code:', response.statusCode);
      console.log('Headers:', JSON.stringify(response.headers, null, 2));
      console.log('\n📨 Response Body:');
      console.log(data);
      
      // Parse and analyze response
      try {
        // Try to parse as JSON if possible
        const jsonResponse = JSON.parse(data);
        console.log('\n📊 Parsed Response:');
        console.log(JSON.stringify(jsonResponse, null, 2));
        
        // Check for success indicators
        if (jsonResponse.status === 'success' || jsonResponse.code === '200' || data.includes('success')) {
          console.log('\n🎉 SUCCESS: WhatsApp document sent successfully!');
          console.log('✅ The automation is working correctly.');
        } else {
          console.log('\n❌ FAILED: Document send failed.');
          console.log('ℹ️ Check the response above for error details.');
        }
      } catch (e) {
        // If not JSON, check for success keywords in plain text
        const responseText = data.toLowerCase();
        if (responseText.includes('success') || responseText.includes('sent') || responseText.includes('delivered')) {
          console.log('\n🎉 SUCCESS: WhatsApp document sent successfully!');
          console.log('✅ The automation is working correctly.');
        } else if (responseText.includes('error') || responseText.includes('failed') || responseText.includes('invalid')) {
          console.log('\n❌ FAILED: Document send failed.');
          console.log('ℹ️ Response indicates an error occurred.');
        } else {
          console.log('\n⚠️ UNCLEAR: Response received but status unclear.');
          console.log('ℹ️ Please check the response body above.');
        }
      }
      
      console.log('\n📋 Test Summary:');
      console.log('- Phone Number: ' + API_CONFIG.phone);
      console.log('- Template: ' + API_CONFIG.templateName);
      console.log('- Parameters: ' + API_CONFIG.params);
      console.log('- Document Type: ' + API_CONFIG.htype);
      console.log('- Status Code: ' + response.statusCode);
      console.log('\n🔧 Next Steps:');
      console.log('If successful, you can now integrate this into your POS system.');
      console.log('If failed, check API credentials and template configuration.');
    });

  }).on('error', (error) => {
    console.error('\n❌ ERROR: Network request failed');
    console.error('Error details:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check internet connection');
    console.log('2. Verify API endpoint is accessible');
    console.log('3. Confirm API credentials are correct');
  });
}

/**
 * Test function with detailed logging
 */
function runTest() {
  console.log('='.repeat(60));
  console.log('           WHATSAPP DOCUMENT SEND TEST');
  console.log('='.repeat(60));
  console.log('📅 Test Date:', new Date().toLocaleString());
  console.log('🌐 API Provider: BhashSMS');
  console.log('📱 Service: WhatsApp Automation');
  console.log('='.repeat(60));
  
  sendWhatsAppDocument();
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test interrupted by user');
  console.log('👋 Goodbye!');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

// Run the test - ES6 module check
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

export {
  sendWhatsAppDocument,
  API_CONFIG
}; 