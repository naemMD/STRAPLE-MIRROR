"""
AI Coach — LLM initialization and chat logic.

Supports any OpenAI-compatible API (OpenAI, Azure, Ollama, vLLM, etc.)
Configure via environment variables:
  - AI_MODEL_PROVIDER: "openai" (default) or "ollama"
  - AI_MODEL_NAME: model identifier (e.g. "gpt-4o-mini", "llama3")
  - AI_API_KEY: API key (not needed for local models)
  - AI_API_BASE_URL: custom base URL (e.g. "http://localhost:11434/v1" for Ollama)
"""

import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AI_MODEL_PROVIDER = os.getenv("AI_MODEL_PROVIDER", "openai")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "gpt-4o-mini")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_API_BASE_URL = os.getenv("AI_API_BASE_URL", None)

# ---------------------------------------------------------------------------
# Client initialization
# ---------------------------------------------------------------------------

_client: AsyncOpenAI | None = None


def get_ai_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client configured from env vars."""
    global _client
    if _client is None:
        kwargs: dict = {"api_key": AI_API_KEY}
        if AI_API_BASE_URL:
            kwargs["base_url"] = AI_API_BASE_URL
        _client = AsyncOpenAI(**kwargs)
    return _client


# ---------------------------------------------------------------------------
# System prompt — defines the AI coach personality
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are NutriCoach, an AI assistant specialized in nutrition and fitness, integrated into the NutriTrain app.

Your role:
- Provide personalized nutrition and training advice
- Answer questions about food, macronutrients, and exercises
- Motivate and encourage the user in their progress
- Suggest food alternatives and program adjustments

Rules:
- Always reply in the same language the user writes in
- Be concise but informative
- NEVER make medical diagnoses — redirect to a healthcare professional when needed
- Use a supportive and motivating tone
- If you have access to the user's profile, personalize your answers based on their goals
"""


# ---------------------------------------------------------------------------
# Chat completion
# ---------------------------------------------------------------------------

async def generate_ai_response(
    user_message: str,
    conversation_history: list[dict] | None = None,
    user_context: dict | None = None,
) -> str:
    """
    Generate an AI coach response.

    Args:
        user_message: The user's latest message.
        conversation_history: Previous messages [{"role": ..., "content": ...}].
        user_context: Optional user profile data to inject into context.

    Returns:
        The AI assistant's response text.
    """
    client = get_ai_client()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject user profile context if available
    if user_context:
        context_parts = []
        if user_context.get("firstname"):
            context_parts.append(f"Prénom: {user_context['firstname']}")
        if user_context.get("goal"):
            goal_map = {
                "lose_weight": "lose weight",
                "gain_muscle": "gain muscle",
                "maintain_weight": "maintain weight",
            }
            context_parts.append(f"Goal: {goal_map.get(user_context['goal'], user_context['goal'])}")
        if user_context.get("weight"):
            context_parts.append(f"Weight: {user_context['weight']} kg")
        if user_context.get("height"):
            context_parts.append(f"Height: {user_context['height']} cm")
        if user_context.get("daily_caloric_needs"):
            context_parts.append(f"Daily caloric needs: {user_context['daily_caloric_needs']} kcal/day")

        if context_parts:
            messages.append({
                "role": "system",
                "content": "User profile:\n" + "\n".join(context_parts),
            })

    # Add conversation history (last 20 messages max to stay within context)
    if conversation_history:
        messages.extend(conversation_history[-20:])

    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model=AI_MODEL_NAME,
        messages=messages,
        max_tokens=1024,
        temperature=0.7,
    )

    return response.choices[0].message.content or ""

#   ---------------------------------------------------------------------------

# from openai import OpenAI

# client = OpenAI(
#     base_url = "https://api.scaleway.ai/65a7dd3f-2376-4856-8e6f-8162c28d6f9a/v1",
#     api_key = "SCW_SECRET_KEY" # Replace SCW_SECRET_KEY with your IAM API key
# )

# response = client.chat.completions.create(
#   model="llama-3.1-8b-instruct",
#   messages=[
#     { "role": "system", "content": "You are a helpful assistant" },
#     { "role": "user", "content": "" },
#   ],
#   max_tokens=2048,
#   temperature=0.6,
#   top_p=0.9,
#   presence_penalty=0,
#   stream=false,
#   response_format={ "type": "text" }
# )

# for chunk in response:
#     if chunk.choices and chunk.choices[0].delta.content:
#         print(chunk.choices[0].delta.content, end="", flush=True)