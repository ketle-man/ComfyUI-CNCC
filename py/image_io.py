import base64
import io

import numpy as np
import torch
from PIL import Image, ImageOps

import folder_paths


def pil_to_tensor(img: Image.Image) -> torch.Tensor:
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None,]


def load_uploaded_as_tensor(file_ref: str):
    if not file_ref:
        return None
    image_path = folder_paths.get_annotated_filepath(file_ref)
    img = Image.open(image_path)
    return pil_to_tensor(img)


def base64_to_tensor(b64_str: str) -> torch.Tensor:
    raw = base64.b64decode(b64_str)
    img = Image.open(io.BytesIO(raw))
    return pil_to_tensor(img)
