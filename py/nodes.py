from . import image_io, preprocessor_registry, preset_store

_PLACEHOLDER = "<プリセット未作成>"


def _apply_control_net_to_conditioning(conditioning_list, control_net, control_hint, strength, start_percent, end_percent):
    """conditioning内の各エントリにcontrol_netの適用結果をセットして新しいリストを返す。

    conditioningエントリが既に別のControlNet適用結果（'control'キー）を持つ場合は、
    それを前段として数珠つなぎにする（複数ControlNetの直列適用に対応するため）。
    同じ前段を参照する複数エントリに対しては、control_netの複製を1回だけ作って使い回す。
    """
    net_by_previous = {}
    updated = []
    for text_embedding, params in conditioning_list:
        new_params = params.copy()
        previous_net = new_params.get("control")

        if previous_net not in net_by_previous:
            applied_net = control_net.copy()
            applied_net.set_cond_hint(control_hint, strength, (start_percent, end_percent))
            applied_net.set_previous_controlnet(previous_net)
            net_by_previous[previous_net] = applied_net

        new_params["control"] = net_by_previous[previous_net]
        new_params["control_apply_to_uncond"] = False
        updated.append([text_embedding, new_params])

    return updated


class CNCCNode:
    """CNCC ControlNet: プリセット化されたプリプロセッサーを1ノードで実行する。"""

    CATEGORY = "CNCC"
    FUNCTION = "execute"
    RETURN_TYPES = ("IMAGE", "IMAGE", "POSE_KEYPOINT")
    RETURN_NAMES = ("original_image", "controlnet_image", "pose_keypoint")

    @classmethod
    def INPUT_TYPES(cls):
        names = preset_store.list_names()
        if not names:
            names = [_PLACEHOLDER]
        return {
            "required": {
                "cn_name": (names, {"default": names[0]}),
            },
            "optional": {
                "image": ("IMAGE",),
                "uploaded_image": ("STRING", {"default": "", "multiline": False}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    def execute(self, cn_name, image=None, uploaded_image="", unique_id=None):
        src = image if image is not None else image_io.load_uploaded_as_tensor(uploaded_image)

        if src is None:
            raise ValueError(
                "No image provided. Connect an IMAGE input, or drop an image "
                "onto the node's drop area."
            )

        if cn_name == _PLACEHOLDER:
            raise ValueError(
                "No preset has been created yet. Create one from CNCC Settings "
                "(the blue button)."
            )

        preset = preset_store.load_by_name(cn_name)
        if preset is None:
            raise ValueError(f"Preset '{cn_name}' not found. Please recreate it in CNCC Settings.")

        controlnet_image, pose_keypoint = preprocessor_registry.run_preset(preset, src)
        return (src, controlnet_image, pose_keypoint)


class CNCCControlNetApplyNode:
    """CNCC ControlNet Apply: プリセットのプリプロセッサー実行とControlNet適用(ControlNetApplyAdvanced相当)を1ノードで行う。"""

    CATEGORY = "CNCC"
    FUNCTION = "execute"
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "IMAGE", "POSE_KEYPOINT")
    RETURN_NAMES = ("positive", "negative", "controlnet_image", "pose_keypoint")
    SEARCH_ALIASES = ["controlnet", "apply controlnet", "use controlnet", "control net"]

    @classmethod
    def INPUT_TYPES(cls):
        import folder_paths

        names = preset_store.list_names()
        if not names:
            names = [_PLACEHOLDER]
        return {
            "required": {
                "cn_name": (names, {"default": names[0]}),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "control_net_name": (folder_paths.get_filename_list("controlnet"),),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01}),
                "start_percent": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "end_percent": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.001}),
            },
            "optional": {
                "image": ("IMAGE",),
                "uploaded_image": ("STRING", {"default": "", "multiline": False}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            },
        }

    def execute(
        self,
        cn_name,
        positive,
        negative,
        control_net_name,
        strength,
        start_percent,
        end_percent,
        image=None,
        uploaded_image="",
        unique_id=None,
    ):
        import comfy.controlnet
        import folder_paths

        src = image if image is not None else image_io.load_uploaded_as_tensor(uploaded_image)

        if src is None:
            raise ValueError(
                "No image provided. Connect an IMAGE input, or drop an image "
                "onto the node's drop area."
            )

        if cn_name == _PLACEHOLDER:
            raise ValueError(
                "No preset has been created yet. Create one from CNCC Settings "
                "(the blue button)."
            )

        preset = preset_store.load_by_name(cn_name)
        if preset is None:
            raise ValueError(f"Preset '{cn_name}' not found. Please recreate it in CNCC Settings.")

        controlnet_path = folder_paths.get_full_path_or_raise("controlnet", control_net_name)
        control_net = comfy.controlnet.load_controlnet(controlnet_path)
        if control_net is None:
            raise RuntimeError(
                f"ControlNet file '{control_net_name}' is invalid — it does not "
                "contain a valid ControlNet model."
            )

        controlnet_image, pose_keypoint = preprocessor_registry.run_preset(preset, src)

        if strength == 0:
            return (positive, negative, controlnet_image, pose_keypoint)

        control_hint = controlnet_image.movedim(-1, 1)
        new_positive = _apply_control_net_to_conditioning(
            positive, control_net, control_hint, strength, start_percent, end_percent
        )
        new_negative = _apply_control_net_to_conditioning(
            negative, control_net, control_hint, strength, start_percent, end_percent
        )

        return (new_positive, new_negative, controlnet_image, pose_keypoint)
