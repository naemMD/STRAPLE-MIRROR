from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship, selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.schemas import *
from sqlalchemy import select, func, asc, update, and_, delete, desc, or_
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from app.middleware import create_access_token
from datetime import datetime, date, timedelta
import secrets, json, math, os, random


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def calculate_distance(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

async def get_user_by_id(session: AsyncSession, user_id):
    result = await session.execute(
        select(Users).where(Users.id == user_id)
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "id": user.id,
            "email": user.email,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "gender": user.gender,
            "age": user.age,
            "role": user.role,
            "nationality": user.nationality,
            "language": user.language,
            "coach_id": user.coach_id,
            "unique_code": user.unique_code,
            "description": user.description,
            "city": user.city,
            "latitude": user.latitude,
            "longitude": user.longitude,
            "goal": user.goal,
            "height": user.height,
            "weight": user.weight,
            "created_at": str(user.created_at)
        }
    )


async def register_user(session: AsyncSession, user_data: dict):
    try:
        user_data['age'] = int(user_data['age'])
    except ValueError:
        raise HTTPException(status_code=400, detail="The age field must be a valid integer.")

    stmt = select(Users).where(Users.email == user_data["email"])
    result = await session.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered. Please use a different email address.")

    random_digits = secrets.randbelow(1000000)
    generated_code = f"#{random_digits:06d}"

    role_str = str(user_data.get("role", "")).lower()

    now = datetime.utcnow()

    new_user = Users(
        firstname=user_data["firstname"],
        lastname=user_data["lastname"],
        gender=user_data.get("gender"),
        email=user_data["email"],
        age=user_data["age"],
        role=role_str,
        nationality=user_data.get("nationality"),
        language=user_data.get("language"),
        coach_id=user_data.get("coach_id"),
        height=user_data.get("height"),
        weight=user_data.get("weight"),
        unique_code=generated_code,
        city=user_data.get("city"),
        latitude=user_data.get("latitude") if role_str == 'coach' else None,
        longitude=user_data.get("longitude") if role_str == 'coach' else None,
        goal=user_data.get("goal") if role_str == 'client' else None,
        fitness_level=user_data.get("fitness_level") if role_str == 'client' else None,
        cgu_accepted_at=now,
        privacy_accepted_at=now,
        cgu_version="1.0",
        last_activity_at=now,
    )

    new_user.password = user_data["password"]
    try:
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        # TEMPORARY SEED DATA — DELETE THESE 2 LINES WHEN DONE TESTING
        if new_user.role == "client":
            await seed_demo_workouts(session, new_user.id)

        token_payload = {
            "userId": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role
        }

        access_token = create_access_token(token_payload)

        return JSONResponse(
            status_code=201,
            content={
                "message": "User registered successfully",
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": new_user.id,
                    "firstname": new_user.firstname,
                    "role": new_user.role,
                    "unique_code": new_user.unique_code
                }
            }
        )

    except IntegrityError as e:
        await session.rollback()
        print(f"Erreur inattendue DB: {e}")
        raise HTTPException(status_code=500, detail="Une erreur est survenue lors de la création du compte. Veuillez réessayer.")


# ============================================================
# TEMPORARY SEED DATA — DELETE THIS FUNCTION WHEN DONE TESTING
# ============================================================
async def seed_demo_workouts(session: AsyncSession, user_id: int):
    """Generate 30 days of completed workouts for stats testing."""
    today = datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0)
    demo_plans = [
        ("Push Day", "Intermediate", [
            {"name": "Bench Press", "muscle": "chest", "num_sets": 4, "sets_details": [{"set_number": 1, "reps": 10, "weight": 60}, {"set_number": 2, "reps": 10, "weight": 60}, {"set_number": 3, "reps": 8, "weight": 65}, {"set_number": 4, "reps": 8, "weight": 65}]},
            {"name": "Overhead Press", "muscle": "shoulders", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 10, "weight": 30}, {"set_number": 2, "reps": 10, "weight": 30}, {"set_number": 3, "reps": 8, "weight": 35}]},
            {"name": "Tricep Dips", "muscle": "triceps", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 12, "weight": 0}, {"set_number": 2, "reps": 12, "weight": 0}, {"set_number": 3, "reps": 10, "weight": 0}]},
        ]),
        ("Pull Day", "Intermediate", [
            {"name": "Deadlift", "muscle": "back", "num_sets": 4, "sets_details": [{"set_number": 1, "reps": 8, "weight": 80}, {"set_number": 2, "reps": 8, "weight": 80}, {"set_number": 3, "reps": 6, "weight": 90}, {"set_number": 4, "reps": 6, "weight": 90}]},
            {"name": "Barbell Row", "muscle": "back", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 10, "weight": 50}, {"set_number": 2, "reps": 10, "weight": 50}, {"set_number": 3, "reps": 8, "weight": 55}]},
            {"name": "Bicep Curl", "muscle": "biceps", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 12, "weight": 14}, {"set_number": 2, "reps": 12, "weight": 14}, {"set_number": 3, "reps": 10, "weight": 16}]},
        ]),
        ("Leg Day", "Intermediate", [
            {"name": "Squat", "muscle": "quadriceps", "num_sets": 4, "sets_details": [{"set_number": 1, "reps": 10, "weight": 70}, {"set_number": 2, "reps": 10, "weight": 70}, {"set_number": 3, "reps": 8, "weight": 80}, {"set_number": 4, "reps": 8, "weight": 80}]},
            {"name": "Leg Press", "muscle": "quadriceps", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 12, "weight": 100}, {"set_number": 2, "reps": 12, "weight": 100}, {"set_number": 3, "reps": 10, "weight": 120}]},
            {"name": "Calf Raise", "muscle": "calves", "num_sets": 3, "sets_details": [{"set_number": 1, "reps": 15, "weight": 40}, {"set_number": 2, "reps": 15, "weight": 40}, {"set_number": 3, "reps": 15, "weight": 40}]},
        ]),
    ]

    for day_offset in range(30, 0, -1):
        workout_date = today - timedelta(days=day_offset)
        plan_name, difficulty, exercises = demo_plans[day_offset % len(demo_plans)]

        workout = Workout(
            user_id=user_id,
            name=plan_name,
            difficulty=difficulty,
            scheduled_date=workout_date,
            is_completed=True,
        )
        session.add(workout)
        await session.flush()

        for exo in exercises:
            session.add(WorkoutExercise(
                workout_id=workout.id,
                name=exo["name"],
                muscle=exo["muscle"],
                num_sets=exo["num_sets"],
                rest_time=60,
                sets_details=exo["sets_details"],
            ))

        session.add(WorkoutRating(
            workout_id=workout.id,
            user_id=user_id,
            overall_rating=random.randint(2, 5),
            perceived_difficulty=random.choice(["too_easy", "just_right", "just_right", "hard", "too_hard"]),
            energy_level=random.choice(["fresh", "fresh", "normal", "normal", "tired", "exhausted"]),
            feedback_text=None,
        ))

    await session.commit()
# ============================================================
# END TEMPORARY SEED DATA
# ============================================================


async def login_user(session: AsyncSession, user_data: dict):
    result = await session.execute(
        select(Users).where(
            (Users.email == user_data['email'])
        )
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(404, "User not found.")

    if not user.verify_password(user_data['password']):
        raise HTTPException(401, "Invalid password.")

    # Update last activity for RGPD inactivity tracking
    user.last_activity_at = datetime.utcnow()
    await session.commit()

    token_payload = {
        "userId": str(user.id),
        "email": user.email,
        "role": user.role
    }

    access_token = create_access_token(token_payload)

    return JSONResponse(
        status_code=200,
        content={
            "message": "Login successful!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "email": user.email,
                "role": user.role,
                "age": user.age,
                "language": user.language
            }
        }
    )


async def update_user_description(session: AsyncSession, user_id: int, description: str):
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.description = description

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {"message": "Description updated successfully", "description": user.description}


async def update_user_profile(session: AsyncSession, user_id: int, update_data: UserUpdate):
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updatable_fields = ["firstname", "lastname", "email", "age", "gender", "city",
                        "latitude", "longitude", "weight", "height", "goal", "fitness_level", "description"]
    for field in updatable_fields:
        value = getattr(update_data, field, None)
        if value is not None:
            setattr(user, field, value)

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return {"message": "Profile updated successfully"}


async def get_dashboard_stats(session: AsyncSession, current_user):
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


async def update_my_goals(session: AsyncSession, current_user, goal_data: UserGoalUpdate):
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


async def update_user_macro_goals(session: AsyncSession, user_id: int, goal_data: MacroUpdate):
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


async def update_user_location(session: AsyncSession, user_id: int, location: LocationUpdate):
    stmt = (
        update(Users)
        .where(Users.id == user_id)
        .values(latitude=location.latitude, longitude=location.longitude)
    )
    await session.execute(stmt)
    await session.commit()
    return {"message": "Location updated successfully"}


