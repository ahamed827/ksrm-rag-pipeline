"""Evaluation endpoints: start a golden-set run in the background and poll its progress."""
from fastapi import APIRouter, HTTPException

from ..dependencies import eval_job

router = APIRouter(prefix="/api", tags=["evaluation"])


@router.post("/evaluate", status_code=202)
def start_evaluation() -> dict:
    """Kick off a background evaluation run; poll GET /api/evaluate for progress and the report."""
    if not eval_job.start():
        raise HTTPException(status_code=409, detail="An evaluation is already running.")
    return eval_job.state


@router.get("/evaluate")
def evaluation_status() -> dict:
    return eval_job.state
