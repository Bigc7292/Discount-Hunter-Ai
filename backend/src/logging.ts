import { appendFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

export interface JsonLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'summary';
  event: string;
  [key: string]: unknown;
}

export async function ensureLogDirectory(logDir = path.resolve(process.cwd(), 'logs')): Promise<string> {
  await mkdir(logDir, { recursive: true });
  return logDir;
}

export async function appendJsonl(filePath: string, entry: JsonLogEntry): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function writeJson(filePath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}
