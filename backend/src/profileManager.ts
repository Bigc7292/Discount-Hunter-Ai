import { randomUUID } from 'crypto';

export interface ProfileAccount {
  id: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
  purpose: 'signup' | 'testing' | 'recovery';
}

const accounts: ProfileAccount[] = [];

export function createProfileAccount(purpose: ProfileAccount['purpose'] = 'testing'): ProfileAccount {
  const id = randomUUID();
  const email = `discount-hunter+${id.slice(0, 8)}@mailinator.com`;
  const password = `TempPass${Math.random().toString(36).slice(-10)}!`;
  const account: ProfileAccount = {
    id,
    email,
    password,
    displayName: `AI Profile ${accounts.length + 1}`,
    createdAt: new Date().toISOString(),
    purpose,
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
