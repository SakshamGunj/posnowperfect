import QRCode from 'qrcode';

// Helper function to generate UPI payment string
export function generateUPIPaymentString(upiId: string, amount: number, name: string, note: string): string {
  // UPI payment URL format: upi://pay?pa=UPI_ID&pn=NAME&tn=NOTE&am=AMOUNT&cu=INR
  const params = new URLSearchParams({
    pa: upiId, // Payee Address (UPI ID)
    pn: name, // Payee Name
    tn: note, // Transaction Note
    am: amount.toString(), // Amount
    cu: 'INR' // Currency
  });
  
  const upiString = `upi://pay?${params.toString()}`;
  console.log('🔗 Generated UPI Payment String:', upiString);
  return upiString;
}

// Helper function to generate QR code as base64 data URL
export async function generateQRCodeDataURL(text: string): Promise<string> {
  try {
    console.log('🏷️ Generating QR Code for text:', text);
    
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: 120, // Reduced from 150px for smaller bill size
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H', // High error correction for better scanning
      type: 'image/png'
    });
    
    if (qrCodeDataURL && qrCodeDataURL.startsWith('data:image/png;base64,')) {
      console.log('✅ QR Code generated successfully!');
      return qrCodeDataURL;
    } else {
      console.error('❌ Failed to generate valid QR Code data URL');
      return '';
    }
  } catch (error) {
    console.error('❌ Error generating QR Code:', error);
    return '';
  }
} 