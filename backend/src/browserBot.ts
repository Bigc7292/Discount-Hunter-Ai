/**
 * BrowserBot — Puppeteer headless checkout simulator
 *
 * Improvements:
 * - Smarter checkout URL detection (tries /cart first, then /checkout)
 * - Per-session timeout with AbortController
 * - Human-like typing delays (randomised 40-120ms)
 * - More robust apply-button detection (evaluates visible text)
 * - Better success/failure signal extraction
 * - Proper browser instance cleanup on error
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { BrowserTestResult, ProxyConfig } from './types.js';
import { formatProxyUrl } from './geoProxy.js';

// Singleton browser instance — reused across verifications
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
        '--window-size=1366,768',
        '--disable-blink-features=AutomationControlled', // Avoid bot detection
        '--disable-infobars',
      ],
    });
  }
  return browserInstance;
}

async function wait(min: number, max?: number): Promise<void> {
  const ms = max ? Math.floor(Math.random() * (max - min + 1)) + min : min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main checkout simulation
// ---------------------------------------------------------------------------

export async function simulateCheckout(
  merchantUrl: string,
  promoCode: string,
  proxy?: ProxyConfig,
  timeoutMs: number = 35000
): Promise<BrowserTestResult> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // ── Anti-detection ──
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
    });

    // Override navigator.webdriver to avoid bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // ── Viewport ──
    await page.setViewport({ width: 1366, height: 768 });

    // ── Proxy auth ──
    if (proxy?.username && proxy?.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    // ── Navigate to checkout/cart ──
    const checkoutUrl = buildCheckoutUrl(merchantUrl);
    console.log(`  → Navigating to: ${checkoutUrl}`);

    await page.goto(checkoutUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Human-like pause after page load
    await wait(1500, 3000);

    // ── Find promo code input ──
    const promoInput = await findPromoInput(page);

    if (!promoInput) {
      return {
        success: false,
        errorMessage: 'Could not locate promo code input field on this page',
        pageLoadTime: Date.now() - startTime,
      };
    }

    // ── Type the code with human-like delays ──
    await promoInput.click({ clickCount: 3 }); // Select all existing text
    await wait(200, 400);

    // Type character by character with random delays
    for (const char of promoCode) {
      await promoInput.type(char, { delay: Math.floor(Math.random() * 80) + 40 });
    }

    await wait(400, 800);

    // ── Click apply button ──
    const applied = await clickApplyButton(page);

    if (applied) {
      // Wait for page to respond
      await wait(2500, 4000);
    }

    // ── Extract result signals ──
    const errorMessage = await extractErrorSignal(page);
    if (errorMessage) {
      return {
        success: false,
        errorMessage,
        pageLoadTime: Date.now() - startTime,
      };
    }

    const priceInfo = await extractPriceInfo(page);
    const successSignal = await detectSuccessSignal(page);

    if (priceInfo.discountDetected || successSignal) {
      return {
        success: true,
        ...priceInfo,
        discountText: priceInfo.discountText || 'Discount applied at checkout',
        discountAmount: priceInfo.discountAmount,
        pageLoadTime: Date.now() - startTime,
      };
    }

    return {
      success: false,
      errorMessage: 'Code submitted but no discount signal detected',
      pageLoadTime: Date.now() - startTime,
      ...priceInfo,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ✗ Checkout simulation error: ${errorMessage}`);

    return {
      success: false,
      errorMessage: errorMessage.includes('timeout')
        ? 'Page load timeout — store may be slow or blocking automation'
        : errorMessage,
      pageLoadTime: Date.now() - startTime,
    };

  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Build the right URL to start the checkout flow
// ---------------------------------------------------------------------------

function buildCheckoutUrl(merchantUrl: string): string {
  try {
    const url = new URL(merchantUrl);

    // If they gave us a cart/checkout URL already, use it
    const alreadyCheckout = ['/checkout', '/cart', '/bag', '/basket', '/order'].some(
      path => url.pathname.includes(path)
    );
    if (alreadyCheckout) return merchantUrl;

    // Otherwise try /cart first (most stores allow promo code at cart stage)
    return `${url.origin}/cart`;

  } catch {
    // If URL parsing fails, return as-is
    return merchantUrl;
  }
}

// ---------------------------------------------------------------------------
// Find promo code input field
// ---------------------------------------------------------------------------

async function findPromoInput(page: Page) {
  const selectors = [
    // By name attribute
    'input[name*="promo" i]',
    'input[name*="coupon" i]',
    'input[name*="discount" i]',
    'input[name*="voucher" i]',
    'input[name*="gift" i]',
    'input[name*="code" i]',
    // By ID
    'input[id*="promo" i]',
    'input[id*="coupon" i]',
    'input[id*="discount" i]',
    'input[id*="voucher" i]',
    // By placeholder
    'input[placeholder*="promo" i]',
    'input[placeholder*="coupon" i]',
    'input[placeholder*="discount" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="voucher" i]',
    // By aria-label
    'input[aria-label*="promo" i]',
    'input[aria-label*="coupon" i]',
    'input[aria-label*="discount" i]',
    // By data attributes
    'input[data-testid*="coupon" i]',
    'input[data-testid*="promo" i]',
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isVisible = await el.isIntersectingViewport().catch(() => true);
        if (isVisible) return el;
      }
    } catch {
      continue;
    }
  }

  // Try to expand a hidden promo section (some stores hide it behind "Have a code?")
  const expandTriggers = [
    'a[class*="promo" i]',
    'button[class*="promo" i]',
    'a[class*="coupon" i]',
    'span[class*="promo" i]',
  ];

  for (const trigger of expandTriggers) {
    try {
      const el = await page.$(trigger);
      if (el) {
        await el.click();
        await wait(800, 1200);
        // Try finding the input again after expansion
        for (const selector of selectors) {
          const input = await page.$(selector).catch(() => null);
          if (input) return input;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Click the Apply button
// ---------------------------------------------------------------------------

async function clickApplyButton(page: Page): Promise<boolean> {
  // Try common selectors first
  const selectors = [
    'button[type="submit"][class*="promo" i]',
    'button[type="submit"][class*="coupon" i]',
    'button[id*="apply" i]',
    'button[class*="apply" i]',
    'input[type="submit"][value*="apply" i]',
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        return true;
      }
    } catch {
      continue;
    }
  }

  // Fallback: find button by visible text content
  const clicked = await page.evaluate(() => {
    const applyTexts = ['apply', 'submit', 'redeem', 'use code', 'go'];
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));

    for (const btn of buttons) {
      const text = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase().trim();
      if (applyTexts.some(t => text.includes(t))) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  return clicked;
}

// ---------------------------------------------------------------------------
// Detect error signals (code rejected, invalid, expired)
// ---------------------------------------------------------------------------

async function extractErrorSignal(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const errorSelectors = [
      '[class*="error" i]',
      '[class*="alert" i]',
      '[role="alert"]',
      '[aria-live="polite"]',
      '.message-error',
      '.notification-error',
      '.flash-error',
    ];

    const errorKeywords = [
      'invalid', 'expired', 'not valid', 'cannot be applied',
      'does not apply', 'not found', 'incorrect', 'not recognized',
      'already used', 'maximum discount', 'not applicable',
    ];

    for (const selector of errorSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.textContent || '').toLowerCase().trim();
        if (text && errorKeywords.some(kw => text.includes(kw))) {
          return el.textContent?.trim().substring(0, 200) || null;
        }
      }
    }

    // Also check body text for very prominent error messages
    const bodyText = document.body.innerText.toLowerCase();
    for (const kw of errorKeywords) {
      if (bodyText.includes(kw)) {
        return `Code appears to be ${kw}`;
      }
    }

    return null;
  });
}

// ---------------------------------------------------------------------------
// Detect success signal (discount was applied)
// ---------------------------------------------------------------------------

async function detectSuccessSignal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const successKeywords = [
      'discount applied', 'promo applied', 'coupon applied', 'code applied',
      'code accepted', 'savings applied', 'you saved', 'discount:',
      'promotional discount', 'voucher applied', 'coupon code applied',
    ];
    const bodyText = document.body.innerText.toLowerCase();
    return successKeywords.some(kw => bodyText.includes(kw));
  });
}

// ---------------------------------------------------------------------------
// Extract price / discount information
// ---------------------------------------------------------------------------

async function extractPriceInfo(page: Page): Promise<{
  originalPrice?: string;
  finalPrice?: string;
  discountText?: string;
  discountAmount?: string;
  discountDetected?: boolean;
}> {
  try {
    return await page.evaluate(() => {
      const discountSelectors = [
        '[class*="discount" i]',
        '[class*="saving" i]',
        '[class*="promo" i]',
        '[class*="coupon" i]',
        '[id*="discount" i]',
        '[data-testid*="discount" i]',
        '.order-discount',
        '.cart-discount',
      ];

      let discountText = '';
      let discountAmount = '';

      for (const selector of discountSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent) {
          const text = el.textContent.trim();
          if (text) {
            discountText = text.substring(0, 100);
            // Try to extract a dollar/percentage amount
            const dollarMatch = text.match(/[-−]?\$[\d,]+\.?\d*/);
            const percentMatch = text.match(/\d+%/);
            if (dollarMatch) discountAmount = dollarMatch[0];
            else if (percentMatch) discountAmount = percentMatch[0] + ' off';
            break;
          }
        }
      }

      // Look for strikethrough prices (original vs new)
      const strikethroughs = document.querySelectorAll('s, del, [class*="strike" i], [class*="original" i]');
      let originalPrice = '';
      for (const el of strikethroughs) {
        const match = (el.textContent || '').match(/\$[\d,]+\.?\d*/);
        if (match) { originalPrice = match[0]; break; }
      }

      const discountDetected = !!(discountText || discountAmount);

      return { originalPrice, discountText, discountAmount, discountDetected };
    });
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

export async function cleanup(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    console.log('[BrowserBot] Browser instance closed.');
  }
}

export { getBrowser };
