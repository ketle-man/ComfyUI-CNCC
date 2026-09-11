"""ComfyUI サーバーへ CNCC 専用の aiohttp ルートを登録する。"""
import asyncio
import logging

from aiohttp import web

from . import image_io, preprocessor_catalog, preprocessor_registry, preset_store, thumbnail

log = logging.getLogger(__name__)

MAX_BODY_SIZE = 20 * 1024 * 1024

_preview_lock = asyncio.Lock()
_routes_registered = False


async def _read_json(request: web.Request) -> dict:
    if request.content_length and request.content_length > MAX_BODY_SIZE:
        raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY_SIZE, actual_size=request.content_length)
    return await request.json()


def _serialize_input_spec(key: str, spec) -> dict:
    if not isinstance(spec, (list, tuple)) or len(spec) == 0:
        return {"type": "STRING"}
    type_or_choices = spec[0]
    opts = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
    if isinstance(type_or_choices, list):
        default = opts.get("default", type_or_choices[0] if type_or_choices else None)
        return {"type": "COMBO", "choices": type_or_choices, "default": default}
    entry = {"type": type_or_choices}
    for k in ("default", "min", "max", "step"):
        if k in opts:
            entry[k] = opts[k]
    return entry


def _serialize_schema(schema: dict) -> dict:
    out = {}
    for key, spec in schema.items():
        try:
            out[key] = _serialize_input_spec(key, spec)
        except Exception:
            log.exception("CNCC: パラメータスキーマの解析に失敗しました (key=%s)", key)
    return out


def setup_routes():
    """ComfyUIロード時に一度だけ呼び出す。PromptServer が未初期化なら何もしない。"""
    global _routes_registered
    if _routes_registered:
        return
    try:
        from server import PromptServer
    except ImportError:
        return
    if getattr(PromptServer, "instance", None) is None:
        return

    routes = PromptServer.instance.routes

    @routes.get("/cncc/preprocessor_types")
    async def get_preprocessor_types(request: web.Request):
        result = []
        for cat in preprocessor_catalog.PREPROCESSOR_CATALOG:
            items = []
            for item in cat["items"]:
                node_type = item["node_type"]
                available = False
                schema = {}
                try:
                    schema = preprocessor_registry.get_preprocessor_param_schema(node_type)
                    available = True
                except Exception:
                    pass
                items.append(
                    {
                        "node_type": node_type,
                        "display_name": item["display_name"],
                        "available": available,
                        "schema": _serialize_schema(schema),
                    }
                )
            result.append({"category": cat["category"], "items": items})
        return web.json_response(result)

    @routes.get("/cncc/presets")
    async def get_presets(request: web.Request):
        return web.json_response(preset_store.list_presets())

    @routes.get("/cncc/presets/{id}")
    async def get_preset(request: web.Request):
        preset_id = request.match_info["id"]
        data = preset_store.load_by_id(preset_id)
        if data is None:
            return web.json_response({"error": "Preset not found"}, status=404)
        return web.json_response(data)

    @routes.post("/cncc/presets")
    async def post_preset(request: web.Request):
        try:
            body = await _read_json(request)
            name = (body.get("name") or "").strip()
            cn_type = body.get("cn_type")
            if not name or not cn_type:
                return web.json_response({"error": "name and cn_type are required"}, status=400)
            category = body.get("category", "")
            params = body.get("params", {})
            preset_id = body.get("id")
            thumbnail_b64 = body.get("thumbnail")
            thumb_bytes = thumbnail.make_thumbnail_from_base64(thumbnail_b64) if thumbnail_b64 else None
            data = preset_store.save_preset(name, cn_type, category, params, thumb_bytes, preset_id)
            return web.json_response(data)
        except Exception as e:
            log.exception("CNCC: プリセット保存に失敗しました")
            return web.json_response({"error": str(e)}, status=400)

    @routes.delete("/cncc/presets/{id}")
    async def delete_preset(request: web.Request):
        preset_id = request.match_info["id"]
        ok = preset_store.delete_preset(preset_id)
        if not ok:
            return web.json_response({"error": "Preset not found"}, status=404)
        return web.json_response({"ok": True})

    @routes.get("/cncc/thumbnail/{id}")
    async def get_thumbnail(request: web.Request):
        preset_id = request.match_info["id"]
        path = preset_store.thumbnail_path(preset_id)
        if path is None:
            return web.Response(status=404)
        return web.FileResponse(path)

    @routes.post("/cncc/preview")
    async def post_preview(request: web.Request):
        if _preview_lock.locked():
            return web.json_response(
                {"error": "Another CNCC operation is in progress. Please try again shortly."}, status=423
            )
        async with _preview_lock:
            try:
                body = await _read_json(request)
                cn_type = body.get("cn_type")
                params = body.get("params", {})
                image_ref = body.get("image_ref")
                image_b64 = body.get("image_base64")

                if not cn_type:
                    return web.json_response({"error": "cn_type is required"}, status=400)

                if image_b64:
                    image_tensor = image_io.base64_to_tensor(image_b64)
                elif image_ref:
                    image_tensor = image_io.load_uploaded_as_tensor(image_ref)
                else:
                    return web.json_response({"error": "No image specified"}, status=400)

                result_tensor = preprocessor_registry.run_preprocessor(cn_type, params, image_tensor)
                preview_img = thumbnail.resize_for_preview(result_tensor, max_side=512)
                b64 = thumbnail.pil_to_base64(preview_img, fmt="PNG")
                return web.json_response({"image_base64": b64})
            except Exception as e:
                log.exception("CNCC: プレビュー実行に失敗しました")
                return web.json_response({"error": str(e)}, status=400)

    _routes_registered = True
