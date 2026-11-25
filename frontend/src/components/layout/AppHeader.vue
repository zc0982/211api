<template>
  <!--
    v3 顶栏（Figma「211API · Console v3」L.topbar / L.mpage）：
    平板、桌面 64px 暖纸底 + 底部细线；手机是夜空顶栏（菜单、星狐横版、余额、头像）。
  -->
  <header class="console-topbar" :class="{ 'console-topbar--night': isPhone }">
    <div class="console-topbar__row">
      <!-- Left: phone menu + brand / page title -->
      <div class="flex min-w-0 shrink items-center gap-2">
        <button
          v-if="isPhone"
          @click="toggleMobileSidebar"
          class="console-topbar__menu"
          :aria-label="t('common.toggleMenu')"
        >
          <Icon name="menu" size="md" />
        </button>

        <router-link v-if="isPhone" :to="homePath" class="console-topbar__brand">
          <img :src="siteLogo || '/logo.svg'" alt="" class="console-topbar__mark" :class="{ 'console-topbar__mark--uploaded': !!siteLogo }" />
          <span class="truncate">{{ appStore.siteName }}</span>
        </router-link>

        <!-- 页面自带页头（meta.pageHeading）时顶栏不再重复标题和描述；仪表盘等其他页面不变。 -->
        <div v-else-if="!route.meta.pageHeading" class="min-w-0" data-test="topbar-page-title">
          <h1 class="truncate text-base font-semibold text-gray-900 dark:text-dark-100">
            {{ pageTitle }}
          </h1>
          <p v-if="pageDescription" class="hidden truncate text-xs text-gray-500 dark:text-dark-400 xl:block">
            {{ pageDescription }}
          </p>
        </div>
      </div>

      <!-- Right: Announcements + Docs + Plaza + Language + Theme + Subscriptions + Balance + Account -->
      <div class="flex min-w-0 items-center gap-1 sm:gap-2 xl:gap-3.5">
        <!-- Announcement Bell：手机夜空顶栏也保留，静默公告只能从这里打开 -->
        <div v-if="user" class="console-bell flex">
          <AnnouncementBell />
        </div>

        <!-- Docs Link -->
        <a
          v-if="docUrl && !isPhone"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="console-topbar__link hidden lg:flex"
        >
          <Icon name="book" size="sm" />
          <span>{{ t('nav.docs') }}</span>
        </a>

        <!-- Model Plaza Entry -->
        <router-link
          v-if="user && modelPlazaEnabled && !isPhone"
          :to="{ path: '/model-plaza', query: { embedded: '1' } }"
          :title="t('nav.modelPlaza')"
          :aria-label="t('nav.modelPlaza')"
          class="console-topbar__link"
        >
          <Icon name="grid" size="sm" />
          <span class="hidden xl:inline">{{ t('nav.modelPlaza') }}</span>
        </router-link>

        <!-- Language Switcher -->
        <div v-if="!isPhone" class="flex">
          <LocaleSwitcher />
        </div>

        <!-- Theme -->
        <button
          v-if="!isPhone"
          type="button"
          class="console-topbar__theme"
          :aria-label="isDark ? t('nav.lightMode') : t('nav.darkMode')"
          :title="isDark ? t('nav.lightMode') : t('nav.darkMode')"
          @click="toggleTheme"
        >
          <Icon :name="isDark ? 'moon' : 'sun'" size="sm" />
        </button>

        <!-- Subscription Progress (for users with active subscriptions; not mounted at all when the feature is off) -->
        <div v-if="user && subscriptionFeatureEnabled" class="hidden md:flex">
          <SubscriptionProgressMini />
        </div>

        <!-- Balance Display -->
        <div v-if="user" class="console-balance group" :class="{ 'console-balance--night': isPhone }">
          <Icon v-if="isPhone" name="creditCard" size="xs" class="opacity-90" />
          <span v-else class="console-balance__label">{{ t('nav.balance') }}</span>
          <span class="console-balance__value">{{ formatHeaderMoney(availableBalance) }}</span>
          <span
            v-if="frozenBalance > 0 && !isPhone"
            class="badge badge-warning hidden lg:inline-flex"
          >
            {{ balanceFrozenLabel }}
          </span>
          <router-link v-if="showRechargeButton && !isPhone" to="/purchase" class="console-balance__cta">
            {{ t('nav.recharge') }}
          </router-link>
          <div class="console-balance__tip">
            <div class="flex items-center justify-between">
              <span class="text-gray-500 dark:text-dark-400">{{ balanceAvailableText }}</span>
              <span class="font-mono font-medium text-gray-900 dark:text-dark-100">{{ formatHeaderMoney(availableBalance) }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between">
              <span class="text-gray-500 dark:text-dark-400">{{ balanceFrozenText }}</span>
              <span class="font-mono font-medium text-star-bronze dark:text-star-bronze-night">{{ formatHeaderMoney(frozenBalance) }}</span>
            </div>
            <div class="mt-2 border-t border-gray-100 pt-2 dark:border-dark-700">
              <div class="flex items-center justify-between">
                <span class="text-gray-500 dark:text-dark-400">{{ balanceTotalText }}</span>
                <span class="font-mono font-semibold text-gray-900 dark:text-dark-100">{{ formatHeaderMoney(totalBalance) }}</span>
              </div>
            </div>
          </div>
        </div>

        <span v-if="user && !isPhone" class="hidden h-5 w-px bg-gray-200 dark:bg-dark-700 md:block" aria-hidden="true"></span>

        <!-- User Dropdown -->
        <div v-if="user" class="relative" ref="dropdownRef">
          <button
            @click="toggleDropdown"
            class="console-account"
            :aria-label="t('common.userMenu')"
          >
            <div class="console-account__avatar" :class="{ 'console-account__avatar--night': isPhone }">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                :alt="displayName"
                class="h-full w-full object-cover"
              >
              <span v-else>{{ userInitials }}</span>
            </div>
            <span v-if="!isPhone" class="hidden max-w-[10rem] truncate text-sm font-medium text-gray-900 dark:text-dark-100 lg:block">
              {{ displayName }}
            </span>
            <Icon v-if="!isPhone" name="chevronDown" size="sm" class="hidden text-gray-500 dark:text-dark-400 lg:block" />
          </button>

          <!-- Dropdown Menu -->
          <transition name="dropdown">
            <div v-if="dropdownOpen" class="dropdown right-0 mt-2 w-56">
              <!-- User Info -->
              <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ displayName }}
                </div>
                <div class="text-xs text-gray-500 dark:text-dark-400">{{ user.email }}</div>
              </div>

              <!-- Balance (mobile only) -->
              <div class="border-b border-gray-100 px-4 py-2 dark:border-dark-700 md:hidden">
                <div class="text-xs text-gray-500 dark:text-dark-400">
                  {{ t('common.balance') }}
                </div>
                <div class="font-mono text-sm font-medium text-gray-900 dark:text-dark-100">
                  {{ formatHeaderMoney(availableBalance) }}
                </div>
                <div v-if="frozenBalance > 0" class="mt-1 text-xs text-amber-600 dark:text-amber-300">
                  {{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}
                </div>
              </div>

              <div class="py-1">
                <router-link to="/profile" @click="closeDropdown" class="dropdown-item">
                  <Icon name="user" size="sm" />
                  {{ t('nav.profile') }}
                </router-link>

                <router-link to="/keys" @click="closeDropdown" class="dropdown-item">
                  <Icon name="key" size="sm" />
                  {{ t('nav.apiKeys') }}
                </router-link>

                <a
                  v-if="authStore.isAdmin"
                  href="https://github.com/Wei-Shaw/sub2api"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="closeDropdown"
                  class="dropdown-item"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                    />
                  </svg>
                  {{ t('nav.github') }}
                </a>

              </div>

              <!-- Contact Support (only show if configured) -->
              <div
                v-if="contactInfo"
                class="border-t border-gray-100 px-4 py-2.5 dark:border-dark-700"
              >
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <svg
                    class="h-3.5 w-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                    />
                  </svg>
                  <span>{{ t('common.contactSupport') }}:</span>
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{
                    contactInfo
                  }}</span>
                </div>
              </div>

              <div v-if="showOnboardingButton" class="border-t border-gray-100 py-1 dark:border-dark-700">
                <button @click="handleReplayGuide" class="dropdown-item w-full">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a1 1 0 110 2 1 1 0 010-2zm1.07-7.75c0-.6-.49-1.25-1.32-1.25-.7 0-1.22.4-1.43 1.02a1 1 0 11-1.9-.62A3.41 3.41 0 0111.8 5c2.02 0 3.25 1.4 3.25 2.9 0 2-1.83 2.55-2.43 3.12-.43.4-.47.75-.47 1.23a1 1 0 01-2 0c0-1 .16-1.82 1.1-2.7.69-.64 1.82-1.05 1.82-2.06z"
                    />
                  </svg>
                  {{ $t('onboarding.restartTour') }}
                </button>
              </div>

              <div class="border-t border-gray-100 py-1 dark:border-dark-700">
                <button
                  @click="handleLogout"
                  class="dropdown-item w-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  {{ t('nav.logout') }}
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveRouteMetaKeys } from '@/router/title'
import { resolveBalancePurchaseAction, resolveSiteBillingMode } from '@/utils/siteBillingMode'
import { useConsoleViewport } from '@/composables/useConsoleViewport'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()
const onboardingStore = useOnboardingStore()

