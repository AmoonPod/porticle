import type { Protocol, RecognizedService } from '../../shared/model'

interface ServiceInput {
  port: number
  protocol: Protocol
  processName: string
  command?: string
}

interface ServiceRule {
  id: string
  name: string
  category: RecognizedService['category']
  ports?: readonly number[]
  pattern?: RegExp
  web?: boolean
  secure?: boolean
}

const SERVICE_RULES: readonly ServiceRule[] = [
  { id: 'next', name: 'Next.js', category: 'web', pattern: /\bnext(?:\.js)?\b/i, web: true },
  { id: 'vite', name: 'Vite', category: 'web', pattern: /\bvite\b/i, web: true },
  { id: 'astro', name: 'Astro', category: 'web', pattern: /\bastro\b/i, web: true },
  { id: 'nuxt', name: 'Nuxt', category: 'web', pattern: /\bnuxt\b/i, web: true },
  { id: 'storybook', name: 'Storybook', category: 'web', ports: [6006], web: true },
  {
    id: 'django',
    name: 'Django',
    category: 'web',
    pattern: /\b(?:manage\.py|django)\b/i,
    web: true
  },
  { id: 'flask', name: 'Flask', category: 'web', pattern: /\bflask\b/i, web: true },
  { id: 'rails', name: 'Rails', category: 'web', pattern: /\b(?:rails|puma)\b/i, web: true },
  { id: 'jupyter', name: 'Jupyter', category: 'web', pattern: /\bjupyter\b/i, web: true },
  { id: 'postgres', name: 'PostgreSQL', category: 'database', ports: [5432] },
  { id: 'mysql', name: 'MySQL', category: 'database', ports: [3306] },
  { id: 'mssql', name: 'SQL Server', category: 'database', ports: [1433] },
  { id: 'mongodb', name: 'MongoDB', category: 'database', ports: [27017] },
  { id: 'redis', name: 'Redis', category: 'cache', ports: [6379] },
  { id: 'memcached', name: 'Memcached', category: 'cache', ports: [11211] },
  {
    id: 'rabbitmq-management',
    name: 'RabbitMQ Management',
    category: 'queue',
    ports: [15672],
    web: true
  },
  { id: 'rabbitmq', name: 'RabbitMQ', category: 'queue', ports: [5672] },
  { id: 'kafka', name: 'Kafka', category: 'queue', ports: [9092] },
  { id: 'elasticsearch', name: 'Elasticsearch', category: 'database', ports: [9200], web: true },
  { id: 'localstack', name: 'LocalStack', category: 'container', ports: [4566], web: true },
  { id: 'docker', name: 'Docker', category: 'container', pattern: /\b(?:docker|com\.docker)\b/i },
  {
    id: 'kubernetes',
    name: 'Kubernetes API',
    category: 'container',
    ports: [6443],
    web: true,
    secure: true
  },
  { id: 'ollama', name: 'Ollama', category: 'other', ports: [11434], web: true }
]

const COMMON_WEB_PORTS = new Set([
  80, 443, 3000, 3001, 4000, 4173, 4200, 4321, 5000, 5173, 5174, 7000, 8000, 8080, 8081, 8443, 8888
])

export function recognizeService(input: ServiceInput): RecognizedService | undefined {
  const haystack = `${input.processName} ${input.command ?? ''}`
  const rule = SERVICE_RULES.find((candidate) => {
    const portMatches = candidate.ports?.includes(input.port) ?? false
    const processMatches = candidate.pattern?.test(haystack) ?? false
    return portMatches || processMatches
  })

  const canOpen =
    input.protocol === 'tcp' && (rule?.web === true || COMMON_WEB_PORTS.has(input.port))
  const url = canOpen
    ? `${rule?.secure === true || input.port === 443 || input.port === 8443 ? 'https' : 'http'}://localhost:${input.port}`
    : undefined

  if (rule) {
    return {
      id: rule.id,
      name: rule.name,
      category: rule.category,
      ...(url ? { url } : {})
    }
  }

  if (url) {
    return {
      id: 'local-web',
      name: 'Local web service',
      category: 'web',
      url
    }
  }

  return undefined
}
