import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getArchivedMessages } from '$lib/server/archive-store';

/**
 * GET: Get list of archived message IDs for a mailbox
 *
 * Query params:
 * - mailboxId: string
 */
export const GET: RequestHandler = async ({ url }) => {
	const mailboxId = url.searchParams.get('mailboxId');

	if (!mailboxId) {
		return json({ error: 'mailboxId is required' }, { status: 400 });
	}

	const archived = getArchivedMessages(mailboxId);
	return json({ archived, count: archived.length });
};
