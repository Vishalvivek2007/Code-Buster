import subprocess
import tempfile
import os
from dataclasses import dataclass
from typing import Optional

# Per-test limits. Tune later if needed.
TIMEOUT_SECONDS = 5
MAX_OUTPUT_CHARS = 10_000  # truncate runaway prints


@dataclass
class ExecutionResult:
    """Result of running user code against a single test input."""
    success: bool              # did it run to completion without crashing?
    stdout: str                # what the code printed
    stderr: str                # any error output
    timed_out: bool
    error_type: Optional[str]  # "timeout", "runtime_error", "compile_error", or None


def run_python(code: str, test_input: str) -> ExecutionResult:
    """Run Python code with the given stdin input."""
    try:
        proc = subprocess.run(
            ["python", "-c", code],
            input=test_input,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        if proc.returncode != 0:
            return ExecutionResult(
                success=False,
                stdout=proc.stdout[:MAX_OUTPUT_CHARS],
                stderr=proc.stderr[:MAX_OUTPUT_CHARS],
                timed_out=False,
                error_type="runtime_error",
            )
        return ExecutionResult(
            success=True,
            stdout=proc.stdout[:MAX_OUTPUT_CHARS],
            stderr="",
            timed_out=False,
            error_type=None,
        )
    except subprocess.TimeoutExpired:
        return ExecutionResult(
            success=False, stdout="", stderr="Execution exceeded time limit.",
            timed_out=True, error_type="timeout",
        )
    except Exception as e:
        return ExecutionResult(
            success=False, stdout="", stderr=str(e),
            timed_out=False, error_type="runtime_error",
        )


def run_cpp(code: str, test_input: str) -> ExecutionResult:
    """Compile and run C++ code with the given stdin input."""
    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, "sol.cpp")
        exe_path = os.path.join(tmpdir, "sol.exe")  # .exe for Windows; harmless on Linux

        with open(src_path, "w", encoding="utf-8") as f:
            f.write(code)

        # Compile
        try:
            compile_proc = subprocess.run(
                ["g++", "-O2", "-std=c++17", src_path, "-o", exe_path],
                capture_output=True, text=True, timeout=15,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False, stdout="", stderr="Compilation timed out.",
                timed_out=True, error_type="compile_error",
            )
        except FileNotFoundError:
            return ExecutionResult(
                success=False, stdout="",
                stderr="g++ not installed on server. C++ support unavailable.",
                timed_out=False, error_type="compile_error",
            )

        if compile_proc.returncode != 0:
            return ExecutionResult(
                success=False, stdout="", stderr=compile_proc.stderr[:MAX_OUTPUT_CHARS],
                timed_out=False, error_type="compile_error",
            )

        # Run
        try:
            proc = subprocess.run(
                [exe_path],
                input=test_input,
                capture_output=True, text=True,
                timeout=TIMEOUT_SECONDS,
            )
            if proc.returncode != 0:
                return ExecutionResult(
                    success=False,
                    stdout=proc.stdout[:MAX_OUTPUT_CHARS],
                    stderr=proc.stderr[:MAX_OUTPUT_CHARS] or f"Exit code {proc.returncode}",
                    timed_out=False, error_type="runtime_error",
                )
            return ExecutionResult(
                success=True,
                stdout=proc.stdout[:MAX_OUTPUT_CHARS],
                stderr="", timed_out=False, error_type=None,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False, stdout="", stderr="Execution exceeded time limit.",
                timed_out=True, error_type="timeout",
            )


def execute(code: str, test_input: str, language: str) -> ExecutionResult:
    """Dispatcher — picks the right runner for the language."""
    if language == "python":
        return run_python(code, test_input)
    elif language == "cpp":
        return run_cpp(code, test_input)
    else:
        return ExecutionResult(
            success=False, stdout="", stderr=f"Unsupported language: {language}",
            timed_out=False, error_type="runtime_error",
        )


def normalize_output(s: str) -> str:
    """Strip trailing whitespace per line + trailing blank lines.
    Saves us from false-positive failures due to trailing newlines."""
    lines = [line.rstrip() for line in s.splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def outputs_match(actual: str, expected: str) -> bool:
    return normalize_output(actual) == normalize_output(expected)


# Test harness
if __name__ == "__main__":
    print("=== Test 1: Python correct code ===")
    py_correct = "n = int(input())\narr = list(map(int, input().split()))\nprint(sum(arr))"
    result = execute(py_correct, "3\n1 2 3", "python")
    print(f"Success: {result.success}, Output: {result.stdout!r}")
    print(f"Matches expected '6'? {outputs_match(result.stdout, '6')}")

    print("\n=== Test 2: Python runtime error ===")
    py_broken = "x = 1/0"
    result = execute(py_broken, "", "python")
    print(f"Success: {result.success}, Error: {result.error_type}")
    print(f"Stderr preview: {result.stderr[:100]}")

    print("\n=== Test 3: Python infinite loop (timeout) ===")
    py_loop = "while True: pass"
    result = execute(py_loop, "", "python")
    print(f"Success: {result.success}, Timed out: {result.timed_out}")

    print("\n=== Test 4: C++ overflow demo (the bug from Step 2) ===")
    cpp_buggy = """
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
    result = execute(cpp_buggy, "3\n1000000000 1000000000 1000000000", "cpp")
    print(f"Success: {result.success}, Output: {result.stdout.strip()!r}")
    print(f"Matches expected '3000000000'? {outputs_match(result.stdout, '3000000000')}")
    print("(If 'False' — congrats, we just caught the overflow bug!)")