async def unassign_my_coach(session: AsyncSession, user_id: int):
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.coach_id is None:
        raise HTTPException(status_code=400, detail="You don't have a coach assigned")

    user.coach_id = None

    try:
        await session.commit()
        return {"message": "You have left your coach"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------

async def create_meal(session: AsyncSession, user_id: int, meal_data: dict):
    aliments_data = meal_data.get('aliments')
    if isinstance(aliments_data, (list, dict)):
        aliments_json = json.dumps(aliments_data)
    else:
        aliments_json = aliments_data

    new_meal = Meal(
        user_id=user_id,
        name=meal_data['name'],
        description=meal_data.get('description'),
        total_calories=meal_data['total_calories'],
        total_proteins=meal_data['total_proteins'],
        total_carbohydrates=meal_data['total_carbohydrates'],
        total_sugars=meal_data['total_sugars'],
        total_lipids=meal_data['total_lipids'],
        total_saturated_fats=meal_data['total_saturated_fats'],
        total_fiber=meal_data['total_fiber'],
        total_salt=meal_data['total_salt'],
        aliments=aliments_json,
        meal_type=meal_data.get('meal_type'),
        hourtime=datetime.fromisoformat(meal_data['hourtime'].replace("Z", "+00:00")),
        is_consumed=meal_data.get('is_consumed', False)
    )

    session.add(new_meal)
    await session.commit()
    await session.refresh(new_meal)
    return new_meal


async def delete_meal(session: AsyncSession, meal_id):
    result = await session.execute(
        select(Meal).where(Meal.id == meal_id)
    )
    meal = result.scalars().first()

    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found.")

    await session.delete(meal)
    await session.commit()

    return {"message": "Meal deleted successfully"}


async def update_meal(session, meal_id, meal_data):
    if 'hourtime' in meal_data and isinstance(meal_data['hourtime'], str):
        clean_date = meal_data['hourtime'].replace('Z', '+00:00')
        meal_data['hourtime'] = datetime.fromisoformat(clean_date)

    meal_data.pop('total_fats', None)

    if 'total_fibers' in meal_data:
        meal_data['total_fiber'] = meal_data.pop('total_fibers')

    stmt = (
        update(Meal)
        .where(Meal.id == meal_id)
        .values(**meal_data)
        .execution_options(synchronize_session="fetch")
    )

    await session.execute(stmt)
    await session.commit()

    return {"message": "Meal updated successfully"}


async def get_meals_by_user(session: AsyncSession, user_id: int):
    today = date.today()

    result = await session.execute(
        select(Meal)
        .where(
            (Meal.user_id == user_id) &
            (func.date(Meal.hourtime) == today)
        )
        .order_by(Meal.hourtime.asc())
    )

    meals = result.scalars().all()

    meal_list = []
    for meal in meals:
        meal_list.append({
            "id": meal.id,
            "user_id": meal.user_id,
            "name": meal.name,
            "hourtime": meal.hourtime.isoformat(),
            "total_calories": meal.total_calories,
            "total_proteins": meal.total_proteins,
            "total_carbohydrates": meal.total_carbohydrates,
            "total_sugars": meal.total_sugars,
            "total_lipids": meal.total_lipids,
            "total_saturated_fats": meal.total_saturated_fats,
            "total_fiber": meal.total_fiber,
            "total_salt": meal.total_salt,
            "aliments": meal.aliments,
            "is_consumed": meal.is_consumed,
        })

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"meals": meal_list}
    )


async def toggle_meal_consume(session: AsyncSession, meal_id: int, user_id: int):
    result = await session.execute(select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id))
    meal = result.scalars().first()

    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    meal.is_consumed = not meal.is_consumed

    await session.commit()
    await session.refresh(meal)
    return meal


# ---------------------------------------------------------------------------
# Workouts
# ---------------------------------------------------------------------------

async def create_full_workout(session: AsyncSession, user_id: int, workout_data: WorkoutCreate, is_ai_generated: bool = False):
    try:
        new_workout = Workout(
            user_id=user_id,
            name=workout_data.name,
            description=workout_data.description,
            difficulty=workout_data.difficulty,
            scheduled_date=workout_data.scheduled_date,
            is_ai_generated=is_ai_generated,
        )
        session.add(new_workout)

        await session.flush()

        for exo in workout_data.exercises:
            sets_data = [s.model_dump() for s in exo.sets_details] if exo.sets_details else []

            new_exercise = WorkoutExercise(
                workout_id=new_workout.id,
                name=exo.name,
                muscle=exo.muscle,
                num_sets=exo.num_sets,
                rest_time=exo.rest_time,
                sets_details=sets_data
            )
            session.add(new_exercise)

        await session.commit()

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={"message": "Workout scheduled successfully", "workout_id": new_workout.id}
        )

    except Exception as e:
        await session.rollback()
        print(f"Error creating workout: {e}")
        raise HTTPException(status_code=500, detail="Could not save workout.")


async def get_user_workouts(session: AsyncSession, user_id: int):
    try:
        stmt = select(Workout)\
            .where(Workout.user_id == user_id)\
            .options(selectinload(Workout.exercises), selectinload(Workout.rating))\
            .order_by(Workout.scheduled_date.asc())

        result = await session.execute(stmt)
        workouts = result.scalars().all()
        return workouts

    except Exception as e:
        print(f"Error fetching workouts: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch workouts.")


async def update_full_workout(session: AsyncSession, workout_id: int, workout_data: dict):
    result = await session.execute(select(Workout).where(Workout.id == workout_id))
    workout = result.scalars().first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    workout.name = workout_data.get('name', workout.name)
    workout.difficulty = workout_data.get('difficulty', workout.difficulty)

    await session.execute(
        WorkoutExercise.__table__.delete().where(WorkoutExercise.workout_id == workout_id)
    )

    for exo in workout_data.get('exercises', []):
        new_exercise = WorkoutExercise(
            workout_id=workout.id,
            name=exo['name'],
            muscle=exo['muscle'],
            num_sets=exo['num_sets'],
            rest_time=exo.get('rest_time', 60),
            sets_details=exo['sets_details']
        )
        session.add(new_exercise)

    await session.commit()
    return {"message": "Workout updated successfully"}


async def delete_full_workout(session: AsyncSession, workout_id: int):
    result = await session.execute(select(Workout).where(Workout.id == workout_id))
    workout = result.scalars().first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    await session.execute(
        WorkoutExercise.__table__.delete().where(WorkoutExercise.workout_id == workout_id)
    )

    await session.delete(workout)
    await session.commit()

    return {"message": "Workout deleted successfully"}


async def delete_workout_for_user(session: AsyncSession, workout_id: int, user_id: int):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    workout = result.scalars().first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    await session.delete(workout)
    await session.commit()

    return {"message": "Workout deleted"}


async def toggle_workout_complete(session: AsyncSession, workout_id: int, user_id: int, rating_data: dict = None):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    workout = result.scalars().first()

    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    if not (workout.is_completed or False):
        # Completing the workout — create rating if provided
        workout.is_completed = True
        if rating_data:
            rating = WorkoutRating(
                workout_id=workout_id,
                user_id=user_id,
                overall_rating=rating_data.get("overall_rating"),
                perceived_difficulty=rating_data.get("perceived_difficulty"),
                energy_level=rating_data.get("energy_level"),
                feedback_text=rating_data.get("feedback_text"),
            )
            session.add(rating)
    else:
        # Uncompleting the workout — delete associated rating
        workout.is_completed = False
        await session.execute(
            delete(WorkoutRating).where(WorkoutRating.workout_id == workout_id)
        )

    await session.commit()
    await session.refresh(workout)

    return workout


