<script module lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';

	export const kanbanColumnVariants = tv({
		base: 'panel-glass rounded-xl p-4 flex flex-col h-full min-h-[500px]',
		variants: {
			status: {
				open: '',
				'in_progress': '',
				done: ''
			}
		}
	});

	export type KanbanColumnStatus = VariantProps<typeof kanbanColumnVariants>['status'];
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		count: number;
		status: string;
		children: Snippet;
		ondragover?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		dragOver?: boolean;
	}

	let { title, count, status, children, ondragover, ondrop, ondragleave, dragOver = false }: Props =
		$props();
</script>

<div
	class={cn(kanbanColumnVariants({ status: status as any }), dragOver && 'ring-2 ring-ring')}
	ondragover={ondragover}
	ondrop={ondrop}
	ondragleave={ondragleave}
	data-column-status={status}
>
	<div class="flex items-center justify-between mb-4">
		<h2 class="font-semibold text-foreground">{title}</h2>
		<span class="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
			{count}
		</span>
	</div>
	<div class="flex-1 space-y-3 overflow-y-auto">
		{@render children()}
	</div>
</div>
