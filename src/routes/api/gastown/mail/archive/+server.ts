import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface ArchiveRequest {
	messageIds: string[];
}

interface ArchiveResponse {
	success: boolean;
	archivedCount?: number;
	error?: string;
}

/**
 * POST: Archive one or more mail messages
 *
 * Uses `gt mail archive <message-id>...` to archive messages by closing them in beads.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: ArchiveRequest = await request.json();
		const { messageIds } = body;

		// Validate input
		if (!Array.isArray(messageIds) || messageIds.length === 0) {
			return json(
				{ success: false, error: 'messageIds must be a non-empty array' },
				{ status: 400 }
			);
		}

		// Execute gt mail archive command with all message IDs
		const cmd = `gt mail archive ${messageIds.join(' ')}`;
		const { stdout, stderr } = await execAsync(cmd, {
			timeout: 15000,
			maxBuffer: 1024 * 1024 // 1MB buffer
		});

		// Check for errors in stderr (gt may output errors there)
		if (stderr && stderr.includes('Error')) {
			return json(
				{ success: false, error: stderr.trim() },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			archivedCount: messageIds.length
		} satisfies ArchiveResponse);
	} catch (error) {
		console.error('Failed to archive messages:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to archive messages'
			} satisfies ArchiveResponse,
			{ status: 500 }
		);
	}
};
