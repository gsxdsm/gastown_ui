import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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

/**
 * Parse subject line to extract message type
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

interface GtStatus {
	name: string;
	agents: Array<{
		name: string;
		address: string;
		role: string;
		running: boolean;
		unread_mail?: number;
	}>;
	rigs: Array<{
		name: string;
		agents: Array<{
			name: string;
			address: string;
			role: string;
			running: boolean;
			unread_mail?: number;
		}>;
	}>;
}

/**
 * Find the agent address for a given mailbox ID
 */
async function getAgentAddress(mailboxId: string): Promise<string | null> {
	try {
		const { stdout } = await execAsync('gt status --json');
		const data: GtStatus = JSON.parse(stdout);

		// Check top-level agents
		for (const agent of data.agents) {
			const id = agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name;
			if (id === mailboxId) {
				return agent.address;
			}
		}

		// Check rig agents
		for (const rig of data.rigs) {
			for (const agent of rig.agents) {
				const id = agent.address.replace(/\//g, '-').replace(/-$/, '') || agent.name;
				if (id === mailboxId) {
					return agent.address;
				}
			}
		}

		return null;
	} catch {
		return null;
	}
}

/** GET: Fetch messages for a specific mailbox */
export const GET: RequestHandler = async ({ params, url }) => {
	const mailboxId = params.address;
	const limit = url.searchParams.get('limit');

	try {
		// Map mailbox ID back to agent address
		const agentAddress = await getAgentAddress(mailboxId);

		if (!agentAddress) {
			return json(
				{ error: `Mailbox '${mailboxId}' not found` },
				{ status: 404 }
			);
		}

		// Fetch inbox for this address
		const cmd = `gt mail inbox --address=${agentAddress} --json`;
		const { stdout } = await execAsync(cmd, { timeout: 5000 });

		const rawMessages: GtMailMessage[] | null = JSON.parse(stdout);
		let messages = (rawMessages ?? []).map(transformMessage);

		// Sort: unread first, then by timestamp descending
		messages.sort((a, b) => {
			if (a.read !== b.read) return a.read ? 1 : -1;
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		});

		// Apply limit if specified
		if (limit) {
			const parsedLimit = parseInt(limit, 10);
			if (!isNaN(parsedLimit) && parsedLimit > 0) {
				messages = messages.slice(0, parsedLimit);
			}
		}

		const unreadCount = messages.filter((m) => !m.read).length;

		return json({
			messages,
			unreadCount,
			address: agentAddress,
			mailboxId
		});
	} catch (error) {
		console.error('Failed to fetch mailbox messages:', error);
		return json(
			{
				messages: [],
				unreadCount: 0,
				address: null,
				mailboxId,
				error: error instanceof Error ? error.message : 'Failed to fetch messages'
			},
			{ status: 200 } // Return 200 with empty array on error
		);
	}
};
