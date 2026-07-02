// backend/src/newsletter.ts
// Simple newsletter ingestion service using IMAP.
// Listens for new emails on a catch‑all inbox, extracts HTML bodies,
// runs the code extractor on each email, and queues discovered codes for verification.

import { extractCodes } from './discovery/codeExtractor';

const logger = console;

export function startNewsletterListener() {
  logger.info('Newsletter listener is disabled in this build. Configure IMAP/BullMQ later to enable it.');
}
