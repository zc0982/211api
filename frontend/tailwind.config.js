/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调：v3「星链」学院深蓝 / 星光蓝（DESIGN.md · Colors；Figma「211API · Console v3」）。
        // 800 = navy #14306b（浅色主按钮），600 = blue #2f5fd0，400 = 夜空蓝 #7aa2ff（深色强调），
        // 100 = tint #e8f0fc，300 = sky #bfd6f6。
        primary: {
          50: '#f2f6fd',
          100: '#e8f0fc',
          200: '#d3e2f9',
          300: '#bfd6f6',
          400: '#7aa2ff',
          500: '#4a78e0',
          600: '#2f5fd0',
          700: '#1f449e',
          800: '#14306b',
          900: '#0f2452',
          950: '#091430'
        },
        // 中性色随主题切换（值在 style.css :root / .dark）：浅色是暖纸色系（canvas / band / line），
        // 深色下 50–400 换成冷色月白，供 dark:text-gray-* 使用。500–950 两套主题相同。
        gray: {
          50: 'rgb(var(--c-gray-50) / <alpha-value>)',
          100: 'rgb(var(--c-gray-100) / <alpha-value>)',
          200: 'rgb(var(--c-gray-200) / <alpha-value>)',
          300: 'rgb(var(--c-gray-300) / <alpha-value>)',
          400: 'rgb(var(--c-gray-400) / <alpha-value>)',
          500: '#66738c',
          600: '#45536e',
          700: '#33405c',
          800: '#1c2944',
          900: '#0c1830',
          950: '#070e1d'
        },
        // 辅助色 - 深蓝灰
        accent: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        // 深色模式：夜空色系（DESIGN.md 深色色板）。950 = canvas #070e1d，900 = band #0b1427，
        // 800 = surface #0e1830，700 = line #1f2d48，600 = 按钮描边 #2b3a58，400 = mist，300 = slate，100 = ink。
        dark: {
          50: '#f4f7fc',
          100: '#e9eef8',
          200: '#cfd8e8',
          300: '#aab6cb',
          400: '#7f8ca5',
          500: '#5d6b86',
          600: '#2b3a58',
          700: '#1f2d48',
          800: '#0e1830',
          900: '#0b1427',
          950: '#070e1d'
        },
        // v3 用户后台的星光色：古铜只给金额，金色只给被追踪的那一次调用，信号绿只表示状态
        star: {
          gold: '#d4a84b',
          'gold-night': '#e3b95e',
          bronze: '#8a6420',
          'bronze-night': '#ecc978',
          ok: '#137a52',
          'ok-night': '#3dd68c'
        },
        // 品牌首页（features/brand-home）专用。值由 .brand-home 上的 CSS 变量承载（浅色），
        // .dark .brand-home 覆盖为深色；取值见 features/brand-home/styles/brand-home.css
        brand: {
          navy: 'rgb(var(--brand-navy) / <alpha-value>)',
          blue: 'rgb(var(--brand-blue) / <alpha-value>)',
          gold: 'rgb(var(--brand-gold) / <alpha-value>)',
          bronze: 'rgb(var(--brand-bronze) / <alpha-value>)',
          ink: 'rgb(var(--brand-ink) / <alpha-value>)',
          slate: 'rgb(var(--brand-slate) / <alpha-value>)',
          mist: 'rgb(var(--brand-mist) / <alpha-value>)',
          ok: 'rgb(var(--brand-ok) / <alpha-value>)',
          line: 'rgb(var(--brand-line) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface) / <alpha-value>)',
          canvas: 'rgb(var(--brand-canvas) / <alpha-value>)',
          band: 'rgb(var(--brand-band) / <alpha-value>)',
          tint: 'rgb(var(--brand-tint) / <alpha-value>)',
          sky: 'rgb(var(--brand-sky) / <alpha-value>)'
        }
      },
      fontFamily: {
        // 与品牌首页同一套无衬线字体栈（DESIGN.md · Typography）；Inter 只在本机已安装时生效
        sans: [
          'Inter',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          '-apple-system',
          'system-ui',
          'Segoe UI',
          'sans-serif'
        ],
        // 可核对的数字一律 Geist Mono（The Tabular Truth Rule），字体文件见 style.css @font-face
        mono: ['"Brand Geist Mono"', '"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        'brand-serif': ['"Brand Noto Serif SC"', '"Noto Serif SC"', '"Songti SC"', 'serif'],
        'brand-sans': ['"Brand Noto Sans SC"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        'brand-mono': ['"Brand Geist Mono"', '"Geist Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        'brand-wordmark': ['"Brand Geist"', 'Geist', '"Noto Sans SC"', 'sans-serif']
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.06)',
        glow: '0 0 20px rgba(47, 95, 208, 0.22)',
        'glow-lg': '0 0 40px rgba(47, 95, 208, 0.3)',
        // v3 卡片与浮层阴影（Figma C0：card 0 8 24 -12，float 0 18 40 -14），按主题取值见 style.css
        card: 'var(--c-shadow-card)',
        'card-hover': 'var(--c-shadow-pop)',
        float: 'var(--c-shadow-float)',
        pop: 'var(--c-shadow-pop)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        // 品牌首页阴影随主题切换（深色为黑色、3 倍不透明度），由 brand-home.css 的变量承载
        'brand-primary': 'var(--bh-shadow-primary)',
        'brand-primary-hover': 'var(--bh-shadow-primary-hover)',
        'brand-glass': 'var(--bh-shadow-glass)',
        'brand-glass-hover': 'var(--bh-shadow-glass-hover)',
        'brand-card': 'var(--bh-shadow-card)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #2f5fd0 0%, #14306b 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'mesh-gradient':
          'radial-gradient(at 40% 20%, rgba(47, 95, 208, 0.06) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(122, 162, 255, 0.05) 0px, transparent 50%)',
        // v3 夜空（侧栏、手机顶栏）
        'night-sky': 'linear-gradient(180deg, #050b18 0%, #091430 55%, #13244b 100%)',
        'night-bar': 'linear-gradient(180deg, #050b18 0%, #091430 100%)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.25)' },
          '100%': { boxShadow: '0 0 30px rgba(20, 184, 166, 0.4)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderRadius: {
        '4xl': '2rem',
        'brand-tile': '8px',
        'brand-card': '16px',
        'brand-panel': '20px',
        'brand-pill': '999px'
      }
    }
  },
  plugins: []
}
