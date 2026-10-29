import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

describe('Vue I18n runtime compatibility', () => {
  it('supports lazy messages, locale changes, fallback and interpolation', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      fallbackLocale: 'en',
      missingWarn: false,
      fallbackWarn: false,
      messages: { en: { greeting: 'Hello {name}', items: 'one item | {count} items', fallback: 'Fallback' } }
    })

    expect(i18n.global.t('greeting', { name: 'Ada' })).toBe('Hello Ada')
    expect(i18n.global.t('items', 2)).toBe('2 items')

    i18n.global.setLocaleMessage('zh', { greeting: '你好，{name}' })
    i18n.global.locale.value = 'zh'

    expect(i18n.global.t('greeting', { name: 'Ada' })).toBe('你好，Ada')
    expect(i18n.global.t('fallback')).toBe('Fallback')
  })

  it('neutralizes iframe srcdoc when escaping HTML translation parameters', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      escapeParameter: true,
      warnHtmlMessage: false,
      messages: { en: { message: '<iframe srcdoc="{content}"></iframe>' } }
    })
    const element = document.createElement('div')
    element.innerHTML = i18n.global.t('message', { content: '<b>untrusted</b>' })

    expect(element.querySelector('iframe')).not.toBeNull()
    expect(element.querySelector('[srcdoc]')).toBeNull()
  })
})
