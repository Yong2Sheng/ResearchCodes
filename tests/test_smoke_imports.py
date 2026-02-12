from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECTS_ROOT = REPO_ROOT / "Projects"

# 你可以按需要继续加
SKIP_DIRS = {
    "__pycache__",
    ".ipynb_checkpoints",
    ".pytest_cache",
    ".mypy_cache",
}

@pytest.mark.smoke
def test_import_all_py_files_under_projects():
    assert PROJECTS_ROOT.exists(), f"Expected folder not found: {PROJECTS_ROOT}"

    # 让 Projects 内部如果有绝对导入（比如 import some_utils）更容易找到
    sys.path.insert(0, str(PROJECTS_ROOT))
    sys.path.insert(0, str(REPO_ROOT))

    py_files = []
    for p in PROJECTS_ROOT.rglob("*.py"):
        parts = set(p.relative_to(PROJECTS_ROOT).parts)
        if parts & SKIP_DIRS:
            continue
        py_files.append(p)

    failures = []
    for p in sorted(py_files):
        # 给每个文件一个唯一的“假模块名”，避免冲突
        mod_name = (
            "smoke_projects_"
            + p.relative_to(PROJECTS_ROOT).with_suffix("").as_posix().replace("/", "_").replace("-", "_")
        )

        try:
            spec = importlib.util.spec_from_file_location(mod_name, p)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"Cannot create import spec for {p}")
            mod = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = mod
            spec.loader.exec_module(mod)
        except Exception as e:
            failures.append((str(p.relative_to(PROJECTS_ROOT)), repr(e)))

    if failures:
        msg = "\n".join([f"- {relpath}: {err}" for relpath, err in failures])
        raise AssertionError(f"Import smoke failed for some .py files under Projects:\n{msg}\n")
