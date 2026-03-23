# routes.py
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.model import *
from app.database import get_session
from app.api import *
from app.schemas import WorkoutCreate, WorkoutRead, MealRead, MealCreateByCoach, UserGoalUpdate, MacroUpdate, ForumCreate, ForumUpdate, ForumMessageCreate, AIChatRequest, AIChatResponse, AIChatMessageRead, AIChatMessage
from typing import List, Any, Optional
from jose import JWTError, jwt
from dotenv import load_dotenv
from sqlalchemy import select, desc
from app.ai_coach import generate_ai_response
import os

router = APIRouter()
load_dotenv()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


async def get_current_user_id(token: str = Depends(oauth2_scheme)):
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = os.getenv("ALGORITHM")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("userId")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return int(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@router.get("/")
async def read_root():
    return {"hello world"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@router.post("/register")
async def add_user(request: Request, session: AsyncSession = Depends(get_session)):
    userData = await request.json()
    return await register_user(session, userData)


@router.post("/login")
async def check_user(request: Request, session: AsyncSession = Depends(get_session)):
    userData = await request.json()
    return await login_user(session, userData)


# ---------------------------------------------------------------------------
# Users — routes fixes (/users/me/...) avant routes dynamiques (/users/{id}/...)
# ---------------------------------------------------------------------------

# -- Chemins fixes sous /users/me/
@router.get("/users/me/dashboard-stats")
async def get_dashboard_stats_route(
    current_user: Any = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_dashboard_stats(session, current_user)


@router.patch("/users/me/description")
async def update_my_description(
    update_data: UserUpdate,
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await update_user_description(session, current_user_id, update_data.description)


@router.patch("/users/me/goals")
async def update_my_goals_route(
    goal_data: UserGoalUpdate,
    current_user: Any = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await update_my_goals(session, current_user, goal_data)


@router.patch("/users/me/location")
async def update_user_location_route(
    location: LocationUpdate,
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await update_user_location(session, current_user_id, location)


@router.delete("/users/me/coach")
async def leave_coach(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await unassign_my_coach(session, user_id)


# -- Chemins semi-fixes (préfixe fixe + param dynamique en fin)
@router.get("/users/get_daily_meals/{user_id}")
async def get_daily_meals(user_id: int, session: AsyncSession = Depends(get_session)):
    return await get_meals_by_user(session, user_id)


# -- Chemins dynamiques (/users/{id}/...)  — après tous les fixes
@router.get("/users/me/{user_id}")
async def get_current_user(user_id: int, session: AsyncSession = Depends(get_session)):
    return await get_user_by_id(session, user_id)


@router.patch("/users/{user_id}/goals")
async def update_user_goals_route(
    user_id: int,
    goal_data: MacroUpdate,
    session: AsyncSession = Depends(get_session)
):
    return await update_user_macro_goals(session, user_id, goal_data)


@router.put("/users/{client_id}/assign-coach/{coach_id}")
async def assign_coach(client_id: int, coach_id: int, session: AsyncSession = Depends(get_session)):
    return await assign_coach_to_client(session, client_id, coach_id)


# ---------------------------------------------------------------------------
# Meals — préfixes tous distincts, pas de conflit inter-routes
# ---------------------------------------------------------------------------

@router.post("/addMeal/{userId}")
async def add_meal(userId: int, request: Request, session: AsyncSession = Depends(get_session)):
    mealData = await request.json()
    return await create_meal(session, userId, mealData)


@router.put("/updateMeal/{meal_id}")
async def updateMeal(meal_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    mealData = await request.json()
    return await update_meal(session, meal_id, mealData)


@router.patch("/meals/{meal_id}/toggle-consume", response_model=MealRead)
async def toggle_meal_consume_route(
    meal_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await toggle_meal_consume(session, meal_id, user_id)


@router.delete("/deleteMeal/{meal_id}")
async def deleteMeal(meal_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    return await delete_meal(session, meal_id)


# ---------------------------------------------------------------------------
# Workouts — route fixe (/workouts/create, /workouts/my-workouts) avant /{id}
# ---------------------------------------------------------------------------

@router.post("/workouts/create", status_code=201)
async def create_workout_route(
    workout_data: WorkoutCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await create_full_workout(session, user_id, workout_data)


@router.get("/workouts/my-workouts", response_model=List[WorkoutRead])
async def get_my_workouts_route(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_user_workouts(session, user_id)


@router.patch("/workouts/{workout_id}/toggle-complete")
async def toggle_workout_complete_route(
    workout_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await toggle_workout_complete(session, workout_id, user_id)


@router.delete("/workouts/{workout_id}")
async def delete_workout_route(
    workout_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await delete_workout_for_user(session, workout_id, user_id)


# ---------------------------------------------------------------------------
# External API (food / exercises) — tous fixes ou préfixes distincts
# ---------------------------------------------------------------------------

@router.get("/getMuscles/")
async def get_muscles_from_api(session: AsyncSession = Depends(get_session)):
    return get_muscles()


@router.get("/getAlimentNutriment/{code}/{quantity}")
async def get_aliment_nutriment(code: str, quantity: int, session: AsyncSession = Depends(get_session)):
    return get_food_by_code(code, quantity)


@router.get("/getAlimentFromApi/{aliment_name}")
async def get_aliment_from_api(aliment_name: str, session: AsyncSession = Depends(get_session)):
    return search_food(aliment_name)


@router.get("/getExercises/{muscle}")
async def get_exercises_from_api(muscle: str, session: AsyncSession = Depends(get_session)):
    return get_exercises(muscle)


@router.get("/scan/{code}/{format}")
async def scan_aliment(code: str, session: AsyncSession = Depends(get_session)):
    return scan_food(code, format)


# ---------------------------------------------------------------------------
# Coaches
#
# Ordre de priorité dans chaque méthode HTTP :
#   1. Chemins entièrement fixes         (/coaches/list, /coaches/search, /coaches/invite-client)
#   2. Chemins fixes + /me/...           (/coaches/me/sent-invitations, ...)
#   3. Chemins semi-fixes sous-préfixe   (/coaches/client/..., /coaches/client-details/...,
#                                         /coaches/clients/..., /coaches/workouts/...,
#                                         /coaches/meals/..., /coaches/invitations/...,
#                                         /coaches/requests/...)
#   4. Chemins dynamiques /coaches/{id}/ — en dernier
# ---------------------------------------------------------------------------

# -- GET fixes & /me/
@router.get("/coaches/list")
async def list_coaches(session: AsyncSession = Depends(get_session)):
    return await get_all_coaches(session)


@router.get("/coaches/search", response_model=list[CoachSearchResponse])
async def search_coaches_route(
    city: str = None,
    lat: float = None,
    lon: float = None,
    session: AsyncSession = Depends(get_session)
):
    return await search_coaches_near_location(session, city, lat, lon)


@router.get("/coaches/me/sent-invitations")
async def get_sent_invitations_route(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_coach_sent_invitations(session, user_id)


@router.get("/coaches/me/needs-attention")
async def get_needs_attention_route(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_coach_needs_attention(session, current_user_id)


@router.get("/coaches/me/pending-requests")
async def get_coach_pending_requests_route(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_coach_pending_client_requests(session, current_user_id)


# -- GET semi-fixes (2e segment fixe, param dynamique ensuite)
@router.get("/coaches/client-details/{client_id}")
async def get_client_details_full_route(
    client_id: int,
    target_date: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    return await get_client_details_full(session, client_id, target_date)


@router.get("/coaches/client/{client_id}/dashboard-stats")
async def get_client_dashboard_stats_for_coach(
    client_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_client_dashboard_stats(session, client_id)


# -- GET dynamiques /coaches/{coach_id}/...  — en dernier
@router.get("/coaches/{coach_id}/clients")
async def list_coach_clients(coach_id: int, session: AsyncSession = Depends(get_session)):
    return await get_clients_by_coach_id(session, coach_id)


@router.get("/coaches/{coach_id}/home-summary")
async def get_coach_home_summary_route(coach_id: int, session: AsyncSession = Depends(get_session)):
    return await get_coach_home_summary(session, coach_id)


@router.get("/coaches/{coach_id}/public-profile")
async def get_coach_public_profile_route(
    coach_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_coach_public_profile(session, coach_id)


# -- POST fixes & semi-fixes
@router.post("/coaches/invite-client")
async def invite_client_by_code_route(
    invitation_data: InvitationCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await invite_client_by_unique_code(session, user_id, invitation_data.unique_code)


@router.post("/coaches/clients/{client_id}/workouts/create", status_code=201)
async def create_workout_for_client_route(
    client_id: int,
    workout_data: WorkoutCreate,
    session: AsyncSession = Depends(get_session)
):
    return await create_full_workout(session, client_id, workout_data)


@router.post("/coaches/clients/{client_id}/meals/create", status_code=status.HTTP_201_CREATED)
async def create_meal_for_client_route(
    client_id: int,
    meal_data: MealCreateByCoach,
    session: AsyncSession = Depends(get_session)
):
    return await create_meal_for_client(session, client_id, meal_data)


# -- POST dynamiques /coaches/{coach_id}/...  — en dernier
@router.post("/coaches/{coach_id}/add-client")
async def add_client_via_code(coach_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    data = await request.json()
    unique_code = data.get("code")
    return await assign_client_by_code(session, coach_id, unique_code)


# -- PUT semi-fixes (2e segment fixe)
@router.put("/coaches/workouts/{workout_id}")
async def coach_update_workout(
    workout_id: int,
    workout_data: dict,
    session: AsyncSession = Depends(get_session),
    token: str = Depends(oauth2_scheme)
):
    return await update_full_workout(session, workout_id, workout_data)


@router.put("/coaches/meals/{meal_id}", status_code=status.HTTP_200_OK)
async def update_meal_by_coach_route(
    meal_id: int,
    meal_data: MealCreateByCoach,
    session: AsyncSession = Depends(get_session),
    current_user: Any = Depends(get_current_user_id)
):
    return await update_meal_by_coach(session, meal_id, meal_data)


# -- PATCH semi-fixes
@router.patch("/coaches/requests/{request_id}")
async def respond_to_client_request_route(
    request_id: int,
    status: str,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await respond_to_client_coach_request(session, request_id, status, current_user_id)


# -- DELETE semi-fixes (2e segment fixe, avant les dynamiques /{coach_id}/...)
@router.delete("/coaches/workouts/{workout_id}")
async def coach_delete_workout(
    workout_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await delete_full_workout(session, workout_id)


@router.delete("/coaches/meals/{meal_id}", status_code=status.HTTP_200_OK)
async def delete_meal_by_coach_route(
    meal_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: Any = Depends(get_current_user_id)
):
    return await delete_meal_by_coach(session, meal_id)


@router.delete("/coaches/clients/{client_id}", status_code=status.HTTP_200_OK)
async def remove_client_from_coach_route(
    client_id: int,
    session: AsyncSession = Depends(get_session),
    current_user_id: int = Depends(get_current_user_id)
):
    return await remove_client_from_coach(session, current_user_id, client_id)


@router.delete("/coaches/invitations/{invitation_id}")
async def delete_invitation_route(
    invitation_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await delete_coach_invitation(session, invitation_id, user_id)


# -- DELETE dynamiques /coaches/{coach_id}/...  — en dernier
@router.delete("/coaches/{coach_id}/clients/{client_id}")
async def remove_client_route(coach_id: int, client_id: int, session: AsyncSession = Depends(get_session)):
    return await unassign_client(session, coach_id, client_id)


# ---------------------------------------------------------------------------
# Clients
#
# Ordre : fixes (/clients/search-coaches, /clients/me/...) avant dynamiques
# ---------------------------------------------------------------------------

# -- GET fixes & /me/
@router.get("/clients/search-coaches")
async def search_coaches_by_city_route(
    city: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    return await search_coaches_by_city(session, city)


@router.get("/clients/me/invitations")
async def get_my_invitations_route(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_client_invitations(session, user_id)


@router.get("/clients/me/sent-requests")
async def get_client_sent_requests_route(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_client_sent_coach_requests(session, current_user_id)


# -- POST fixes
@router.post("/clients/me/requests")
async def create_client_request_route(
    req: ClientCoachRequestCreate,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await create_client_coach_request(session, current_user_id, req.coach_id)


# -- PATCH & DELETE semi-fixes (2e segment fixe)
@router.patch("/clients/invitations/{invitation_id}")
async def respond_to_invitation_route(
    invitation_id: int,
    response_data: InvitationUpdate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await respond_to_coach_invitation(session, invitation_id, user_id, response_data)


@router.delete("/clients/requests/{request_id}")
async def cancel_client_request_route(
    request_id: int,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await cancel_client_coach_request(session, request_id, current_user_id)


# ---------------------------------------------------------------------------
# Messages
#
# /messages/conversations et /messages/read/... (fixes) avant /messages/{id}
# ---------------------------------------------------------------------------

# -- GET fixe — doit précéder GET /messages/{other_user_id}
@router.get("/messages/conversations", response_model=list[ConversationRead])
async def get_conversations_route(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_conversations(session, current_user_id)


@router.get("/messages/unread-count")
async def get_unread_count_route(
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_unread_message_count(session, current_user_id)


# -- POST & PUT fixes
@router.post("/messages", response_model=MessageRead)
async def send_message_route(
    message_data: MessageCreate,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await send_message(session, current_user_id, message_data)


@router.put("/messages/read/{other_user_id}")
async def mark_messages_as_read_route(
    other_user_id: int,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await mark_messages_read(session, current_user_id, other_user_id)


# -- GET dynamique — en dernier (après /messages/conversations)
@router.get("/messages/{other_user_id}", response_model=list[MessageRead])
async def get_chat_history_route(
    other_user_id: int,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_chat_history(session, current_user_id, other_user_id)


# ---------------------------------------------------------------------------
# Forums
#
# Ordre : fixes (/forums/my-forums, /forums/favorites, /forums) avant /{id}
# ---------------------------------------------------------------------------

# -- GET fixes
@router.get("/forums/my-forums")
async def get_my_forums_route(
    page: int = 1,
    page_size: int = 15,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_my_forums(session, user_id, page, page_size)


@router.get("/forums/favorites")
async def get_favorite_forums_route(
    page: int = 1,
    page_size: int = 15,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_favorite_forums(session, user_id, page, page_size)


@router.get("/forums")
async def get_public_forums_route(
    page: int = 1,
    page_size: int = 15,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_public_forums(session, user_id, page, page_size)


# -- POST fix
@router.post("/forums", status_code=201)
async def create_forum_route(
    forum_data: ForumCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await create_forum(session, user_id, forum_data)


# -- GET/POST/PATCH/DELETE dynamiques /forums/{forum_id}/...
@router.get("/forums/{forum_id}")
async def get_forum_route(
    forum_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await get_forum_with_messages(session, forum_id, user_id)


@router.post("/forums/{forum_id}/messages", status_code=201)
async def post_forum_message_route(
    forum_id: int,
    message_data: ForumMessageCreate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await post_forum_message(session, forum_id, user_id, message_data)


@router.post("/forums/{forum_id}/favorite")
async def toggle_forum_favorite_route(
    forum_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await toggle_forum_favorite(session, user_id, forum_id)


@router.patch("/forums/{forum_id}")
async def update_forum_route(
    forum_id: int,
    update_data: ForumUpdate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await update_forum(session, forum_id, user_id, update_data)


@router.delete("/forums/{forum_id}")
async def delete_forum_route(
    forum_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await delete_forum(session, forum_id, user_id)


@router.delete("/forums/{forum_id}/messages/{message_id}")
async def delete_forum_message_route(
    forum_id: int,
    message_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    return await delete_forum_message(session, forum_id, message_id, user_id)


# ---------------------------------------------------------------------------
# Users — public profile (accessible by any authenticated user)
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}/public-profile")
async def get_user_public_profile_route(
    user_id: int,
    session: AsyncSession = Depends(get_session)
):
    return await get_user_public_profile(session, user_id)


# ---------------------------------------------------------------------------
# AI Coach
# ---------------------------------------------------------------------------

@router.post("/ai-coach/chat", response_model=AIChatResponse)
async def ai_coach_chat_route(
    chat_request: AIChatRequest,
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Send a message to the AI coach and get a response."""
    from app.schemas import Users

    # Fetch user profile for context
    user = await session.get(Users, current_user_id)
    user_context = None
    if user:
        user_context = {
            "firstname": user.firstname,
            "goal": user.goal,
            "weight": user.weight,
            "height": user.height,
            "daily_caloric_needs": user.daily_caloric_needs,
        }

    # Load recent conversation history from DB
    result = await session.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == current_user_id)
        .order_by(desc(AIChatMessage.created_at))
        .limit(20)
    )
    history_rows = result.scalars().all()
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in reversed(history_rows)
    ]

    # Generate AI response
    ai_response = await generate_ai_response(
        user_message=chat_request.message,
        conversation_history=conversation_history,
        user_context=user_context,
    )

    # Save user message
    user_msg = AIChatMessage(
        user_id=current_user_id,
        role="user",
        content=chat_request.message,
    )
    session.add(user_msg)

    # Save AI response
    ai_msg = AIChatMessage(
        user_id=current_user_id,
        role="assistant",
        content=ai_response,
    )
    session.add(ai_msg)
    await session.commit()
    await session.refresh(ai_msg)

    return AIChatResponse(response=ai_response, message_id=ai_msg.id)


@router.get("/ai-coach/history", response_model=List[AIChatMessageRead])
async def ai_coach_history_route(
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Fetch the AI coach conversation history for the current user."""
    result = await session.execute(
        select(AIChatMessage)
        .where(AIChatMessage.user_id == current_user_id)
        .order_by(AIChatMessage.created_at)
    )
    return result.scalars().all()


@router.delete("/ai-coach/history")
async def ai_coach_clear_history_route(
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """Clear the AI coach conversation history for the current user."""
    result = await session.execute(
        select(AIChatMessage).where(AIChatMessage.user_id == current_user_id)
    )
    messages = result.scalars().all()
    for msg in messages:
        await session.delete(msg)
    await session.commit()
    return {"detail": "Conversation history cleared"}
