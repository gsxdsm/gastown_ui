<script module lang="ts">
	import { tv, type VariantProps } from 'tailwind-variants';

	export const kanbanCardVariants = tv({
		base: 'p-4 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200',
		variants: {
			dragging: {
				true: 'opacity-50 scale-95 shadow-lg',
				false: ''
			},
			priority: {
				0: 'border-l-4 border-l-destructive',
				1: 'border-l-4 border-l-status-offline',
				2: 'border-l-4 border-l-warning',
				3: 'border-l-4 border-l-status-idle',
				4: 'border-l-4 border-l-muted'
			}
		},
		defaultVariants: {
			dragging: false
		}
	});

	export type KanbanCardPriority = VariantProps<typeof kanbanCardVariants>['priority'];
</script>

<script lang="ts">
	import { Bug, CheckSquare, Lightbulb, BookOpen, GripVertical } from 'lucide-svelte';
	import { Badge } from '$lib/components';
	import { cn } from '$lib/utils';

	interface Props {
		id: string;
		title: string;
		type: string;
		priority: number;
		dragging?: boolean;
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
	}

	let {
		id,
		title,
		type,
		priority,
		dragging = false,
		ondragstart,
		ondragend
	}: Props = $props();

	const typeIcons = {
		task: CheckSquare,
		bug: Bug,
		feature: Lightbulb,
		epic: BookOpen
	};

	const priorityLabels = {
		0: 'P0',
		1: 'P1',
		2: 'P2',
		3: 'P3',
		4: 'P4'
	};

	const TypeIcon = typeIcons[type as keyof typeof typeIcons] || CheckSquare;
</script>

<div
	class={cn(
		kanbanCardVariants({ dragging, priority }),
		'bg-muted/30 hover:bg-muted/50 border border-border/50'
	)}
	draggable="true"
	ondragstart={ondragstart}
	ondragend={ondragend}
	data-issue-id={id}
>
	<div class="flex items-start gap-3">
		<GripVertical class="w-4 h-4 text-muted-foreground mt-0.5" strokeWidth={2} />
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 mb-2">
				<span class="font-mono text-xs text-muted-foreground">{id}</span>
				<Badge variant="outline" size="sm">{type}</Badge>
			</div>
			<p class="text-sm text-foreground font-medium mb-2 line-clamp-2">{title}</p>
			<div class="flex items-center gap-2">
				<Badge
					variant={priority === 0 ? 'destructive' : priority === 1 ? 'error' : 'secondary'}
					size="sm"
				>
					{priorityLabels[priority as keyof typeof priorityLabels]} - {priority === 0
						? 'Critical'
						: priority === 1
							? 'High'
							: priority === 2
								? 'Medium'
								: priority === 3
									? 'Low'
									: 'Backlog'}
				</Badge>
			</div>
		</div>
		<TypeIcon class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
	</div>
</div>
