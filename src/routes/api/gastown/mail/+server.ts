import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface GtAgent {
	name: string;
	address: string;
	role: string;
	running: boolean;
	unread_mail?: number;
}

interface GtRig {
	name: string;
	agents: GtAgent[];
}

interface GtStatus {
	name: string;
	agents: GtAgent[];
	rigs: GtRig[];
}

interface Mailbox {
	id: string;
	name: string;
	address: string;
	unreadCount: number;
	role: string;
}

/** GET: List all agent mailboxes with unread counts */
export const GET: RequestHandler = async () => {
	try {
		const { stdout } = await execAsync('gt status --json');
		const data: GtStatus = JSON.parse(stdout);

		const mailboxes: Mailbox[] = [];

		// Add top-level agents (mayor, deacon)
		for (const agent of data.agents) {
			const roleName = agent.address.split('/').pop() || agent.name;
			mailboxes.push({
				id: agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name,
				name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
				address: agent.address,
				unreadCount: agent.unread_mail || 0,
				role: agent.role
			});
		}

		// Add rig agents (witness, refinery, polecats, crew)
		for (const rig of data.rigs) {
			for (const agent of rig.agents) {
				const roleName = agent.address.split('/').pop() || agent.name;
				mailboxes.push({
					id: agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name,
					name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
					address: agent.address,
					unreadCount: agent.unread_mail || 0,
					role: agent.role
				});
			}
		}

		// Deduplicate mailboxes by ID (keep first occurrence)
		const uniqueMailboxes = Array.from(
			new Map(mailboxes.map((mb) => [mb.id, mb])).values()
		);

		return json(uniqueMailboxes);
	} catch (error) {
		console.error('Failed to fetch mailboxes:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch mailboxes' },
			{ status: 500 }
		);
	}
};
