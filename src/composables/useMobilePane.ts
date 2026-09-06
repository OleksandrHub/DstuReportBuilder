import { ref } from 'vue'

export type MobilePane = 'editor' | 'preview'

// Which pane is visible on phones (< 768px). Shared singleton:
// the switcher lives in App.vue, the panes in HomeView.vue. At 768px and
// above both panes sit side by side and this value is ignored.
const mobilePane = ref<MobilePane>('editor')

export function useMobilePane() {
  function show(pane: MobilePane) {
    mobilePane.value = pane
  }

  return { mobilePane, show }
}
