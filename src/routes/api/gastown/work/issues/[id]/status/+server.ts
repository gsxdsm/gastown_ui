import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];

/** PATCH: Update issue status */
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;
		const body = await request.json();
		const { status } = body;

		if (!status || typeof status !== 'string') {
			return json({ error: 'Status is required' }, { status: 400 });
		}

		// Validate status enum
		const normalizedStatus = status.toLowerCase().replace('-', '_');
		if (!VALID_STATUSES.includes(normalizedStatus)) {
			return json(
				{ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
				{ status: 400 }
			);
		}

		// Sanitize ID to prevent command injection
		const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');

		const cmd = `bd update ${sanitizedId} --status=${normalizedStatus} --json`;
		const { stdout } = await execAsync(cmd);

		const result = JSON.parse(stdout);

		// Auto-sling work when moved to in-progress column (hq-cslr)
		if (normalizedStatus === 'in_progress') {
			try {
				const rig = process.env.GT_RIG || 'gastown_ui';
				// Sanitize rig name to prevent command injection
				const sanitizedRig = rig.replace(/[^a-zA-Z0-9_-]/g, '');
				const slingCmd = `gt sling ${sanitizedId} ${sanitizedRig}`;
				await execAsync(slingCmd);
				console.log(`Auto-slung ${sanitizedId} to ${sanitizedRig}`);
			} catch (slingError) {
				// Log sling error but don't fail the status update
				console.error('Failed to auto-sling work:', slingError);
			}
		}

		return json(result);
	} catch (error) {
		console.error('Failed to update issue status:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to update issue status' },
			{ status: 500 }
		);
	}
};
