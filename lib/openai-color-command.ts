export interface OpenAIColorCommand {
  targetLabel: string
  color: string
}

interface ResolveColorCommandParams {
  apiKey: string
  userMessage: string
  labels: string[]
}

export async function resolveColorCommand({
  apiKey,
  userMessage,
  labels,
}: ResolveColorCommandParams): Promise<OpenAIColorCommand> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You convert a natural language request into a JSON color edit command for a 3D model. " +
            "Match user intent to one of the provided labels using exact or partial name matching. " +
            "Return ONLY valid JSON with keys targetLabel and color. " +
            "color must be a #RRGGBB hex string.",
        },
        {
          role: "user",
          content: `Available labels: ${labels.join(", ")}\\nRequest: ${userMessage}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (!content || typeof content !== "string") {
    throw new Error("OpenAI API returned an empty response")
  }

  const parsed = JSON.parse(content) as Partial<OpenAIColorCommand>

  if (!parsed.targetLabel || !parsed.color) {
    throw new Error("OpenAI response missing targetLabel or color")
  }

  const normalizedColor = parsed.color.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    throw new Error(`Invalid color format returned by OpenAI: ${normalizedColor}`)
  }

  return {
    targetLabel: parsed.targetLabel.trim(),
    color: normalizedColor,
  }
}
