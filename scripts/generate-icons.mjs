import { execFile } from 'node:child_process'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { resolve } from 'node:path'
import process from 'node:process'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const resources = resolve(root, 'resources')
const generated = resolve(resources, 'generated')
const rendererPublic = resolve(root, 'src', 'renderer', 'public')
const iconset = resolve(generated, 'Porticle.iconset')
const iconSource = resolve(resources, 'icon.svg')
const trayTemplateSource = resolve(resources, 'trayTemplate.svg')
const trayWindowsSource = resolve(resources, 'tray-windows.svg')

await rm(generated, { recursive: true, force: true })
await mkdir(iconset, { recursive: true })
await mkdir(rendererPublic, { recursive: true })

const sizes = [16, 32, 64, 128, 256, 512, 1024]
const pngs = new Map()
for (const size of sizes) {
  const destination = resolve(generated, `icon-${size}.png`)
  await sharp(iconSource).resize(size, size).png({ compressionLevel: 9 }).toFile(destination)
  pngs.set(size, destination)
}

await sharp(iconSource)
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(resolve(resources, 'icon.png'))

const iconsetFiles = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
]
for (const [size, name] of iconsetFiles) {
  await sharp(iconSource)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(iconset, name))
}

if (process.platform === 'darwin') {
  await execFileAsync('/usr/bin/iconutil', [
    '-c',
    'icns',
    iconset,
    '-o',
    resolve(resources, 'icon.icns')
  ])
}

const icoBuffer = await pngToIco([pngs.get(16), pngs.get(32), pngs.get(64), pngs.get(256)])
await writeFile(resolve(resources, 'icon.ico'), icoBuffer)
await copyFile(iconSource, resolve(rendererPublic, 'favicon.svg'))
await writeFile(resolve(rendererPublic, 'favicon.ico'), icoBuffer)
await sharp(iconSource)
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(resolve(rendererPublic, 'favicon-32x32.png'))
await sharp(iconSource)
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(resolve(rendererPublic, 'apple-touch-icon.png'))

await sharp(trayTemplateSource).resize(20, 20).png().toFile(resolve(resources, 'trayTemplate.png'))
await sharp(trayTemplateSource)
  .resize(40, 40)
  .png()
  .toFile(resolve(resources, 'trayTemplate@2x.png'))
await sharp(trayWindowsSource).resize(20, 20).png().toFile(resolve(resources, 'tray-windows.png'))
await sharp(trayWindowsSource)
  .resize(40, 40)
  .png()
  .toFile(resolve(resources, 'tray-windows@2x.png'))

process.stdout.write('Generated Porticle app and tray icons.\n')
