<script lang="ts">
	import { tv } from 'tailwind-variants';
	import { GridPattern } from '$lib/components';
	import { cn } from '$lib/utils';
	import { Plus, ChevronDown, ChevronRight, Mail, Loader2, Archive, Check } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	interface Mailbox {
		id: string;
		name: string;
		address: string;
		unreadCount: number;
		role: string;
	}

	interface MailMessage {
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

	interface MailboxResponse {
		messages: MailMessage[];
		unreadCount: number;
		address: string | null;
		mailboxId: string;
		error?: string;
	}

	// State
	let mailboxes = $state<Mailbox[]>([]);
	let selectedMailbox = $state<Mailbox | null>(null);
	let mailboxMessages = $state<MailboxResponse | null>(null);
	let mailboxesLoading = $state(true);
	let messagesLoading = $state(false);
	let mailboxesError = $state<string | null>(null);

	// Track which message is expanded
	let expandedId = $state<string | null>(null);

	// Mobile view: show list or messages
	let mobileView = $state<'list' | 'messages'>('list');

	// Selection state for bulk archive
	let selectedMessages = $state<Set<string>>(new Set());
	let showSelectAll = $state(false);
	let isArchiving = $state(false);

	/**
	 * Message type badge variants
	 */
	const typeBadgeVariants = tv({
		base: 'inline-flex items-center px-2 py-0.5 text-2xs font-mono font-bold rounded uppercase',
		variants: {
			type: {
				ESCALATION: 'bg-destructive/20 text-destructive',
				ERROR: 'bg-destructive/20 text-destructive',
				HANDOFF: 'bg-warning/20 text-warning',
				DONE: 'bg-success/20 text-success',
				POLECAT_DONE: 'bg-success/20 text-success',
				TEST: 'bg-info/20 text-info',
				MESSAGE: 'bg-muted text-muted-foreground'
			}
		},
		defaultVariants: {
			type: 'MESSAGE'
		}
	});

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
	 * Format sender address for display
	 */
	function formatSender(from: string): string {
		// Extract the agent name from address like "gastown_ui/polecats/nux"
		const parts = from.split('/');
		if (parts.length === 0) return from;

		const last = parts[parts.length - 1];
		// Capitalize first letter
		return last.charAt(0).toUpperCase() + last.slice(1);
	}

	/**
	 * Load mailboxes list
	 */
	async function loadMailboxes() {
		mailboxesLoading = true;
		mailboxesError = null;
		try {
			const res = await fetch('/api/gastown/mail');
			if (!res.ok) throw new Error('Failed to load mailboxes');
			const data: Mailbox[] = await res.json();

			// Sort by unread count descending, then by name
			data.sort((a, b) => {
				if (b.unreadCount !== a.unreadCount) {
					return b.unreadCount - a.unreadCount;
				}
				return a.name.localeCompare(b.name);
			});

			mailboxes = data;

			// Auto-select first mailbox
			if (data.length > 0) {
				selectMailbox(data[0]);
			}
		} catch (e) {
			mailboxesError = e instanceof Error ? e.message : 'Failed to load mailboxes';
		} finally {
			mailboxesLoading = false;
		}
	}

	/**
	 * Select a mailbox and load its messages
	 */
	async function selectMailbox(mailbox: Mailbox) {
		selectedMailbox = mailbox;
		messagesLoading = true;
		mailboxMessages = null;

		try {
			const res = await fetch(`/api/gastown/mail/${mailbox.id}`);
			if (!res.ok) throw new Error('Failed to load messages');
			const data: MailboxResponse = await res.json();
			mailboxMessages = data;
			mobileView = 'messages';
		} catch (e) {
			mailboxMessages = {
				messages: [],
				unreadCount: 0,
				address: mailbox.address,
				mailboxId: mailbox.id,
				error: e instanceof Error ? e.message : 'Failed to load messages'
			};
		} finally {
			messagesLoading = false;
		}
	}

	/**
	 * Toggle message expansion
	 */
	function toggleMessage(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	/**
	 * Go back to mailbox list on mobile
	 */
	function backToList() {
		mobileView = 'list';
	}

	/**
	 * Toggle selection mode for bulk actions
	 */
	function toggleSelectAll() {
		if (!mailboxMessages) return;

		if (selectedMessages.size === mailboxMessages.messages.length) {
			// Deselect all
			selectedMessages.clear();
		} else {
			// Select all
			selectedMessages = new Set(mailboxMessages.messages.map((m) => m.id));
		}
	}

	/**
	 * Toggle message selection
	 */
	function toggleMessageSelection(messageId: string) {
		if (selectedMessages.has(messageId)) {
			selectedMessages.delete(messageId);
		} else {
			selectedMessages.add(messageId);
		}
		// Force reactivity by creating new Set
		selectedMessages = new Set(selectedMessages);
	}

	/**
	 * Archive a single message
	 */
	async function archiveMessage(messageId: string) {
		isArchiving = true;
		try {
			const res = await fetch('/api/gastown/mail/archive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageIds: [messageId] })
			});

			if (!res.ok) {
				throw new Error('Failed to archive message');
			}

			// Remove message from UI
			if (mailboxMessages) {
				mailboxMessages.messages = mailboxMessages.messages.filter((m) => m.id !== messageId);
			}
		} catch (error) {
			console.error('Failed to archive message:', error);
			alert('Failed to archive message');
		} finally {
			isArchiving = false;
		}
	}

	/**
	 * Archive selected messages
	 */
	async function archiveSelected() {
		if (selectedMessages.size === 0) return;

		isArchiving = true;
		try {
			const res = await fetch('/api/gastown/mail/archive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageIds: Array.from(selectedMessages) })
			});

			if (!res.ok) {
				throw new Error('Failed to archive messages');
			}

			// Remove archived messages from UI
			if (mailboxMessages) {
				mailboxMessages.messages = mailboxMessages.messages.filter(
					(m) => !selectedMessages.has(m.id)
				);
			}

			// Clear selection
			selectedMessages.clear();
			showSelectAll = false;
		} catch (error) {
			console.error('Failed to archive messages:', error);
			alert('Failed to archive messages');
		} finally {
			isArchiving = false;
		}
	}

	// Load mailboxes on mount
	onMount(() => {
		loadMailboxes();
	});

	/**
	 * Get badge type for message
	 */
	function getBadgeType(messageType: string): string {
		const knownTypes = ['ESCALATION', 'ERROR', 'HANDOFF', 'DONE', 'POLECAT_DONE', 'TEST'];
		return knownTypes.includes(messageType) ? messageType : 'MESSAGE';
	}
