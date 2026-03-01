# routes.py
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_, or_, desc
from app.model import *
from app.database import get_session
from app.api import *
from app.schemas import WorkoutCreate, WorkoutRead, MealRead, MealCreateByCoach, UserGoalUpdate, MacroUpdate
from typing import List, Any, Optional
from jose import JWTError, jwt
from dotenv import load_dotenv
from datetime import datetime
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

@router.post("/coaches/clients/{client_id}/workouts/create", status_code=201)
async def create_workout_for_client_route(
    client_id: int,
    workout_data: WorkoutCreate, 
    session: AsyncSession = Depends(get_session)
):
    return await create_full_workout(session, client_id, workout_data)

@router.patch("/users/me/description")
async def update_my_description(
    update_data: UserUpdate,
    current_user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Users).where(Users.id == current_user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.description = update_data.description
    
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    return {"message": "Description updated successfully", "description": user.description}

@router.get("/users/me/dashboard-stats")
async def get_dashboard_stats(
    current_user: Any = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    print(f"DEBUG: Auth object received: {type(current_user)}")

    try:
        user_id = None
        if hasattr(current_user, 'id'):
            user_id = current_user.id
        elif isinstance(current_user, dict):
            user_id = current_user.get('id')
        elif isinstance(current_user, int):
            user_id = current_user
        else:
            user_id = int(str(current_user))
            
        print(f"DEBUG: Extracted User ID: {user_id}")

        if not user_id:
            return JSONResponse(content={"error": "User ID not found in token"}, status_code=401)

        result_user = await session.execute(select(Users).where(Users.id == user_id))
        user = result_user.scalars().first()
        
        goal = 2500.0
        goal_proteins = 150.0
        goal_carbs = 250.0
        goal_fats = 70.0
        
        if user:
            try:
                if user.daily_caloric_needs: goal = float(user.daily_caloric_needs)
                if user.goal_proteins: goal_proteins = float(user.goal_proteins)
                if user.goal_carbs: goal_carbs = float(user.goal_carbs)
                if user.goal_fats: goal_fats = float(user.goal_fats)
            except:
                pass

        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        result_meals = await session.execute(
            select(Meal)
            .where(Meal.user_id == user_id)
            .where(Meal.hourtime >= today_start)
        )
        today_meals = result_meals.scalars().all()

        cals = 0.0
        prots = 0.0
        carbs = 0.0
        fats = 0.0

        for m in today_meals:
            if m.is_consumed:
                cals += float(m.total_calories or 0)
                prots += float(m.total_proteins or 0)
                carbs += float(m.total_carbohydrates or 0)
                fats += float(m.total_lipids or 0)

        remaining = max(0.0, goal - cals)
        progress = min(1.0, cals / goal) if goal > 0 else 0.0

        data = {
            "daily_caloric_goal": goal,
            "calories_consumed": cals,
            "calories_remaining": remaining,
            "proteins_consumed": prots,
            "carbs_consumed": carbs,
            "fats_consumed": fats,
            "progress_percentage": progress,
            "goal_proteins": goal_proteins,
            "goal_carbs": goal_carbs,
            "goal_fats": goal_fats
        }

        return JSONResponse(content=data, status_code=200)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.get("/")
async def read_root():
    return {"hello world"}

@router.get("/users/me/{user_id}")
async def get_current_user(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await get_user_by_id(session, user_id)
    return result

@router.get("/users/get_daily_meals/{user_id}")
async def get_daily_meals(user_id: int, session: AsyncSession = Depends(get_session)):
    result = await get_meals_by_user(session, user_id)
    return result

@router.get("/coaches/list")
async def list_coaches(session: AsyncSession = Depends(get_session)):
    return await get_all_coaches(session)

@router.get("/coaches/{coach_id}/clients")
async def list_coach_clients(coach_id: int, session: AsyncSession = Depends(get_session)):
    return await get_clients_by_coach_id(session, coach_id)

@router.get("/coaches/client/{client_id}/dashboard-stats")
async def get_client_dashboard_stats_for_coach(
    client_id: int,
    session: AsyncSession = Depends(get_session)
):
    result_user = await session.execute(select(User).where(User.id == client_id))
    client = result_user.scalars().first()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    today = datetime.now().date()
    result_meals = await session.execute(
        select(Meal).where(
            Meal.user_id == client_id,
            func.date(Meal.hourtime) == today
        )
    )
    meals = result_meals.scalars().all()

    calories_consumed = sum(m.total_calories for m in meals if m.is_consumed)
    proteins_consumed = sum(m.total_proteins for m in meals if m.is_consumed)
    carbs_consumed    = sum(m.total_carbohydrates for m in meals if m.is_consumed)
    fats_consumed     = sum(m.total_lipids for m in meals if m.is_consumed)

    daily_goal = client.daily_caloric_needs or 2500
    progress = 0
    if daily_goal > 0:
        progress = calories_consumed / daily_goal

    return {
        "daily_caloric_goal": daily_goal,
        "calories_consumed": calories_consumed,
        "calories_remaining": daily_goal - calories_consumed,
        "progress_percentage": progress,
        
        "proteins_consumed": proteins_consumed,
        "carbs_consumed": carbs_consumed,
        "fats_consumed": fats_consumed,
        
        "goal_proteins": client.goal_proteins if hasattr(client, 'goal_proteins') else 150,
        "goal_carbs": client.goal_carbs if hasattr(client, 'goal_carbs') else 250,
        "goal_fats": client.goal_fats if hasattr(client, 'goal_fats') else 70,
    }

@router.get("/getAlimentNutriment/{code}/{quantity}")
async def get_aliment_nutriment(code: str, quantity: int, session: AsyncSession = Depends(get_session)):
    return get_food_by_code(code, quantity)

@router.get("/getAlimentFromApi/{aliment_name}")
async def get_aliment_from_api(aliment_name: str, session: AsyncSession = Depends(get_session)):
    return search_food(aliment_name)

@router.get("/getMuscles/")
async def get_muscles_from_api(session: AsyncSession = Depends(get_session)):
    return get_muscles()

@router.get("/getExercises/{muscle}")
async def get_exercises_from_api(muscle: str, session: AsyncSession = Depends(get_session)):
    return get_exercises(muscle)

@router.get("/scan/{code}/{format}")
async def scan_aliment(code: str, session: AsyncSession = Depends(get_session)):
    return scan_food(code, format)

@router.post("/register")
async def add_user(request: Request, session: AsyncSession = Depends(get_session)):
    userData = await request.json()
    result = await register_user(session, userData)
    return result

@router.post("/login")
async def check_user(request: Request, session: AsyncSession = Depends(get_session)):
    userData = await request.json()
    result = await login_user(session, userData)
    return result

@router.post("/addMeal/{userId}")
async def add_meal(userId: int, request: Request, session: AsyncSession = Depends(get_session)):
    mealData = await request.json()
    result = await create_meal(session, userId, mealData)
    return result

@router.delete("/deleteMeal/{meal_id}")
async def deleteMeal(meal_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    result = await delete_meal(session, meal_id)
    return result

@router.put("/updateMeal/{meal_id}")
async def updateMeal(meal_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    mealData = await request.json()
    result = await update_meal(session, meal_id, mealData)
    return result

@router.put("/users/{client_id}/assign-coach/{coach_id}")
async def assign_coach(client_id: int, coach_id: int, session: AsyncSession = Depends(get_session)):
    return await assign_coach_to_client(session, client_id, coach_id)

@router.post("/coaches/{coach_id}/add-client")
async def add_client_via_code(coach_id: int, request: Request, session: AsyncSession = Depends(get_session)):
    data = await request.json()
    unique_code = data.get("code")
    return await assign_client_by_code(session, coach_id, unique_code)

@router.put("/coaches/workouts/{workout_id}")
async def coach_update_workout(
    workout_id: int, 
    workout_data: dict, 
    session: AsyncSession = Depends(get_session),
    token: str = Depends(oauth2_scheme)
):
    return await update_full_workout(session, workout_id, workout_data)

@router.delete("/coaches/meals/{meal_id}", status_code=status.HTTP_200_OK)
async def delete_meal_by_coach(
    meal_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: Any = Depends(get_current_user_id)
):
    result = await session.execute(select(Meal).where(Meal.id == meal_id))
    meal = result.scalars().first()
    
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    try:
        await session.delete(meal)
        await session.commit()

        return {"message": "Meal successfully deleted"}

    except Exception as e:
        await session.rollback()
        print(f"Error deleting meal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the meal."
        )

@router.put("/coaches/meals/{meal_id}", status_code=status.HTTP_200_OK)
async def update_meal_by_coach(
    meal_id: int,
    meal_data: MealCreateByCoach,
    session: AsyncSession = Depends(get_session),
    current_user: Any = Depends(get_current_user_id)
):
    result = await session.execute(select(Meal).where(Meal.id == meal_id))
    meal = result.scalars().first()
    
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    try:
        meal.name = meal_data.name
        meal.total_calories = meal_data.total_calories
        meal.proteins = meal_data.total_proteins
        meal.carbohydrates = meal_data.total_carbohydrates
        meal.lipids = meal_data.total_lipids
        meal.aliments = json.dumps(meal_data.aliments)
        
        await session.commit()
        await session.refresh(meal)

        return {"message": "Meal successfully updated"}

    except Exception as e:
        await session.rollback()
        print(f"Error updating meal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the meal."
        )

@router.post("/coaches/clients/{client_id}/meals/create", status_code=status.HTTP_201_CREATED)
async def create_meal_for_client(
    client_id: int,
    meal_data: MealCreateByCoach,
    session: AsyncSession = Depends(get_session),
    current_user: Any = Depends(get_current_user_id)
):
    client_result = await session.execute(select(Users).where(Users.id == client_id))
    client = client_result.scalars().first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    try:
        new_meal = Meal(
            user_id=client_id,
            name=meal_data.name,
            total_calories=meal_data.total_calories,
            total_proteins=meal_data.total_proteins,
            total_carbohydrates=meal_data.total_carbohydrates,
            total_lipids=meal_data.total_lipids,
            hourtime=meal_data.date_of_meal,
            aliments=json.dumps(meal_data.aliments),
            is_consumed=False
        )

        session.add(new_meal)
        await session.commit()
        await session.refresh(new_meal)

        return {
            "message": "Meal successfully scheduled for client.",
            "meal_id": new_meal.id
        }

    except Exception as e:
        await session.rollback()
        print(f"Error creating meal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving the meal to the database."
        )

@router.delete("/coaches/workouts/{workout_id}")
async def coach_delete_workout(
    workout_id: int, 
    session: AsyncSession = Depends(get_session)
):
    return await delete_full_workout(session, workout_id)

@router.get("/coaches/client-details/{client_id}")
async def get_client_details_full(
    client_id: int, 
    target_date: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Users).where(Users.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if target_date:
        query_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    else:
        query_date = datetime.now().date()
    
    result_meals = await session.execute(
        select(Meal).where(Meal.user_id == client_id, func.date(Meal.hourtime) == query_date)
    )
    meals = result_meals.scalars().all()

    result_workouts = await session.execute(
        select(Workout)
        .where(Workout.user_id == client_id, func.date(Workout.scheduled_date) == query_date)
        .options(selectinload(Workout.exercises))
    )
    workouts = result_workouts.scalars().all()
    
    current_cals = sum(m.total_calories for m in meals if m.is_consumed)
    current_prot = sum(m.total_proteins for m in meals if m.is_consumed)
    current_carb = sum(m.total_carbohydrates for m in meals if m.is_consumed)
    current_fat  = sum(m.total_lipids for m in meals if m.is_consumed)

    return {
        "id": client.id,
        "firstname": client.firstname,
        "lastname": client.lastname,
        "age": client.age,
        "gender": client.gender,
        "goal_calories": client.daily_caloric_needs or 2500,
        "goals_macros": {
            "proteins": client.goal_proteins or 150,
            "carbs": client.goal_carbs or 250,
            "fats": client.goal_fats or 70
        },
        "today_stats": {
            "calories": current_cals,
            "proteins": current_prot,
            "carbs": current_carb,
            "fats": current_fat
        },
        "meals_today": [
            {
                "id": m.id,
                "name": m.name if hasattr(m, 'name') else m.aliment_name,
                "calories": m.total_calories,
                "is_consumed": m.is_consumed,
                "aliments": json.loads(m.aliments) if m.aliments else []
            } for m in meals
        ],
        "workouts_today": [
            {
                "id": w.id,
                "name": w.name,
                "is_completed": w.is_completed,
                "exercises": [
                    {
                        "name": exo.name,
                        "muscle": exo.muscle,
                        "num_sets": exo.num_sets,
                        "sets_details": exo.sets_details
                    } for exo in w.exercises
                ]
            } for w in workouts
        ]
    }

@router.delete("/coaches/{coach_id}/clients/{client_id}")
async def remove_client_route(coach_id: int, client_id: int, session: AsyncSession = Depends(get_session)):
    return await unassign_client(session, coach_id, client_id)

@router.get("/coaches/{coach_id}/home-summary")
async def get_coach_home_summary_route(coach_id: int, session: AsyncSession = Depends(get_session)):
    return await get_coach_home_summary(session, coach_id)

@router.delete("/users/me/coach")
async def leave_coach(user_id: int = Depends(get_current_user_id), session: AsyncSession = Depends(get_session)):
    return await unassign_my_coach(session, user_id)

@router.post("/workouts/create", status_code=201)
async def create_workout_route(
    workout_data: WorkoutCreate, 
    user_id: int = Depends(get_current_user_id), 
    session: AsyncSession = Depends(get_session)
):
    return await create_full_workout(session, user_id, workout_data)

@router.delete("/workouts/{workout_id}")
async def delete_workout_route(
    workout_id: int, 
    user_id: int = Depends(get_current_user_id), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    workout = result.scalars().first()
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    await session.delete(workout)
    await session.commit()
    
    return {"message": "Workout deleted"}

@router.get("/workouts/my-workouts", response_model=List[WorkoutRead])
async def get_my_workouts_route(
    user_id: int = Depends(get_current_user_id), 
    session: AsyncSession = Depends(get_session)
):
    return await get_user_workouts(session, user_id)

@router.patch("/users/me/goals")
async def update_user_goals(
    goal_data: UserGoalUpdate,
    current_user: Any = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    user_id = None
    if hasattr(current_user, 'id'): user_id = current_user.id
    elif isinstance(current_user, dict): user_id = current_user.get('id')
    elif isinstance(current_user, int): user_id = current_user
    else: user_id = int(str(current_user))

    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.daily_caloric_needs = goal_data.daily_caloric_needs
    
    await session.commit()
    return {"message": "Goal updated", "new_goal": user.daily_caloric_needs}

@router.patch("/meals/{meal_id}/toggle-consume", response_model=MealRead)
async def toggle_meal_consume(
    meal_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id))
    meal = result.scalars().first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    meal.is_consumed = not meal.is_consumed
    
    await session.commit()
    await session.refresh(meal)
    return meal

@router.patch("/workouts/{workout_id}/toggle-complete")
async def toggle_workout_complete(
    workout_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    workout = result.scalars().first()
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    workout.is_completed = not (workout.is_completed or False)
    
    await session.commit()
    await session.refresh(workout)
    
    return workout

@router.patch("/users/{user_id}/goals")
async def update_user_goals(
    user_id: int,
    goal_data: MacroUpdate,
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if goal_data.daily_caloric_needs is not None: user.daily_caloric_needs = goal_data.daily_caloric_needs
    if goal_data.goal_proteins is not None: user.goal_proteins = goal_data.goal_proteins
    if goal_data.goal_carbs is not None: user.goal_carbs = goal_data.goal_carbs
    if goal_data.goal_fats is not None: user.goal_fats = goal_data.goal_fats

    await session.commit()
    return {"message": "Goals updated successfully"}

@router.get("/coaches/client-details/{client_id}")
async def get_client_details_full(client_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Users).where(Users.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    today = datetime.now().date()
    
    result_meals = await session.execute(
        select(Meal).where(Meal.user_id == client_id, func.date(Meal.hourtime) == today)
    )
    meals = result_meals.scalars().all()

    result_workouts = await session.execute(
        select(Workout).where(Workout.user_id == client_id, func.date(Workout.scheduled_date) == today)
    )
    workouts = result_workouts.scalars().all()
    
    current_cals = sum(m.total_calories for m in meals if m.is_consumed)
    current_prot = sum(m.total_proteins for m in meals if m.is_consumed)
    current_carb = sum(m.total_carbohydrates for m in meals if m.is_consumed)
    current_fat  = sum(m.total_lipids for m in meals if m.is_consumed)

    return {
        "id": client.id,
        "firstname": client.firstname,
        "lastname": client.lastname,
        "age": client.age,
        "gender": client.gender,
        "goal_calories": client.daily_caloric_needs or 2500,
        "goals_macros": {
            "proteins": client.goal_proteins or 150,
            "carbs": client.goal_carbs or 250,
            "fats": client.goal_fats or 70
        },
        "today_stats": {
            "calories": current_cals,
            "proteins": current_prot,
            "carbs": current_carb,
            "fats": current_fat
        },
        "meals_today": [
            {
                "id": m.id,
                "name": m.aliment_name or "Repas",
                "calories": m.total_calories,
                "is_consumed": m.is_consumed
            } for m in meals
        ],
        "workouts_today": [
            {
                "id": w.id,
                "name": w.name,
                "is_completed": w.is_completed
            } for w in workouts
        ]
    }

@router.get("/clients/search-coaches")
async def search_coaches(
    city: Optional[str] = None, 
    session: AsyncSession = Depends(get_session)
):
    stmt = select(Users).where(Users.role == 'coach')
    
    if city:
        stmt = stmt.where(Users.city.ilike(f"%{city}%"))
        
    result = await session.execute(stmt)
    coaches = result.scalars().all()
    
    return [
        {
            "id": coach.id,
            "firstname": coach.firstname,
            "lastname": coach.lastname,
            "city": coach.city
        }
        for coach in coaches
    ]

@router.post("/coaches/invite-client")
async def invite_client_by_code(
    invitation_data: InvitationCreate,
    user_id: int = Depends(get_current_user_id), # <-- CORRIGÉ ICI
    session: AsyncSession = Depends(get_session)
):
    current_coach_id = user_id
    coach_req = await session.execute(select(Users).where(Users.id == current_coach_id))
    coach = coach_req.scalars().first()
    if not coach or coach.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can invite clients.")

    client_req = await session.execute(select(Users).where(Users.unique_code == invitation_data.unique_code))
    client = client_req.scalars().first()
    
    if not client:
        raise HTTPException(status_code=404, detail="Invalid code. No user found.")
    if client.id == current_coach_id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself.")
    if client.coach_id == current_coach_id:
        raise HTTPException(status_code=400, detail="This client is already part of your team.")

    existing_invitation_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.coach_id == current_coach_id,
                CoachInvitation.client_id == client.id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    if existing_invitation_req.scalars().first():
        raise HTTPException(status_code=400, detail="An invitation is already pending for this client.")

    new_invitation = CoachInvitation(
        coach_id=current_coach_id,
        client_id=client.id,
        status='pending'
    )
    session.add(new_invitation)
    await session.commit()

    return {"message": "Invitation sent to the client successfully!"}

@router.get("/clients/me/invitations")
async def get_my_invitations(
    user_id: int = Depends(get_current_user_id), # <-- CORRIGÉ ICI
    session: AsyncSession = Depends(get_session)
):
    stmt = select(CoachInvitation, Users).join(
        Users, CoachInvitation.coach_id == Users.id
    ).where(
        and_(
            CoachInvitation.client_id == user_id,
            CoachInvitation.status == 'pending'
        )
    )
    
    result = await session.execute(stmt)
    invitations = result.all()

    formatted_invitations = []
    for inv, coach in invitations:
        formatted_invitations.append({
            "id": inv.id,
            "status": inv.status,
            "created_at": str(inv.created_at),
            "coach_id": coach.id,
            "coach_firstname": coach.firstname,
            "coach_lastname": coach.lastname,
            "coach_avatar": coach.firstname[0] if coach.firstname else "?"
        })

    return {"invitations": formatted_invitations}

@router.delete("/coaches/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    inv_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.id == invitation_id,
                CoachInvitation.coach_id == user_id
            )
        )
    )
    invitation = inv_req.scalars().first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed.")

    await session.delete(invitation)
    await session.commit()

    return {"message": "Invitation successfully deleted."}

@router.patch("/clients/invitations/{invitation_id}")
async def respond_to_invitation(
    invitation_id: int,
    response_data: InvitationUpdate,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    current_client_id = user_id
    if response_data.status not in ['accepted', 'rejected']:
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'.")

    inv_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.id == invitation_id,
                CoachInvitation.client_id == current_client_id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    invitation = inv_req.scalars().first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed.")

    invitation.status = response_data.status

    if response_data.status == 'accepted':
        client_req = await session.execute(select(Users).where(Users.id == current_client_id))
        client = client_req.scalars().first()
        client.coach_id = invitation.coach_id
        session.add(client)
        
        await session.execute(
            update(CoachInvitation)
            .where(
                and_(
                    CoachInvitation.client_id == current_client_id,
                    CoachInvitation.status == 'pending',
                    CoachInvitation.id != invitation_id
                )
            )
            .values(status='rejected')
        )

    session.add(invitation)
    await session.commit()

    action = "accepted" if response_data.status == 'accepted' else "rejected"
    return {"message": f"Invitation successfully {action}."}

@router.get("/coaches/me/sent-invitations")
async def get_sent_invitations(
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    current_coach_id = user_id
    stmt = select(CoachInvitation, Users).join(
        Users, CoachInvitation.client_id == Users.id
    ).where(CoachInvitation.coach_id == current_coach_id)
    
    result = await session.execute(stmt)
    invitations = result.all()

    return [
        {
            "id": inv.id,
            "status": inv.status,
            "created_at": str(inv.created_at),
            "client_name": f"{client.firstname} {client.lastname}",
            "client_email": client.email
        }
        for inv, client in invitations if inv.status != 'accepted'
    ]

@router.get("/coaches/{coach_id}/public-profile")
async def get_coach_public_profile(
    coach_id: int,
    session: AsyncSession = Depends(get_session)
):
    coach_req = await session.execute(
        select(Users).where(
            and_(
                Users.id == coach_id, 
                Users.role == 'coach'
            )
        )
    )
    coach = coach_req.scalars().first()
    
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found.")

    clients_req = await session.execute(select(func.count(Users.id)).where(Users.coach_id == coach_id))
    active_clients = clients_req.scalar() or 0

    return {
        "id": coach.id,
        "firstname": coach.firstname,
        "lastname": coach.lastname,
        "description": coach.description,
        "city": coach.city,
        "stats": {
            "active_clients": active_clients,
            "workouts_created": 154, 
            "forum_posts": 28 
        },
        "certifications": [
            "NASM Certified Personal Trainer",
            "Precision Nutrition Level 1",
            "CrossFit Level 2 Instructor"
        ]
    }

@router.get("/messages/conversations", response_model=list[ConversationRead])
async def get_conversations(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    clients_req = await session.execute(
        select(Users).where(Users.coach_id == current_user_id)
    )
    clients = clients_req.scalars().all()

    conversations = []
    
    for client in clients:
        last_msg_req = await session.execute(
            select(Message)
            .where(
                or_(
                    and_(Message.sender_id == current_user_id, Message.receiver_id == client.id),
                    and_(Message.sender_id == client.id, Message.receiver_id == current_user_id)
                )
            )
            .order_by(desc(Message.timestamp))
            .limit(1)
        )
        last_msg = last_msg_req.scalars().first()
        
        conversations.append({
            "client_id": client.id,
            "client_firstname": client.firstname,
            "client_lastname": client.lastname,
            "last_message": last_msg.content if last_msg else "Aucun message",
            "last_message_time": last_msg.timestamp if last_msg else None
        })
        
    conversations.sort(key=lambda x: x["last_message_time"] or datetime.min, reverse=True)
    return conversations


@router.get("/messages/{other_user_id}", response_model=list[MessageRead])
async def get_chat_history(
    other_user_id: int,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    req = await session.execute(
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == current_user_id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == current_user_id)
            )
        )
        .order_by(Message.timestamp.asc())
    )
    return req.scalars().all()


@router.post("/messages", response_model=MessageRead)
async def send_message(
    message_data: MessageCreate,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    new_msg = Message(
        sender_id=current_user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    session.add(new_msg)
    await session.commit()
    await session.refresh(new_msg)
    return new_msg

@router.get("/coaches/me/needs-attention")
async def get_needs_attention(
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    pending_invites_req = await session.execute(
        select(func.count(CoachInvitation.id))
        .where(
            and_(
                CoachInvitation.coach_id == current_user_id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    pending_invites_count = pending_invites_req.scalar() or 0

    unread_messages_req = await session.execute(
        select(func.count(Message.id))
        .where(
            and_(
                Message.receiver_id == current_user_id,
                Message.is_read == False
            )
        )
    )
    unread_messages_count = unread_messages_req.scalar() or 0

    return {
        "pending_invitations": pending_invites_count,
        "unread_messages": unread_messages_count,
        "total_alerts": pending_invites_count + unread_messages_count
    }

@router.put("/messages/read/{other_user_id}")
async def mark_messages_as_read(
    other_user_id: int,
    current_user_id: int,
    session: AsyncSession = Depends(get_session)
):
    stmt = (
        update(Message)
        .where(
            and_(
                Message.sender_id == other_user_id,
                Message.receiver_id == current_user_id,
                Message.is_read == False
            )
        )
        .values(is_read=True)
    )
    await session.execute(stmt)
    await session.commit()
    return {"message": "Messages marqués comme lus"}
