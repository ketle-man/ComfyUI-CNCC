"""プリセット（プリプロセッサー種類＋パラメータ＋サムネイル）の
グローバル共有ライブラリ。カスタムノードディレクトリ配下の presets/ に永続化する。
"""
import json
import os
import shutil
import uuid
from datetime import datetime, timezone

PRESETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "presets")
INDEX_PATH = os.path.join(PRESETS_DIR, "index.json")


def _ensure_dirs():
    os.makedirs(PRESETS_DIR, exist_ok=True)
    if not os.path.exists(INDEX_PATH):
        _write_index([])


def _read_index() -> list:
    _ensure_dirs()
    try:
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _write_index(entries: list):
    os.makedirs(PRESETS_DIR, exist_ok=True)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def _preset_dir(preset_id: str) -> str:
    safe_id = os.path.basename(str(preset_id))
    if not safe_id or safe_id in (".", ".."):
        raise ValueError("Invalid preset ID")
    base = os.path.abspath(PRESETS_DIR)
    path = os.path.abspath(os.path.join(base, safe_id))
    if os.path.commonpath([base, path]) != base:
        raise ValueError("Invalid preset ID")
    return path


def list_presets() -> list:
    return _read_index()


def list_names() -> list:
    return [p["name"] for p in _read_index()]


def load_by_id(preset_id: str):
    try:
        path = os.path.join(_preset_dir(preset_id), "preset.json")
    except ValueError:
        return None
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_by_name(name: str):
    for entry in _read_index():
        if entry["name"] == name:
            return load_by_id(entry["id"])
    return None


def save_preset(name, cn_type, category, params, thumbnail_bytes=None, preset_id=None) -> dict:
    _ensure_dirs()
    is_new = preset_id is None
    preset_id = preset_id or uuid.uuid4().hex
    pdir = _preset_dir(preset_id)
    os.makedirs(pdir, exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()
    existing = None if is_new else load_by_id(preset_id)
    data = {
        "id": preset_id,
        "name": name,
        "cn_type": cn_type,
        "category": category,
        "params": params or {},
        "created_at": existing["created_at"] if existing else now,
        "updated_at": now,
    }
    with open(os.path.join(pdir, "preset.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    if thumbnail_bytes is not None:
        with open(os.path.join(pdir, "thumbnail.webp"), "wb") as f:
            f.write(thumbnail_bytes)

    entries = [e for e in _read_index() if e["id"] != preset_id]
    entries.append(
        {
            "id": preset_id,
            "name": name,
            "cn_type": cn_type,
            "category": category,
            "thumbnail": f"{preset_id}/thumbnail.webp",
            "updated_at": now,
        }
    )
    entries.sort(key=lambda e: e["name"])
    _write_index(entries)
    return data


def delete_preset(preset_id: str) -> bool:
    try:
        pdir = _preset_dir(preset_id)
    except ValueError:
        return False
    if not os.path.isdir(pdir):
        return False
    shutil.rmtree(pdir)
    entries = [e for e in _read_index() if e["id"] != preset_id]
    _write_index(entries)
    return True


def thumbnail_path(preset_id: str):
    try:
        path = os.path.join(_preset_dir(preset_id), "thumbnail.webp")
    except ValueError:
        return None
    return path if os.path.exists(path) else None
