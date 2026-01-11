import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** PUT: Update issue status */
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;
		const body = await request.json();
		const { status } = body;

		// Validate status - using actual bd status values
		const validStatuses = ['open', 'hooked', 'in_progress'];
		if (!status || !validStatuses.includes(status)) {
			return json(
				{ error: 'Invalid status. Must be one of: open, hooked, in_progress' },
				{ status: 400 }
			);
		}

		// Sanitize id to prevent command injection
		const sanitizedId = id.replace(/['"\\$`]/g, '');

		// Use bd update command to change status
		const cmd = `bd update "${sanitizedId}" --status=${status} --json`;
		const { stdout } = await execAsync(cmd);

		const result = JSON.parse(stdout);
		return json({ message: `Updated issue ${id} to ${status}`, issue: result });
	} catch (error) {
		console.error('Failed to update issue:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to update issue' },
			{ status: 500 }
		);
	}
};
