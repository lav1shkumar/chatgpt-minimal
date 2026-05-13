export const AI_Models = [
  {
    name: 'GPT-5.5',
    value: 'gpt-5.5-1'
  },
  {
    name: 'GPT-5.4 Pro',
    value: 'gpt-5.4-pro-1'
  },
  {
    name: 'GPT-5.4',
    value: 'gpt-5.4'
  }
] as const

export type AIModelValue = (typeof AI_Models)[number]['value']

export const DEFAULT_AI_MODEL = AI_Models[0]

export const AI_MODEL_VALUES = AI_Models.map((model) => model.value) as [
  AIModelValue,
  ...AIModelValue[]
]

export function isAIModelValue(value: unknown): value is AIModelValue {
  return typeof value === 'string' && (AI_MODEL_VALUES as readonly string[]).includes(value)
}
