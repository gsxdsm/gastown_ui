<script lang="ts">
	import { GridPattern } from '$lib/components';
	import { Archive, ChevronRight, Mail, Loader2, ArrowLeft } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	interface ArchivedMessage {
		id: string;
		title: string;
		status: string;
		type: string;
		priority: string;
		assignee: string;
		createdBy: string;
		createdAt: string;
		updatedAt: string;
		labels: string[];
		description?: string;
	}

	interface PageData {
		messages: ArchivedMessage[];
		count: number;
		error?: string;
	}

	// State
	let isLoading = $state(false);

	/**
	 * Format timestamp for display
	 */
	function formatTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		// Less than 1 hour: show minutes
		if (diff < 3600000) {
			const mins = Math.floor(diff / 60000);
			return mins <= 0 ? 'now' : `${mins}m ago`;
		}

		// Less than 24 hours: show hours
		if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}h ago`;
		}

		// Otherwise: show date
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Extract message type from title or labels
	 */
	function getMessageType(message: ArchivedMessage): string {
		// Check labels for message type
		const typeLabel = message.labels.find((l) =>
			['HANDOFF', 'ESCALATION', 'ERROR', 'DONE'].includes(l)
		);
		if (typeLabel) return typeLabel;

		// Check title for type prefix
		const match = message.title.match(/^([A-Z_]+):/);
		if (match) return match[1];

		// Check title for common types
		if (message.title.includes('HANDOFF')) return 'HANDOFF';
		if (message.title.includes('ESCALATION')) return 'ESCALATION';
		if (message.title.includes('DONE')) return 'DONE';
		if (message.title.includes('ERROR')) return 'ERROR';

		return 'MESSAGE';
	}

	/**
	 * Get badge class based on message type
	 */
	function getBadgeClass(type: string): string {
		const base = 'inline-flex items-center px-2 py-0.5 text-2xs font-mono font-bold rounded uppercase';
		const types: Record<string, string> = {
			ESCALATION: 'bg-destructive/20 text-destructive',
			ERROR: 'bg-destructive/20 text-destructive',
			HANDOFF: 'bg-warning/20 text-warning',
			DONE: 'bg-success/20 text-success',
			MESSAGE: 'bg-muted text-muted-foreground'
		};
		return `${base} ${types[type] || types.MESSAGE}`;
	}
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container">
				<div class="flex items-center gap-4">
					<a
						href="/mail"
						class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeft class="w-4 h-4" strokeWidth={2} />
						<span class="hidden sm:inline">Back to Mail</span>
					</a>
					<div class="flex-1">
						<h1 class="text-xl font-semibold text-foreground">Archived Messages</h1>
						<p class="text-sm text-muted-foreground">
							{data.count} archived message{data.count !== 1 ? 's' : ''}
						</p>
					</div>
				</div>
			</div>
		</header>

		<main class="container py-6">
			{#if data.error}
				<div class="panel-glass p-6 border-status-offline/30">
					<p class="text-status-offline font-medium">Failed to load archived messages</p>
					<p class="text-sm text-muted-foreground mt-1">{data.error}</p>
				</div>
			{:else if data.messages.length === 0}
				<div class="panel-glass p-6 text-center">
					<Archive class="w-12 h-12 text-muted-foreground mx-auto mb-4" strokeWidth={2} />
					<p class="text-muted-foreground">No archived messages yet</p>
					<p class="text-sm text-muted-foreground mt-1">
						Archived messages will appear here after you archive them from your inbox.
					</p>
					<a
						href="/mail"
						class="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
					>
						Go to Mail
					</a>
				</div>
			{:else}
				<div class="panel-glass overflow-hidden">
					<ul class="divide-y divide-border" role="list">
						{#each data.messages as message, index}
							{@const messageType = getMessageType(message)}
							<li
								class="p-4 hover:bg-accent/5 transition-colors animate-blur-fade-up"
								style="animation-delay: {index * 30}ms"
							>
								<div class="flex items-start gap-3">
									<!-- Icon -->
									<div class="flex-shrink-0 mt-1">
										<Mail class="w-5 h-5 text-muted-foreground" strokeWidth={2} />
									</div>

									<!-- Content -->
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<span class={getBadgeClass(messageType)}>
												{messageType}
											</span>
											<span class="text-xs text-muted-foreground font-mono">
												{message.id}
											</span>
											<span class="text-xs text-muted-foreground ml-auto">
												Archived {formatTime(message.updatedAt)}
											</span>
										</div>

										<h3 class="font-medium text-foreground truncate">
											{message.title}
										</h3>

										{#if message.description}
											<p class="text-sm text-muted-foreground truncate mt-1">
												{message.description}
											</p>
										{/if}

										<div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
											<span>From: {message.createdBy}</span>
											{#if message.assignee}
												<span>To: {message.assignee}</span>
											{/if}
										</div>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</main>
	</div>
</div>
