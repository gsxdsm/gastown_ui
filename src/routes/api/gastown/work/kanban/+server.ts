import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface BeadIssue {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	created_at: string;
	updated_at: string;
	dependency_count?: number;
	dependent_count?: number;
}

interface KanbanColumn {
	name: string;
	issues: BeadIssue[];
}

interface KanbanResponse {
	todo: BeadIssue[];
	inProgress: BeadIssue[];
}

/** GET: Fetch kanban data - ready issues and in-progress issues */
export const GET: RequestHandler = async () => {
	try {
		// Run both commands in parallel
		const [readyResult, inProgressResult] = await Promise.allSettled([
			execAsync('bd ready --json'),
			execAsync('bd list --status=in_progress --json')
		]);

		// Parse todo issues from "bd ready"
		let todoIssues: BeadIssue[] = [];
		if (readyResult.status === 'fulfilled') {
			try {
				const stdout = readyResult.value.stdout.trim();
				todoIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				todoIssues = [];
			}
		}

		// Parse in-progress issues from "bd list --status=in_progress"
		let inProgressIssues: BeadIssue[] = [];
		if (inProgressResult.status === 'fulfilled') {
			try {
				const stdout = inProgressResult.value.stdout.trim();
				inProgressIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				inProgressIssues = [];
			}
		}

		const response: KanbanResponse = {
			todo: todoIssues,
			inProgress: inProgressIssues
		};

		return json(response);
	} catch (error) {
		console.error('Failed to fetch kanban data:', error);
		// Return empty kanban on error
		return json({
			todo: [],
			inProgress: []
		});
	}
};
