from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.admin_sync import router as admin_sync_router
from app.api.routes.leads import router as leads_router
from app.api.routes.admin_clients import router as admin_clients_router
from app.api.routes.client_portal import router as client_portal_router
from app.services.scheduler_service import (
    start_scheduler,
    stop_scheduler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start automatic campaign synchronization.
    start_scheduler()

    try:
        yield
    finally:
        # Stop scheduler cleanly when the backend shuts down.
        stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Backend API for the Intelera Digital Marketing "
        "Lead Management Portal"
    ),
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to Intelera DM Portal API",
        "status": "running",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": settings.APP_NAME,
    }


app.include_router(admin_sync_router)
app.include_router(leads_router)
app.include_router(admin_clients_router)
app.include_router(client_portal_router)