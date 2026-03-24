"""
AI Coach — LLM initialization and chat logic.

Supports any OpenAI-compatible API (OpenAI, Azure, Ollama, vLLM, Scaleway etc.)
Configure via environment variables:
  - AI_MODEL_PROVIDER: "scaleway"
  - AI_MODEL_NAME: "mistral-small-3.2-24b-instruct-2506"
  - MISTRAL_API_KEY: Your Scaleway Secret Key
  - AI_API_BASE_URL: "https://api.scaleway.ai/65a7dd3f-2376-4856-8e6f-8162c28d6f9a/v1"
"""

import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration (On met les valeurs Scaleway par défaut)
# ---------------------------------------------------------------------------

AI_MODEL_PROVIDER = os.getenv("AI_MODEL_PROVIDER", "scaleway")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "mistral-small-3.2-24b-instruct-2506")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
AI_API_BASE_URL = os.getenv("SCALEWAY_API_URL")

# ---------------------------------------------------------------------------
# Client initialization
# ---------------------------------------------------------------------------

_client: AsyncOpenAI | None = None

def get_ai_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client configured from env vars."""
    global _client
    if _client is None:
        kwargs: dict = {"api_key": MISTRAL_API_KEY}
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
    """
    client = get_ai_client()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject user profile context if available
    if user_context:
        context_parts = []
        if user_context.get("firstname"):
            context_parts.append(f"Name: {user_context['firstname']}")
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

    try:
        response = await client.chat.completions.create(
            model=AI_MODEL_NAME,
            messages=messages,
            max_tokens=2048,
            temperature=0.7,
            top_p=1,
            presence_penalty=0
        )
        return response.choices[0].message.content or ""
        
    except Exception as e:
        print(f"[AI Coach] Error calling LLM API: {e}")
        raise