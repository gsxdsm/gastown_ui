import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	archiveMessage,
	unarchiveMessage,
	archiveMessages,
	getArchivedMessages,
	isMessageArchived
} from '$lib/server/archive-store';

/**
 * POST: Archive or unarchive a message
 *
 * Body:
 * - mailboxId: string
 * - messageId: string
 * - action: 'archive' | 'unarchive'
 *
 * For bulk operations:
 * - messageIds: string[] (if provided, archives multiple messages)
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { mailboxId, messageId, messageIds, action } = body;

		if (!mailboxId) {
			return json({ error: 'mailboxId is required' }, { status: 400 });
		}

		if (!action) {
			return json({ error: 'action is required' }, { status: 400 });
		}

		// Bulk operation
		if (messageIds && Array.isArray(messageIds)) {
			if (action === 'archive') {
				archiveMessages(mailboxId, messageIds);
				return json({ success: true, archived: messageIds.length });
			} else if (action === 'unarchive') {
				for (const id of messageIds) {
					unarchiveMessage(mailboxId, id);
				}
				return json({ success: true, unarchived: messageIds.length });
			}
		}

		// Single message operation
		if (!messageId) {
			return json({ error: 'messageId is required' }, { status: 400 });
		}

		if (action === 'archive') {
			archiveMessage(mailboxId, messageId);
			return json({ success: true, archived: true });
		} else if (action === 'unarchive') {
			unarchiveMessage(mailboxId, messageId);
			return json({ success: true, unarchived: true });
		} else {
			return json({ error: 'Invalid action. Use "archive" or "unarchive"' }, { status: 400 });
		}
	} catch (error) {
		console.error('Archive API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};

/**
 * GET: Check if a message is archived
 *
 * Query params:
 * - mailboxId: string
 * - messageId: string
 */
export const GET: RequestHandler = async ({ url }) => {
	const mailboxId = url.searchParams.get('mailboxId');
	const messageId = url.searchParams.get('messageId');

	if (!mailboxId || !messageId) {
		return json({ error: 'mailboxId and messageId are required' }, { status: 400 });
	}

	const archived = isMessageArchived(mailboxId, messageId);
	return json({ archived });
};
