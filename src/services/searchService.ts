import { CouponCode, Competitor, SearchResult, SearchStatus, LogEntry } from '../types';
import { discoverCodes, generateLogMessage, findInfluencerCodes, checkGlitchProbability } from './minimaxService';

const VERIFIER_URL = import.meta.env.VITE_VERIFIER_API_URL || 'http://localhost:3001';

interface VerificationResult {
  code: string;
  status: 'verified' | 'failed' | 'expired' | 'error' | 'unverified';
  confidence: number;
  testedRegion: string;
  testedAt: string;
  codeDescription?: string;
  source?: string;
  errorMessage?: string;
}

interface VerificationResponse {
  merchant: { name: string; url: string; region: string };
  results: VerificationResult[];
  totalTested: number;
  successful: number;
  failed: number;
  unverified: number;
  processingTimeMs: number;
}

type LogHandler = (message: string, type: LogEntry['type']) => void;

export async function runSearch(
  query: string,
  region: string,
  userId: string | null,
  addLog: LogHandler,
  setStatus: (s: SearchStatus) => void,
  setResult: (r: SearchResult | null) => void,
  setInfluencerCodes: (c: CouponCode[]) => void,
  setGlitchStatus: (s: { probability: number; warning?: string } | null) => void
): Promise<void> {
  setStatus(SearchStatus.PLANNING);
  addLog(`HUNTER PROTOCOL INITIATED: "${query}" REGION: ${region || 'GLOBAL'}`, 'system');

  try {
    // PHASE 1: DISCOVERY (MiniMax AI finds potential codes)
    setStatus(SearchStatus.PLANNING);
    addLog('ACCESSING AI DISCOVERY NETWORK...', 'info');
    
    const discovery = await discoverCodes(query, region);

    if (!discovery.merchantName) {
      throw new Error("TARGET NOT IDENTIFIED");
    }

    addLog(`TARGET ACQUIRED: ${discovery.merchantName}`, 'success');

    // No codes found in discovery
    if (discovery.suggestedCodes.length === 0) {
      setStatus(SearchStatus.COMPLETE);
      setResult({
        merchantName: discovery.merchantName,
        merchantUrl: discovery.merchantUrl,
        codes: [],
        competitors: discovery.competitors,
        stats: {
          sourcesScanned: 0,
          codesTested: 0,
          timeTaken: '0s',
          moneySavedEstimate: '$0.00'
        }
      });
      addLog('ZERO CODES DISCOVERED - TARGET EXHAUSTED', 'warning');
      return;
    }

    setStatus(SearchStatus.DISCOVERING);
    addLog(`DISCOVERY PHASE COMPLETE: ${discovery.suggestedCodes.length} POTENTIAL CODES LOCATED`, 'info');

    // PHASE 2: REAL VERIFICATION (Backend tests codes against actual checkout)
    setStatus(SearchStatus.VERIFYING);
    addLog(`INITIATING VERIFICATION PROTOCOL IN ${region || 'US'} REGION...`, 'system');
    addLog('LAUNCHING HEADLESS BROWSER - SIMULATING REAL CHECKOUT...', 'info');

    let verificationResult: VerificationResponse | null = null;

    try {
      const response = await fetch(`${VERIFIER_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: {
            name: discovery.merchantName,
            url: discovery.merchantUrl,
          },
          codes: discovery.suggestedCodes.map(c => ({
            code: c.code,
            description: c.description,
            source: c.source,
            sourceUrl: c.sourceUrl,
          })),
          testRegion: region || 'US',
        }),
      });

      if (response.ok) {
        verificationResult = await response.json();
        const { successful, totalTested } = verificationResult;
        addLog(`VERIFICATION COMPLETE: ${successful}/${totalTested} CODES CONFIRMED WORKING`, 'success');
      } else {
        throw new Error(`Verifier returned ${response.status}`);
      }
    } catch (verifierError) {
      console.warn('Verifier service unavailable:', verifierError);
      addLog('⚠️ VERIFIER OFFLINE - CODES ARE UNVERIFIED', 'warning');
    }

    // PHASE 3: Map results to display format
    const verifiedCodes: CouponCode[] = verificationResult
      ? verificationResult.results.map(r => ({
          code: r.code,
          description: r.codeDescription || '',
          successRate: r.confidence,
          lastVerified: r.testedAt || 'Just now',
          source: r.source || 'Unknown',
          isVerified: r.status === 'verified',
          status: r.status,
          testedRegion: r.testedRegion,
          errorMessage: r.errorMessage,
        }))
      : discovery.suggestedCodes.map(c => ({
          code: c.code,
          description: c.description,
          successRate: c.discoveryConfidence || 30,
          lastVerified: c.discoveredAt || 'Unknown',
          source: c.source || 'Unknown',
          isVerified: false,
          status: 'unverified' as const,
        }));

    const workingCodes = verifiedCodes.filter(c => c.status === 'verified');
    const estimatedSavings = workingCodes.length > 0
      ? `~$${(workingCodes.length * 10).toFixed(2)}` // Rough estimate
      : '$0.00';

    setStatus(SearchStatus.COMPLETE);

    setResult({
      merchantName: discovery.merchantName,
      merchantUrl: discovery.merchantUrl,
      codes: verifiedCodes,
      competitors: discovery.competitors,
      stats: {
        sourcesScanned: discovery.suggestedCodes.length,
        codesTested: verificationResult?.totalTested || 0,
        timeTaken: verificationResult?.processingTimeMs
          ? `${(verificationResult.processingTimeMs / 1000).toFixed(1)}s`
          : 'N/A',
        moneySavedEstimate: estimatedSavings,
      }
    });

    addLog(`MISSION COMPLETE: ${workingCodes.length} VERIFIED CODES READY FOR EXTRACTION`, 'success');

    // Social layer (additive)
    if (discovery.merchantName) {
      findInfluencerCodes(discovery.merchantName).then(codes => {
        if (codes.length > 0) {
          setInfluencerCodes(codes);
          addLog(`SOCIAL LAYER: ${codes.length} INFLUENCER CODES DETECTED`, 'info');
        }
      });

      checkGlitchProbability(discovery.merchantName).then(status => {
        setGlitchStatus(status);
        if (status.probability > 50) {
          addLog(`⚠️ PRICE GLITCH DETECTED: ${status.probability}% PROBABILITY`, 'warning');
        }
      });
    }

  } catch (error) {
    console.error('Search pipeline error:', error);
    addLog('CRITICAL FAILURE IN HUNTER PROTOCOL', 'error');
    setStatus(SearchStatus.ERROR);
  }
}