const user = computed(() => authStore.user)
const { isPhone } = useConsoleViewport()
const homePath = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
// 顶栏余额旁的「充值」：开启支付、非简易模式、且没关余额充值（仅订阅站点走侧栏的「订阅」）才显示
const showRechargeButton = computed(
  () =>
    resolveBalancePurchaseAction(appStore.cachedPublicSettings, {
      paymentEnabled: isFeatureFlagEnabled(FeatureFlags.payment),
      simpleMode: authStore.isSimpleMode,
    }) === 'recharge',
)

// 主题切换（原在侧栏底部，v3 移到顶栏）；启动时的主题由 main.ts initThemeClass 决定
const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const contactInfo = computed(() => appStore.contactInfo)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() => t('common.availableBalance') === 'common.availableBalance' ? '可用余额' : t('common.availableBalance'))
const balanceFrozenText = computed(() => t('common.frozenBalance') === 'common.frozenBalance' ? '冻结金额' : t('common.frozenBalance'))
const balanceTotalText = computed(() => t('common.totalBalance') === 'common.totalBalance' ? '总余额' : t('common.totalBalance'))
const balanceFrozenLabel = computed(() => `${balanceFrozenText.value} ${formatHeaderMoney(frozenBalance.value)}`)

// 只在标准模式的管理员下显示新手引导按钮
const showOnboardingButton = computed(() => {
  return !authStore.isSimpleMode && user.value?.role === 'admin'
})

