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
# Configuration
# ---------------------------------------------------------------------------

AI_MODEL_PROVIDER = os.getenv("AI_MODEL_PROVIDER", "scaleway")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "mistral-small-3.2-24b-instruct-2506")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
AI_API_BASE_URL = os.getenv("SCALEWAY_API_URL", "https://api.scaleway.ai/65a7dd3f-2376-4856-8e6f-8162c28d6f9a/v1")

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
- ALWAYS reply in the SAME language the user writes in. If the user writes in French, your ENTIRE response (including disclaimers, headers, labels) MUST be in French. Same for any other language. NEVER mix languages or default to English.
- Be concise but informative
- Use a supportive and motivating tone
- If you have access to the user's profile, personalize your answers based on their goals

## Injury / Pain assessment protocol

When a user mentions pain, injury, discomfort, or any physical issue, you MUST follow a strict multi-step investigation before giving any assessment. 

STEP 1: **Clarify Anatomy (The Funnel Technique)**
Users are often beginners and misidentify body parts. If the user uses a broad term (e.g., "back", "leg", "shoulder", "arm", "chest"), you MUST ask specific, descriptive questions to pinpoint the exact anatomical area. Do NOT proceed to assessment until the area is perfectly clear.
- Example: If they say "shoulder", ask if it's closer to the neck (trapezius), the front, side, or deep inside the joint.
- Example: If they say "back", ask if it's the upper back, middle back, or lower back (lumbar).
- Example: If they say "leg", ask if it's the front (quads), back (hamstrings), calf, or knee.

### [SHOW_BODY_MAP] tag — STRICT RULES
You may output the tag [SHOW_BODY_MAP] on its own line at the END of your message ONLY when ALL of these conditions are true:
1. This is your FIRST response after the user mentions a pain/injury/discomfort for the first time
2. You are asking the user to clarify WHERE exactly the pain is located
3. The user used a VAGUE or BROAD term (e.g., "back", "shoulder", "leg", "arm") — meaning the exact anatomical zone is unclear
4. You have NEVER output [SHOW_BODY_MAP] before in this entire conversation

If ANY of these is false, do NOT output [SHOW_BODY_MAP].

Situations where you must NEVER output [SHOW_BODY_MAP]:
- The user already clearly identified the exact zone (e.g., "my right knee", "left trapezius") — no map needed
- You already output [SHOW_BODY_MAP] once before in this conversation — NEVER repeat it
- You are in Step 2 (asking about pain type, intensity, timing, context)
- You are in Step 3/4/5 (assessment, recommendations, disclaimer)
- The user is answering your clarification questions
- Any follow-up message after your initial "where does it hurt?" question

The body map is a ONE-TIME tool shown ONLY at the very beginning of the injury investigation to help the user point to the right area. After that first use, the conversation continues with text only.

STEP 2: **Gather the context**
Ask 3 to 4 precise questions to understand the mechanics of the injury. Ask them clearly and wait for the user's next message. You need to know:
- Type of pain (sharp, dull, burning, electric, stiffness)
- When it started and what specific exercise/movement triggered it
- Pain intensity (1-10) and if it limits their range of motion

STEP 3: **Provide a hypothesis-based assessment** (ONLY after Step 1 and 2 are fully answered)
Present a structured list of qualitative hypotheses. 
🚨 ABSOLUTE RULE: NEVER use percentages, statistics, or numerical probabilities. You must only use words.
Format example:
- **Primary Hypothesis:** Muscle strain of the [muscle name]
- **Alternative Hypothesis:** Tendinitis of the [tendon]

STEP 4: **Recommend immediate actions**
Suggest the RICE protocol, rest, and explicitly mention adapted exercises they CAN still do safely.

STEP 5: **Medical disclaimer — MANDATORY, every single time**
Whenever you discuss pain, injury, discomfort, or anything health-related — whether it is your first assessment, a follow-up, or a casual mention — you MUST include a clear disclaimer. This applies to EVERY message that contains any form of hypothesis, recommendation, or health-related advice. No exceptions.

The disclaimer must clearly state ALL of the following points:
- You are an AI, NOT a doctor, physiotherapist, or any kind of healthcare professional.
- Your analysis is only an estimation based on the information provided — it can be wrong.
- The user must NOT treat your hypotheses as a real medical diagnosis.
- They should consult a real healthcare professional (doctor, physiotherapist, sports physician) as soon as possible, especially if pain persists or worsens.

