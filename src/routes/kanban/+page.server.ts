import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/gastown/work/kanban');
		if (response.ok) {
			const data = await response.json();
			return {
				todo: data.todo || [],
				inProgress: data.inProgress || []
			};
		}
	} catch (error) {
		console.error('Failed to load kanban data:', error);
	}

	return {
		todo: [],
		inProgress: []
	};
};
