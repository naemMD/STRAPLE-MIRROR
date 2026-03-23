from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Enum, func, event, JSON, Boolean, Text, Any, UniqueConstraint
from app.database import Base
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class ClientCoachRequestCreate(BaseModel):
    coach_id: int

class CoachSearchResponse(BaseModel):
    id: int
    firstname: str
    lastname: str
    city: Optional[str] = None
    distance: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ClientCoachRequest(Base):
    __tablename__ = "client_coach_requests"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    receiver_id: int

class MessageRead(MessageBase):
    id: int
    sender_id: int
    receiver_id: int
    timestamp: datetime
    is_read: bool

    class Config:
        from_attributes = True

class ConversationRead(BaseModel):
    client_id: int
    client_firstname: str
    client_lastname: str
    last_message: str | None
    last_message_time: datetime | None

class CoachInvitation(Base):
    __tablename__ = 'coach_invitations'

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    client_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    status = Column(Enum('pending', 'accepted', 'rejected', name='invitation_status_enum'), default='pending', nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    coach = relationship("Users", foreign_keys=[coach_id], backref="sent_invitations")
    client = relationship("Users", foreign_keys=[client_id], backref="received_invitations")

class InvitationCreate(BaseModel):
    unique_code: str

class InvitationUpdate(BaseModel):
    status: str

class InvitationRead(BaseModel):
    id: int
    coach_id: int
    client_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class InvitationWithCoachInfo(BaseModel):
    id: int
    status: str
    created_at: datetime
    coach_id: int
    coach_firstname: str
    coach_lastname: str

class Exercice(Base):
    __tablename__ = 'exercice'

    id = Column(Integer, primary_key=True)
    exercice_name = Column(String(50), nullable=False)
    target = Column(String(15), nullable=False)
    is_bodyweight = Column(Boolean, default=False)
    weight_required = Column(Boolean, default=False)
    repetitions = Column(Integer, nullable=True)
    num_sets = Column(Integer, nullable=True)
    description = Column(String(100), nullable=False)
    video_url = Column(String(200), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Training(Base):
    __tablename__ = 'trainings'

    id = Column(Integer, primary_key=True)
    datetime = Column(DateTime, server_default=func.now())
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class MealCreateByCoach(BaseModel):
    name: str
    total_calories: float
    total_proteins: float
    total_carbohydrates: float
    total_lipids: float
    date_of_meal: datetime
    aliments: List[Dict[str, Any]]

class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    total_calories = Column(Float, nullable=False, default=0.0)
    total_proteins = Column(Float, nullable=False, default=0.0)
    total_carbohydrates = Column(Float, nullable=False, default=0.0)
    total_sugars = Column(Float, nullable=False, default=0.0)
    total_lipids = Column(Float, nullable=False, default=0.0)
    total_saturated_fats = Column(Float, nullable=False, default=0.0)
    total_fiber = Column(Float, nullable=False, default=0.0)
    total_salt = Column(Float, nullable=False, default=0.0)

    aliments = Column(Text, nullable=False) 

    meal_type = Column(String(50), nullable=True)
    hourtime = Column(DateTime(timezone=True), nullable=False)
    
    is_consumed = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MealBase(BaseModel):
    name: str
    hourtime: datetime
    total_calories: float
    total_proteins: float
    total_carbohydrates: float
    total_sugars: float
    total_lipids: float
    total_saturated_fats: float
    total_fiber: float
    total_salt: float
    aliments: Any 

class MealCreate(MealBase):
    is_consumed: Optional[bool] = False

class MealRead(MealBase):
    id: int
    user_id: int
    created_at: datetime
    is_consumed: bool

    class Config:
        from_attributes = True

class UserGoalUpdate(BaseModel):
    daily_caloric_needs: float

class DashboardStats(BaseModel):
    daily_caloric_goal: float = 2000.0
    calories_consumed: float = 0.0
    calories_remaining: float = 0.0
    proteins_consumed: float = 0.0
    carbs_consumed: float = 0.0
    fats_consumed: float = 0.0
    progress_percentage: float = 0.0

class Users(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    _password = Column("password", String(200), nullable=False)
    daily_caloric_needs = Column(Float, nullable=True)
    goal_proteins = Column(Float, nullable=True)
    goal_carbs = Column(Float, nullable=True)
    goal_fats = Column(Float, nullable=True)

    firstname = Column(String(50), nullable=False)
    lastname = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True)
    age = Column(Integer(), nullable=False)
    gender = Column(Enum('male', 'female', name='gender_enum'), nullable=False)
    role = Column(Enum('admin', 'client', 'coach', name='role_enum'), nullable=False)
    nationality = Column(String(15), nullable=True)
    language = Column(String(15), nullable=True)
    description = Column(Text, nullable=True)
    
    unique_code = Column(String(10), unique=True, nullable=True)

    city = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    goal = Column(Enum('lose_weight', 'gain_muscle', 'maintain_weight', name='goal_enum'), nullable=True)

    coach_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    coach = relationship("Users", remote_side=[id], backref="clients")
    created_at = Column(DateTime, server_default=func.now())

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, plaintext_password):
        self._password = pwd_context.hash(plaintext_password)

    def verify_password(self, plain_password: str) -> bool:
        return pwd_context.verify(plain_password, self.password)
    
class UserCreate(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    password: str
    role: str
    
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    
    weight: Optional[float] = None
    height: Optional[float] = None
    goal: Optional[str] = None

class UserUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    description: Optional[str] = Field(None, max_length=150)
    
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    goal: Optional[str] = None

class ExerciseSetDetail(BaseModel):
    set_number: int
    reps: Optional[int] = 0
    weight: Optional[float] = 0.0
    duration: Optional[int] = 0
    
class WorkoutExerciseBase(BaseModel):
    name: str
    muscle: str
    num_sets: int
    rest_time: Optional[int] = 60
    sets_details: List[ExerciseSetDetail] = []

class WorkoutExerciseCreate(WorkoutExerciseBase):
    pass

class WorkoutExerciseRead(WorkoutExerciseBase):
    id: int
    workout_id: int

    class Config:
        from_attributes = True

class WorkoutBase(BaseModel):
    name: str
    description: Optional[str] = None
    difficulty: str
    scheduled_date: datetime

class WorkoutCreate(WorkoutBase):
    exercises: List[WorkoutExerciseCreate]

class WorkoutRead(WorkoutBase):
    id: int
    user_id: int
    created_at: datetime
    exercises: List[WorkoutExerciseRead] = []

    is_completed: bool = False

    class Config:
        from_attributes = True

class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(String(50), nullable=False)
    
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exercises = relationship("WorkoutExercise", back_populates="workout", cascade="all, delete-orphan")

    is_completed = Column(Boolean, default=False)

class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id = Column(Integer, primary_key=True, index=True)
    workout_id = Column(Integer, ForeignKey("workouts.id"))
    name = Column(String(100), nullable=False)
    muscle = Column(String(50), nullable=False)
    num_sets = Column(Integer, nullable=False)
    rest_time = Column(Integer, nullable=True, default=60)
    sets_details = Column(JSON, nullable=True)

    workout = relationship("Workout", back_populates="exercises")

class MacroUpdate(BaseModel):
    daily_caloric_needs: Optional[float] = None
    goal_proteins: Optional[float] = None
    goal_carbs: Optional[float] = None
    goal_fats: Optional[float] = None


# ---------------------------------------------------------------------------
# Forums
# ---------------------------------------------------------------------------

class Forum(Base):
    __tablename__ = "forums"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(80), nullable=False)
    description = Column(String(500), nullable=True)
    status = Column(Enum('public', 'private', 'draft', name='forum_status_enum'), default='public', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now())

    messages = relationship("ForumMessage", back_populates="forum", cascade="all, delete-orphan")
    favorites = relationship("ForumFavorite", back_populates="forum", cascade="all, delete-orphan")


class ForumMessage(Base):
    __tablename__ = "forum_messages"

    id = Column(Integer, primary_key=True, index=True)
    forum_id = Column(Integer, ForeignKey("forums.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    forum = relationship("Forum", back_populates="messages")


class ForumFavorite(Base):
    __tablename__ = "forum_favorites"
    __table_args__ = (UniqueConstraint("user_id", "forum_id", name="uq_user_forum_favorite"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    forum_id = Column(Integer, ForeignKey("forums.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    forum = relationship("Forum", back_populates="favorites")


class ForumCreate(BaseModel):
    title: str = Field(..., max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    status: str = "public"


class ForumUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = None


class ForumRead(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    last_activity_at: datetime
    author_firstname: str
    author_lastname: str
    author_role: str
    message_count: int
    is_favorite: bool = False

    class Config:
        from_attributes = True


class ForumMessageCreate(BaseModel):
    content: str


# ---------------------------------------------------------------------------
# AI Coach Chat
# ---------------------------------------------------------------------------

class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AIChatRequest(BaseModel):
    message: str


class AIChatResponse(BaseModel):
    response: str
    message_id: int


class AIChatMessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ForumMessageRead(BaseModel):
    id: int
    forum_id: int
    user_id: int
    author_firstname: str
    author_lastname: str
    author_role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ForumDetailRead(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    last_activity_at: datetime
    author_firstname: str
    author_lastname: str
    author_role: str
    is_favorite: bool = False
    messages: List[ForumMessageRead] = []

    class Config:
        from_attributes = True


__all__ = [
    "LocationUpdate",
    "CoachSearchResponse",
    "ClientCoachRequestCreate",
    "ClientCoachRequest",
    "Message",
    "MessageCreate",
    "MessageRead",
    "ConversationRead",
    "CoachInvitation",
    "InvitationCreate",
    "InvitationUpdate",
    "Users",
    "UserUpdate",
    "UserCreate",
    "Meal",
    "MealCreateByCoach",
    "Training",
    "Exercice",
    "Workout",
    "WorkoutExercise",
    "WorkoutCreate",
    "WorkoutRead",
    "WorkoutExerciseCreate",
    "WorkoutExerciseRead",
    "MealCreate",
    "MealRead",
    "UserGoalUpdate",
    "DashboardStats",
    "MacroUpdate",
    "Forum",
    "ForumMessage",
    "ForumFavorite",
    "ForumCreate",
    "ForumUpdate",
    "ForumRead",
    "ForumMessageCreate",
    "ForumMessageRead",
    "ForumDetailRead",
    "AIChatMessage",
    "AIChatRequest",
    "AIChatResponse",
    "AIChatMessageRead",
]