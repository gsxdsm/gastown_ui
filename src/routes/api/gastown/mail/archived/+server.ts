import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface ArchivedMessage {
	id: string;
	title: string;
	status: string;
	type: string;
	priority: string;
	assignee: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	labels: string[];
	description?: string;
}

/**
 * GET: Fetch archived (closed) mail messages from beads
 *
 * Queries beads for closed message-type issues, which represent archived mail.
 */
export const GET: RequestHandler = async ({ url }) => {
	const limit = url.searchParams.get('limit');

	try {
		// Query beads for closed message-type issues
		const { stdout } = await execAsync('bd list --status=closed --type=message --json', {
			timeout: 10000,
			maxBuffer: 1024 * 1024 // 1MB buffer
		});

		let issues: any[] = [];
		try {
			issues = JSON.parse(stdout);
		} catch {
			// If JSON parse fails, try parsing line by line (JSONL format)
			const lines = stdout.trim().split('\n');
			for (const line of lines) {
				if (line.trim()) {
					try {
						issues.push(JSON.parse(line));
					} catch {
						// Skip invalid lines
					}
				}
			}
		}

		// Transform to archived message format
		const messages: ArchivedMessage[] = issues
			.map((issue: any) => ({
				id: issue.id,
				title: issue.title,
				status: issue.status,
				type: issue.type,
				priority: issue.priority,
				assignee: issue.assignee || '',
				createdBy: issue.created_by || '',
				createdAt: issue.created_at || '',
				updatedAt: issue.updated_at || '',
				labels: issue.labels || [],
				description: issue.description || ''
			}))
			.sort((a, b) => {
				// Sort by updated date descending (most recently archived first)
				return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
			});

		// Apply limit if specified
		if (limit) {
			const parsedLimit = parseInt(limit, 10);
			if (!isNaN(parsedLimit) && parsedLimit > 0) {
				messages.length = Math.min(messages.length, parsedLimit);
			}
		}

		return json({
			messages,
			count: messages.length
		});
	} catch (error) {
		console.error('Failed to fetch archived messages:', error);
		return json(
			{
				messages: [],
				count: 0,
				error: error instanceof Error ? error.message : 'Failed to fetch archived messages'
			},
			{ status: 200 } // Return 200 with empty array on error
		);
	}
};