async def update_workout_rating(session: AsyncSession, workout_id: int, user_id: int, rating_data: dict):
    result = await session.execute(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    workout = result.scalars().first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    if not workout.is_completed:
        raise HTTPException(status_code=400, detail="Workout is not completed")

    result = await session.execute(
        select(WorkoutRating).where(WorkoutRating.workout_id == workout_id)
    )
    rating = result.scalars().first()

    if rating:
        rating.overall_rating = rating_data["overall_rating"]
        rating.perceived_difficulty = rating_data["perceived_difficulty"]
        rating.energy_level = rating_data["energy_level"]
        rating.feedback_text = rating_data.get("feedback_text")
    else:
        rating = WorkoutRating(
            workout_id=workout_id,
            user_id=user_id,
            overall_rating=rating_data["overall_rating"],
            perceived_difficulty=rating_data["perceived_difficulty"],
            energy_level=rating_data["energy_level"],
            feedback_text=rating_data.get("feedback_text"),
        )
        session.add(rating)

    await session.commit()
    await session.refresh(rating)
    return rating


async def auto_complete_daily_workouts(session: AsyncSession):
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    stmt = (
        update(Workout)
        .where(
            and_(
                Workout.scheduled_date >= today_start,
                Workout.scheduled_date < today_end,
                Workout.is_completed == False
            )
        )
        .values(is_completed=True)
    )
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount


# ---------------------------------------------------------------------------
# Calories burned estimation
# ---------------------------------------------------------------------------

# MET values by muscle group (moderate intensity strength training)
MUSCLE_MET = {
    "chest": 6.0,
    "back": 6.0,
    "legs": 6.5,
    "shoulders": 5.0,
    "arms": 4.5,
    "abs": 4.0,
    "cardio": 8.0,
    "full body": 6.0,
}
DEFAULT_MET = 5.0


def _estimate_exercise_calories(exercise, user_weight_kg: float) -> float:
    """
    Estimate calories burned for a single exercise.

    For strength exercises (reps > 0):
      active_time = sets × reps × 4s per rep
      total_time  = active_time + rest between sets
      calories    = (total_minutes / 60) × MET × weight_kg

    For duration exercises (duration > 0):
      total_time  = sets × duration
      calories    = (total_minutes / 60) × MET × weight_kg
    """
    met = MUSCLE_MET.get((exercise.muscle or "").lower(), DEFAULT_MET)
    sets_details = exercise.sets_details or []
    num_sets = exercise.num_sets or len(sets_details) or 1
    rest_time = exercise.rest_time or 60

    total_seconds = 0

    if sets_details:
        for s in sets_details:
            reps = s.get("reps", 0) or 0
            duration = s.get("duration", 0) or 0
            weight = s.get("weight", 0) or 0

            if duration > 0:
                total_seconds += duration
            elif reps > 0:
                # ~4 seconds per rep average (concentric + eccentric + pause)
                set_time = reps * 4
                # heavier weights burn slightly more
                if weight > 0:
                    set_time *= 1 + (weight / 200)
                total_seconds += set_time

            total_seconds += rest_time
    else:
        # Fallback: estimate 30s per set + rest
        total_seconds = num_sets * (30 + rest_time)

    total_minutes = total_seconds / 60
    # MET formula: kcal = MET × weight_kg × time_hours
    calories = met * user_weight_kg * (total_minutes / 60)
    return round(calories, 1)


async def get_daily_calories_burned(session: AsyncSession, user_id: int):
    """Get estimated calories burned from completed workouts today."""
    user = await session.get(Users, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_weight = user.weight or 70.0  # fallback 70kg

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await session.execute(
        select(Workout)
        .where(
            and_(
                Workout.user_id == user_id,
                Workout.scheduled_date >= today_start,
                Workout.scheduled_date < today_end,
                Workout.is_completed == True,
            )
        )
        .options(selectinload(Workout.exercises))
    )
    workouts = result.scalars().all()

    total_calories = 0.0
    exercise_count = 0
    workout_count = len(workouts)

    for w in workouts:
        for ex in w.exercises:
            total_calories += _estimate_exercise_calories(ex, user_weight)
            exercise_count += 1

    return {
        "calories_burned": round(total_calories),
        "workout_count": workout_count,
        "exercise_count": exercise_count,
    }


# ---------------------------------------------------------------------------
# Coaches
# ---------------------------------------------------------------------------

async def get_all_coaches(session: AsyncSession):
    result = await session.execute(
        select(Users).where(Users.role == 'coach')
    )
    coaches = result.scalars().all()

    return [
        {
            "id": coach.id,
            "firstname": coach.firstname,
            "lastname": coach.lastname,
            "email": coach.email,
            "gender": coach.gender,
            "age": coach.age,
            "speciality": "General"
        }
        for coach in coaches
    ]


async def assign_coach_to_client(session: AsyncSession, client_id: int, coach_id: int):
    client_result = await session.execute(select(Users).where(Users.id == client_id))
    client = client_result.scalars().first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    coach_result = await session.execute(select(Users).where(Users.id == coach_id))
    coach = coach_result.scalars().first()

    if not coach or coach.role != 'coach':
        raise HTTPException(status_code=400, detail="Invalid coach ID")

    client.coach_id = coach_id
    try:
        await session.commit()
        return {"message": "Coach assigned successfully", "coach": f"{coach.firstname} {coach.lastname}"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


async def get_clients_by_coach_id(session: AsyncSession, coach_id: int):
    result = await session.execute(
        select(Users).where(Users.coach_id == coach_id)
    )
    clients = result.scalars().all()

    return [
        {
            "id": client.id,
            "firstname": client.firstname,
            "lastname": client.lastname,
            "age": client.age,
            "gender": client.gender,
            "email": client.email,
            "goal": client.daily_caloric_needs or 2000
        }
        for client in clients
    ]


async def get_coach_dashboard_stats(session: AsyncSession, coach_id: int):
    today = date.today()

    clients_result = await session.execute(select(Users).where(Users.coach_id == coach_id))
    clients = clients_result.scalars().all()

    dashboard_data = []

    for client in clients:
        meals_result = await session.execute(
            select(func.sum(Meal.total_calories))
            .where(
                and_(
                    Meal.user_id == client.id,
                    func.date(Meal.hourtime) == today
                )
            )
        )
        total_calories_today = meals_result.scalar() or 0

        target = client.daily_caloric_needs or 2000

        dashboard_data.append({
            "client_id": client.id,
            "client_name": f"{client.firstname} {client.lastname}",
            "client_avatar": None,
            "calories_consumed": round(total_calories_today),
            "calories_goal": target,
            "progress_percent": min(round((total_calories_today / target) * 100), 100) if target > 0 else 0,
            "status": "on_track" if total_calories_today <= target else "over"
        })

    return dashboard_data


async def assign_client_by_code(session: AsyncSession, coach_id: int, unique_code: str):
    result = await session.execute(select(Users).where(Users.unique_code == unique_code))
    client = result.scalars().first()

    if not client:
        raise HTTPException(status_code=404, detail="Client with this code not found.")

    if client.id == coach_id:
        raise HTTPException(status_code=400, detail="You cannot assign yourself as your client.")

    coach_result = await session.execute(select(Users).where(Users.id == coach_id))
    coach = coach_result.scalars().first()

    if not coach or coach.role != 'coach':
        raise HTTPException(status_code=400, detail="Invalid coach ID")

    client.coach_id = coach_id

    try:
        await session.commit()
        return {
            "message": "Client ajouté avec succès",
            "client": {
                "firstname": client.firstname,
                "lastname": client.lastname
            }
        }
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


async def unassign_client(session: AsyncSession, coach_id: int, client_id: int):
    result = await session.execute(
        select(Users).where(and_(Users.id == client_id, Users.coach_id == coach_id))
    )
    client = result.scalars().first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found or not assigned to this coach."
        )

    client.coach_id = None

    try:
        await session.commit()
        return {"message": "Client unassigned successfully"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail="Database error during unassignment.")


async def get_client_details(session: AsyncSession, client_id: int, target_date: str):
    try:
        date_obj = date.fromisoformat(target_date)
        start_of_day = datetime.combine(date_obj, datetime.min.time())
        end_of_day = datetime.combine(date_obj, datetime.max.time())

        user_result = await session.execute(select(Users).where(Users.id == client_id))
        client = user_result.scalars().first()
        if not client: raise HTTPException(404, "Client not found")

        workout_stmt = (
            select(Workout)
            .where(and_(Workout.user_id == client_id, Workout.scheduled_date >= start_of_day, Workout.scheduled_date <= end_of_day))
            .options(selectinload(Workout.exercises))
        )
        workout_res = await session.execute(workout_stmt)
        workouts = workout_res.scalars().all()

        formatted_workouts = []
        for w in workouts:
            formatted_workouts.append({
                "id": w.id,
                "name": w.name,
                "is_completed": w.is_completed,
                "is_ai_generated": w.is_ai_generated,
                "difficulty": w.difficulty,
                "exercises": [
                    {
                        "name": e.name,
                        "muscle": e.muscle,
                        "num_sets": e.num_sets,
                        "sets_details": e.sets_details
                    } for e in w.exercises
                ]
            })

        meals_result = await session.execute(
            select(func.sum(Meal.total_calories), func.sum(Meal.total_proteins), func.sum(Meal.total_carbohydrates), func.sum(Meal.total_lipids))
            .where(and_(Meal.user_id == client_id, Meal.hourtime >= start_of_day, Meal.hourtime <= end_of_day))
        )
        m_stats = meals_result.one()

        print("Client:", client.firstname, client.lastname)
        print("workouts:", formatted_workouts)
        goal_cals = client.daily_caloric_needs or 2000
        return {
            "id": client.id,
            "firstname": client.firstname,
            "lastname": client.lastname,
            "age": client.age,
            "gender": client.gender,
            "goal_calories": round(goal_cals),
            "today_stats": {"calories": round(m_stats[0] or 0), "proteins": round(m_stats[1] or 0), "carbs": round(m_stats[2] or 0), "fats": round(m_stats[3] or 0)},
            "goals_macros": {"proteins": round((goal_cals*0.25)/4), "carbs": round((goal_cals*0.5)/4), "fats": round((goal_cals*0.25)/9)},
            "workouts_today": formatted_workouts
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(500, "Internal Server Error")


async def get_coach_home_summary(session: AsyncSession, coach_id: int):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday

    # --- Clients ---
    res_clients = await session.execute(select(Users).where(Users.coach_id == coach_id))
    clients = res_clients.scalars().all()
    total_clients = len(clients)
    client_ids = [c.id for c in clients]

    if not client_ids:
        return {
            "kpi": {"total_clients": 0, "week_workouts_completed": 0, "week_workouts_total": 0, "avg_rating": None, "avg_completion": None},
            "clients_week_workouts": [],
            "goal_distribution": {},
            "weekly_activity": [],
            "leaderboard": [],
            "avg_satisfaction_weekly": [],
            "unread_messages": 0,
            "pending_requests": 0,
        }

    # --- This-week workouts (all clients) ---
    wo_result = await session.execute(
        select(Workout)
        .where(Workout.user_id.in_(client_ids), func.date(Workout.scheduled_date) >= week_start, func.date(Workout.scheduled_date) <= today)
        .options(selectinload(Workout.rating))
    )
    week_workouts = wo_result.scalars().all()
    week_total = len(week_workouts)
    week_completed = sum(1 for w in week_workouts if w.is_completed)

    # Per-client breakdown for this week
    per_client: dict[int, dict] = {}
    for w in week_workouts:
        uid = w.user_id
        if uid not in per_client:
            per_client[uid] = {"total": 0, "completed": 0}
        per_client[uid]["total"] += 1
        if w.is_completed:
            per_client[uid]["completed"] += 1

    clients_week_workouts = []
    for c in clients:
        data = per_client.get(c.id, {"total": 0, "completed": 0})
        clients_week_workouts.append({
            "id": c.id,
            "name": f"{c.firstname} {c.lastname}",
            "total": data["total"],
            "completed": data["completed"],
        })
    clients_week_workouts.sort(key=lambda x: x["completed"], reverse=True)

    # --- Last 30 days workouts for trends ---
    start_30 = today - timedelta(days=30)
    wo_30_result = await session.execute(
        select(Workout)
        .where(Workout.user_id.in_(client_ids), func.date(Workout.scheduled_date) >= start_30, func.date(Workout.scheduled_date) <= today)
        .options(selectinload(Workout.rating))
    )
    workouts_30 = wo_30_result.scalars().all()

    # Avg rating (last 30d)
    rated = [w for w in workouts_30 if w.rating]
    avg_rating = round(sum(w.rating.overall_rating for w in rated) / len(rated), 1) if rated else None

    # Avg completion (last 30d)
    total_30 = len(workouts_30)
    completed_30 = sum(1 for w in workouts_30 if w.is_completed)
    avg_completion = round(completed_30 / total_30 * 100, 1) if total_30 else None

    # Weekly activity buckets (last 30d)
    weekly_act: dict[str, dict] = {}
    for w in workouts_30:
        wo_date = w.scheduled_date.date() if hasattr(w.scheduled_date, 'date') else w.scheduled_date
        ws = wo_date - timedelta(days=wo_date.weekday())
        key = str(ws)
        if key not in weekly_act:
            weekly_act[key] = {"week_start": key, "total": 0, "completed": 0}
        weekly_act[key]["total"] += 1
        if w.is_completed:
            weekly_act[key]["completed"] += 1
    weekly_activity = [weekly_act[k] for k in sorted(weekly_act.keys())]

    # Avg satisfaction per week (last 30d)
    weekly_sat: dict[str, list] = {}
    for w in workouts_30:
        if w.rating:
            wo_date = w.scheduled_date.date() if hasattr(w.scheduled_date, 'date') else w.scheduled_date
            ws = wo_date - timedelta(days=wo_date.weekday())
            key = str(ws)
            weekly_sat.setdefault(key, []).append(w.rating.overall_rating)
    avg_satisfaction_weekly = [
        {"week_start": k, "avg_rating": round(sum(v) / len(v), 1)}
        for k, v in sorted(weekly_sat.items())
    ]

    # --- Goal distribution ---
    goal_dist: dict[str, int] = {}
    for c in clients:
        g = c.goal or "not_set"
        goal_dist[g] = goal_dist.get(g, 0) + 1

    # --- Leaderboard (sessions/week over last 30d) ---
    leaderboard = []
    weeks_count = max(1, len(weekly_activity))
    for c in clients:
        c_completed = sum(1 for w in workouts_30 if w.user_id == c.id and w.is_completed)
        c_total = sum(1 for w in workouts_30 if w.user_id == c.id)
        sessions_per_week = round(c_completed / (30 / 7), 1)
        completion = round(c_completed / c_total * 100) if c_total else 0
        leaderboard.append({
            "id": c.id,
            "name": f"{c.firstname} {c.lastname}",
            "sessions_per_week": sessions_per_week,
            "completed": c_completed,
            "total": c_total,
            "completion": completion,
        })
    leaderboard.sort(key=lambda x: x["sessions_per_week"], reverse=True)

    # --- Unread messages ---
    unread_result = await session.execute(
        select(func.count(Message.id))
        .where(Message.receiver_id == coach_id, Message.is_read == False)
    )
    unread_messages = unread_result.scalar() or 0

    # --- Pending requests ---
    pending_result = await session.execute(
        select(func.count(ClientCoachRequest.id))
        .where(ClientCoachRequest.coach_id == coach_id, ClientCoachRequest.status == "pending")
    )
    pending_requests = pending_result.scalar() or 0

    # --- Recent activity (notification messages from clients) ---
    notif_result = await session.execute(
        select(Message)
        .where(Message.receiver_id == coach_id, Message.content.like('%"_notification"%'))
        .order_by(desc(Message.timestamp))
        .limit(20)
    )
    notif_msgs = notif_result.scalars().all()

    client_map = {c.id: f"{c.firstname} {c.lastname}" for c in clients}
    recent_activity = []
    for msg in notif_msgs:
        try:
            data = json.loads(msg.content)
            if data.get("_notification"):
                recent_activity.append({
                    "id": msg.id,
                    "client_id": msg.sender_id,
                    "client_name": client_map.get(msg.sender_id, data.get("client_name", "Unknown")),
                    "type": data.get("type", ""),
                    "label": data.get("label", ""),
                    "date": data.get("date"),
                    "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                    "is_read": msg.is_read,
                })
        except (json.JSONDecodeError, AttributeError):
            continue

    return {
        "kpi": {
            "total_clients": total_clients,
            "week_workouts_completed": week_completed,
            "week_workouts_total": week_total,
            "avg_rating": avg_rating,
            "avg_completion": avg_completion,
        },
        "clients_week_workouts": clients_week_workouts,
        "goal_distribution": goal_dist,
        "weekly_activity": weekly_activity,
        "leaderboard": leaderboard,
        "avg_satisfaction_weekly": avg_satisfaction_weekly,
        "unread_messages": unread_messages,
        "pending_requests": pending_requests,
        "recent_activity": recent_activity,
    }


async def get_client_dashboard_stats(session: AsyncSession, client_id: int):
    result_user = await session.execute(select(Users).where(Users.id == client_id))
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


async def get_client_details_full(session: AsyncSession, client_id: int, target_date: str = None):
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
        .options(selectinload(Workout.exercises), selectinload(Workout.rating))
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
        "goal": client.goal,
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
                "is_ai_generated": w.is_ai_generated,
                "rating": {
                    "overall_rating": w.rating.overall_rating,
                    "perceived_difficulty": w.rating.perceived_difficulty,
                    "energy_level": w.rating.energy_level,
                    "feedback_text": w.rating.feedback_text,
                } if w.rating else None,
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


async def get_client_statistics(session: AsyncSession, client_id: int, days: int = 30):
    """Aggregate workout and nutrition statistics for a client over N days."""
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)

    # --- Workout stats ---
    wo_result = await session.execute(
        select(Workout)
        .where(
            Workout.user_id == client_id,
            func.date(Workout.scheduled_date) >= start_date,
            func.date(Workout.scheduled_date) <= end_date,
        )
        .options(selectinload(Workout.rating), selectinload(Workout.exercises))
    )
    workouts = wo_result.scalars().all()

    total_wo = len(workouts)
    completed_wo = sum(1 for w in workouts if w.is_completed)
    completion_rate = round((completed_wo / total_wo * 100) if total_wo else 0, 1)

    rated = [w for w in workouts if w.rating]
    avg_rating = round(sum(w.rating.overall_rating for w in rated) / len(rated), 1) if rated else None
    rated_count = len(rated)

    diff_dist = {"too_easy": 0, "just_right": 0, "hard": 0, "too_hard": 0}
    energy_dist = {"fresh": 0, "normal": 0, "tired": 0, "exhausted": 0}
    for w in rated:
        d = w.rating.perceived_difficulty
        e = w.rating.energy_level
        if d in diff_dist:
            diff_dist[d] += 1
        if e in energy_dist:
            energy_dist[e] += 1

    # Muscle group distribution (count exercises per muscle)
    muscle_dist: dict[str, int] = {}
    for w in workouts:
        if w.is_completed:
            for exo in w.exercises:
                m = (exo.muscle or "other").lower()
                muscle_dist[m] = muscle_dist.get(m, 0) + 1

    # Compute total volume per workout (sum of reps * weight across all exercises/sets)
    def calc_workout_volume(workout):
        vol = 0
        for exo in workout.exercises:
            sets = exo.sets_details
            if isinstance(sets, str):
                try:
                    sets = json.loads(sets)
                except Exception:
                    sets = []
            if not sets:
                continue
            for s in sets:
                reps = s.get("reps", 0) or 0
                weight = s.get("weight", 0) or 0
                vol += reps * weight
        return vol

    total_volume = sum(calc_workout_volume(w) for w in workouts if w.is_completed)

    # Weekly buckets
    weekly = {}
    for w in workouts:
        wo_date = w.scheduled_date.date() if hasattr(w.scheduled_date, 'date') else w.scheduled_date
        week_start = wo_date - timedelta(days=wo_date.weekday())
        key = str(week_start)
        if key not in weekly:
            weekly[key] = {"week_start": key, "total": 0, "completed": 0, "ratings": [], "volume": 0}
        weekly[key]["total"] += 1
        if w.is_completed:
            weekly[key]["completed"] += 1
            weekly[key]["volume"] += calc_workout_volume(w)
        if w.rating:
            weekly[key]["ratings"].append(w.rating.overall_rating)

    weekly_list = []
    for k in sorted(weekly.keys()):
        entry = weekly[k]
        avg_r = round(sum(entry["ratings"]) / len(entry["ratings"]), 1) if entry["ratings"] else None
        weekly_list.append({
            "week_start": entry["week_start"],
            "total": entry["total"],
            "completed": entry["completed"],
            "avg_rating": avg_r,
            "volume": entry["volume"],
        })

    # --- Nutrition stats ---
    meal_result = await session.execute(
        select(Meal).where(
            Meal.user_id == client_id,
            func.date(Meal.hourtime) >= start_date,
            func.date(Meal.hourtime) <= end_date,
            Meal.is_consumed == True,
        )
    )
    meals = meal_result.scalars().all()

    daily_nutrition = {}
    for m in meals:
        d = str(m.hourtime.date() if hasattr(m.hourtime, 'date') else m.hourtime)
        if d not in daily_nutrition:
            daily_nutrition[d] = {"date": d, "calories": 0, "proteins": 0, "carbs": 0, "fats": 0}
        daily_nutrition[d]["calories"] += m.total_calories or 0
        daily_nutrition[d]["proteins"] += m.total_proteins or 0
        daily_nutrition[d]["carbs"] += m.total_carbohydrates or 0
        daily_nutrition[d]["fats"] += m.total_lipids or 0

    daily_list = [daily_nutrition[k] for k in sorted(daily_nutrition.keys())]
    days_logged = len(daily_list)

    avg_cal = round(sum(d["calories"] for d in daily_list) / days_logged, 1) if days_logged else 0
    avg_prot = round(sum(d["proteins"] for d in daily_list) / days_logged, 1) if days_logged else 0
    avg_carbs = round(sum(d["carbs"] for d in daily_list) / days_logged, 1) if days_logged else 0
    avg_fats = round(sum(d["fats"] for d in daily_list) / days_logged, 1) if days_logged else 0

    # Round daily values
    for d in daily_list:
        d["calories"] = round(d["calories"], 0)
        d["proteins"] = round(d["proteins"], 1)
        d["carbs"] = round(d["carbs"], 1)
        d["fats"] = round(d["fats"], 1)

    # Meal type distribution
    meal_type_dist: dict[str, int] = {}
    for m in meals:
        mt = (m.meal_type or "other").lower()
        meal_type_dist[mt] = meal_type_dist.get(mt, 0) + 1

    # Weekly nutrition buckets
    weekly_nutrition: dict[str, dict] = {}
    for m in meals:
        m_date = m.hourtime.date() if hasattr(m.hourtime, 'date') else m.hourtime
        week_start = m_date - timedelta(days=m_date.weekday())
        key = str(week_start)
        if key not in weekly_nutrition:
            weekly_nutrition[key] = {"week_start": key, "calories": 0, "proteins": 0, "carbs": 0, "fats": 0, "meals": 0}
        weekly_nutrition[key]["calories"] += m.total_calories or 0
        weekly_nutrition[key]["proteins"] += m.total_proteins or 0
        weekly_nutrition[key]["carbs"] += m.total_carbohydrates or 0
        weekly_nutrition[key]["fats"] += m.total_lipids or 0
        weekly_nutrition[key]["meals"] += 1

    weekly_nutrition_list = []
    for k in sorted(weekly_nutrition.keys()):
        e = weekly_nutrition[k]
        n_meals = e["meals"] or 1
        weekly_nutrition_list.append({
            "week_start": e["week_start"],
            "avg_calories": round(e["calories"] / n_meals * min(n_meals, 3), 1),
            "avg_proteins": round(e["proteins"] / n_meals, 1),
            "avg_carbs": round(e["carbs"] / n_meals, 1),
            "avg_fats": round(e["fats"] / n_meals, 1),
            "meals": n_meals,
        })

    # Get client's calorie goal for reference
    client_result = await session.execute(select(Users).where(Users.id == client_id))
    client = client_result.scalars().first()
    calorie_goal = client.daily_caloric_needs or 2500 if client else 2500

    return {
        "period_days": days,
        "calorie_goal": calorie_goal,
        "workout_stats": {
            "total": total_wo,
            "completed": completed_wo,
            "completion_rate": completion_rate,
            "avg_rating": avg_rating,
            "rated_count": rated_count,
            "total_volume": total_volume,
            "muscle_distribution": muscle_dist,
            "difficulty_distribution": diff_dist,
            "energy_distribution": energy_dist,
            "weekly": weekly_list,
        },
        "nutrition_stats": {
            "avg_daily_calories": avg_cal,
            "avg_proteins": avg_prot,
            "avg_carbs": avg_carbs,
            "avg_fats": avg_fats,
            "total_meals": len(meals),
            "days_logged": days_logged,
            "meal_type_distribution": meal_type_dist,
            "daily": daily_list,
            "weekly": weekly_nutrition_list,
        },
    }


async def remove_client_from_coach(session: AsyncSession, coach_id: int, client_id: int):
    result = await session.execute(select(Users).where(Users.id == client_id, Users.coach_id == coach_id))
    client = result.scalars().first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found or not associated with this coach.")

    client.coach_id = None
    await session.commit()

    return {"message": "Client successfully removed from your team."}


# ---------------------------------------------------------------------------
# Coach meals (created by coach for a client)
# ---------------------------------------------------------------------------

async def delete_meal_by_coach(session: AsyncSession, meal_id: int):
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


async def update_meal_by_coach(session: AsyncSession, meal_id: int, meal_data: MealCreateByCoach):
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


async def create_meal_for_client(session: AsyncSession, client_id: int, meal_data: MealCreateByCoach):
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


# ---------------------------------------------------------------------------
# Coach search
# ---------------------------------------------------------------------------

async def search_coaches_by_city(session: AsyncSession, city: str = None):
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


async def search_coaches_near_location(session: AsyncSession, city: str = None, lat: float = None, lon: float = None):
    query = select(Users).where(Users.role == 'coach')

    if city:
        query = query.where(Users.city.ilike(f"%{city}%"))

    result = await session.execute(query)
    coaches = result.scalars().all()

    response_data = []

    for coach in coaches:
        dist = calculate_distance(lat, lon, coach.latitude, coach.longitude)
        dist_rounded = round(dist, 1) if dist is not None else None

        response_data.append({
            "id": coach.id,
            "firstname": coach.firstname,
            "lastname": coach.lastname,
            "city": coach.city,
            "distance": dist_rounded,
            "latitude": coach.latitude,
            "longitude": coach.longitude
        })

    if lat is not None and lon is not None:
        response_data.sort(key=lambda x: x["distance"] if x["distance"] is not None else float('inf'))

    return response_data


async def get_coach_public_profile(session: AsyncSession, coach_id: int):
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


# ---------------------------------------------------------------------------
# Invitations (coach → client)
# ---------------------------------------------------------------------------

async def invite_client_by_unique_code(session: AsyncSession, coach_id: int, unique_code: str):
    coach_req = await session.execute(select(Users).where(Users.id == coach_id))
    coach = coach_req.scalars().first()
    if not coach or coach.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can invite clients.")

    client_req = await session.execute(select(Users).where(Users.unique_code == unique_code))
    client = client_req.scalars().first()

    if not client:
        raise HTTPException(status_code=404, detail="Invalid code. No user found.")
    if client.id == coach_id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself.")
    if client.coach_id == coach_id:
        raise HTTPException(status_code=400, detail="This client is already part of your team.")

    existing_invitation_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.coach_id == coach_id,
                CoachInvitation.client_id == client.id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    if existing_invitation_req.scalars().first():
        raise HTTPException(status_code=400, detail="An invitation is already pending for this client.")

    new_invitation = CoachInvitation(
        coach_id=coach_id,
        client_id=client.id,
        status='pending'
    )
    session.add(new_invitation)
    await session.commit()

    return {"message": "Invitation sent to the client successfully!"}


async def get_client_invitations(session: AsyncSession, user_id: int):
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


async def delete_coach_invitation(session: AsyncSession, invitation_id: int, coach_id: int):
    inv_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.id == invitation_id,
                CoachInvitation.coach_id == coach_id
            )
        )
    )
    invitation = inv_req.scalars().first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed.")

    await session.delete(invitation)
    await session.commit()

    return {"message": "Invitation successfully deleted."}