🚨 CRITICAL LANGUAGE RULE: The disclaimer MUST be written in the SAME language the user is writing in. If the user writes in French, the disclaimer MUST be in French. If in Spanish, in Spanish. NEVER default to English unless the user writes in English. This rule applies to the entire message, including the disclaimer.

Example if user writes in French:
"⚠️ Rappel important : Je suis un assistant IA, pas un professionnel de santé. Tout ce que je dis est une estimation et ne remplace en aucun cas une consultation avec un vrai médecin ou kinésithérapeute. Ne prenez pas mon analyse comme un diagnostic définitif — consultez un professionnel de santé pour un examen approprié."

Example if user writes in English:
"⚠️ Important reminder: I am an AI assistant, not a medical professional. Everything I say is an estimation and should never replace a consultation with a real doctor or physiotherapist. Please do not take my analysis as a definitive diagnosis — see a healthcare professional to get a proper examination."

## Injury proposal protocol (UI Trigger)

ONLY AFTER you have completed the full assessment (Step 3 to 5), you must propose to record the injury.

1. **Ask for confirmation implicitly**: At the end of your assessment message, include: "I can record this injury to adapt your future training sessions. Just click the button below to confirm."

2. **Output the structured tag**: On a new line at the very end of your response, output exactly one tag per injured zone using this exact format:
   [INJURY_PROPOSAL: zone="<body_zone>", description="<brief_description>"]

   The <body_zone> MUST be one of these standardized values:
   "right_shoulder", "left_shoulder", "right_trapezius", "left_trapezius", "upper_back", "lower_back", "neck", "right_elbow", "left_elbow", "right_wrist", "left_wrist", "chest", "abs", "right_hip", "left_hip", "right_knee", "left_knee", "right_ankle", "left_ankle", "right_foot", "left_foot", "right_calf", "left_calf", "right_thigh", "left_thigh", "right_bicep", "left_bicep", "right_tricep", "left_tricep", "right_forearm", "left_forearm".

CRITICAL: Never output the [INJURY_PROPOSAL] tag during the questioning phase (Steps 1 & 2). Only output it when you are giving your final assessment.
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
        if user_context.get("active_injuries"):
            context_parts.append(f"Currently recorded active injuries:\n{user_context['active_injuries']}")

        if context_parts:
            messages.append({
                "role": "system",
                "content": "User profile:\n" + "\n".join(context_parts),
            })

    # Add conversation history (last 10 messages)
    if conversation_history:
        messages.extend(conversation_history[-10:])

    messages.append({"role": "user", "content": user_message})

    try:
        response = await client.chat.completions.create(
            model=AI_MODEL_NAME,
            messages=messages,
            max_tokens=2048,
            temperature=0.3,
            top_p=1,
            presence_penalty=0
        )
        return response.choices[0].message.content or ""
        
    except Exception as e:
        print(f"[AI Coach] Error calling LLM API: {e}")
        raise


# ---------------------------------------------------------------------------
# AI Workout Program Generation
# ---------------------------------------------------------------------------

