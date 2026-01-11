/**
 * Agents Mail Page Server Load
 *
 * Fetches list of all agents (human, witness, refinery, polecats, crew).
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

export const load: PageServerLoad = async () => {
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
		const { stdout: rigsOutput } = await execAsync('gt rig list', {
			timeout: 5000
		});
		// Parse the output format:
		// Rigs in /home/user/gt:
		//
		//   ui_gastown
		//     Polecats: 2  Crew: 2
		//     Agents: [refinery witness mayor]
		const lines = rigsOutput.trim().split('\n');
		const rigs: string[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			// Rig names are indented with 2 spaces and not metadata lines
			if (trimmed && !trimmed.startsWith('Rigs') && !trimmed.includes('Polecats:') && !trimmed.includes('Agents:')) {
				rigs.push(trimmed);
			}
		}

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
				const { stdout: polecatsOutput } = await execAsync(`gt polecat list ${rig}`, {
					timeout: 5000
				});
				// Parse the output format:
				// Active Polecats
				//
				//   ● ui_gastown/furiosa  done
				//   ● ui_gastown/nux  working
				//   ● ui_gastown/slit  stuck
				const lines = polecatsOutput.trim().split('\n');
				for (const line of lines) {
					// Each polecat line starts with "● " and contains "rig/name  state"
					const match = line.match(/●\s+(\S+\/\S+)\s+(\S+)/);
					if (match) {
						const fullName = match[1];
						const state = match[2];
						const name = fullName.split('/').pop() || fullName;
						agents.push({
							id: fullName,
							name: name,
							displayName: getDisplayName(fullName),
							type: 'polecat',
							rig,
							state: state,
							sessionRunning: true // All listed polecats are active
						});
					}
				}
			} catch (e) {
				// If no polecats or error, continue
				console.debug(`No polecats found for rig ${rig}:`, e);
			}
		}

		return {
			agents,
			error: null
		};
	} catch (error) {
		console.error('Failed to fetch agents:', error);

		return {
			agents,
			error: 'Failed to fetch agents'
		};
	}
};
