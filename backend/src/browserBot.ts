import puppeteer, { Browser, Page } from 'puppeteer';
import type { BrowserTestResult, ProxyConfig } from './types.js';
import { formatProxyUrl } from './geoProxy.js';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: process.env.USE_HEADLESS_BROWSER !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
  }
  return browserInstance;
}

async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function simulateCheckout(
  merchantUrl: string,
  promoCode: string,
  proxy?: ProxyConfig,
  timeout: number = 30000
): Promise<BrowserTestResult> {
  const startTime = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();

    if (proxy) {
      const proxyUrl = formatProxyUrl(proxy);
      if (proxyUrl) {
        await page.authenticate({
          username: proxy.username || '',
          password: proxy.password || ''
        }).catch(() => {});
      }
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    const checkoutUrl = buildCheckoutUrl(merchantUrl);
    console.log(`Navigating to: ${checkoutUrl}`);

    await page.goto(checkoutUrl, {
      waitUntil: 'networkidle2',
      timeout
    });

    await page.waitForTimeout(2000);

    const promoInputSelectors = [
      'input[name*="promo"]',
      'input[name*="coupon"]', 
      'input[name*="discount"]',
      'input[name*="code"]',
      'input[id*="promo"]',
      'input[id*="coupon"]',
      'input[placeholder*="promo"]',
      'input[placeholder*="coupon"]',
      'input[placeholder*="code"]',
      'input[aria-label*="promo"]',
      'input[aria-label*="coupon"]'
    ];

    let promoInput: puppeteer.ElementHandle<Element> | null = null;
    for (const selector of promoInputSelectors) {
      try {
        promoInput = await page.$(selector);
        if (promoInput) break;
      } catch {
        continue;
      }
    }

    if (!promoInput) {
      return {
        success: false,
        errorMessage: 'Could not find promo code input field',
        pageLoadTime: Date.now() - startTime
      };
    }

    await promoInput.click({ clickCount: 3 });
    await promoInput.type(promoCode, { delay: 50 });

    const applyButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Apply")',
      'button:has-text("apply")',
      'input[type="submit"]',
      'button[class*="apply"]',
      'button[id*="apply"]'
    ];

    let applyButton: puppeteer.ElementHandle<Element> | null = null;
    for (const selector of applyButtonSelectors) {
      try {
        applyButton = await page.$(selector);
        if (applyButton) break;
      } catch {
        continue;
      }
    }

    if (applyButton) {
      await applyButton.click();
      await page.waitForTimeout(3000);
    }

    const priceInfo = await extractPriceInfo(page);
    const errorInfo = await extractErrorInfo(page);

    if (errorInfo) {
      return {
        success: false,
        errorMessage: errorInfo,
        pageLoadTime: Date.now() - startTime,
        ...priceInfo
      };
    }

    if (priceInfo.originalPrice && priceInfo.finalPrice) {
      const original = parseFloat(priceInfo.originalPrice.replace(/[^0-9.]/g, ''));
      const final = parseFloat(priceInfo.finalPrice.replace(/[^0-9.]/g, ''));
      
      if (final < original) {
        return {
          success: true,
          ...priceInfo,
          pageLoadTime: Date.now() - startTime
        };
      }
    }

    const successIndicators = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return {
        hasSuccess: text.includes('discount applied') || 
                    text.includes('promo applied') ||
                    text.includes('coupon applied') ||
                    text.includes('code accepted') ||
                    text.includes('saved'),
        hasError: text.includes('invalid') || 
                  text.includes('expired') || 
                  text.includes('not valid') ||
                  text.includes('does not apply')
      };
    });

    if (successIndicators.hasSuccess && !successIndicators.hasError) {
      return {
        success: true,
        ...priceInfo,
        discountText: 'Code appears to have been accepted',
        pageLoadTime: Date.now() - startTime
      };
    }

    if (successIndicators.hasError) {
      return {
        success: false,
        errorMessage: 'Code rejected or invalid',
        pageLoadTime: Date.now() - startTime
      };
    }

    return {
      success: false,
      errorMessage: 'Could not determine code status',
      pageLoadTime: Date.now() - startTime,
      ...priceInfo
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Checkout simulation failed: ${errorMessage}`);
    
    return {
      success: false,
      errorMessage,
      pageLoadTime: Date.now() - startTime
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function buildCheckoutUrl(merchantUrl: string): string {
  try {
    const url = new URL(merchantUrl);
    const checkoutPaths = ['/checkout', '/cart', '/bag', '/basket'];
    
    for (const path of checkoutPaths) {
      if (url.pathname.includes(path)) {
        return merchantUrl;
      }
    }
    
    return `${url.origin}/checkout`;
  } catch {
    return merchantUrl;
  }
}

async function extractPriceInfo(page: Page): Promise<{
  originalPrice?: string;
  finalPrice?: string;
  discountText?: string;
}> {
  try {
    const priceData = await page.evaluate(() => {
      const priceSelectors = [
        '[data-testid*="price"]',
        '[class*="price"]',
        '[id*="price"]',
        '.total',
        '.subtotal',
        '.order-total',
        '.grand-total'
      ];
      
      let originalPrice = '';
      let finalPrice = '';
      let discountText = '';
      
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent || '';
        const match = text.match(/\$\s*[\d,]+\.?\d*/);
        if (match && !originalPrice) {
          originalPrice = match[0];
        }
        if (text.toLowerCase().includes('discount') || 
            text.toLowerCase().includes('saved')) {
          discountText = text.substring(0, 100);
        }
      }
      
      return { originalPrice, finalPrice: originalPrice, discountText };
    });
    
    return priceData;
  } catch {
    return {};
  }
}

async function extractErrorInfo(page: Page): Promise<string | null> {
  try {
    const errorData = await page.evaluate(() => {
      const errorSelectors = [
        '[class*="error"]',
        '[class*="Error"]',
        '[role="alert"]',
        '.message.error',
        '.alert.error'
      ];
      
      for (const selector of errorSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const text = el.textContent.toLowerCase();
          if (text.includes('invalid') || 
              text.includes('expired') || 
              text.includes('not valid') ||
              text.includes('cannot be applied')) {
            return el.textContent.substring(0, 200);
          }
        }
      }
      return null;
    });
    
    return errorData;
  } catch {
    return null;
  }
}

export async function cleanup(): Promise<void> {
  await closeBrowser();
}

export { getBrowser, closeBrowser as closeBrowserInstance };
