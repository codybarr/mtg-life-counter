import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'

import type { Plugin, ResolvedConfig } from 'vite'

const listFiles = async (dir: string): Promise<Array<string>> => {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
}

/** Writes `sw.js` into the build output after Vite (and its public/ copy) is
 *  done, filling `scripts/sw.template.js` with a content-hash cache version
 *  and the list of every emitted file to precache. */
export const serviceWorker = (): Plugin => {
  let config: ResolvedConfig
  return {
    name: 'mtg-life:service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir)
      const files = (await listFiles(outDir))
        .map(file => `/${relative(outDir, file).split('\\').join('/')}`)
        .filter(path => !path.endsWith('.map') && path !== '/sw.js')
        .sort()

      const hash = createHash('sha256')
      for (const path of files) hash.update(await readFile(join(outDir, path)))
      const version = hash.digest('hex').slice(0, 12)

      const precache = ['/', ...files.filter(path => path !== '/index.html')]
      const template = await readFile(resolve(config.root, 'scripts/sw.template.js'), 'utf8')
      await writeFile(
        join(outDir, 'sw.js'),
        template
          .replace('__VERSION__', version)
          .replace('__PRECACHE__', JSON.stringify(precache)),
      )
      config.logger.info(`sw.js: precaching ${precache.length} files (cache ${version})`)
    },
  }
}
