"""Guardrails that decide whether a question may reach the answer-generating LLM.

Order of checks (see RagEngine._prepare):
G1  Input filter      - blocks prompt injection / misuse phrases.                (before retrieval)
--  Small talk        - greetings, "who are you", "what can you do", thanks.     (before retrieval)
G2  Scope decision    - uses retrieval signals to sort a question into one of three zones:
        ACCEPT     the re-ranker is confident a chunk is relevant     -> answer
        BLOCK      the question is far from every chunk                -> refuse
        UNCERTAIN  signals are ambiguous (short / casual wording)      -> ask the LLM scope check
                                                                                 (after retrieval, before generation)
G3  Grounded prompt   - lives in llm.py: answer only from the retrieved context.

Why three zones: numeric thresholds alone are brittle. Short, casual questions ("college name")
score low on both distance and re-rank even when they are clearly about KSRM, so a hard cut-off
either refuses real questions or lets off-topic ones through. The ambiguous middle goes to an LLM.

Why small talk is separate: messages about the assistant itself ("who are you") are far from every
website chunk, so G2 would refuse them. They need a friendly fixed reply, not retrieval.
"""
import re
from enum import Enum

BLOCKED_PHRASES = [
    "ignore previous",
    "ignore your rules",
    "system prompt",
    "write python code",
    "hack",
]

INPUT_FILTER_MESSAGE = (
    "Sorry, I can't help with that request. I'm here to answer questions about "
    "K.S.R.M. College of Engineering, such as admissions, courses, regulations or placements."
)
OUT_OF_SCOPE_MESSAGE = (
    "I can only answer questions about K.S.R.M. College of Engineering, and that one seems to be "
    "outside what I know. Try asking about admissions, courses and intake, exam rules, departments, "
    "leadership or placements."
)

_ABOUT_ME = (
    "I'm the **KSRM College Assistant**, an AI that answers questions about "
    "K.S.R.M. College of Engineering, Kadapa, using information from the official website "
    "(ksrmce.ac.in). Every answer comes with the pages it was taken from."
)
_CAPABILITIES = (
    "You can ask me things like:\n\n"
    "- **Admissions**: helpline numbers, EAPCET code, Dean of Admissions\n"
    "- **Courses & intake**: B.Tech, M.Tech, MBA and BCA seats\n"
    "- **Regulations**: attendance, pass criteria, exams, supplementary attempts\n"
    "- **People & history**: principal, chairman, founder, accreditation\n"
    "- **Placements**: students placed, recruiters, Training & Placement cell"
)

SMALL_TALK_REPLIES = {
    "greeting": f"Hello! 👋 {_ABOUT_ME}\n\n{_CAPABILITIES}",
    "identity": f"{_ABOUT_ME}\n\n{_CAPABILITIES}",
    "capability": _CAPABILITIES,
    "thanks": "You're welcome! Ask me anything else about KSRM College of Engineering.",
    "bye": "Goodbye! Come back any time you have questions about KSRMCE.",
}

_GREETING = r"(hi+|hello+|hey+|hai|namaste|good (morning|afternoon|evening))( there)?"
_INTENTS = [
    ("greeting", re.compile(rf"^{_GREETING}$")),
    ("identity", re.compile(
        r"^(who|what) (are|r) (you|u)( exactly)?$|^what is your name$|^your name$|^introduce yourself$"
        r"|^who (made|built|created|developed) (you|u)$|^are (you|u) (a bot|a robot|an ai|ai|human|a human)$")),
    ("capability", re.compile(
        r"^what (can|do) (you|u) (do|know|help with)$|^how can (you|u) help( me)?$|^help( me)?$"
        r"|^what can i ask( you)?$|^what should i ask$")),
    ("thanks", re.compile(r"^(ok(ay)? )?(thanks|thank you|thank u|thx|ty)( (so much|a lot))?$")),
    ("bye", re.compile(r"^(bye|goodbye|good bye|see you|see ya)$")),
]
_LEADING_GREETING = re.compile(rf"^{_GREETING}\s+")
_NON_WORD = re.compile(r"[^\w\s]")


class Scope(str, Enum):
    ACCEPT = "accept"
    BLOCK = "block"
    UNCERTAIN = "uncertain"


def _normalize(text: str) -> str:
    return " ".join(_NON_WORD.sub(" ", text.lower()).split())


def is_unsafe_query(query: str) -> bool:
    """G1: block prompt-injection and off-topic coding requests."""
    lowered = query.lower()
    return any(phrase in lowered for phrase in BLOCKED_PHRASES)


def small_talk_intent(query: str) -> str | None:
    """Return the small-talk intent of a whole message, or None for real questions.

    Patterns are anchored to the full message, so "who is the principal" is never small talk.
    A leading greeting is ignored: "hi, who are you?" -> identity.
    """
    text = _normalize(query)
    candidates = [text]
    stripped = _LEADING_GREETING.sub("", text)
    if stripped != text:
        candidates.append(stripped)
    for candidate in reversed(candidates):  # prefer the more specific intent
        for intent, pattern in _INTENTS:
            if pattern.match(candidate):
                return intent
    return None


def small_talk_reply(query: str) -> str | None:
    intent = small_talk_intent(query)
    return SMALL_TALK_REPLIES[intent] if intent else None


def scope_decision(
    best_distance: float,
    best_rerank: float | None,
    accept_rerank: float,
    block_distance: float,
) -> Scope:
    """G2: pure decision from retrieval signals (no model calls, easy to test)."""
    if best_rerank is not None and best_rerank >= accept_rerank:
        return Scope.ACCEPT
    if best_distance > block_distance:
        return Scope.BLOCK
    return Scope.UNCERTAIN