const userInitials = computed(() => {
  if (!user.value) return ''
  // Prefer username, fallback to email
  if (user.value.username) {
    return user.value.username.substring(0, 2).toUpperCase()
  }
  if (user.value.email) {
    // Get the part before @ and take first 2 chars
    const localPart = user.value.email.split('@')[0]
    return localPart.substring(0, 2).toUpperCase()
  }
  return ''
})

const displayName = computed(() => {
  if (!user.value) return ''
  return user.value.username || user.value.email?.split('@')[0] || ''
})

// 订阅功能关闭时不挂载顶栏订阅徽章（组件 onMounted 会拉取订阅接口）。
const subscriptionFeatureEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))

// /purchase 的标题/描述随站点计费模式切换，与 document.title 共用同一解析。
const routeMetaKeys = computed(() => resolveRouteMetaKeys(route, {
  billingMode: resolveSiteBillingMode(appStore.cachedPublicSettings),
}))

const pageTitle = computed(() => {
  // For custom pages, use the menu item's label instead of generic "自定义页面"
  if (route.name === 'CustomPage') {
    const id = route.params.id as string
    const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
    const menuItem = publicItems.find((item) => item.id === id)
      ?? (authStore.isAdmin ? adminSettingsStore.customMenuItems.find((item) => item.id === id) : undefined)
    if (menuItem?.label) return menuItem.label
  }
  const titleKey = routeMetaKeys.value.titleKey
  if (titleKey) {
    return t(titleKey)
  }
  return (route.meta.title as string) || ''
})

const pageDescription = computed(() => {
  const descKey = routeMetaKeys.value.descriptionKey
  if (descKey) {
    return t(descKey)
  }
  return (route.meta.description as string) || ''
})

