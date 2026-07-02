import path from 'path';
import { ensureLogDirectory, appendJsonl, writeJson } from './logging';
import { verifyCodes } from './verifier';
import type { VerificationRequest } from './types';

export interface TestCase {
  name: string;
  request: VerificationRequest;
}

export interface TestRunSummary {
  startedAt: string;
  completedAt: string;
  testCases: Array<{
    name: string;
    status: 'passed' | 'failed';
    totalTested: number;
    verified: number;
    failed: number;
    unverified: number;
    processingTimeMs?: number;
    sample?: Record<string, unknown>;
  }>;
}

export async function runVerificationTests(testCases: TestCase[]): Promise<TestRunSummary> {
  const logDir = await ensureLogDirectory();
  const startedAt = new Date().toISOString();
  const results: TestRunSummary['testCases'] = [];
  const runFile = path.join(logDir, `verification-test-${Date.now()}.jsonl`);

  for (const testCase of testCases) {
    const started = Date.now();
    try {
      const response = await verifyCodes(testCase.request);
      const duration = Date.now() - started;
      const sample = response.results[0] ? {
        code: response.results[0].code,
        status: response.results[0].status,
        confidence: response.results[0].confidence,
        errorMessage: response.results[0].errorMessage,
      } : undefined;

      const entry = {
        timestamp: new Date().toISOString(),
        level: 'summary' as const,
        event: 'verification-test',
        name: testCase.name,
        totalTested: response.totalTested,
        verified: response.successful,
        failed: response.failed,
        unverified: response.results.filter(r => r.status === 'unverified' || r.status === 'error').length,
        processingTimeMs: duration,
      };

      await appendJsonl(runFile, entry);
      results.push({
        name: testCase.name,
        status: 'passed',
        totalTested: response.totalTested,
        verified: response.successful,
        failed: response.failed,
        unverified: response.results.filter(r => r.status === 'unverified' || r.status === 'error').length,
        processingTimeMs: duration,
        sample,
      });
    } catch (error) {
      const duration = Date.now() - started;
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        event: 'verification-test-failed',
        name: testCase.name,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: duration,
      };
      await appendJsonl(runFile, entry);
      results.push({
        name: testCase.name,
        status: 'failed',
        totalTested: 0,
        verified: 0,
        failed: 0,
        unverified: 0,
        processingTimeMs: duration,
        sample: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  const summary: TestRunSummary = {
    startedAt,
    completedAt: new Date().toISOString(),
    testCases: results,
  };

  await writeJson(path.join(logDir, `verification-test-summary-${Date.now()}.json`), summary);
  return summary;
}
