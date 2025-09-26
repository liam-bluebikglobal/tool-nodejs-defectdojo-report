require('dotenv').config();
const { automateDefectDojo } = require('./defectdojo_latest_engagement_automation');

// Read products from environment variable
const productsString = process.env.PRODUCTS || '';
const products = productsString
  .replace(/\n/g, ',') // Convert newlines to commas
  .split(',')
  .map(product => product.trim())
  .filter(product => product.length > 0 && !product.startsWith('#')); // Ignore commented lines

if (products.length === 0) {
  console.error('❌ No products found in .env file');
  console.log('Please add products to the PRODUCTS variable in .env file');
  console.log('Example: PRODUCTS=product1,product2,product3');
  process.exit(1);
}

// Read configuration from environment variables
const options = {
  headless: process.env.HEADLESS_MODE === 'true',
  outputDir: process.env.OUTPUT_DIR || './defectdojo_reports'
};

// Display configuration
console.log('🔧 Configuration:');
console.log(`  - DefectDojo URL: ${process.env.DEFECTDOJO_URL}`);
console.log(`  - Headless mode: ${options.headless}`);
console.log(`  - Output directory: ${options.outputDir}`);
console.log(`  - Products to process: ${products.length}`);
products.forEach((product, index) => {
  console.log(`    ${index + 1}. ${product}`);
});
console.log('');

// Run the automation
automateDefectDojo(products, options)
  .then(results => {
    console.log('\n✅ Automation completed successfully!');
    console.log(`📁 Check the ${options.outputDir} folder for the exported Excel files.`);
  })
  .catch(error => {
    console.error('\n❌ Automation failed:', error.message);
    process.exit(1);
  });