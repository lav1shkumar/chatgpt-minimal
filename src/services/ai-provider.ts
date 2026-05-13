import 'server-only'

import { DEFAULT_AI_MODEL, type AIModelValue } from '@/services/ai-models'
import { createAzure } from '@ai-sdk/azure'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

type AzureCachedModel = {
  mode: 'azure'
  model: LanguageModel
}

type OpenAiCachedModel = {
  mode: 'openai'
  model: LanguageModel
  openaiModel: string
  openaiProvider: ReturnType<typeof createOpenAI>
}

type CachedModel = AzureCachedModel | OpenAiCachedModel

let cachedOpenAiModel: OpenAiCachedModel | undefined
const cachedAzureModels = new Map<string, AzureCachedModel>()

export function getModel(
  selectedAzureDeployment: AIModelValue = DEFAULT_AI_MODEL.value
): CachedModel {
  const azureResourceName = process.env.AZURE_OPENAI_RESOURCE_NAME
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY
  const azureDeployment =
    selectedAzureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_AI_MODEL.value

  if (azureResourceName && azureApiKey && azureDeployment) {
    const cachedAzureModel = cachedAzureModels.get(azureDeployment)
    if (cachedAzureModel) {
      return cachedAzureModel
    }

    const azure = createAzure({
      resourceName: azureResourceName,
      apiKey: azureApiKey
    })
    const modelConfig: AzureCachedModel = { mode: 'azure', model: azure(azureDeployment) }
    cachedAzureModels.set(azureDeployment, modelConfig)
    return modelConfig
  }

  if (cachedOpenAiModel) {
    return cachedOpenAiModel
  }

  const openaiApiKey = process.env.OPENAI_API_KEY
  let openaiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  // createOpenAI builds request paths relative to baseURL; without a /v1 suffix,
  // many OpenAI-compatible servers resolve to non-versioned endpoints and return 404.
  if (!openaiBaseUrl.endsWith('/v1')) {
    openaiBaseUrl = openaiBaseUrl.replace(/\/$/, '') + '/v1'
  }
  if (!openaiApiKey) {
    throw new Error(
      'No AI provider configured. Please set either Azure OpenAI or OpenAI credentials in environment variables.'
    )
  }

  const openai = createOpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiBaseUrl
  })

  cachedOpenAiModel = {
    mode: 'openai',
    model: openai.chat(openaiModel),
    openaiModel,
    openaiProvider: openai
  }
  return cachedOpenAiModel
}
