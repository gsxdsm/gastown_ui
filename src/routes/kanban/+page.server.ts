import type { PageServerLoad } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface Issue {
	id: string;
	title: string;
	type: string;
	status: string;
	priority: number;
	assignee?: string;
}

interface KanbanData {
	todo: Issue[];
	inProgress: Issue[];
	done: Issue[];
	error: string | null;
}

export const load: PageServerLoad = async (): Promise<KanbanData> => {
	try {
		// Fetch all issues and categorize by status
		const [readyResult, inProgressResult, doneResult] = await Promise.allSettled([
			fetchIssuesByStatus('open'),
			fetchIssuesByStatus('in_progress'),
			fetchIssuesByStatus('done')
		]);

		// Ready issues go to todo column
		const todo = readyResult.status === 'fulfilled' ? readyResult.value : [];
		const inProgress = inProgressResult.status === 'fulfilled' ? inProgressResult.value : [];
		const done = doneResult.status === 'fulfilled' ? doneResult.value : [];

		return {
			todo,
			inProgress,
			done,
			error: null
		};
	} catch (error) {
		return {
			todo: [],
			inProgress: [],
			done: [],
			error: error instanceof Error ? error.message : 'Failed to load issues'
		};
	}
};

async function fetchIssuesByStatus(status: string): Promise<Issue[]> {
	try {
		const { stdout } = await execAsync(`bd list --status=${status} --json`);
		const issues = JSON.parse(stdout);
		return Array.isArray(issues) ? issues : [];
	} catch (error) {
		// bd list might return empty or error if no issues
		if (error instanceof Error && (error.message.includes('no issues') || error.message.includes('exit code 1'))) {
			return [];
		}
		// For other errors, return empty array rather than failing
		console.error(`Failed to fetch ${status} issues:`, error);
		return [];
	}
}
