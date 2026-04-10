import type { 
  CandidateCode, 
  MerchantInfo, 
  VerificationRequest,
  VerificationResponse,
  CodeVerificationResult 
} from './types.js';
import { getGeoLocation, formatProxyUrl } from './geoProxy.js';
import { simulateCheckout } from './browserBot.js';

interface ConfidenceFactors {
  browserTestPassed: boolean;
  responseTime: number;
  testRegion: string;
  attempts: number;
  errorMessage?: string;
}

function calculateConfidence(factors: ConfidenceFactors): number {
  let confidence = 0;

  if (factors.browserTestPassed) {
    confidence += 60;
  }

  if (factors.responseTime < 5000) {
    confidence += 15;
  } else if (factors.responseTime < 10000) {
    confidence += 10;
  } else if (factors.responseTime < 20000) {
    confidence += 5;
  }

  if (factors.attempts > 1) {
    confidence += 10;
  }

  if (factors.testRegion !== 'GLOBAL') {
    confidence += 5;
  }

  if (factors.errorMessage) {
    const error = factors.errorMessage.toLowerCase();
    if (error.includes('expired')) {
      confidence -= 30;
    } else if (error.includes('invalid')) {
      confidence -= 40;
    } else if (error.includes('minimum')) {
      confidence -= 20;
    } else if (error.includes('not applicable')) {
      confidence -= 25;
    }
  }

  return Math.max(0, Math.min(100, confidence));
}

function determineStatus(
  success: boolean, 
  confidence: number, 
  errorMessage?: string
): CodeVerificationResult['status'] {
  if (!success) {
    if (errorMessage) {
      const error = errorMessage.toLowerCase();
      if (error.includes('expired')) return 'expired';
      if (error.includes('invalid') || error.includes('rejected')) return 'failed';
    }
    return 'error';
  }

  if (confidence < 30) return 'unverified';
  if (confidence >= 85) return 'verified';
  
  return 'unverified';
}

async function verifySingleCode(
  merchant: MerchantInfo,
  candidate: CandidateCode,
  region: string,
  maxRetries: number = 1
): Promise<CodeVerificationResult> {
  const geo = getGeoLocation(region);
  const proxy = geo.proxy;
  let lastError: string | undefined;
  let success = false;
  let responseTime = 0;
  let discountApplied: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await simulateCheckout(
        merchant.url,
        candidate.code,
        proxy,
        30000
      );

      responseTime = result.pageLoadTime;
      discountApplied = result.discountText;

      if (result.success) {
        success = true;
        break;
      }

      if (result.errorMessage) {
        lastError = result.errorMessage;
        
        if (lastError.toLowerCase().includes('could not find')) {
          break;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Verification failed';
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  const confidenceFactors: ConfidenceFactors = {
    browserTestPassed: success,
    responseTime,
    testRegion: region,
    attempts: maxRetries + 1,
    errorMessage: lastError
  };

  const confidence = calculateConfidence(confidenceFactors);
  const status = determineStatus(success, confidence, lastError);

  return {
    code: candidate.code,
    status,
    confidence,
    discountApplied,
    errorMessage: lastError,
    testedAt: new Date().toISOString(),
    testRegion: region,
    responseTime,
    terms: extractTerms(candidate.description)
  };
}

function extractTerms(description: string): string[] {
  const terms: string[] = [];
  
  const minSpend = description.match(/min\.?\s*spend.*?\$?\d+/i);
  if (minSpend) terms.push(minSpend[0]);
  
  const percentMatch = description.match(/\d+\s*%/);
  if (percentMatch) terms.push(`Save ${percentMatch[0]}`);
  
  const expiryMatch = description.match(/exp(?:ires?|iry).*?\d+/i);
  if (expiryMatch) terms.push(expiryMatch[0]);
  
  const newCustomer = description.match(/new\s*custom(?:er|ers?)/i);
  if (newCustomer) terms.push('New customers only');

  return terms;
}

export async function verifyCodes(
  request: VerificationRequest
): Promise<VerificationResponse> {
  const { merchant, codes, testRegion } = request;
  
  console.log(`Starting verification for ${merchant.name} in ${testRegion} region`);
  console.log(`Testing ${codes.length} candidate codes`);

  const results: CodeVerificationResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const candidate of codes) {
    console.log(`Verifying code: ${candidate.code}`);
    
    const result = await verifySingleCode(merchant, candidate, testRegion);
    results.push(result);

    if (result.status === 'verified') {
      successful++;
      console.log(`✓ Code ${candidate.code} VERIFIED (confidence: ${result.confidence}%)`);
    } else if (result.status === 'failed' || result.status === 'expired') {
      failed++;
      console.log(`✗ Code ${candidate.code} ${result.status}`);
    } else {
      console.log(`? Code ${candidate.code} unverified (confidence: ${result.confidence}%)`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const response: VerificationResponse = {
    merchant,
    results,
    totalTested: codes.length,
    successful,
    failed,
    testedAt: new Date().toISOString(),
    region: testRegion
  };

  console.log(`\nVerification complete: ${successful}/${codes.length} successful`);

  return response;
}

export async function verifySingleCodePublic(
  merchantUrl: string,
  code: string,
  region: string = 'US'
): Promise<CodeVerificationResult> {
  const merchant: MerchantInfo = {
    name: new URL(merchantUrl).hostname,
    url: merchantUrl,
    region
  };

  const candidate: CandidateCode = {
    code,
    description: 'Direct verification request',
    source: 'API',
    discoveredAt: new Date().toISOString()
  };

  return verifySingleCode(merchant, candidate, region);
}
