import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** GET: Get kanban board data - todo (ready) and in-progress items */
export const GET: RequestHandler = async () => {
	try {
		// Get todo items (ready to work - no blockers)
		const { stdout: readyStdout } = await execAsync('bd ready --json');
		const todoItems = JSON.parse(readyStdout);

		// Get in-progress items
		const { stdout: progressStdout } = await execAsync('bd list --status=in_progress --json');
		const inProgressItems = JSON.parse(progressStdout);

		return json({
			todo: todoItems,
			inProgress: inProgressItems
		});
	} catch (error) {
		// bd commands might return empty results
		if (error instanceof Error && 'stdout' in error) {
			const { stdout } = error as { stdout: string };
			if (stdout.includes('no issues') || stdout.includes('nothing ready')) {
				return json({
					todo: [],
					inProgress: []
				});
			}
		}
		console.error('Failed to fetch kanban data:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch kanban data' },
			{ status: 500 }
		);
	}
};
