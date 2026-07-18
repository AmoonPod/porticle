import { z } from 'zod'

export const portNumberSchema = z.number().int().min(1).max(65535)
export const processTokenSchema = z.string().min(3).max(256)

export const terminateRequestSchema = z.strictObject({
  id: z.string().min(1).max(512),
  endpointKey: z.string().min(1).max(320),
  processToken: processTokenSchema,
  pid: z.number().int().positive(),
  port: portNumberSchema,
  force: z.boolean().optional()
})

export const copyRequestSchema = z.strictObject({
  id: z.string().min(1).max(512),
  field: z.enum(['port', 'pid', 'command', 'address', 'url'])
})

export const openRequestSchema = z.strictObject({
  id: z.string().min(1).max(512)
})

export const watchRequestSchema = z.strictObject({
  port: portNumberSchema,
  watched: z.boolean()
})

export const settingsSchema = z.strictObject({
  theme: z.enum(['system', 'light', 'dark']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  refreshInterval: z.union([z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000)]),
  confirmBeforeKill: z.boolean(),
  forceKillAfterMs: z.union([z.literal(0), z.literal(1500), z.literal(3000)]),
  launchAtLogin: z.boolean(),
  shortcutEnabled: z.boolean(),
  globalShortcut: z.string().trim().min(1).max(80),
  watchedPorts: z.array(portNumberSchema).max(64),
  notifications: z.boolean()
})

export const settingsPatchSchema = settingsSchema.partial()

export const noArgumentsSchema = z.tuple([])
