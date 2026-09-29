const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\reyna\\.gemini\\antigravity-ide\\brain\\55e26e91-cf1a-4457-9b0e-675029c29935\\scratch\\page.html', 'utf16le');
console.log("Includes 'Standard Aluminum Window':", html.includes('Standard Aluminum Window'));
console.log("Includes 'product_card_placeholder':", html.includes('product_card_placeholder'));
console.log("Includes 'pub-f25f5e':", html.includes('pub-f25f5e'));

// Also try to find any img tags and their src attributes
const imgRegex = /<img[^>]+src="([^">]+)"/g;
let match;
console.log("Image sources:");
while ((match = imgRegex.exec(html)) !== null) {
  console.log(match[1]);
}
