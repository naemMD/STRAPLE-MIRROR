from fastapi import FastAPI
from app.routes import router
from app.database import engine, Base, SessionLocal
from app.model import *
from app.API.ApiController import get_aliment_from_API
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi.middleware.cors import CORSMiddleware

scheduler = AsyncIOScheduler()


async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


def create_app():
    app = FastAPI()

    origins = [
        "http://localhost",
        "http://localhost:8081",
        "https://nutritrain-mirror.vercel.app"
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def on_startup():
        await init_models()

        async def run_cleanup():
            async with SessionLocal() as session:
                count = await cleanup_inactive_forums(session)
                print(f"[Scheduler] Deleted {count} inactive forum(s)")

        async def run_auto_complete_workouts():
            async with SessionLocal() as session:
                count = await auto_complete_daily_workouts(session)
                print(f"[Scheduler] Auto-completed {count} workout(s) for today")

        scheduler.add_job(run_cleanup, CronTrigger(hour=0, minute=0))
        scheduler.add_job(run_auto_complete_workouts, CronTrigger(hour=23, minute=59))
        scheduler.start()

    @app.on_event("shutdown")
    async def on_shutdown():
        if scheduler.running:
            scheduler.shutdown()

    app.include_router(router)

    return app
