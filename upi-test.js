const QRCode = require('qrcode');

// Test UPI QR code generation
async function testUPIQRCode() {
  try {
    console.log('Testing UPI QR Code generation...');
    
    // Sample UPI payment string
    const upiString = 'upi://pay?pa=test@upi&pn=Test Restaurant&tn=Payment for Table 1&am=100&cu=INR';
    console.log('UPI String:', upiString);
    
    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(upiString, {
      width: 150,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 1.0
    });
    
    if (qrCodeDataURL && qrCodeDataURL.startsWith('data:image/png;base64,')) {
      console.log('✅ QR Code generated successfully!');
      console.log('Data URL length:', qrCodeDataURL.length);
      console.log('First 100 characters:', qrCodeDataURL.substring(0, 100));
    } else {
      console.log('❌ Failed to generate QR Code');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testUPIQRCode(); 