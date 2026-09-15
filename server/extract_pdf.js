const { PDFParse } = require('pdf-parse');
const fs = require('fs');

const buf = fs.readFileSync('../Niirerevise plawminay-Chapter-1-3.pdf');
const parser = new PDFParse({ data: buf });

parser.getText().then(result => {
  const pages = result.pages;
  console.log('Total pages:', result.total || pages.length);
  
  // Print pages 50-93 (rest of Chapter III and end)
  for (let i = 49; i < pages.length; i++) {
    const p = pages[i];
    const text = p.text || '';
    console.log(`\n=== PAGE ${i+1} ===`);
    console.log(text);
  }
}).catch(e => {
  console.error('Error:', e.message, e.stack);
});
