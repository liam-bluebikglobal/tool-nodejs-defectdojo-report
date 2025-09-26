const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DEFECTDOJO_URL = process.env.DEFECTDOJO_URL;
const USERNAME = process.env.DEFECTDOJO_USERNAME;
const PASSWORD = process.env.DEFECTDOJO_PASSWORD;

class DefectDojoLatestEngagementAutomation {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.headless = options.headless ?? false;
    this.outputDir = options.outputDir ?? './reports';
    this.filenameTemplate = options.filenameTemplate ?? '{moduleName}_findings_{version}.xlsx';
    this.results = [];
    this.isLoggedIn = false;
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--ignore-certificate-errors', '--ignore-ssl-errors']
    });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
      acceptDownloads: true
    });

    this.page = await this.context.newPage();

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async login() {
    if (this.isLoggedIn) {
      return true;
    }

    try {
      await this.page.goto(`${DEFECTDOJO_URL}/login`);
      await this.page.getByRole('textbox', { name: 'Username*' }).fill(USERNAME);
      await this.page.getByRole('textbox', { name: 'Password*' }).fill(PASSWORD);
      await this.page.getByRole('button', { name: 'Login' }).click();
      await this.page.waitForLoadState('networkidle');

      this.isLoggedIn = true;
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async extractEngagementIdFromUrl() {
    const url = this.page.url();
    const match = url.match(/\/engagement\/(\d+)/);
    return match ? match[1] : null;
  }

  async processProduct(productName) {
    console.log(`📦 Processing: ${productName}`);

    const result = {
      productName,
      timestamp: new Date().toISOString(),
      success: false,
      engagementId: null,
      engagementVersion: null,
      moduleName: null,
      excelPath: null,
      error: null
    };

    try {
      // Navigate to Products and search
      await this.page.getByRole('link', { name: 'Products', exact: true }).click();
      await this.page.waitForLoadState('networkidle');

      await this.page.getByRole('searchbox', { name: 'Search:' }).click();
      await this.page.locator('#show-filters').click();
      await this.page.waitForTimeout(500);

      await this.page.getByRole('textbox', { name: 'Product Name', exact: true }).click();
      await this.page.getByRole('textbox', { name: 'Product Name', exact: true }).fill(productName);
      await this.page.getByRole('button', { name: ' Apply Filters' }).click();
      await this.page.waitForLoadState('networkidle');

      // Check if any products were found
      const noProductsMessage = await this.page.locator('text=No products found').count();
      if (noProductsMessage > 0) {
        console.log(`⚠️ ${productName} - No products found, skipping`);
        result.success = true;
        result.error = 'Product not found in DefectDojo';
        return result;
      }

      // Click on product
      const productFirstPart = productName.split('/').slice(0, 3).join('/');
      await this.page.getByRole('link', { name: productFirstPart }).click();
      await this.page.waitForLoadState('networkidle');

      // Navigate to Engagements
      const engagementLinks = await this.page.getByRole('link').all();
      for (const link of engagementLinks) {
        const text = await link.textContent();
        const cleanText = text ? text.replace(/\s+/g, ' ').trim() : '';
        if (cleanText && /^Engagements \d+/.test(cleanText)) {
          await link.click();
          break;
        }
      }
      await this.page.waitForLoadState('networkidle');

      await this.page.getByRole('link', { name: ' View Engagements' }).click();
      await this.page.waitForLoadState('networkidle');

      // Select latest engagement
      await this.page.waitForSelector('#open tbody tr', { state: 'visible', timeout: 10000 });
      await this.page.waitForTimeout(2000);

      const latestEngagementSelector = '#open > tbody > tr:nth-child(1) > td:nth-child(2) > a';
      await this.page.waitForSelector(latestEngagementSelector, { state: 'visible' });

      const engagementText = await this.page.locator(latestEngagementSelector).textContent();
      result.engagementVersion = engagementText?.trim();

      const pathParts = productName.split('/');
      result.moduleName = pathParts[pathParts.length - 1];

      await this.page.click(latestEngagementSelector);
      await this.page.waitForLoadState('networkidle');

      // Extract engagement ID
      result.engagementId = await this.extractEngagementIdFromUrl();
      if (!result.engagementId) {
        throw new Error('Could not extract engagement ID');
      }

      // Navigate to Open Findings and filter
      await this.page.goto(`${DEFECTDOJO_URL}/finding/open`);
      await this.page.waitForLoadState('networkidle');

      await this.page.locator('html').click();
      await this.page.waitForTimeout(500);

      await this.page.getByRole('button', { name: 'show-filters' }).click();
      await this.page.waitForTimeout(500);

      await this.page.locator('div:nth-child(13) > .dropdown > .btn').click();
      await this.page.waitForTimeout(500);

      await this.page.getByRole('combobox', { name: 'Search' }).fill(result.engagementId);
      await this.page.waitForTimeout(1500);

      // Click engagement option using XPath
      const xpathSelector = '/html/body/div[5]/div/div[2]/ul/li/a/span[2]';
      await this.page.waitForSelector(`xpath=${xpathSelector}`, { state: 'visible', timeout: 5000 });

      const xpathElement = this.page.locator(`xpath=${xpathSelector}`);
      const xpathText = await xpathElement.textContent();

      if (xpathText && xpathText.includes(result.engagementId)) {
        await xpathElement.click();
      } else {
        // Fallback: search all options
        const options = await this.page.getByRole('option').all();
        for (const option of options) {
          const text = await option.textContent();
          if (text && text.includes(result.engagementId)) {
            await option.click();
            break;
          }
        }
      }

      await this.page.waitForTimeout(500);
      await this.page.locator('html').click();
      await this.page.waitForTimeout(500);

      await this.page.getByRole('button', { name: ' Apply Filters' }).click();
      await this.page.waitForLoadState('networkidle');

      // Export to Excel (always attempt, even with no findings)
      const findingsCount = await this.page.locator('tbody tr').count();

      await this.page.getByRole('button', { name: 'dropdown-menu', exact: true }).click();
      await this.page.waitForTimeout(1000);

      try {
        const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 });
        await this.page.getByRole('link', { name: ' Excel Export' }).click();

        const download = await downloadPromise;
        const fileName = this.filenameTemplate
          .replace('{moduleName}', result.moduleName)
          .replace('{version}', result.engagementVersion);
        const filePath = path.join(this.outputDir, fileName);

        await download.saveAs(filePath);
        result.excelPath = filePath;
        result.success = true;

        if (findingsCount === 0) {
          console.log(`✅ ${fileName} (no findings)`);
        } else {
          console.log(`✅ ${fileName} (${findingsCount} findings)`);
        }

      } catch (downloadError) {
        result.success = true;
        if (findingsCount === 0) {
          result.error = 'No findings found - export may have timed out';
        } else {
          result.error = 'Export clicked but download timed out';
        }
        console.log(`⚠️ ${result.moduleName}_${result.engagementVersion} - export timeout`);
      }

    } catch (error) {
      console.error(`❌ Error processing ${productName}:`, error.message);
      result.error = error.message;
    }

    return result;
  }

  async processMultipleProducts(productNames) {
    console.log(`🎯 Starting automation for ${productNames.length} products`);

    await this.initialize();

    const loginSuccess = await this.login();
    if (!loginSuccess) {
      throw new Error('Failed to login to DefectDojo');
    }

    this.results = [];

    for (const productName of productNames) {
      const result = await this.processProduct(productName);
      this.results.push(result);
      await this.page.waitForTimeout(2000);
    }

    await this.saveResultsSummary();
    await this.cleanup();

    return this.results;
  }

  async saveResultsSummary() {
    // Delete previous summary reports
    const files = fs.readdirSync(this.outputDir);
    const summaryFiles = files.filter(file => file.startsWith('summary_') && file.endsWith('.json'));

    summaryFiles.forEach(file => {
      const filePath = path.join(this.outputDir, file);
      fs.unlinkSync(filePath);
    });

    // Create new summary with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const summaryPath = path.join(this.outputDir, `summary_${timestamp}.json`);

    const summary = {
      timestamp: new Date().toISOString(),
      totalProducts: this.results.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      results: this.results
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 Latest summary saved to: ${this.outputDir}`);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function automateDefectDojo(productNames, options = {}) {
  const automation = new DefectDojoLatestEngagementAutomation(options);

  try {
    const results = await automation.processMultipleProducts(productNames);

    console.log('\n📈 AUTOMATION COMPLETED');
    console.log(`Total products: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);

    if (results.filter(r => !r.success).length > 0) {
      console.log('\n❌ Failed products:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.productName}: ${r.error}`);
      });
    }

    return results;
  } catch (error) {
    console.error('❌ Automation failed:', error.message);
    throw error;
  }
}

module.exports = {
  DefectDojoLatestEngagementAutomation,
  automateDefectDojo
};

if (require.main === module) {
  const productsString = process.env.PRODUCTS || '';
  const products = productsString
    .replace(/\n/g, ',') // Convert newlines to commas
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0 && !p.startsWith('#')); // Ignore commented lines

  if (products.length === 0) {
    console.error('❌ No products configured in .env file');
    process.exit(1);
  }

  const options = {
    headless: process.env.HEADLESS_MODE === 'true',
    outputDir: process.env.OUTPUT_DIR || './reports',
    filenameTemplate: process.env.FILENAME_TEMPLATE || undefined
  };

  automateDefectDojo(products, options)
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}