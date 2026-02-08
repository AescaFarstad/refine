import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Point2 } from './ItemLib';

const HOVER_HINT_NODE_OFFSET = 40;
const HOVER_HINT_DEFAULT_HEIGHT = 220;
const HOVER_HINT_DEFAULT_WIDTH = 320;
const HOVER_HINT_EDGE_MARGIN = 8;

type HintPlacementInput = {
  anchor: ComputedRef<Point2 | null>;
  container: Ref<HTMLElement | null>;
  visible: ComputedRef<boolean>;
};

type HintPlacementOutput = {
  hintRef: Ref<HTMLElement | null>;
  hintBelow: ComputedRef<boolean>;
  hintStyle: ComputedRef<Record<string, string> | null>;
};

export function useResearchNodeHintPlacement(input: HintPlacementInput): HintPlacementOutput {
  const hintRef = ref<HTMLElement | null>(null);
  const hintHeight = ref(0);
  const hintWidth = ref(0);

  const hintBelow = computed(() => {
    const pos = input.anchor.value;
    if (!pos) return false;
    const measuredHeight = hintHeight.value || HOVER_HINT_DEFAULT_HEIGHT;
    const topIfAbove = pos.y - HOVER_HINT_NODE_OFFSET - measuredHeight;
    return topIfAbove < 0;
  });

  const hintStyle = computed<Record<string, string> | null>(() => {
    const pos = input.anchor.value;
    if (!pos) return null;

    const measuredWidth = hintWidth.value || HOVER_HINT_DEFAULT_WIDTH;
    const containerWidth = input.container.value?.clientWidth ?? window.innerWidth;
    const minX = measuredWidth / 2 + HOVER_HINT_EDGE_MARGIN;
    const maxX = containerWidth - measuredWidth / 2 - HOVER_HINT_EDGE_MARGIN;
    const x = minX <= maxX ? Math.min(Math.max(pos.x, minX), maxX) : containerWidth / 2;
    const y = hintBelow.value ? pos.y + HOVER_HINT_NODE_OFFSET : pos.y - HOVER_HINT_NODE_OFFSET;

    return {
      left: `${x}px`,
      top: `${y}px`,
    };
  });

  watch(
    [input.anchor, input.visible],
    async () => {
      if (!input.visible.value) {
        hintHeight.value = 0;
        hintWidth.value = 0;
        return;
      }
      await nextTick();
      hintHeight.value = hintRef.value?.offsetHeight ?? 0;
      hintWidth.value = hintRef.value?.offsetWidth ?? 0;
    },
    { flush: 'post' }
  );

  return { hintRef, hintBelow, hintStyle };
}