async def generate_workout_program(
    selected_dates: list[str],
    available_exercises: list[dict],
    user_context: dict,
    day_configs: list[dict] | None = None,
) -> list[dict]:
    """
    Ask the AI to generate a structured workout program for the given dates,
    using only the provided exercises, adapted to the user's profile and injuries.
    Returns a list of workout dicts ready to be saved.
    """
    import json

    client = get_ai_client()

    exercises_str = "\n".join([
        f"- {ex['name']} (muscle: {ex['muscle']}, type: {ex['type']}, difficulty: {ex['difficulty']})"
        for ex in available_exercises
    ])

    injuries_str = "\n".join(user_context.get("injuries", [])) or "None"
    fitness_level = user_context.get("fitness_level", "intermediate")

    # Build per-day instructions
    day_instructions = ""
    if day_configs:
        day_lines = []
        for dc in day_configs:
            day_lines.append(f"  - {dc['date']}: Focus = {dc['focus']}, Load mode = {dc['mode']}")
        day_instructions = "\n".join(day_lines)
    else:
        day_instructions = "\n".join([f"  - {d}: Focus = Adapted Full Body, Load mode = progressive" for d in selected_dates])

    # Fitness level guidelines
    level_guidelines = {
        "beginner": (
            "- Beginner level: 2-3 sets per exercise, 12-15 reps, light weights (focus on form).\n"
            "- Weight increments between progressive/degressive sets should be small (+/- 2kg).\n"
            "- Keep total exercises per session to 4."
        ),
        "intermediate": (
            "- Intermediate level: 3-4 sets per exercise, 8-12 reps, moderate weights.\n"
            "- Weight increments between progressive/degressive sets: +/- 5kg.\n"
            "- 4-5 exercises per session."
        ),
        "advanced": (
            "- Advanced level: 4-5 sets per exercise, 6-10 reps, heavier weights.\n"
            "- Weight increments between progressive/degressive sets: +/- 5-10kg.\n"
            "- 5-6 exercises per session. Can include supersets."
        ),
    }

    prompt = f"""Generate a workout program for the following dates with per-day preferences:
{day_instructions}

User profile:
- Goal: {user_context.get('goal', 'maintain_weight')}
- Fitness level: {fitness_level}
- Weight: {user_context.get('weight', 'unknown')} kg
- Active injuries: {injuries_str}

Fitness level guidelines:
{level_guidelines.get(fitness_level, level_guidelines['intermediate'])}

Load mode rules:
- "progressive": Each set increases weight and decreases reps (pyramid up). Example: Set1: 12 reps @ 15kg → Set2: 10 reps @ 20kg → Set3: 8 reps @ 25kg
- "degressive": Each set decreases weight and increases reps (drop set). Example: Set1: 8 reps @ 25kg → Set2: 10 reps @ 20kg → Set3: 12 reps @ 15kg
- "constant": Same weight and reps across all sets. Example: Set1: 10 reps @ 20kg → Set2: 10 reps @ 20kg → Set3: 10 reps @ 20kg

Focus rules:
- "Full Body": Mix upper and lower body exercises for a balanced session
- "Adapted Full Body": Mix upper and lower body exercises, excluding injured zones
- "Upper Body": Only chest, back, shoulders, biceps, triceps, forearms exercises
- "Lower Body": Only quads, hamstrings, glutes, calves exercises
- "Push": Chest, shoulders, triceps exercises
- "Pull": Back, biceps, forearms exercises
- "Core": Abs and core stability exercises
- "Cardio": Duration-based and cardio exercises

Available exercises (ONLY use exercises from this list, use their EXACT names):
{exercises_str}

🚨 CRITICAL INJURY PROTOCOL (BIOMECHANICS):
When creating a workout for a user with active injuries, you MUST NOT simply exclude exercises that target the injured muscle. You MUST evaluate the biomechanical role of the injured joint in EVERY exercise you consider.

General principle — Stabilizers & Anchors: Exclude any exercise where the injured joint acts as a stabilizer, anchor, or supports body weight, even if the exercise "targets" a completely different muscle group.

Shoulder injuries (right_shoulder, left_shoulder, right_trapezius, left_trapezius) — Strict rules:
- NO hanging exercises (e.g., Pull-ups, Chin-ups, Hanging Leg Raises) — 100% of body weight stretches and loads the shoulder joint.
- NO Barbell Back Squats — requires extreme external shoulder rotation to hold the bar. Replace with Hack Squat, Leg Press, or Goblet Squat.
- NO unsupported heavy pulling (e.g., Heavy Barbell Rows, Bent Over Barbell Rows, Deadlifts, T-Bar Rows) — places massive isometric stress on the rotator cuff. Replace with Chest-Supported Rows, seated machine rows, or cable rows.
- NO overhead pressing (e.g., Overhead Press, Military Press, Arnold Press, Push Press) — direct compression of the shoulder joint.
- NO dips — heavy shoulder extension under load, high injury risk.
- PREFER machine-based or cable alternatives that do not require the shoulder to stabilize freely (e.g., Machine Chest Press instead of Barbell Bench Press, Cable Lateral Raises instead of Dumbbell Lateral Raises).

Lower back injuries (lower_back) — Strict rules:
- NO axial loading (e.g., Barbell Squats, Standing Overhead Press, Deadlifts) — compresses the lumbar spine.
- NO unsupported hinge movements (e.g., Romanian Deadlifts, Barbell Rows, Good Mornings) — high shear force on lumbar discs.
- ALWAYS prioritize machine-based alternatives that isolate the target muscle without spinal loading (e.g., Leg Press, Chest-Supported Row, Cable Crunch, Machine Leg Curl).

Knee injuries (right_knee, left_knee) — Strict rules:
- NO deep squats, lunges, or leg extensions with heavy load — high patellofemoral stress.
- PREFER partial range-of-motion exercises, leg press with controlled ROM, or isometric holds.
- NO plyometrics (jump squats, box jumps).

Elbow injuries (right_elbow, left_elbow) — Strict rules:
- NO heavy barbell curls or skull crushers — high stress on the elbow joint.
- PREFER cable or machine isolation movements with controlled load.

Hip injuries (right_hip, left_hip) — Strict rules:
- NO deep squats, heavy lunges, or sumo deadlifts.
- PREFER machine-based leg work (Leg Press, Machine Leg Curl, Machine Leg Extension) with controlled ROM.

For ANY other injured zone: apply the same principle — if the injured joint bears load, stabilizes, anchors, or undergoes significant stretch/compression during the exercise, EXCLUDE that exercise and find a safer machine-based or supported alternative.

In the "description" field of each workout, you MUST explicitly mention which exercises were excluded due to injury biomechanics and what alternatives were chosen instead.

🎯 RULE FOR VARIETY & PROGRESSION:
- NEVER repeat the exact same workout on multiple days. If generating a multi-day plan, ensure HIGH exercise variety across all days. Each day MUST have a different exercise selection.
- Even with strict injury constraints, find DIFFERENT safe alternative exercises for each day. For example: if Day 1 uses Leg Press, Day 2 should use Hack Squat or Leg Extensions/Curls instead. Rotate through all available safe exercises before reusing any.
- NEVER copy-paste the description text. Each day's "description" field MUST be unique, engaging, and explain how this specific day complements the others in the weekly plan (e.g., "Yesterday focused on quads with Leg Press; today we shift to hamstrings and glutes with Leg Curls and Hip Thrusts to balance your lower body development.").
- Vary the rep ranges across days to create a real training periodization: e.g., Day 1 = Strength focus (6-8 reps, heavier), Day 2 = Hypertrophy focus (10-12 reps, moderate), Day 3 = Endurance/Volume focus (14-16 reps, lighter). Do NOT generate flat "10 reps x 3 sets" everywhere.
- Vary the number of sets too when appropriate (e.g., 4 sets for compound movements, 3 sets for isolation).
- If the user selected different focus areas per day (e.g., Upper Body on Day 1, Lower Body on Day 2), this naturally creates variety. But if the user selected the SAME focus for multiple days, you MUST still create distinct workouts with different exercises and rep schemes for each day.

Rules:
- For "strength" type exercises: apply the load mode specified for that day.
- For "duration" type exercises: set reps to 0. In progressive mode increase duration each set, in degressive mode decrease it, in constant keep it the same.
- Consider the user's injuries and NEVER include exercises that could aggravate them (see INJURY PROTOCOL above).
- Give each workout a descriptive name matching its focus (e.g. "Upper Body Power", "Leg Day", "Core & Cardio").
- Only use exercises that match the focus for that day. If the focus doesn't have enough safe exercises, complement with related muscle groups.
- For each workout, include a "description" field that explains in 2-3 sentences WHY you chose these exercises and this structure. Mention the user's injuries (what was avoided and WHY biomechanically), their goal, fitness level, and the load mode. Write it in a friendly, coach-like tone addressed to the user. Example: "Since you're working toward muscle gain at an intermediate level, this session focuses on compound lower body movements using machines. We avoided Barbell Back Squats because holding the bar requires shoulder external rotation which would stress your injured shoulders. Leg Press and Hack Squat give you the same stimulus safely. Progressive loading will help build strength gradually."

CRITICAL: Return ONLY a valid JSON array, no markdown, no code fences, no explanation. Format:
[
  {{
    "name": "Session Name",
    "description": "Explanation of why this workout was designed this way...",
    "difficulty": "Intermediate",
    "scheduled_date": "YYYY-MM-DDT10:00:00",
    "exercises": [
      {{
        "name": "Exact Exercise Name",
        "muscle": "muscle group",
        "num_sets": 3,
        "rest_time": 60,
        "sets_details": [
          {{"set_number": 1, "reps": 10, "weight": 20, "duration": 0}}
        ]
      }}
    ]
  }}
]
"""

    response = await client.chat.completions.create(
        model=AI_MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": "You are a fitness program generator. Output ONLY valid JSON arrays. No markdown, no explanations, no code fences.",
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=4096,
        temperature=0.3,
    )

    raw = response.choices[0].message.content or "[]"

    # Strip potential markdown code fences
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        lines = lines[1:]  # Remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]  # Remove closing fence
        raw = "\n".join(lines).strip()

    return json.loads(raw)