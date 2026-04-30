from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from typing import Optional, List
import os
import traceback

from llm_engine import generate_test_cases, explain_failure
from executor import execute, outputs_match, normalize_output

load_dotenv()

app = FastAPI(title="Code Buster API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / Response models ----------

class AnalyzeRequest(BaseModel):
    problem: str = Field(..., min_length=10, max_length=10_000)
    code: str = Field(..., min_length=1, max_length=20_000)
    language: str = Field(..., pattern="^(python|cpp)$")


class TestCaseResult(BaseModel):
    input: str
    expected_output: str
    actual_output: str
    targets: str
    passed: bool
    error_type: Optional[str] = None


class FailureAnalysis(BaseModel):
    bug_explanation: str
    fix_hint: str
    concept_to_review: str


class AnalyzeResponse(BaseModel):
    approach_detected: str
    weaknesses: List[str]
    test_results: List[TestCaseResult]
    first_failure: Optional[TestCaseResult] = None
    analysis: Optional[FailureAnalysis] = None
    all_passed: bool


# ---------- Routes ----------

@app.get("/")
def root():
    return {"name": "Code Buster", "status": "online", "version": "0.1.0"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "gemini_key_loaded": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    # Step 1: Get adversarial test cases
    try:
        gemini_result = generate_test_cases(req.problem, req.code, req.language)
    except Exception as e:
        traceback.print_exc()
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "rate" in err_str.lower():
            raise HTTPException(
                status_code=429,
                detail="The AI is rate-limited right now. Wait 30 seconds and try again.",
            )
        raise HTTPException(
            status_code=502,
            detail="Couldn't analyze your code. The AI service is having a moment — try again in a sec.",
        )

    approach = gemini_result.get("approach_detected", "Unknown")
    weaknesses = gemini_result.get("weaknesses", [])
    test_cases = gemini_result.get("test_cases", [])

    if not test_cases:
        raise HTTPException(
            status_code=422,
            detail="Couldn't generate reliable test cases for this problem. "
                   "It might have multiple valid outputs, or the format wasn't clear enough.",
        )

    test_results: List[TestCaseResult] = []
    first_failure: Optional[TestCaseResult] = None

    for tc in test_cases:
        test_input = tc.get("input", "")
        expected = tc.get("expected_output", "")
        targets = tc.get("targets", "general correctness")

        exec_result = execute(req.code, test_input, req.language)

        if not exec_result.success:
            actual = exec_result.stderr if exec_result.stderr else "(no output)"
            passed = False
        else:
            actual = exec_result.stdout
            passed = outputs_match(actual, expected)

        result = TestCaseResult(
            input=test_input,
            expected_output=expected,
            actual_output=normalize_output(actual),
            targets=targets,
            passed=passed,
            error_type=exec_result.error_type,
        )
        test_results.append(result)

        if not passed and first_failure is None:
            first_failure = result

    analysis: Optional[FailureAnalysis] = None
    if first_failure is not None:
        try:
            explanation = explain_failure(
                problem=req.problem, code=req.code, language=req.language,
                failing_input=first_failure.input,
                expected=first_failure.expected_output,
                actual=first_failure.actual_output,
            )
            analysis = FailureAnalysis(
                bug_explanation=explanation.get("bug_explanation", ""),
                fix_hint=explanation.get("fix_hint", ""),
                concept_to_review=explanation.get("concept_to_review", ""),
            )
        except Exception:
            traceback.print_exc()
            analysis = None

    return AnalyzeResponse(
        approach_detected=approach,
        weaknesses=weaknesses,
        test_results=test_results,
        first_failure=first_failure,
        analysis=analysis,
        all_passed=(first_failure is None),
    )