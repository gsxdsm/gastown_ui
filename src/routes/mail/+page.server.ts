/**
 * Mail Inbox Page Server Load
 *
 * Fetches mail inbox data from gt mail command.
 * Parses subject lines to extract message types.
 * Also fetches the list of agents for the sidebar.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { PageServerLoad } from './$types';

const execAsync = promisify(exec);

interface GtMailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	type: string;
	thread_id: string;
}

export interface MailMessage {
	id: string;
	from: string;
	subject: string;
	body: string;
	timestamp: string;
	read: boolean;
	priority: string;
	messageType: string;
	threadId: string;
}

interface GtPolecat {
	rig: string;
	name: string;
	state: string;
	session_running: boolean;
}

export interface Agent {
	id: string;
	name: string;
	displayName: string;
	type: 'human' | 'witness' | 'refinery' | 'polecat' | 'crew';
	rig?: string;
	state?: string;
	sessionRunning?: boolean;
}

/**
 * Parse subject line to extract message type
 * Recognizes patterns like: "POLECAT_DONE: ...", "ESCALATION: ...", "HANDOFF: ..."
 */
function parseMessageType(subject: string): string {
	const prefixMatch = subject.match(/^([A-Z_]+):/);
	if (prefixMatch) {
		return prefixMatch[1];
	}

	// Check for emoji-prefixed types
	if (subject.includes('HANDOFF')) return 'HANDOFF';
	if (subject.includes('ESCALATION')) return 'ESCALATION';
	if (subject.includes('DONE')) return 'DONE';
	if (subject.includes('ERROR')) return 'ERROR';

	return 'MESSAGE';
}

/**
 * Transform raw mail message to display format
 */
function transformMessage(msg: GtMailMessage): MailMessage {
	return {
		id: msg.id,
		from: msg.from,
		subject: msg.subject,
		body: msg.body,
		timestamp: msg.timestamp,
		read: msg.read,
		priority: msg.priority,
		messageType: parseMessageType(msg.subject),
		threadId: msg.thread_id
	};
}

/**
 * Get display name from agent address
 */
function getDisplayName(address: string): string {
	const parts = address.split('/');
	if (parts.length === 0) return address;

	const last = parts[parts.length - 1];
	if (last === 'human') return 'Human Overseer';
	if (last === 'witness') return 'Witness';
	if (last === 'refinery') return 'Refinery';

	// Capitalize first letter
	return last.charAt(0).toUpperCase() + last.slice(1);
}

/**
 * Fetch all agents (human, witness, refinery, polecats)
 */
async function fetchAgents(): Promise<{ agents: Agent[]; error: string | null }> {
	const agents: Agent[] = [];

	// 1. Add Human Overseer at the top (always present)
	agents.push({
		id: 'human',
		name: 'human',
		displayName: 'Human Overseer',
		type: 'human'
	});

	try {
		// 2. Get rigs
		const { stdout: rigsOutput } = await execAsync('gt rigs --json', {
			timeout: 5000
		});
		const rigs: string[] = JSON.parse(rigsOutput);

		for (const rig of rigs) {
			// 3. Add Witness for each rig
			agents.push({
				id: `${rig}/witness`,
				name: 'witness',
				displayName: getDisplayName(`${rig}/witness`),
				type: 'witness',
				rig
			});

			// 4. Add Refinery for each rig
			agents.push({
				id: `${rig}/refinery`,
				name: 'refinery',
				displayName: getDisplayName(`${rig}/refinery`),
				type: 'refinery',
				rig
			});

			// 5. Get polecats for this rig
			try {
				const { stdout: polecatsOutput } = await execAsync(`gt polecat list ${rig} --json`, {
					timeout: 5000
				});
				const polecats: GtPolecat[] = JSON.parse(polecatsOutput);

				for (const polecat of polecats) {
					agents.push({
						id: `${rig}/${polecat.name}`,
						name: polecat.name,
						displayName: getDisplayName(`${rig}/${polecat.name}`),
						type: 'polecat',
						rig,
						state: polecat.state,
						sessionRunning: polecat.session_running
					});
				}
			} catch (e) {
				// If no polecats or error, continue
				console.debug(`No polecats found for rig ${rig}:`, e);
			}
		}

		return { agents, error: null };
	} catch (error) {
		console.error('Failed to fetch agents:', error);
		return { agents, error: 'Failed to fetch agents' };
	}
}

export const load: PageServerLoad = async () => {
	// Fetch mail and agents in parallel
	const [mailResult, agentsResult] = await Promise.allSettled([
		(async () => {
			try {
				const { stdout } = await execAsync('gt mail inbox --json', {
					timeout: 5000
				});

				const rawMessages: GtMailMessage[] | null = JSON.parse(stdout);
				const messages = (rawMessages ?? []).map(transformMessage);

				// Sort: unread first, then by timestamp descending
				messages.sort((a, b) => {
					if (a.read !== b.read) return a.read ? 1 : -1;
					return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
				});

				const unreadCount = messages.filter((m) => !m.read).length;

				return {
					messages,
					unreadCount,
					error: null,
					fetchedAt: new Date().toISOString()
				};
			} catch (err) {
				console.error('Failed to fetch mail inbox:', err);

				return {
					messages: [],
					unreadCount: 0,
					error: 'Failed to fetch mail inbox',
					fetchedAt: new Date().toISOString()
				};
			}
		})(),
		fetchAgents()
	]);

	const mailData = mailResult.status === 'fulfilled' ? mailResult.value : {
		messages: [],
		unreadCount: 0,
		error: 'Failed to fetch mail inbox',
		fetchedAt: new Date().toISOString()
	};

	const agentsData = agentsResult.status === 'fulfilled' ? agentsResult.value : {
		agents: [],
		error: 'Failed to fetch agents'
	};

	return {
		...mailData,
		...agentsData
	};
};
