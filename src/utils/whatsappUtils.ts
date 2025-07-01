import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export class WhatsAppUtils {
  /**
   * Clean HTML content and format it for WhatsApp
   */
  static formatBillForWhatsApp(htmlContent: string): string {
    // First, remove style and script blocks completely (including their content)
    let cleanText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Remove all HTML tags but preserve their content
    cleanText = cleanText.replace(/<[^>]*>/g, ' ');
    
    // Replace HTML entities
    cleanText = cleanText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, '...')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');
    
    // Clean up excessive whitespace while preserving structure
    cleanText = cleanText
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/\n\s+/g, '\n') // Remove spaces at beginning of lines
      .replace(/\s+\n/g, '\n') // Remove spaces at end of lines
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with max 2
      .trim();

    // Structure the bill content properly for WhatsApp
    const lines = cleanText.split('\n').filter(line => line.trim());
    let formattedBill = '';
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines or pure whitespace
      if (!line) continue;
      
      // Format restaurant name and header
      if (line.includes('Restaurant') && i < 3) {
        formattedBill += `🏪 *${line}*\n`;
        continue;
      }
      
      // Format bill receipt header
      if (line.match(/BILL RECEIPT/i)) {
        formattedBill += `\n📋 *BILL RECEIPT*\n`;
        formattedBill += `${'='.repeat(30)}\n`;
        continue;
      }
      
      // Format table, date, time info
      if (line.match(/Table:/i) || line.match(/Date:/i) || line.match(/Time:/i)) {
        formattedBill += `📍 ${line}\n`;
        continue;
      }
      
      // Format order numbers section
      if (line.match(/Order Numbers|Combined Bill/i)) {
        formattedBill += `\n🎫 *${line}*\n`;
        currentSection = 'orders';
        continue;
      }
      
      // Format order entries
      if (currentSection === 'orders' && line.match(/^#/)) {
        formattedBill += `   ${line}\n`;
        continue;
      }
      
      // Format items section
      if (line.match(/ITEM|TOTAL/i) && line.includes('TOTAL')) {
        formattedBill += `\n🍽️ *ITEMS & TOTALS*\n`;
        formattedBill += `${'-'.repeat(30)}\n`;
        currentSection = 'items';
        continue;
      }
      
      // Format individual items
      if (currentSection === 'items' && (line.includes('×') || line.includes('x'))) {
        // Extract item details
        const parts = line.split(/₹|\$|Rs\./);
        if (parts.length >= 2) {
          const itemPart = parts[0].trim();
          const pricePart = '₹' + parts[parts.length - 1].trim();
          formattedBill += `• ${itemPart} - ${pricePart}\n`;
        } else {
          formattedBill += `• ${line}\n`;
        }
        continue;
      }
      
      // Format subtotal and totals
      if (line.match(/Subtotal|Tax|TOTAL AMOUNT|Final|Grand Total/i)) {
        if (line.match(/TOTAL AMOUNT|Final|Grand Total/i)) {
          formattedBill += `${'-'.repeat(30)}\n`;
          formattedBill += `💰 *${line}*\n`;
          formattedBill += `${'='.repeat(30)}\n`;
        } else {
          formattedBill += `   ${line}\n`;
        }
        currentSection = 'totals';
        continue;
      }
      
      // Format payment details
      if (line.match(/Payment Details|Method:/i)) {
        if (line.match(/Payment Details/i)) {
          formattedBill += `\n💳 *PAYMENT DETAILS*\n`;
          formattedBill += `${'-'.repeat(30)}\n`;
        } else {
          formattedBill += `   ${line}\n`;
        }
        currentSection = 'payment';
        continue;
      }
      
      // Format thank you message
      if (line.match(/THANK YOU|Thank you/i)) {
        formattedBill += `\n🙏 *THANK YOU!*\n`;
        formattedBill += `   Please visit us again!\n`;
        continue;
      }
      
      // Format timestamp
      if (line.match(/Generated on|Date:|Time:/)) {
        formattedBill += `\n📅 ${line}\n`;
        continue;
      }
      
      // For any other important lines (like addresses, phone numbers)
      if (line.length > 3 && !line.match(/Restaurant Address|^\s*$/)) {
        // If it looks like contact info or address
        if (line.match(/📞|@|www\.|\.com|Address/i)) {
          formattedBill += `📍 ${line}\n`;
        } else if (currentSection) {
          // Add to current section with proper indentation
          formattedBill += `   ${line}\n`;
        } else {
          // General content
          formattedBill += `${line}\n`;
        }
      }
    }
    
    // Final cleanup and ensure proper spacing
    formattedBill = formattedBill
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .replace(/^\n+|\n+$/g, '') // Remove leading/trailing newlines
      .trim();
    
    return formattedBill;
  }

  /**
   * Generate PDF from HTML content
   */
  static async generateBillPDF(htmlContent: string, fileName: string = 'bill.pdf'): Promise<void> {
    try {
      // Create a temporary div to render HTML content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.padding = '20px';
      document.body.appendChild(tempDiv);

      // Convert HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.scrollHeight
      });

      // Remove temporary div
      document.body.removeChild(tempDiv);

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download the PDF
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF. Please try again.');
    }
  }

  /**
   * Validate and format phone number for WhatsApp
   */
  static formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '91'): string {
    // Remove all non-numeric characters
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // Handle different number formats
    if (cleanNumber.length === 10) {
      // Indian 10-digit number, add country code
      return defaultCountryCode + cleanNumber;
    } else if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
      // Already has Indian country code
      return cleanNumber;
    } else if (cleanNumber.length === 11 && cleanNumber.startsWith('0')) {
      // Number with leading 0, remove it and add country code
      return defaultCountryCode + cleanNumber.substring(1);
    } else if (cleanNumber.length >= 10) {
      // Assume it's an international number
      return cleanNumber;
    }
    
    throw new Error('Invalid phone number format');
  }

  /**
   * Create WhatsApp URL with message
   */
  static createWhatsAppUrl(phoneNumber: string, message: string, useWeb: boolean = false): string {
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    const encodedMessage = encodeURIComponent(message);
    
    if (useWeb) {
      // Use WhatsApp Web directly
      return `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodedMessage}`;
    } else {
      // Use wa.me (opens app or web based on device/preference)
      return `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
    }
  }

  /**
   * Generate formatted bill message for WhatsApp
   */
  static generateBillMessage(data: {
    restaurantName: string;
    tableNumber: string;
    orderNumbers: string[];
    totalAmount: number;
    billContent: string;
  }): string {
    const { restaurantName, tableNumber, orderNumbers, totalAmount, billContent } = data;
    
    const cleanBillContent = this.formatBillForWhatsApp(billContent);
    
    return `🍽️ *${restaurantName}* - Bill Receipt

📋 *Order Details:*
Table: ${tableNumber}
Order(s): ${orderNumbers.join(', ')}
Total Amount: ₹${totalAmount.toFixed(2)}

💳 Payment Status: Completed ✅

📄 *Detailed Bill:*
${cleanBillContent}

Thank you for dining with us! 🙏

---
Generated on ${new Date().toLocaleString('en-IN')}`;
  }

  /**
   * Generate short WhatsApp message for PDF sharing
   */
  static generatePDFSharingMessage(data: {
    restaurantName: string;
    tableNumber: string;
    orderNumbers: string[];
    totalAmount: number;
  }): string {
    const { restaurantName, tableNumber, orderNumbers, totalAmount } = data;
    
    return `🍽️ *${restaurantName}* - Bill Receipt

📋 *Order Details:*
Table: ${tableNumber}
Order(s): ${orderNumbers.join(', ')}
Total Amount: ₹${totalAmount.toFixed(2)}

💳 Payment Status: Completed ✅

📄 PDF bill has been downloaded to your device. Please attach it to this WhatsApp chat.

Thank you for dining with us! 🙏

---
Generated on ${new Date().toLocaleString('en-IN')}`;
  }
} 