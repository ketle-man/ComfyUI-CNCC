"""comfyui_controlnet_aux のプリプロセッサークラスを、ComfyUI本体の
NODE_CLASS_MAPPINGS 経由で安全に取得・実行するためのラッパー。
comfyui_controlnet_aux/__init__.py の AIO_Preprocessor と同じアプローチを踏襲する。
"""
import importlib
import uuid


def _get_comfy_node_mappings() -> dict:
    comfy_nodes = importlib.import_module("nodes")
    return comfy_nodes.NODE_CLASS_MAPPINGS


def get_preprocessor_class(node_type: str):
    mapping = _get_comfy_node_mappings()
    if node_type not in mapping:
        raise KeyError(
            f"controlnet_aux preprocessor '{node_type}' not found. "
            "Check that comfyui_controlnet_aux is installed."
        )
    return mapping[node_type]


def is_preprocessor_available(node_type: str) -> bool:
    return node_type in _get_comfy_node_mappings()


def get_preprocessor_param_schema(node_type: str) -> dict:
    """image 以外の INPUT_TYPES エントリ（パラメータ）を返す。"""
    cls = get_preprocessor_class(node_type)
    input_types = cls.INPUT_TYPES()
    schema = {}
    schema.update(input_types.get("required", {}))
    schema.update(input_types.get("optional", {}))
    schema.pop("image", None)
    return schema


def _with_prompt_context(func, prompt_id=None, node_id="CNCC"):
    """一部のプリプロセッサーは内部の進捗報告で PromptServer.instance の
    last_prompt_id / last_node_id を参照する（main.py のキュー実行ループが
    セットする属性）。通常のグラフキュー実行フロー外（単体プレビュー実行時）で
    直接呼び出すと未設定でエラーになるため、一時的にダミー値を設定する。
    """
    try:
        from server import PromptServer
    except ImportError:
        return func()

    server_instance = getattr(PromptServer, "instance", None)
    if server_instance is None:
        return func()

    prev_prompt_id = getattr(server_instance, "last_prompt_id", None)
    prev_node_id = getattr(server_instance, "last_node_id", None)
    server_instance.last_prompt_id = prompt_id or f"cncc-{uuid.uuid4().hex}"
    server_instance.last_node_id = node_id
    try:
        return func()
    finally:
        server_instance.last_prompt_id = prev_prompt_id
        server_instance.last_node_id = prev_node_id


def run_preprocessor(node_type: str, params: dict, image_tensor, prompt_id=None, node_id="CNCC"):
    cls = get_preprocessor_class(node_type)
    instance = cls()
    func_name = getattr(cls, "FUNCTION", "execute")
    method = getattr(instance, func_name)

    def _call():
        result = method(image=image_tensor, **(params or {}))
        if isinstance(result, dict):
            return result.get("result", result)
        return result

    result = _with_prompt_context(_call, prompt_id=prompt_id, node_id=node_id)
    return_types = cls.RETURN_TYPES
    image_index = return_types.index("IMAGE")
    return result[image_index]


def run_preset(preset: dict, image_tensor, prompt_id=None, node_id="CNCC"):
    return run_preprocessor(
        preset["cn_type"], preset.get("params", {}), image_tensor, prompt_id=prompt_id, node_id=node_id
    )
