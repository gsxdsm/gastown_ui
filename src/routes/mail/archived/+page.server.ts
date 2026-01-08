import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch('/api/gastown/mail/archived?limit=100');
		if (!res.ok) {
			return {
				messages: [],
				count: 0,
				error: 'Failed to load archived messages'
			};
		}
		const data = await res.json();
		return data;
	} catch (error) {
		return {
			messages: [],
			count: 0,
			error: error instanceof Error ? error.message : 'Failed to load archived messages'
		};
	}
};
