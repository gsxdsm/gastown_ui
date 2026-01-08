/**
 * Archive Store for Mail Messages
 *
 * Manages persistent storage of archived message IDs.
 * Uses a simple JSON file for storage.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE_FILE = join(process.cwd(), '.mail-archive.json');
const ARCHIVE_DIR = join(process.cwd(), '.data');

interface ArchiveData {
	archived: Record<string, string[]>; // mailboxId -> message IDs
}

/**
 * Ensure archive directory exists
 */
function ensureDir() {
	if (!existsSync(ARCHIVE_DIR)) {
		mkdirSync(ARCHIVE_DIR, { recursive: true });
	}
}

/**
 * Load archive data from disk
 */
function loadArchiveData(): ArchiveData {
	ensureDir();

	if (!existsSync(ARCHIVE_FILE)) {
		return { archived: {} };
	}

	try {
		const data = readFileSync(ARCHIVE_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return { archived: {} };
	}
}

/**
 * Save archive data to disk
 */
function saveArchiveData(data: ArchiveData) {
	ensureDir();
	writeFileSync(ARCHIVE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get archived message IDs for a mailbox
 */
export function getArchivedMessages(mailboxId: string): string[] {
	const data = loadArchiveData();
	return data.archived[mailboxId] || [];
}

/**
 * Add message to archive
 */
export function archiveMessage(mailboxId: string, messageId: string): void {
	const data = loadArchiveData();

	if (!data.archived[mailboxId]) {
		data.archived[mailboxId] = [];
	}

	if (!data.archived[mailboxId].includes(messageId)) {
		data.archived[mailboxId].push(messageId);
		saveArchiveData(data);
	}
}

/**
 * Remove message from archive
 */
export function unarchiveMessage(mailboxId: string, messageId: string): void {
	const data = loadArchiveData();

	if (data.archived[mailboxId]) {
		data.archived[mailboxId] = data.archived[mailboxId].filter((id) => id !== messageId);
		saveArchiveData(data);
	}
}

/**
 * Bulk archive messages
 */
export function archiveMessages(mailboxId: string, messageIds: string[]): void {
	const data = loadArchiveData();

	if (!data.archived[mailboxId]) {
		data.archived[mailboxId] = [];
	}

	for (const messageId of messageIds) {
		if (!data.archived[mailboxId].includes(messageId)) {
			data.archived[mailboxId].push(messageId);
		}
	}

	saveArchiveData(data);
}

/**
 * Check if a message is archived
 */
export function isMessageArchived(mailboxId: string, messageId: string): boolean {
	const archived = getArchivedMessages(mailboxId);
	return archived.includes(messageId);
}

/**
 * Get archive count for a mailbox
 */
export function getArchiveCount(mailboxId: string): number {
	return getArchivedMessages(mailboxId).length;
}
