"""
AI Coach — LLM initialization and chat logic.

Supports any OpenAI-compatible API (OpenAI, Azure, Ollama, vLLM, Scaleway etc.)
Configure via environment variables:
  - AI_MODEL_PROVIDER: "scaleway"
  - AI_MODEL_NAME: "mistral-small-3.2-24b-instruct-2506"
  - MISTRAL_API_KEY: Your Scaleway Secret Key
  - SCALEWAY_API_URL: "https://api.scaleway.ai/65a7dd3f-2376-4856-8e6f-8162c28d6f9a/v1"
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
- Use a supportive and motivating tone
- If you have access to the user's profile, personalize your answers based on their goals

## Injury / Pain assessment protocol

When a user mentions pain, injury, discomfort, or any physical issue, you MUST follow this protocol:

1. **Gather information** — Ask targeted questions one or two at a time (don't overwhelm). You need to understand:
   - Exact location of the pain (ask them to point/describe precisely)
   - Type of pain (sharp, dull, burning, throbbing, stiffness)
   - When it started (during exercise? after? gradually?)
   - What exercise or movement triggered it
   - Pain intensity on a scale of 1-10
   - Whether they can still move the affected area and to what extent (range of motion)
   - Whether there is swelling, bruising, or visible deformation
   - Whether the pain gets worse with specific movements

2. **Provide a hypothesis-based assessment** — Once you have enough information, present your assessment as a structured list of hypotheses rather than invented percentages. Format example:
   - **Primary Hypothesis:** Muscle strain (grade I) of the [muscle name]
   - **Alternative Hypothesis:** Tendinitis of the [tendon]
   - **Point of Vigilance:** Minor ligament sprain (requires careful monitoring)

3. **For each possibility**, briefly explain why you think so based on what the user told you.

4. **Recommend immediate actions** (RICE protocol, rest, etc.) and adapted exercises they CAN still do safely.

5. **ALWAYS include this disclaimer** at the end of your assessment: this is an AI-based estimation, not a medical diagnosis. If pain persists beyond 48-72 hours or is severe, they must consult a doctor or physiotherapist.

IMPORTANT: Never refuse to assess. The user expects guidance. Do NOT just say "go see a doctor" without first going through the assessment. The assessment is explicitly presented as probabilistic and non-medical — it helps the user understand what might be going on while they decide whether to seek professional help.
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

    # Add conversation history (last 10 messages max to stay within context and control costs)
    if conversation_history:
        messages.extend(conversation_history[-10:])

    messages.append({"role": "user", "content": user_message})

    try:
        response = await client.chat.completions.create(
            model=AI_MODEL_NAME,
            messages=messages,
            max_tokens=2048,
            temperature=0.3, # Lowered from 0.7 to ensure factual medical/fitness safety
            top_p=1,
            presence_penalty=0
        )
        return response.choices[0].message.content or ""
        
    except Exception as e:
        print(f"[AI Coach] Error calling LLM API: {e}")
        raise