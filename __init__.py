from .py.api_routes import setup_routes
from .py.nodes import CNCCControlNetApplyNode, CNCCNode

NODE_CLASS_MAPPINGS = {
    "CNCCNode": CNCCNode,
    "CNCCControlNetApplyNode": CNCCControlNetApplyNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CNCCNode": "CNCC ControlNet",
    "CNCCControlNetApplyNode": "CNCC Apply ControlNet",
}

WEB_DIRECTORY = "./web"

setup_routes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