function toggleMobileSidebar() {
  appStore.toggleMobileSidebar()
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  try {
    await authStore.logout()
  } catch (error) {
    // Ignore logout errors - still redirect to login
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function handleReplayGuide() {
  closeDropdown()
  onboardingStore.replay()
}

function formatHeaderMoney(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style>
/* v3 顶栏。不用 scoped：scoped 里的 :global(.dark) x 会被编译成光秃的 .dark {}；类名都带 console- 前缀。 */
/* ---- v3 top bar ---- */
.console-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid rgb(var(--c-gray-200));
  background: rgb(var(--c-gray-50) / 0.88);
  backdrop-filter: blur(16px);
}

.dark .console-topbar {
  border-bottom-color: #1f2d48;
  background: rgb(7 14 29 / 0.88);
}

.console-topbar__row {
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 32px;
}

@media (min-width: 1280px) {
  .console-topbar__row {
    padding: 0 40px;
  }
}

/* 手机：夜空顶栏，高 52 */
.console-topbar--night,
.dark .console-topbar--night {
  border-bottom-color: transparent;
  background-color: #091430;
  background-image:
    url('./assets/appbar-stars.svg'),
    linear-gradient(180deg, #050b18 0%, #091430 100%);
  background-repeat: no-repeat;
  background-size: 390px 140px, 100% 100%;
  backdrop-filter: none;
}

.console-topbar--night .console-bell button {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: #dbe6fb;
}

.console-topbar--night .console-bell button:hover {
  background: rgb(219 230 251 / 0.08);
}

.console-topbar--night .console-topbar__row {
  height: 52px;
  padding: 0 14px 0 6px;
}

.console-topbar__menu {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #dbe6fb;
}

.console-topbar__menu:hover {
  background: rgb(219 230 251 / 0.08);
}

.console-topbar__brand {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.console-topbar__mark {
  width: 26px;
  height: 29px;
  flex: none;
  object-fit: contain;
}

.console-topbar__mark--uploaded {
  width: 29px;
  height: 29px;
  padding: 2px;
  border-radius: 7px;
  background: #fff;
}

.console-topbar__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 6px 10px;
  color: #45536e;
  font-size: 14px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.console-topbar__link:hover {
  background: rgb(var(--c-gray-100));
  color: #0c1830;
}

.dark .console-topbar__link {
  color: #aab6cb;
}

.dark .console-topbar__link:hover {
  background: #0b1427;
  color: #e9eef8;
}

.console-topbar__theme {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--c-gray-200));
  border-radius: 999px;
  background: #fff;
  color: #45536e;
  transition: background-color 0.15s ease;
}

.console-topbar__theme:hover {
  background: rgb(var(--c-gray-50));
}

.dark .console-topbar__theme {
  border-color: #1f2d48;
  background: #0e1830;
  color: #aab6cb;
}

/* 余额胶囊：余额 + 等宽金额 + 充值 */
.console-balance {
  position: relative;
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 14px;
  border: 1px solid rgb(var(--c-gray-200));
  border-radius: 999px;
  background: #fff;
}

.console-balance:not(:has(.console-balance__cta)) {
  padding-right: 14px;
}

.dark .console-balance {
  border-color: #1f2d48;
  background: #0e1830;
}

.console-balance__label {
  color: #66738c;
  font-size: 12px;
}

.dark .console-balance__label {
  color: #7f8ca5;
}

.console-balance__value {
  color: #0c1830;
  font-family: theme('fontFamily.mono');
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.dark .console-balance__value {
  color: #e9eef8;
}

.console-balance__cta {
  display: inline-flex;
  height: 28px;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  background: #14306b;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.console-balance__cta:hover {
  background: #0f2452;
}

.dark .console-balance__cta {
  background: #dbe6fb;
  color: #0e1830;
}

.console-balance__tip {
  pointer-events: none;
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 40;
  display: none;
  width: 14rem;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid rgb(var(--c-gray-200));
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--c-shadow-pop);
  font-size: 12px;
}

.console-balance:hover .console-balance__tip {
  display: block;
}

.dark .console-balance__tip {
  border-color: #1f2d48;
  background: #0e1830;
}

/* 手机夜空顶栏里的余额：月白 6% 底、白 22% 描边 */
.console-balance--night,
.dark .console-balance--night {
  height: 30px;
  gap: 6px;
  padding: 0 10px;
  border-color: rgb(255 255 255 / 0.22);
  background: rgb(219 230 251 / 0.06);
  color: #dbe6fb;
}

.console-balance--night .console-balance__value,
.dark .console-balance--night .console-balance__value {
  color: #e9eef8;
  font-size: 12px;
}

.console-account {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 2px;
}

.console-account__avatar {
  display: flex;
  width: 32px;
  height: 32px;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 999px;
  background: #14306b;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.dark .console-account__avatar {
  background: #dbe6fb;
  color: #0e1830;
}

.console-account__avatar--night,
.dark .console-account__avatar--night {
  width: 30px;
  height: 30px;
  background: #dbe6fb;
  color: #0e1830;
  font-size: 13px;
}

</style>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
