"""LLM engine — uses Groq (Llama 3.3 70B) for test case generation."""
from groq import Groq
from dotenv import load_dotenv
import os
import json
import hashlib

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Llama 3.3 70B is plenty smart for this and free on Groq
MODEL_NAME = "llama-3.3-70b-versatile"

# Simple in-memory cache so re-running the same code+problem doesn't re-hit the API
_cache: dict[str, dict] = {}


TEST_CASE_PROMPT = """You are an expert competitive programming judge. Your job is to find weaknesses in a user's code by generating targeted test cases.

PROBLEM STATEMENT:
{problem}

USER'S CODE ({language}):
Your task:
1. Identify the algorithm/approach the code is using.
2. Identify 3-5 SPECIFIC weakness categories this code likely has. Examples: integer overflow, off-by-one error, empty input, single-element input, all-same elements, maximum constraint stress, negative numbers, duplicates, disconnected graph, cycles, etc.
3. Generate 5 concrete test case INPUTS targeting these weaknesses. For each, provide the CORRECT expected output based on the problem statement.

CRITICAL RULES:
- If you are NOT 100% sure of the expected output for a test case, DO NOT include it. Better to return 3 reliable cases than 5 unreliable ones.
- Test inputs must match the EXACT input format described in the problem.
- Keep input sizes reasonable (arrays max 10^5 elements).
- Expected outputs must be deterministic. Skip problems with multiple valid answers.

Respond with ONLY valid JSON, no markdown fences, no commentary:
{{
  "approach_detected": "brief description of the algorithm used",
  "weaknesses": ["weakness 1", "weakness 2", "..."],
  "test_cases": [
    {{
      "input": "raw input as it would be piped to stdin",
      "expected_output": "exact expected stdout",
      "targets": "which weakness this test targets"
    }}
  ]
}}"""


FIX_SUGGESTION_PROMPT = """A user's code failed on this test case. Explain the bug and suggest a fix.

PROBLEM:
{problem}

USER'S CODE ({language}):
FAILING TEST CASE:
Input: {failing_input}
Expected output: {expected}
User's code produced: {actual}

Provide a short, focused response in JSON only, no markdown fences:
{{
  "bug_explanation": "1-3 sentences explaining WHAT is wrong and WHY",
  "fix_hint": "1-2 sentences hinting at the fix WITHOUT giving full corrected code (we want them to learn)",
  "concept_to_review": "the CS concept they should brush up on (e.g., 'integer overflow', 'edge cases in binary search')"
}}"""


def _call_groq(prompt: str, temperature: float = 0.7) -> dict:
    """Call Groq with JSON-mode and parse response."""
    resp = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


def generate_test_cases(problem: str, code: str, language: str) -> dict:
    cache_key = hashlib.md5(f"{problem}|{code}|{language}".encode()).hexdigest()
    if cache_key in _cache:
        print(f"[CACHE HIT] test_cases {cache_key[:8]}")
        return _cache[cache_key]

    prompt = TEST_CASE_PROMPT.format(problem=problem, code=code, language=language)
    result = _call_groq(prompt, temperature=0.7)
    _cache[cache_key] = result
    return result


def explain_failure(problem: str, code: str, language: str,
                    failing_input: str, expected: str, actual: str) -> dict:
    prompt = FIX_SUGGESTION_PROMPT.format(
        problem=problem, code=code, language=language,
        failing_input=failing_input, expected=expected, actual=actual,
    )
    return _call_groq(prompt, temperature=0.4)


# Standalone test harness
if __name__ == "__main__":
    sample_problem = """
    Given an array of integers, return the sum of all elements.
    Input format:
    - First line: integer N (1 <= N <= 10^5)
    - Second line: N space-separated integers (each up to 10^9)
    Output: a single integer (the sum).
    """
    sample_code = """
#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int sum = 0;
    for (int i = 0; i < n; i++) { int x; cin >> x; sum += x; }
    cout << sum << endl;
    return 0;
}
"""
    print("=== Generating test cases via Groq ===")
    result = generate_test_cases(sample_problem, sample_code, "cpp")
    print(json.dumps(result, indent=2))