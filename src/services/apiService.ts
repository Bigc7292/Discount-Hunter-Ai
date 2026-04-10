import type { CodeStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_VERIFIER_API_URL || 'http://localhost:3001';

interface VerifyCode {
  code: string;
  description: string;
  source?: string;
  sourceUrl?: string;
}

interface Merchant {
  name: string;
  url: string;
}

interface VerifyRequest {
  merchant: Merchant;
  codes: VerifyCode[];
  testRegion: string;
}

export interface CodeVerificationResult {
  code: string;
  status: CodeStatus;
  confidence: number;
  testedRegion: string;
  testedAt: string;
  codeDescription?: string;
  source?: string;
  errorMessage?: string;
}

export interface VerificationResponse {
  merchant: { name: string; url: string; region: string };
  results: CodeVerificationResult[];
  totalTested: number;
  successful: number;
  failed: number;
  unverified: number;
  processingTimeMs: number;
}

export async function verifyCodes(
  merchant: Merchant,
  codes: VerifyCode[],
  testRegion: string
): Promise<VerificationResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: {
          name: merchant.name,
          url: merchant.url,
          region: testRegion,
        },
        codes: codes.map(c => ({
          code: c.code,
          description: c.description,
          source: c.source || 'Unknown',
          sourceUrl: c.sourceUrl,
        })),
        testRegion,
      }),
    });

    if (!response.ok) {
      console.error(`Verifier error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Verifier service unavailable:', error);
    return null;
  }
}

export async function checkVerifierHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getSupportedRegions(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/regions`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.regions || [];
  } catch {
    return [];
  }
}