async def respond_to_coach_invitation(session: AsyncSession, invitation_id: int, client_id: int, response_data: InvitationUpdate):
    if response_data.status not in ['accepted', 'rejected']:
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'.")

    inv_req = await session.execute(
        select(CoachInvitation).where(
            and_(
                CoachInvitation.id == invitation_id,
                CoachInvitation.client_id == client_id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    invitation = inv_req.scalars().first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed.")

    invitation.status = response_data.status

    if response_data.status == 'accepted':
        client_req = await session.execute(select(Users).where(Users.id == client_id))
        client = client_req.scalars().first()
        client.coach_id = invitation.coach_id
        session.add(client)

        await session.execute(
            update(CoachInvitation)
            .where(
                and_(
                    CoachInvitation.client_id == client_id,
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


async def get_coach_sent_invitations(session: AsyncSession, coach_id: int):
    stmt = select(CoachInvitation, Users).join(
        Users, CoachInvitation.client_id == Users.id
    ).where(CoachInvitation.coach_id == coach_id)

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


# ---------------------------------------------------------------------------
# Client requests (client → coach)
# ---------------------------------------------------------------------------

async def create_client_coach_request(session: AsyncSession, client_id: int, coach_id: int):
    existing_req = await session.execute(
        select(ClientCoachRequest)
        .where(and_(
            ClientCoachRequest.client_id == client_id,
            ClientCoachRequest.coach_id == coach_id,
            ClientCoachRequest.status == 'pending'
        ))
    )
    if existing_req.scalars().first():
        raise HTTPException(status_code=400, detail="Une demande est déjà en attente pour ce coach.")

    new_request = ClientCoachRequest(
        client_id=client_id,
        coach_id=coach_id
    )
    session.add(new_request)
    await session.commit()

    return {"message": "Demande envoyée avec succès."}


async def get_client_sent_coach_requests(session: AsyncSession, client_id: int):
    query = (
        select(ClientCoachRequest, Users)
        .join(Users, ClientCoachRequest.coach_id == Users.id)
        .where(
            and_(
                ClientCoachRequest.client_id == client_id,
                ClientCoachRequest.status == 'pending'
            )
        )
    )
    result = await session.execute(query)
    rows = result.all()

    response = []
    for req, coach in rows:
        response.append({
            "id": req.id,
            "coach_id": coach.id,
            "coach_firstname": coach.firstname,
            "coach_lastname": coach.lastname,
            "coach_city": coach.city,
            "status": req.status
        })
    return response


async def cancel_client_coach_request(session: AsyncSession, request_id: int, client_id: int):
    stmt = select(ClientCoachRequest).where(
        and_(ClientCoachRequest.id == request_id, ClientCoachRequest.client_id == client_id)
    )
    result = await session.execute(stmt)
    req = result.scalars().first()

    if req:
        await session.delete(req)
        await session.commit()
    return {"message": "Request cancelled successfully"}


async def respond_to_client_coach_request(session: AsyncSession, request_id: int, status_val: str, coach_id: int):
    stmt = select(ClientCoachRequest).where(
        and_(
            ClientCoachRequest.id == request_id,
            ClientCoachRequest.coach_id == coach_id
        )
    )
    result = await session.execute(stmt)
    req = result.scalars().first()

    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable.")

    if status_val == 'accepted':
        await session.execute(
            update(Users)
            .where(Users.id == req.client_id)
            .values(coach_id=coach_id)
        )

        await session.execute(
            delete(ClientCoachRequest)
            .where(
                and_(
                    ClientCoachRequest.client_id == req.client_id,
                    ClientCoachRequest.id != request_id
                )
            )
        )

        req.status = 'accepted'

    elif status_val == 'rejected':
        await session.delete(req)

    await session.commit()

    return {"message": f"Demande {status_val} avec succès ! Toutes les autres demandes du client ont été annulées."}


async def get_coach_pending_client_requests(session: AsyncSession, coach_id: int):
    query = (
        select(ClientCoachRequest, Users)
        .join(Users, ClientCoachRequest.client_id == Users.id)
        .where(
            and_(
                ClientCoachRequest.coach_id == coach_id,
                ClientCoachRequest.status == 'pending'
            )
        )
    )
    result = await session.execute(query)
    rows = result.all()

    return [{
        "request_id": req.id,
        "client_id": client.id,
        "client_name": f"{client.firstname} {client.lastname}",
        "client_city": client.city,
        "client_age": client.age,
        "client_weight": client.weight,
        "client_height": client.height,
        "client_email": client.email,
        "client_goal": client.goal,
        "created_at": req.created_at
    } for req, client in rows]


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

async def get_conversations(session: AsyncSession, user_id: int):
    clients_req = await session.execute(
        select(Users).where(Users.coach_id == user_id)
    )
    clients = clients_req.scalars().all()

    conversations = []

    for client in clients:
        last_msg_req = await session.execute(
            select(Message)
            .where(
                or_(
                    and_(Message.sender_id == user_id, Message.receiver_id == client.id),
                    and_(Message.sender_id == client.id, Message.receiver_id == user_id)
                )
            )
            .order_by(desc(Message.timestamp))
            .limit(1)
        )
        last_msg = last_msg_req.scalars().first()

        # Parse notification messages for display
        display_msg = "No messages yet"
        if last_msg:
            try:
                data = json.loads(last_msg.content)
                if data.get("_notification"):
                    labels = {"meal_created": "New Meal", "meal_updated": "Meal Updated", "workout_updated": "Workout Updated", "profile_updated": "Profile Updated"}
                    display_msg = f"{labels.get(data.get('type', ''), 'Update')}: {data.get('label', '')}"
                else:
                    display_msg = last_msg.content
            except (json.JSONDecodeError, TypeError):
                display_msg = last_msg.content

        # Count unread messages from this client
        unread_req = await session.execute(
            select(func.count(Message.id))
            .where(Message.sender_id == client.id, Message.receiver_id == user_id, Message.is_read == False)
        )
        unread = unread_req.scalar() or 0

        conversations.append({
            "client_id": client.id,
            "client_firstname": client.firstname,
            "client_lastname": client.lastname,
            "last_message": display_msg,
            "last_message_time": last_msg.timestamp if last_msg else None,
            "unread_count": unread,
        })

    conversations.sort(key=lambda x: x["last_message_time"] or datetime.min, reverse=True)
    return conversations


async def get_chat_history(session: AsyncSession, current_user_id: int, other_user_id: int):
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


async def send_message(session: AsyncSession, current_user_id: int, message_data: MessageCreate):
    new_msg = Message(
        sender_id=current_user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    session.add(new_msg)
    await session.commit()
    await session.refresh(new_msg)
    return new_msg


async def get_coach_needs_attention(session: AsyncSession, coach_id: int):
    pending_invites_req = await session.execute(
        select(func.count(CoachInvitation.id))
        .where(
            and_(
                CoachInvitation.coach_id == coach_id,
                CoachInvitation.status == 'pending'
            )
        )
    )
    pending_invites_count = pending_invites_req.scalar() or 0

    unread_messages_req = await session.execute(
        select(func.count(Message.id))
        .where(
            and_(
                Message.receiver_id == coach_id,
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


async def get_unread_message_count(session: AsyncSession, user_id: int):
    result = await session.execute(
        select(func.count(Message.id))
        .where(
            and_(
                Message.receiver_id == user_id,
                Message.is_read == False
            )
        )
    )
    return {"unread_count": result.scalar() or 0}


async def mark_messages_read(session: AsyncSession, current_user_id: int, other_user_id: int):
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


async def notify_coach(session: AsyncSession, client_id: int, notification):
    """Send a notification message from a client to their coach."""
    result = await session.execute(select(Users).where(Users.id == client_id))
    client = result.scalars().first()
    if not client or not client.coach_id:
        raise HTTPException(status_code=400, detail="No coach assigned")

    content = json.dumps({
        "_notification": True,
        "type": notification.type,
        "label": notification.label,
        "client_name": f"{client.firstname} {client.lastname}",
        "date": str(date.today()),
    })

    msg = Message(sender_id=client_id, receiver_id=client.coach_id, content=content)
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    return {"message": "Coach notified"}


# ---------------------------------------------------------------------------
# Forums
# ---------------------------------------------------------------------------

def _forum_row_to_dict(forum, author, msg_count: int, is_fav: bool) -> dict:
    return {
        "id": forum.id,
        "user_id": forum.user_id,
        "title": forum.title,
        "description": forum.description,
        "topic": forum.topic,
        "status": forum.status,
        "created_at": forum.created_at.isoformat() if forum.created_at else None,
        "last_activity_at": forum.last_activity_at.isoformat() if forum.last_activity_at else None,
        "author_firstname": author.firstname,
        "author_lastname": author.lastname,
        "author_role": author.role,
        "message_count": msg_count,
        "is_favorite": is_fav,
    }


async def _count_messages(session: AsyncSession, forum_id: int) -> int:
    res = await session.execute(
        select(func.count(ForumMessage.id)).where(ForumMessage.forum_id == forum_id)
    )
    return res.scalar() or 0


async def _is_favorited(session: AsyncSession, user_id: int, forum_id: int) -> bool:
    res = await session.execute(
        select(ForumFavorite).where(
            ForumFavorite.user_id == user_id,
            ForumFavorite.forum_id == forum_id
        )
    )
    return res.scalars().first() is not None


async def create_forum(session: AsyncSession, user_id: int, forum_data: ForumCreate):
    forum = Forum(
        user_id=user_id,
        title=forum_data.title,
        description=forum_data.description,
        topic=forum_data.topic,
        status=forum_data.status,
        last_activity_at=datetime.utcnow(),
    )
    session.add(forum)
    await session.commit()
    await session.refresh(forum)

    author = await session.get(Users, user_id)
    return JSONResponse(status_code=201, content=_forum_row_to_dict(forum, author, 0, False))


async def get_public_forums(session: AsyncSession, user_id: int, page: int = 1, page_size: int = 15, topic: str | None = None, sort: str = "recent"):
    offset = (page - 1) * page_size

    filters = [Forum.status == 'public']
    if topic:
        filters.append(Forum.topic == topic)

    total_res = await session.execute(
        select(func.count(Forum.id)).where(*filters)
    )
    total = total_res.scalar() or 0

    order = desc(Forum.last_activity_at)
    if sort == "oldest":
        order = asc(Forum.created_at)
    elif sort == "popular":
        order = desc(Forum.last_activity_at)

    result = await session.execute(
        select(Forum, Users)
        .join(Users, Forum.user_id == Users.id)
        .where(*filters)
        .order_by(order)
        .offset(offset)
        .limit(page_size)
    )
    rows = result.all()

    forums = []
    for forum, author in rows:
        msg_count = await _count_messages(session, forum.id)
        is_fav = await _is_favorited(session, user_id, forum.id)
        forums.append(_forum_row_to_dict(forum, author, msg_count, is_fav))

    return JSONResponse(status_code=200, content={
        "forums": forums,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    })


async def get_forum_with_messages(session: AsyncSession, forum_id: int, user_id: int):
    res = await session.execute(
        select(Forum, Users)
        .join(Users, Forum.user_id == Users.id)
        .where(Forum.id == forum_id)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Forum not found")

    forum, author = row
    if forum.status != 'public' and forum.user_id != user_id:
        raise HTTPException(status_code=403, detail="This forum is not public")

    is_fav = await _is_favorited(session, user_id, forum_id)

    msg_res = await session.execute(
        select(ForumMessage, Users)
        .join(Users, ForumMessage.user_id == Users.id)
        .where(ForumMessage.forum_id == forum_id)
        .order_by(asc(ForumMessage.created_at))
    )
    messages = []
    for msg, msg_author in msg_res.all():
        messages.append({
            "id": msg.id,
            "forum_id": msg.forum_id,
            "user_id": msg.user_id,
            "author_firstname": msg_author.firstname,
            "author_lastname": msg_author.lastname,
            "author_role": msg_author.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

    return JSONResponse(status_code=200, content={
        "id": forum.id,
        "user_id": forum.user_id,
        "title": forum.title,
        "description": forum.description,
        "topic": forum.topic,
        "status": forum.status,
        "created_at": forum.created_at.isoformat() if forum.created_at else None,
        "last_activity_at": forum.last_activity_at.isoformat() if forum.last_activity_at else None,
        "author_firstname": author.firstname,
        "author_lastname": author.lastname,
        "author_role": author.role,
        "is_favorite": is_fav,
        "messages": messages,
    })


async def post_forum_message(session: AsyncSession, forum_id: int, user_id: int, message_data: ForumMessageCreate):
    forum_res = await session.execute(select(Forum).where(Forum.id == forum_id))
    forum = forum_res.scalars().first()
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")
    if forum.status != 'public' and forum.user_id != user_id:
        raise HTTPException(status_code=403, detail="This forum is not public")

    msg = ForumMessage(forum_id=forum_id, user_id=user_id, content=message_data.content)
    session.add(msg)
    forum.last_activity_at = datetime.utcnow()
    await session.commit()
    await session.refresh(msg)

    author = await session.get(Users, user_id)
    return JSONResponse(status_code=201, content={
        "id": msg.id,
        "forum_id": msg.forum_id,
        "user_id": msg.user_id,
        "author_firstname": author.firstname,
        "author_lastname": author.lastname,
        "author_role": author.role,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    })


async def toggle_forum_favorite(session: AsyncSession, user_id: int, forum_id: int):
    res = await session.execute(
        select(ForumFavorite).where(
            ForumFavorite.user_id == user_id,
            ForumFavorite.forum_id == forum_id
        )
    )
    existing = res.scalars().first()
    if existing:
        await session.delete(existing)
        await session.commit()
        return JSONResponse(status_code=200, content={"is_favorite": False})
    else:
        fav = ForumFavorite(user_id=user_id, forum_id=forum_id)
        session.add(fav)
        await session.commit()
        return JSONResponse(status_code=200, content={"is_favorite": True})


async def get_favorite_forums(session: AsyncSession, user_id: int, page: int = 1, page_size: int = 15, topic: str | None = None):
    offset = (page - 1) * page_size

    filters = [ForumFavorite.user_id == user_id, Forum.status == 'public']
    if topic:
        filters.append(Forum.topic == topic)

    total_res = await session.execute(
        select(func.count(ForumFavorite.id))
        .join(Forum, ForumFavorite.forum_id == Forum.id)
        .where(*filters)
    )
    total = total_res.scalar() or 0

    result = await session.execute(
        select(Forum, Users)
        .join(ForumFavorite, ForumFavorite.forum_id == Forum.id)
        .join(Users, Forum.user_id == Users.id)
        .where(*filters)
        .order_by(desc(Forum.last_activity_at))
        .offset(offset)
        .limit(page_size)
    )
    rows = result.all()

    forums = []
    for forum, author in rows:
        msg_count = await _count_messages(session, forum.id)
        forums.append(_forum_row_to_dict(forum, author, msg_count, True))

    return JSONResponse(status_code=200, content={
        "forums": forums,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    })


async def get_my_forums(session: AsyncSession, user_id: int, page: int = 1, page_size: int = 15, topic: str | None = None):
    offset = (page - 1) * page_size

    filters = [Forum.user_id == user_id]
    if topic:
        filters.append(Forum.topic == topic)

    total_res = await session.execute(
        select(func.count(Forum.id)).where(*filters)
    )
    total = total_res.scalar() or 0

    result = await session.execute(
        select(Forum, Users)
        .join(Users, Forum.user_id == Users.id)
        .where(*filters)
        .order_by(desc(Forum.created_at))
        .offset(offset)
        .limit(page_size)
    )
    rows = result.all()

    forums = []
    for forum, author in rows:
        msg_count = await _count_messages(session, forum.id)
        is_fav = await _is_favorited(session, user_id, forum.id)
        forums.append(_forum_row_to_dict(forum, author, msg_count, is_fav))

    return JSONResponse(status_code=200, content={
        "forums": forums,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
    })


async def update_forum(session: AsyncSession, forum_id: int, user_id: int, update_data: ForumUpdate):
    res = await session.execute(select(Forum).where(Forum.id == forum_id))
    forum = res.scalars().first()
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")
    if forum.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this forum")

    if update_data.title is not None:
        forum.title = update_data.title
    if update_data.description is not None:
        forum.description = update_data.description
    if update_data.topic is not None:
        forum.topic = update_data.topic
    if update_data.status is not None:
        forum.status = update_data.status

    await session.commit()
    return JSONResponse(status_code=200, content={"message": "Forum updated successfully"})


async def delete_forum(session: AsyncSession, forum_id: int, user_id: int):
    res = await session.execute(select(Forum).where(Forum.id == forum_id))
    forum = res.scalars().first()
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")
    if forum.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this forum")

    await session.delete(forum)
    await session.commit()
    return JSONResponse(status_code=200, content={"message": "Forum deleted successfully"})


async def delete_forum_message(session: AsyncSession, forum_id: int, message_id: int, user_id: int):
    """Delete a message. Allowed if user is the forum creator OR the message author."""
    forum_res = await session.execute(select(Forum).where(Forum.id == forum_id))
    forum = forum_res.scalars().first()
    if not forum:
        raise HTTPException(status_code=404, detail="Forum not found")

    msg_res = await session.execute(
        select(ForumMessage).where(ForumMessage.id == message_id, ForumMessage.forum_id == forum_id)
    )
    msg = msg_res.scalars().first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if user_id != forum.user_id and user_id != msg.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    await session.delete(msg)
    await session.commit()
    return JSONResponse(status_code=200, content={"message": "Message deleted successfully"})


async def cleanup_inactive_forums(session: AsyncSession) -> int:
    cutoff = datetime.utcnow() - timedelta(days=30)
    res = await session.execute(select(Forum).where(Forum.last_activity_at < cutoff))
    inactive = res.scalars().all()
    count = len(inactive)
    for forum in inactive:
        await session.delete(forum)
    await session.commit()
    return count


# ---------------------------------------------------------------------------
# User public profile
# ---------------------------------------------------------------------------

async def get_user_public_profile(session: AsyncSession, user_id: int):
    res = await session.execute(select(Users).where(Users.id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return JSONResponse(status_code=200, content={
        "id": user.id,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "role": user.role,
        "city": user.city,
        "description": user.description,
        "goal": user.goal,
        "weight": user.weight,
        "height": user.height,
        "age": user.age,
        "gender": user.gender,
        "nationality": user.nationality,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    })


# ---------------------------------------------------------------------------
# RGPD — Account deletion (Right to Erasure)
# ---------------------------------------------------------------------------

async def delete_user_account(session: AsyncSession, user_id: int):
    """Permanently delete a user and ALL their associated data (RGPD Art. 17)."""
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Delete AI chat messages
    await session.execute(delete(AIChatMessage).where(AIChatMessage.user_id == user_id))

    # 2. Delete injuries
    await session.execute(delete(UserInjury).where(UserInjury.user_id == user_id))

    # 3. Delete meals
    await session.execute(delete(Meal).where(Meal.user_id == user_id))

    # 4. Delete workout exercises (via workouts)
    workout_ids_result = await session.execute(
        select(Workout.id).where(Workout.user_id == user_id)
    )
    workout_ids = [row[0] for row in workout_ids_result.all()]
    if workout_ids:
        await session.execute(
            delete(WorkoutRating).where(WorkoutRating.workout_id.in_(workout_ids))
        )
        await session.execute(
            delete(WorkoutExercise).where(WorkoutExercise.workout_id.in_(workout_ids))
        )
        await session.execute(delete(Workout).where(Workout.user_id == user_id))

    # 5. Delete trainings
    await session.execute(delete(Training).where(Training.user_id == user_id))

    # 6. Delete messages (sent and received)
    await session.execute(delete(Message).where(
        or_(Message.sender_id == user_id, Message.receiver_id == user_id)
    ))

    # 7. Delete coach invitations
    await session.execute(delete(CoachInvitation).where(
        or_(CoachInvitation.coach_id == user_id, CoachInvitation.client_id == user_id)
    ))

    # 8. Delete client-coach requests
    await session.execute(delete(ClientCoachRequest).where(
        or_(ClientCoachRequest.client_id == user_id, ClientCoachRequest.coach_id == user_id)
    ))

    # 9. Delete forum favorites
    await session.execute(delete(ForumFavorite).where(ForumFavorite.user_id == user_id))

    # 10. Delete forum messages
    await session.execute(delete(ForumMessage).where(ForumMessage.user_id == user_id))

    # 11. Delete forums created by user
    await session.execute(delete(Forum).where(Forum.user_id == user_id))

    # 12. Unlink clients if user is a coach
    if user.role == "coach":
        await session.execute(
            update(Users).where(Users.coach_id == user_id).values(coach_id=None)
        )

    # 13. Delete the user
    await session.delete(user)
    await session.commit()

    return JSONResponse(status_code=200, content={"detail": "Account and all associated data permanently deleted"})


# ---------------------------------------------------------------------------
# RGPD — Data export (Right to Data Portability — Art. 20)
# ---------------------------------------------------------------------------

async def export_user_data(session: AsyncSession, user_id: int):
    """Export all personal data for a user in a machine-readable format (JSON)."""
    result = await session.execute(select(Users).where(Users.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Profile
    profile = {
        "id": user.id,
        "email": user.email,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "age": user.age,
        "gender": user.gender,
        "role": user.role,
        "city": user.city,
        "latitude": user.latitude,
        "longitude": user.longitude,
        "weight": user.weight,
        "height": user.height,
        "goal": user.goal,
        "fitness_level": user.fitness_level,
        "description": user.description,
        "nationality": user.nationality,
        "language": user.language,
        "daily_caloric_needs": user.daily_caloric_needs,
        "goal_proteins": user.goal_proteins,
        "goal_carbs": user.goal_carbs,
        "goal_fats": user.goal_fats,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "cgu_accepted_at": user.cgu_accepted_at.isoformat() if user.cgu_accepted_at else None,
        "privacy_accepted_at": user.privacy_accepted_at.isoformat() if user.privacy_accepted_at else None,
        "cgu_version": user.cgu_version,
        "last_activity_at": user.last_activity_at.isoformat() if user.last_activity_at else None,
    }

    # Meals
    meals_result = await session.execute(select(Meal).where(Meal.user_id == user_id))
    meals = [{
        "id": m.id, "name": m.name, "total_calories": m.total_calories,
        "total_proteins": m.total_proteins, "total_carbohydrates": m.total_carbohydrates,
        "total_lipids": m.total_lipids, "meal_type": m.meal_type,
        "hourtime": m.hourtime.isoformat() if m.hourtime else None,
        "is_consumed": m.is_consumed,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in meals_result.scalars().all()]

    # Workouts
    workouts_result = await session.execute(
        select(Workout).options(selectinload(Workout.exercises)).where(Workout.user_id == user_id)
    )
    workouts = []
    for w in workouts_result.scalars().all():
        workouts.append({
            "id": w.id, "name": w.name, "description": w.description,
            "difficulty": w.difficulty,
            "scheduled_date": w.scheduled_date.isoformat() if w.scheduled_date else None,
            "is_completed": w.is_completed, "is_ai_generated": w.is_ai_generated,
            "exercises": [{
                "name": e.name, "muscle": e.muscle, "num_sets": e.num_sets,
                "rest_time": e.rest_time, "sets_details": e.sets_details,
            } for e in w.exercises],
        })

    # Injuries
    injuries_result = await session.execute(select(UserInjury).where(UserInjury.user_id == user_id))
    injuries = [{
        "body_zone": i.body_zone, "description": i.description,
        "is_active": i.is_active,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    } for i in injuries_result.scalars().all()]

    # AI chat history
    chat_result = await session.execute(select(AIChatMessage).where(AIChatMessage.user_id == user_id))
    chat_messages = [{
        "role": c.role, "content": c.content,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in chat_result.scalars().all()]

    # Forum posts
    forum_msgs_result = await session.execute(select(ForumMessage).where(ForumMessage.user_id == user_id))
    forum_posts = [{
        "forum_id": fm.forum_id, "content": fm.content,
        "created_at": fm.created_at.isoformat() if fm.created_at else None,
    } for fm in forum_msgs_result.scalars().all()]

    # Messages (DMs)
    dm_result = await session.execute(select(Message).where(
        or_(Message.sender_id == user_id, Message.receiver_id == user_id)
    ))
    direct_messages = [{
        "sender_id": dm.sender_id, "receiver_id": dm.receiver_id,
        "content": dm.content,
        "timestamp": dm.timestamp.isoformat() if dm.timestamp else None,
        "is_read": dm.is_read,
    } for dm in dm_result.scalars().all()]

    return JSONResponse(status_code=200, content={
        "export_date": datetime.utcnow().isoformat(),
        "format_version": "1.0",
        "profile": profile,
        "meals": meals,
        "workouts": workouts,
        "injuries": injuries,
        "ai_chat_history": chat_messages,
        "forum_posts": forum_posts,
        "direct_messages": direct_messages,
    })


# ---------------------------------------------------------------------------
# RGPD — Auto-delete inactive accounts (18 months)
# ---------------------------------------------------------------------------

async def cleanup_inactive_accounts(session: AsyncSession) -> int:
    """Delete accounts inactive for more than 18 months (RGPD data retention)."""
    cutoff = datetime.utcnow() - timedelta(days=548)  # ~18 months
    result = await session.execute(
        select(Users).where(Users.last_activity_at < cutoff)
    )
    inactive_users = result.scalars().all()
    count = 0
    for user in inactive_users:
        await delete_user_account(session, user.id)
        count += 1
    return count


# ---------------------------------------------------------------------------
# Newsletter
# ---------------------------------------------------------------------------

async def subscribe_newsletter(session: AsyncSession, email: str, firstname: str = None):
    """Subscribe an email to the newsletter."""
    result = await session.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == email.lower())
    )
    existing = result.scalars().first()

    if existing:
        if existing.is_active:
            return JSONResponse(status_code=200, content={"detail": "Already subscribed"})
        # Re-subscribe
        existing.is_active = True
        existing.unsubscribed_at = None
        existing.firstname = firstname or existing.firstname
        await session.commit()
        return JSONResponse(status_code=200, content={"detail": "Re-subscribed successfully"})

    token = secrets.token_urlsafe(48)
    subscriber = NewsletterSubscriber(
        email=email.lower(),
        firstname=firstname,
        unsubscribe_token=token,
    )
    session.add(subscriber)
    await session.commit()
    return JSONResponse(status_code=201, content={"detail": "Subscribed successfully"})


async def unsubscribe_newsletter(session: AsyncSession, token: str):
    """Unsubscribe via unique token (RGPD-compliant one-click unsubscribe)."""
    result = await session.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.unsubscribe_token == token)
    )
    subscriber = result.scalars().first()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe link")

    subscriber.is_active = False
    subscriber.unsubscribed_at = datetime.utcnow()
    await session.commit()
    return JSONResponse(status_code=200, content={"detail": "Unsubscribed successfully"})


async def send_newsletter(session: AsyncSession, subject: str, html_content: str):
    """Send a newsletter to all active subscribers via Brevo API."""
    import httpx

    brevo_key = os.getenv("BREVO_API_KEY")
    if not brevo_key:
        raise HTTPException(status_code=500, detail="BREVO_API_KEY not configured")

    sender_email = os.getenv("BREVO_SENDER_EMAIL", "newsletter@stapleapp.fr")
    sender_name = os.getenv("BREVO_SENDER_NAME", "Staple")

    result = await session.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.is_active == True)
    )
    subscribers = result.scalars().all()

    if not subscribers:
        return JSONResponse(status_code=200, content={"detail": "No active subscribers", "sent": 0})

    sent = 0
    errors = []

    async with httpx.AsyncClient() as client:
        for sub in subscribers:
            # Inject unsubscribe link into email
            unsub_url = f"https://stapleapp.fr/app/unsubscribe?token={sub.unsubscribe_token}"
            body_with_unsub = html_content + (
                f'<br><hr style="margin-top:30px">'
                f'<p style="font-size:12px;color:#888;text-align:center">'
                f'You are receiving this email because you subscribed to Staple newsletter.<br>'
                f'<a href="{unsub_url}">Unsubscribe</a></p>'
            )

            payload = {
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": sub.email, "name": sub.firstname or ""}],
                "subject": subject,
                "htmlContent": body_with_unsub,
            }

            try:
                resp = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    json=payload,
                    headers={
                        "api-key": brevo_key,
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code in (200, 201):
                    sent += 1
                else:
                    errors.append({"email": sub.email, "status": resp.status_code, "body": resp.text})
            except Exception as e:
                errors.append({"email": sub.email, "error": str(e)})

    return JSONResponse(status_code=200, content={
        "detail": f"Newsletter sent to {sent}/{len(subscribers)} subscribers",
        "sent": sent,
        "errors": errors if errors else None,
    })
