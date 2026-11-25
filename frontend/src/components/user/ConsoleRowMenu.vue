<template>
  <button
    ref="triggerRef"
    type="button"
    class="console-row-menu-trigger"
    :aria-label="label"
    :title="label"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="open ? menuId : undefined"
    data-test="row-menu-trigger"
    @click="toggle"
    @keydown.down.prevent="openAndFocus(0)"
    @keydown.up.prevent="openAndFocus(-1)"
  >
    <Icon name="more" size="sm" />
  </button>
  <!-- 表格滚动容器 overflow 会裁剪绝对定位的菜单，所以挂到 body，用视口坐标定位。 -->
  <Teleport to="body">
    <div
      v-if="open"
      :id="menuId"
      ref="menuRef"
      role="menu"
      class="console-row-menu"
      :style="menuStyle"
      @keydown="onMenuKeydown"
      @click="onMenuClick"
    >
      <slot :close="close" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'
import Icon from '@/components/icons/Icon.vue'

defineProps<{ label: string }>()

const menuId = `console-row-menu-${useId()}`
const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const items = () => Array.from(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])

function place() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return
  const width = 176
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
  const below = window.innerHeight - rect.bottom
  menuStyle.value = below < 200
    ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 4}px`, width: `${width}px` }
    : { left: `${left}px`, top: `${rect.bottom + 4}px`, width: `${width}px` }
}

function onOutside(event: Event) {
  const target = event.target as Node
  if (menuRef.value?.contains(target) || triggerRef.value?.contains(target)) return
  close(false)
}

function onViewportChange() {
  close(false)
}

function listen(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onOutside, true)
  window[method]('scroll', onViewportChange, true)
  window[method]('resize', onViewportChange)
}

async function openAndFocus(index: number) {
  if (!open.value) {
    place()
    open.value = true
    listen(true)
    await nextTick()
  }
  const list = items()
  list.at(index)?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  listen(false)
  if (returnFocus) triggerRef.value?.focus()
}

function toggle() {
  if (open.value) close()
  else void openAndFocus(0)
}

function onMenuKeydown(event: KeyboardEvent) {
  const list = items()
  const current = list.indexOf(document.activeElement as HTMLElement)
  if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault()
    close(event.key === 'Escape')
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    list[(current + step + list.length) % list.length]?.focus()
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    list.at(event.key === 'Home' ? 0 : -1)?.focus()
  }
}

// 菜单项执行后收起菜单（操作本身可能打开对话框，焦点交给对话框）。
function onMenuClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('[role="menuitem"]')) close(false)
}

onBeforeUnmount(() => listen(false))

defineExpose({ close })
</script>
