import { queryVectorStore } from './vectorStore'
import { generateAnswer } from './llm'

// High-level RAG function
async function answerTeamQuery(userId: string, teamId: string, query: string) {
  // 1. Check user access
  const userHasAccess = await doesUserHaveTeamAccess(userId, teamId)
  if (!userHasAccess) {
    throw new Error('Unauthorized to access this team')
  }

  // 2. Retrieve top relevant messages from only this team
  const messages = await queryVectorStore(query, {
    filter: { team_id: teamId }, // Vector store-level filter
    topK: 5
  })

  // 3. Use the retrieved messages to augment the LLM prompt
  const llmInput = createPromptWithContext(query, messages)

  // 4. Generate the final answer
  const answer = await generateAnswer(llmInput)

  return answer
}