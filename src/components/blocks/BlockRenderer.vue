<script setup lang="ts">
import type { ReportBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import ParagraphBlock from './ParagraphBlock.vue'
import TextBlock from './TextBlock.vue'
import HeadingBlock from './HeadingBlock.vue'
import ListBlockEditor from './ListBlock.vue'
import CodeBlockEditor from './CodeBlock.vue'
import ImageBlockEditor from './ImageBlock.vue'
import TableBlockEditor from './TableBlock.vue'
import FormulaBlockEditor from './FormulaBlock.vue'
import PageBreakBlock from './PageBreakBlock.vue'
import SpacerBlock from './SpacerBlock.vue'
import TocBlock from './TocBlock.vue'
import SourcesBlock from './SourcesBlock.vue'
import ColumnsBlock from './ColumnsBlock.vue'
import GroupBlockEditor from './GroupBlock.vue'

// Renders one body block of any type and re-emits editor events WITHOUT the
// block id — the parent (document list or group) supplies the context.
// Extracted from HomeView so groups can reuse the full block toolbox.
defineProps<{ block: ReportBlock }>()

const store = useReportStore()

function captionIndex(id: string, type: 'code' | 'image' | 'table' | 'formula'): number {
  return store.getBlockIndex(id, type)
}

const emit = defineEmits<{
  update: [data: Partial<ReportBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <ParagraphBlock
    v-if="block.type === 'paragraph'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <TextBlock
    v-else-if="block.type === 'text'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <HeadingBlock
    v-else-if="block.type === 'heading'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <ListBlockEditor
    v-else-if="block.type === 'list'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <CodeBlockEditor
    v-else-if="block.type === 'code'"
    :block="block"
    :index="captionIndex(block.id, 'code')"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <ImageBlockEditor
    v-else-if="block.type === 'image'"
    :block="block"
    :index="captionIndex(block.id, 'image')"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <TableBlockEditor
    v-else-if="block.type === 'table'"
    :block="block"
    :index="captionIndex(block.id, 'table')"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <FormulaBlockEditor
    v-else-if="block.type === 'formula'"
    :block="block"
    :index="captionIndex(block.id, 'formula')"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <PageBreakBlock
    v-else-if="block.type === 'pageBreak'"
    :block="block"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <SpacerBlock
    v-else-if="block.type === 'spacer'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <TocBlock
    v-else-if="block.type === 'toc'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <SourcesBlock
    v-else-if="block.type === 'sources'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <ColumnsBlock
    v-else-if="block.type === 'columns'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
  <GroupBlockEditor
    v-else-if="block.type === 'group'"
    :block="block"
    @update="emit('update', $event)"
    @remove="emit('remove')"
    @duplicate="emit('duplicate')"
    @move-up="emit('moveUp')"
    @move-down="emit('moveDown')"
  />
</template>