</script>

<div class="relative min-h-screen bg-background">
	<GridPattern variant="dots" opacity={0.15} />

	<div class="relative z-10">
		<header class="sticky top-0 z-50 panel-glass border-b border-border px-4 py-4">
			<div class="container">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-xl font-semibold text-foreground">Mail</h1>
						<p class="text-sm text-muted-foreground">
							{#if selectedMailbox}
								{selectedMailbox.name}
								{#if mailboxMessages?.unreadCount}
									<span class="text-accent font-medium">({mailboxMessages.unreadCount} unread)</span>
								{/if}
							{:else}
								{mailboxes.length} mailboxes
							{/if}
						</p>
					</div>
					<a
						href="/mail/compose"
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
					>
						<Plus class="w-4 h-4" />
						<span class="hidden sm:inline">Compose</span>
					</a>
				</div>
			</div>
		</header>

		<main class="container py-6">
			{#if mailboxesError}
				<div class="panel-glass p-6 border-status-offline/30">
					<p class="text-status-offline font-medium">Failed to load mailboxes</p>
					<p class="text-sm text-muted-foreground mt-1">{mailboxesError}</p>
				</div>
			{:else}
				<!-- Two-pane layout -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<!-- Left pane: Mailbox list -->
					<aside class="md:col-span-1 {mobileView === 'messages' ? 'hidden md:block' : ''}">
						<div class="panel-glass p-4">
							{#if mailboxesLoading}
								<div class="flex items-center justify-center py-8">
									<Loader2 class="w-6 h-6 text-muted-foreground animate-spin" strokeWidth={2} />
								</div>
							{:else if mailboxes.length === 0}
								<p class="text-sm text-muted-foreground text-center py-8">No mailboxes found</p>
							{:else}
								<ul class="space-y-1" role="list">
									{#each mailboxes as mailbox (mailbox.id)}
										<li>
											<button
												class="w-full text-left px-3 py-2 rounded-lg transition-colors
													{selectedMailbox?.id === mailbox.id
														? 'bg-accent text-accent-foreground'
														: 'hover:bg-muted/50'}"
												onclick={() => selectMailbox(mailbox)}
											>
												<div class="flex items-center gap-3">
													<Mail class="w-4 h-4 flex-shrink-0" strokeWidth={2} />
													<span class="flex-1 truncate text-sm font-medium">
														{mailbox.name}
													</span>
													{#if mailbox.unreadCount > 0}
														<span class="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full
															{selectedMailbox?.id === mailbox.id
																? 'bg-accent-foreground text-accent'
																: 'bg-accent text-accent-foreground'}">
															{mailbox.unreadCount}
														</span>
													{/if}
												</div>
											</button>
										</li>
									{/each}

									<!-- Divider -->
									<li class="my-2 border-t border-border"></li>

									<!-- Archived folder link -->
									<li>
										<a
											href="/mail/archived"
											class="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-muted/50 text-muted-foreground hover:text-foreground"
										>
											<Archive class="w-4 h-4 flex-shrink-0" strokeWidth={2} />
											<span class="flex-1 truncate text-sm font-medium">Archived</span>
										</a>
									</li>
								</ul>
							{/if}
						</div>
					</aside>

					<!-- Right pane: Messages -->
					<section class="md:col-span-2 {mobileView === 'list' ? 'hidden md:block' : ''}">
						{#if mobileView === 'messages' && selectedMailbox}
							<button
								onclick={backToList}
								class="md:hidden mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
							>
								← Back to mailboxes
							</button>
						{/if}

						<!-- Bulk actions bar (shown when selection mode is active or messages exist) -->
						{#if selectedMailbox && mailboxMessages && mailboxMessages.messages.length > 0}
							<div class="panel-glass p-3 mb-4 flex items-center justify-between gap-4">
								<div class="flex items-center gap-3">
									<button
										onclick={() => showSelectAll = !showSelectAll}
										class="text-sm text-accent hover:text-accent/80 transition-colors"
									>
										{showSelectAll ? 'Done' : 'Select'}
									</button>
									{#if showSelectAll}
										<button
											onclick={toggleSelectAll}
											class="text-sm text-muted-foreground hover:text-foreground transition-colors"
										>
											{selectedMessages.size === mailboxMessages.messages.length
												? 'Deselect All'
												: 'Select All'}
										</button>
									{/if}
								</div>
								{#if selectedMessages.size > 0}
									<div class="flex items-center gap-3">
										<span class="text-sm text-muted-foreground">
											{selectedMessages.size} selected
										</span>
										<button
											onclick={archiveSelected}
											disabled={isArchiving}
											class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors disabled:opacity-50"
										>
											{#if isArchiving}
												<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
											{:else}
												<Archive class="w-4 h-4" strokeWidth={2} />
											{/if}
											Archive
										</button>
									</div>
								{/if}
							</div>
						{/if}

						{#if !selectedMailbox}
							<div class="panel-glass p-6 text-center">
								<Mail class="w-12 h-12 text-muted-foreground mx-auto mb-4" strokeWidth={2} />
								<p class="text-muted-foreground">Select a mailbox to view messages</p>
							</div>
						{:else if messagesLoading}
							<div class="panel-glass p-6">
								<div class="flex items-center justify-center py-8">
									<Loader2 class="w-6 h-6 text-muted-foreground animate-spin" strokeWidth={2} />
								</div>
							</div>
						{:else if !mailboxMessages || mailboxMessages.messages.length === 0}
							<div class="panel-glass p-6 text-center">
								<p class="text-muted-foreground">
									{mailboxMessages?.error || `No messages in ${selectedMailbox.name}`}
								</p>
							</div>
						{:else}
							<div class="panel-glass overflow-hidden">
								<ul class="divide-y divide-border" role="list">
									{#each mailboxMessages.messages as message, index}
										{@const isExpanded = expandedId === message.id}
										{@const isSelected = selectedMessages.has(message.id)}
										<li
											class={cn(
												'transition-colors animate-blur-fade-up',
												!message.read && 'bg-accent/5',
												isSelected && 'bg-accent/10'
											)}
											style="animation-delay: {index * 50}ms"
										>
											<div class="flex items-start gap-3 p-4 hover:bg-accent/5 transition-colors">
												<!-- Selection checkbox (shown when selection mode is active) -->
												{#if showSelectAll}
													<div class="flex-shrink-0 mt-1">
														<button
															type="button"
															onclick={(e) => {
																e.stopPropagation();
																toggleMessageSelection(message.id);
															}}
															class="w-5 h-5 rounded border border-border flex items-center justify-center transition-colors
																{isSelected
																	? 'bg-accent border-accent text-accent-foreground'
																	: 'hover:border-accent'}"
															aria-label={isSelected ? 'Deselect' : 'Select'}
														>
															{#if isSelected}
																<Check class="w-3.5 h-3.5" strokeWidth={3} />
															{/if}
														</button>
													</div>
												{:else}
													<!-- Unread indicator -->
													<div class="flex-shrink-0 mt-1.5">
														{#if !message.read}
															<span class="block w-2 h-2 rounded-full bg-accent"></span>
														{:else}
															<span class="block w-2 h-2"></span>
														{/if}
													</div>
												{/if}

												<!-- Message content (clickable to expand) -->
												<button
													type="button"
													class="flex-1 text-left min-w-0 focus:outline-none"
													onclick={() => toggleMessage(message.id)}
													aria-expanded={isExpanded}
												>
													<div class="flex items-center gap-2 mb-1">
														<span
															class={typeBadgeVariants({
																type: getBadgeType(message.messageType) as
																	| 'ESCALATION'
																	| 'ERROR'
																	| 'HANDOFF'
																	| 'DONE'
																	| 'POLECAT_DONE'
																	| 'TEST'
																	| 'MESSAGE'
															})}
														>
															{message.messageType}
														</span>
														<span class="text-sm font-medium text-foreground">
															{formatSender(message.from)}
														</span>
														<span class="text-xs text-muted-foreground ml-auto flex-shrink-0 font-mono">
															{formatTime(message.timestamp)}
														</span>
													</div>

													<h3
														class="font-medium truncate"
														class:text-foreground={!message.read}
														class:text-muted-foreground={message.read}
													>
														{message.subject}
													</h3>

													{#if !isExpanded}
														<p class="text-sm text-muted-foreground truncate mt-1">
															{message.body}
														</p>
													{/if}
												</button>

												<!-- Action buttons -->
												<div class="flex-shrink-0 flex items-center gap-2">
													<!-- Archive button -->
													<button
														type="button"
														onclick={(e) => {
															e.stopPropagation();
															archiveMessage(message.id);
														}}
														disabled={isArchiving}
														class="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent/10 disabled:opacity-50"
														title="Archive message"
													>
														{#if isArchiving}
															<Loader2 class="w-4 h-4 animate-spin" strokeWidth={2} />
														{:else}
															<Archive class="w-4 h-4" strokeWidth={2} />
														{/if}
													</button>

													<!-- Expand indicator -->
													<button
														type="button"
														onclick={() => toggleMessage(message.id)}
														class="text-muted-foreground hover:text-foreground transition-colors"
													>
														<ChevronDown
															class="w-5 h-5 transition-transform {isExpanded ? 'rotate-180' : ''}"
														/>
													</button>
												</div>
											</div>

											<!-- Expanded message body -->
											{#if isExpanded}
												<div
													class="px-4 pb-4 pt-0 border-l-2 border-accent/30 animate-blur-fade-up"
													class:ml-12={!showSelectAll}
													class:ml-8={showSelectAll}
												>
													<div class="prose prose-sm prose-invert max-w-none">
														<pre
															class="whitespace-pre-wrap text-sm text-foreground bg-muted/30 p-4 rounded-md font-mono">{message.body}</pre>
													</div>
													<div class="mt-3 flex items-center justify-between">
														<div class="flex items-center gap-4 text-xs text-muted-foreground">
															<span>From: {message.from}</span>
															<span>ID: {message.id}</span>
															{#if message.threadId}
																<span>Thread: {message.threadId.slice(-8)}</span>
															{/if}
														</div>
														<div class="flex items-center gap-2">
															<button
																onclick={(e) => {
																	e.stopPropagation();
																	archiveMessage(message.id);
																}}
																disabled={isArchiving}
																class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors disabled:opacity-50"
															>
																{#if isArchiving}
																	<Loader2 class="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
																{:else}
																	<Archive class="w-3.5 h-3.5" strokeWidth={2} />
																{/if}
																Archive
															</button>
															<a
																href="/mail/{message.id}"
																class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
															>
																View full
																<ChevronRight class="w-3.5 h-3.5" />
															</a>
														</div>
													</div>
												</div>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</section>
				</div>
			{/if}
		</main>
	</div>
</div>
