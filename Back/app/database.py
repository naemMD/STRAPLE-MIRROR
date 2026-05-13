from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

URL = os.getenv('DATABASE_URL')

DATABASE_URL = f"{URL}"

engine = create_async_engine(DATABASE_URL, echo=True)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_session():
    async with SessionLocal() as session:
        yield session


Base = declarative_base() # pour definir les models dans /models.py

from app.schemas import * # importe tous les models
