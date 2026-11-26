// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Run after editing the SVG: bun scripts/icons-png.ts
import { chromium } from '@playwright/test'

const svg = await Bun.file('public/icons/icon.svg').text()
const browser = await chromium.launch()
const page = await browser.newPage()

const render = async (file: string, size: number, padding = 0) => {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0;background:#000;display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${size - padding * 2}px;height:${size - padding * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
     </body>`,
  )
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: false })
}

await render('icon-192.png', 192)
await render('icon-512.png', 512)
// Maskable icons need their content inside the central 80% safe zone.
await render('icon-maskable-512.png', 512, 52)
await render('apple-touch-icon.png', 180)

await browser.close()
console.log('Rendered PWA icons')
