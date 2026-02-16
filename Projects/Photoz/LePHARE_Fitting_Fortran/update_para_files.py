import os
import re
import shutil
from pathlib import Path
from typing import Dict, Iterable, List, Tuple, Union, Optional


KeyUpdates = Union[Dict[str, str], List[Tuple[str, str]]]


def modify_phot_para_many(
    file_path: Union[str, Path],
    updates: KeyUpdates,
    replace_all: bool = False,
    backup: bool = True,
    strict: bool = True,
) -> Dict[str, bool]:
    """
    Batch-update multiple keywords in a LePHARE .para file while preserving formatting.

    Parameters
    ----------
    file_path
        Path to the .para file.
    updates
        Either a dict {keyword: new_value} or a list of (keyword, new_value).
        Use a list if you want to control update order.
    replace_all
        If True, replace all occurrences of each keyword; otherwise replace only the first.
    backup
        If True, create a .bak backup.
    strict
        If True, raise ValueError if any keyword is not found; otherwise just report False.

    Returns
    -------
    Dict[str, bool]
        Mapping keyword -> whether it was replaced at least once.
    """
    file_path = Path(file_path)

    # Normalize updates to a list of (keyword, new_value) to preserve order if provided
    if isinstance(updates, dict):
        items: List[Tuple[str, str]] = list(updates.items())
    else:
        items = list(updates)

    text = file_path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    # Precompile patterns per keyword
    patterns = {
        key: re.compile(rf'^(\s*)({re.escape(key)})(\s+)([^#\r\n]*?)(\s*)(#.*)?(\r?\n)?$')
        for key, _ in items
    }

    replaced: Dict[str, bool] = {key: False for key, _ in items}

    out_lines: List[str] = []

    for line in lines:
        # Skip fully commented lines
        if line.lstrip().startswith("#"):
            out_lines.append(line)
            continue

        new_line = line
        for key, new_value in items:
            # If we're only replacing first occurrence and already replaced this key, skip
            if replaced[key] and (not replace_all):
                continue

            m = patterns[key].match(new_line)
            if not m:
                continue

            leading, kw, sep, _old_value, pad, comment, eol = m.groups()
            comment = comment or ""
            eol = eol or ""

            new_line = f"{leading}{kw}{sep}{new_value}{pad}{comment}{eol}"
            replaced[key] = True

            # If only replacing first occurrence per key, we can still continue checking
            # other keys against this (now updated) line.

        out_lines.append(new_line)

    missing = [k for k, ok in replaced.items() if not ok]
    if missing and strict:
        raise ValueError(f"Keywords not found in file: {missing}")

    if any(replaced.values()):
        if backup:
            bak = file_path.with_suffix(file_path.suffix + ".bak")
            shutil.copy2(file_path, bak)

        tmp_path = file_path.with_suffix(file_path.suffix + ".tmp")
        tmp_path.write_text("".join(out_lines), encoding="utf-8")
        os.replace(tmp_path, file_path)

    return replaced