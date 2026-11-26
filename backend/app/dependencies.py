"""Process-wide singletons shared by the API routers."""
from .config import settings
from .evaluation.runner import EvaluationJob
from .services.rag_engine import RagEngine

engine = RagEngine(settings)
eval_job = EvaluationJob(engine)
