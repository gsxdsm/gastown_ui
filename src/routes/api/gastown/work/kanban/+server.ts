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
	inReview: BeadIssue[];
	done: BeadIssue[];
	cancelled: BeadIssue[];
}

/** GET: Fetch kanban data - all status columns */
export const GET: RequestHandler = async () => {
	try {
		// Run all status commands in parallel
		const [readyResult, inProgressResult, inReviewResult, doneResult, cancelledResult] = await Promise.allSettled([
			execAsync('bd ready --json'),
			execAsync('bd list --status=in_progress --json'),
			execAsync('bd list --status=in_review --json'),
			execAsync('bd list --status=closed --json'),
			execAsync('bd list --status=cancelled --json')
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

		// Parse in-progress issues
		let inProgressIssues: BeadIssue[] = [];
		if (inProgressResult.status === 'fulfilled') {
			try {
				const stdout = inProgressResult.value.stdout.trim();
				inProgressIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				inProgressIssues = [];
			}
		}

		// Parse in-review issues
		let inReviewIssues: BeadIssue[] = [];
		if (inReviewResult.status === 'fulfilled') {
			try {
				const stdout = inReviewResult.value.stdout.trim();
				inReviewIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				inReviewIssues = [];
			}
		}

		// Parse done/closed issues
		let doneIssues: BeadIssue[] = [];
		if (doneResult.status === 'fulfilled') {
			try {
				const stdout = doneResult.value.stdout.trim();
				doneIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				doneIssues = [];
			}
		}

		// Parse cancelled issues
		let cancelledIssues: BeadIssue[] = [];
		if (cancelledResult.status === 'fulfilled') {
			try {
				const stdout = cancelledResult.value.stdout.trim();
				cancelledIssues = stdout ? JSON.parse(stdout) : [];
			} catch {
				cancelledIssues = [];
			}
		}

		const response: KanbanResponse = {
			todo: todoIssues,
			inProgress: inProgressIssues,
			inReview: inReviewIssues,
			done: doneIssues,
			cancelled: cancelledIssues
		};

		return json(response);
	} catch (error) {
		console.error('Failed to fetch kanban data:', error);
		// Return empty kanban on error
		return json({
			todo: [],
			inProgress: [],
			inReview: [],
			done: [],
			cancelled: []
		});
	}
};
