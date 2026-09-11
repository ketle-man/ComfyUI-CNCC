import base64
import io

import numpy as np
from PIL import Image


def tensor_to_pil(image_tensor) -> Image.Image:
    arr = image_tensor[0].detach().cpu().numpy()
    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def make_thumbnail_bytes(image_tensor, size=(160, 160)) -> bytes:
    img = tensor_to_pil(image_tensor)
    img.thumbnail(size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    return buf.getvalue()


def resize_for_preview(image_tensor, max_side: int = 512) -> Image.Image:
    img = tensor_to_pil(image_tensor)
    w, h = img.size
    scale = max_side / max(w, h)
    if scale < 1:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    return img


def pil_to_base64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def make_thumbnail_from_base64(b64_str: str, size=(160, 160)) -> bytes:
    """フロントから届く任意形式（PNG等）のbase64画像を、
    プリセットのサムネイルとして保存するための160x160 webpへ変換する。"""
    raw = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail(size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=85)
    return buf.getvalue()
