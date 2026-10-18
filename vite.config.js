import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { esStrings } from './src/i18n'

const AUTO_REDIRECT_MARKER_START = '<!-- i18n-auto-redirect-start -->'
const AUTO_REDIRECT_MARKER_END = '<!-- i18n-auto-redirect-end -->'
const LANG_SWITCHER_MARKER_START = '<!-- i18n-lang-switcher-start -->'
const LANG_SWITCHER_MARKER_END = '<!-- i18n-lang-switcher-end -->'

const autoRedirectHeadScript = `${AUTO_REDIRECT_MARKER_START}
  <script>
    (function () {
      try {
        var params = new URLSearchParams(location.search);
        var qLang = (params.get('locale') || params.get('lang') || '').toLowerCase();
        if (qLang === 'en') return;
        var saved = localStorage.getItem('lang');
        if (qLang !== 'es' && saved === 'en') return;
        if (qLang === 'es' || saved === 'es' || /^es\\b/i.test(navigator.language || '')) {
          var p = location.pathname;
          if (!/^\\/es(\\/|$)/.test(p)) {
            location.replace('/es' + (p.charAt(0) === '/' ? p : '/' + p) + location.search + location.hash);
          }
        }
      } catch (e) {}
    })();
  </script>
${AUTO_REDIRECT_MARKER_END}`

function buildLangSwitcher(fileName, locale) {
  const enHref = fileName === 'index.html' ? '/' : `/${fileName}`
  const esHref = fileName === 'index.html' ? '/es/' : `/es/${fileName}`
  const isEs = locale === 'es'

  if (fileName === 'journey.html') {
    return `${LANG_SWITCHER_MARKER_START}
  <div class="lang-switcher" role="navigation" aria-label="${isEs ? 'Selector de idioma' : 'Language selector'}">
    <a href="${enHref}" class="${!isEs ? 'active' : ''}" onclick="try{localStorage.setItem('lang','en')}catch(e){}">EN</a>
    <span class="lang-sep">|</span>
    <a href="${esHref}" class="${isEs ? 'active' : ''}" onclick="try{localStorage.setItem('lang','es')}catch(e){}">ES</a>
  </div>
${LANG_SWITCHER_MARKER_END}`
  }

  return `${LANG_SWITCHER_MARKER_START}
  <div class="footer-lang-switcher" role="navigation" aria-label="${isEs ? 'Language selector' : 'Selector de idioma'}">
    ${
      isEs
        ? `<a href="${enHref}" onclick="try{localStorage.setItem('lang','en')}catch(e){}">Prefer English? <span>View in English</span></a>`
        : `<a href="${esHref}" onclick="try{localStorage.setItem('lang','es')}catch(e){}">¿Hablás español? <span>Ver en español</span></a>`
    }
  </div>
${LANG_SWITCHER_MARKER_END}`
}

function injectEnglishEnhancements(html, fileName) {
  let out = html.replace('<head>', `<head>\n${autoRedirectHeadScript}`)
  const switcher = buildLangSwitcher(fileName, 'en')

  if (fileName === 'journey.html') {
    out = out.replace(/<body([^>]*)>/, `<body$1>\n${switcher}`)
  } else if (out.includes('<div class="editorial-closing-simple">')) {
    out = out.replace(
      /(<div class="editorial-closing-simple">[\s\S]*?)(<\/div>)/,
      `$1  ${switcher}\n  $2`
    )
  } else if (out.includes('</footer>')) {
    out = out.replace('</footer>', `  ${switcher}\n  </footer>`)
  } else if (out.includes('</section>\n  </main>')) {
    out = out.replace(/<\/section>\s*<\/main>/, `\n      ${switcher}\n    </section>\n  </main>`)
  } else {
    out = out.replace('</body>', `${switcher}\n</body>`)
  }

  return out
}

