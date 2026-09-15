/**
 * AgentMail client stub — server-only OTP fetch for merchant signup verification.
 *
 * Approved inbox: discount-hunter@agentmail.to
 * Display name: Discount Hunter Verify
 * Purpose: merchant-checkout-otp
 *
 * NEVER use personal email addresses for bot/merchant OTP mailboxes.
 * AGENTMAIL_API_KEY is server-only — do not commit real keys.
 */

const DEFAULT_INBOX = 'discount-hunter@agentmail.to';

export function getAgentMailConfig(): { inboxEmail: string; apiKey: string } {
  return {
    inboxEmail: (process.env.AGENTMAIL_INBOX_EMAIL || DEFAULT_INBOX).trim(),
    apiKey: process.env.AGENTMAIL_API_KEY || '',
  };
}

export interface OtpSearchOptions {
  /** ISO datetime — only consider messages after this time */
  after?: string;
  /** Subject substring filters (AgentMail list_messages subject match) */
  subjectContains?: string[];
  /** Optional merchant/profile hint for correlation when sharing one inbox */
  merchantHint?: string;
}

/**
 * TODO: Wire AgentMail API/SDK for OTP polling:
 * - list_messages(inboxId, { after, subject: ['OTP', 'verification', 'code'], limit })
 * - or search_messages(inboxId, { q: 'OTP OR verification', after })
 * - get_message(inboxId, messageId) for full body, then extract the code
 *
 * All merchant profiles share one inbox; filter by time (+ merchant/subject) —
 * AgentMail does not document plus-addressing for @agentmail.to inboxes.
 */
export async function fetchLatestOtp(_options: OtpSearchOptions = {}): Promise<string | null> {
  const { apiKey, inboxEmail } = getAgentMailConfig();
  if (!apiKey) {
    throw new Error('AGENTMAIL_API_KEY is not configured (server-only)');
  }

  // Reserved for future OTP fetch used by profile/browser signup flow.
  void inboxEmail;
  throw new Error('AgentMail OTP fetch not implemented yet — see agentMailClient.ts TODOs');
}
