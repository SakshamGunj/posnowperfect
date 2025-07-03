import{h as m,E as h}from"./index-BoqBS9EV.js";class g{static formatBillForWhatsApp(l){let i=l.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<script[^>]*>[\s\S]*?<\/script>/gi,"");i=i.replace(/<[^>]*>/g," "),i=i.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&hellip;/g,"...").replace(/&mdash;/g,"—").replace(/&ndash;/g,"–"),i=i.replace(/[ \t]+/g," ").replace(/\n\s+/g,`
`).replace(/\s+\n/g,`
`).replace(/\n{3,}/g,`

`).trim();const a=i.split(`
`).filter(r=>r.trim());let t="",n="";for(let r=0;r<a.length;r++){const e=a[r].trim();if(e){if(e.includes("Restaurant")&&r<3){t+=`🏪 *${e}*
`;continue}if(e.match(/BILL RECEIPT/i)){t+=`
📋 *BILL RECEIPT*
`,t+=`${"=".repeat(30)}
`;continue}if(e.match(/Table:/i)||e.match(/Date:/i)||e.match(/Time:/i)){t+=`📍 ${e}
`;continue}if(e.match(/Order Numbers|Combined Bill/i)){t+=`
🎫 *${e}*
`,n="orders";continue}if(n==="orders"&&e.match(/^#/)){t+=`   ${e}
`;continue}if(e.match(/ITEM|TOTAL/i)&&e.includes("TOTAL")){t+=`
🍽️ *ITEMS & TOTALS*
`,t+=`${"-".repeat(30)}
`,n="items";continue}if(n==="items"&&(e.includes("×")||e.includes("x"))){const s=e.split(/₹|\$|Rs\./);if(s.length>=2){const o=s[0].trim(),c="₹"+s[s.length-1].trim();t+=`• ${o} - ${c}
`}else t+=`• ${e}
`;continue}if(e.match(/Subtotal|Tax|TOTAL AMOUNT|Final|Grand Total/i)){e.match(/TOTAL AMOUNT|Final|Grand Total/i)?(t+=`${"-".repeat(30)}
`,t+=`💰 *${e}*
`,t+=`${"=".repeat(30)}
`):t+=`   ${e}
`,n="totals";continue}if(e.match(/Payment Details|Method:/i)){e.match(/Payment Details/i)?(t+=`
💳 *PAYMENT DETAILS*
`,t+=`${"-".repeat(30)}
`):t+=`   ${e}
`,n="payment";continue}if(e.match(/THANK YOU|Thank you/i)){t+=`
🙏 *THANK YOU!*
`,t+=`   Please visit us again!
`;continue}if(e.match(/Generated on|Date:|Time:/)){t+=`
📅 ${e}
`;continue}e.length>3&&!e.match(/Restaurant Address|^\s*$/)&&(e.match(/📞|@|www\.|\.com|Address/i)?t+=`📍 ${e}
`:n?t+=`   ${e}
`:t+=`${e}
`)}}return t=t.replace(/\n{3,}/g,`

`).replace(/^\n+|\n+$/g,"").trim(),t}static async generateBillPDF(l,i="bill.pdf"){try{const a=document.createElement("div");a.innerHTML=l,a.style.position="absolute",a.style.left="-9999px",a.style.width="800px",a.style.backgroundColor="#ffffff",a.style.padding="20px",document.body.appendChild(a);const t=await m(a,{scale:2,useCORS:!0,allowTaint:!0,backgroundColor:"#ffffff",width:800,height:a.scrollHeight});document.body.removeChild(a);const n=new h("p","mm","a4"),r=210,e=295,s=t.height*r/t.width;let o=s,c=0;for(n.addImage(t.toDataURL("image/png"),"PNG",0,c,r,s),o-=e;o>=0;)c=o-s,n.addPage(),n.addImage(t.toDataURL("image/png"),"PNG",0,c,r,s),o-=e;n.save(i)}catch(a){throw console.error("Error generating PDF:",a),new Error("Failed to generate PDF. Please try again.")}}static formatPhoneNumber(l,i="91"){const a=l.replace(/[^0-9]/g,"");if(a.length===10)return i+a;if(a.length===12&&a.startsWith("91"))return a;if(a.length===11&&a.startsWith("0"))return i+a.substring(1);if(a.length>=10)return a;throw new Error("Invalid phone number format")}static createWhatsAppUrl(l,i,a=!1){const t=this.formatPhoneNumber(l),n=encodeURIComponent(i);return a?`https://web.whatsapp.com/send?phone=${t}&text=${n}`:`https://wa.me/${t}?text=${n}`}static generateBillMessage(l){const{restaurantName:i,tableNumber:a,orderNumbers:t,totalAmount:n,billContent:r}=l,e=this.formatBillForWhatsApp(r);return`🍽️ *${i}* - Bill Receipt

📋 *Order Details:*
Table: ${a}
Order(s): ${t.join(", ")}
Total Amount: ₹${n.toFixed(2)}

💳 Payment Status: Completed ✅

📄 *Detailed Bill:*
${e}

Thank you for dining with us! 🙏

---
Generated on ${new Date().toLocaleString("en-IN")}`}static generatePDFSharingMessage(l){const{restaurantName:i,tableNumber:a,orderNumbers:t,totalAmount:n}=l;return`🍽️ *${i}* - Bill Receipt

📋 *Order Details:*
Table: ${a}
Order(s): ${t.join(", ")}
Total Amount: ₹${n.toFixed(2)}

💳 Payment Status: Completed ✅

📄 PDF bill has been downloaded to your device. Please attach it to this WhatsApp chat.

Thank you for dining with us! 🙏

---
Generated on ${new Date().toLocaleString("en-IN")}`}}export{g as WhatsAppUtils};