function replaceAttributeWithTranslation(tagHtml, dataAttrName, targetAttrName) {
  const match = tagHtml.match(new RegExp(`\\s${dataAttrName}="([^"]+)"`))
  if (!match) return tagHtml
  const key = match[1]
  const translated = esStrings[key]
  if (translated === undefined) {
    throw new Error(`[i18n] Missing Spanish translation for key: "${key}"`)
  }
  const escaped = translated.replace(/"/g, '&quot;')
  const targetAttrRegex = new RegExp(`(\\s)${targetAttrName}="[^"]*"`)
  if (targetAttrRegex.test(tagHtml)) {
    return tagHtml.replace(targetAttrRegex, `$1${targetAttrName}="${escaped}"`)
  }
  return tagHtml
}

function renderSpanishHtml(englishHtml, fileName) {
  let html = englishHtml

  // 1. Set <html lang="es">
  html = html.replace(/<html\s+lang="en"\s*>/i, '<html lang="es">')

  // 2. Remove the English auto-redirect script from <head>
  html = html.replace(
    new RegExp(`${AUTO_REDIRECT_MARKER_START}[\\s\\S]*?${AUTO_REDIRECT_MARKER_END}\\n?`, 'g'),
    ''
  )

  // 3. Replace inner content for elements with data-i18n="key"
  html = html.replace(
    /<([a-zA-Z0-9]+)\b([^>]*?\bdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (_full, tag, attrs, key) => {
      const translated = esStrings[key]
      if (translated === undefined) {
        throw new Error(`[i18n] Missing Spanish translation for key: "${key}" in ${fileName}`)
      }
      return `<${tag}${attrs}>${translated}</${tag}>`
    }
  )

  // 4. Replace translated attributes (placeholder, aria-label, alt)
  html = html.replace(/<[^>]+?\bdata-i18n-(?:placeholder|aria-label|alt)="[^"]+"[^>]*>/g, (tagHtml) => {
    let updated = tagHtml
    updated = replaceAttributeWithTranslation(updated, 'data-i18n-placeholder', 'placeholder')
    updated = replaceAttributeWithTranslation(updated, 'data-i18n-aria-label', 'aria-label')
    updated = replaceAttributeWithTranslation(updated, 'data-i18n-alt', 'alt')
    return updated
  })

  // 5. Rewrite internal links and form hidden fields for /es/
  html = html
    .replace(/href="\/"/g, 'href="/es/"')
    .replace(/href="\/(details|journey|rsvp|thanks|index)\.html"/g, 'href="/es/$1.html"')
    .replace(/name="_next"\s+value="\/thanks\.html"/g, 'name="_next" value="/es/thanks.html"')
    .replace(/name="lang"\s+value="en"/g, 'name="lang" value="es"')

  // 6. Swap language switcher to Spanish state (done last so its English href isn't rewritten)
  html = html.replace(
    new RegExp(`${LANG_SWITCHER_MARKER_START}[\\s\\S]*?${LANG_SWITCHER_MARKER_END}`, 'g'),
    buildLangSwitcher(fileName, 'es')
  )

  return html
}

function staticSpanishPlugin() {
  return {
    name: 'vite-plugin-static-spanish',
    enforce: 'post',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const cleanPath = (ctx.path || '/index.html').replace(/^\/+/, '') || 'index.html'
        const fileName = cleanPath.replace(/^es\//, '') || 'index.html'
        return injectEnglishEnhancements(html, fileName)
      },
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const [pathname, search = ''] = req.url.split('?')

        if (pathname === '/es') {
          res.statusCode = 302
          res.setHeader('Location', '/es/' + (search ? `?${search}` : ''))
          res.end()
          return
        }

        if (pathname.startsWith('/es/')) {
          const subPath = pathname.slice('/es/'.length) || 'index.html'
          const fileName = subPath.endsWith('.html') ? subPath : `${subPath.replace(/\/+$/, '') || 'index'}.html`
          const absPath = resolve(__dirname, fileName)

          if (existsSync(absPath)) {
            try {
              const rawHtml = readFileSync(absPath, 'utf-8')
              const transformed = await server.transformIndexHtml(`/${fileName}`, rawHtml, req.originalUrl)
              const spanishHtml = renderSpanishHtml(transformed, fileName)
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(spanishHtml)
              return
            } catch (err) {
              return next(err)
            }
          }
        }

        next()
      })
    },
    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && fileName.endsWith('.html') && !fileName.startsWith('es/')) {
          const englishHtml = typeof asset.source === 'string'
            ? asset.source
            : Buffer.from(asset.source).toString('utf-8')
          const spanishHtml = renderSpanishHtml(englishHtml, fileName)
          this.emitFile({
            type: 'asset',
            fileName: `es/${fileName}`,
            source: spanishHtml,
          })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [staticSpanishPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        details: resolve(__dirname, 'details.html'),
        journey: resolve(__dirname, 'journey.html'),
        rsvp: resolve(__dirname, 'rsvp.html'),
        thanks: resolve(__dirname, 'thanks.html'),
      },
    },
  },
})
