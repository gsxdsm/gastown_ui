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
}

export const load: PageServerLoad = async () => {
	try {
		const issues = await fetchIssues();
		return {
			issues,
			issuesError: null
		};
	} catch (error) {
		return {
			issues: [],
			issuesError: error instanceof Error ? error.message : 'Failed to fetch issues'
		};
	}
};

async function fetchIssues(): Promise<Issue[]> {
	try {
		// Fetch all issues (not just open ones, for kanban view)
		const { stdout } = await execAsync('bd list --json');
		return JSON.parse(stdout);
	} catch (error) {
		// bd list might return empty or error if no issues
		if (error instanceof Error && error.message.includes('no issues')) {
			return [];
		}
		throw error;
	}
}
