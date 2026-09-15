import { randomUUID } from 'crypto';
import { getAgentMailConfig } from './agentMailClient';

export interface ProfileAccount {
  id: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
  purpose: 'signup' | 'testing' | 'recovery';
  /** Correlation fields when many profiles share one AgentMail inbox */
  metadata: {
    profileId: string;
    purpose: ProfileAccount['purpose'];
  };
}

const accounts: ProfileAccount[] = [];

export function createProfileAccount(purpose: ProfileAccount['purpose'] = 'testing'): ProfileAccount {
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  // AgentMail does not document plus-addressing; use the dedicated inbox and
  // correlate OTP mail by time + displayName/metadata (not personal email).
  const { inboxEmail } = getAgentMailConfig();
  const password = `TempPass${Math.random().toString(36).slice(-10)}!`;
  const account: ProfileAccount = {
    id,
    email: inboxEmail,
    password,
    displayName: `Discount Hunter Verify (${shortId})`,
    createdAt: new Date().toISOString(),
    purpose,
    metadata: {
      profileId: id,
      purpose,
    },
  };
  accounts.push(account);
  return account;
}

export function listProfileAccounts(): ProfileAccount[] {
  return [...accounts];
}

export function getProfileAccount(id: string): ProfileAccount | undefined {
  return accounts.find(account => account.id === id);
}
