[English](README.md) | [日本語](README.ja.md) | 中文

# ComfyUI-CNCC

**正式名称: ControlNet Control Center**

一个ComfyUI自定义节点，可将 `comfyui_controlnet_aux` 的预处理器保存为可复用的“预设”，
从而用单个节点即可完成ControlNet预处理直至应用的整个流程。

## 前提条件

- 需要已安装 [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)。

## 安装

将本仓库（`comfyui-cncc/`）放入 `ComfyUI/custom_nodes/` 目录下，然后重启ComfyUI。
无需额外依赖包。

## 功能

- 单独用一个节点运行ControlNet预处理器（同时输出原图和ControlNet结果图）
- 加载ControlNet模型（从 `control_net_name` 选择，无需额外连接 `Load ControlNet Model` 节点）、
  执行预处理，并将结果应用到 `positive`/`negative` CONDITIONING —— 全部在一个节点内完成
- 通过CNCC设置弹窗选择预处理器类型、调整参数并保存为预设
  - 保存预设时可通过复选框选择是否同时保存缩略图
- 从缩略图列表中选择、调用、删除已保存的预设
- 通过拖放新图片创建样例，并可对所有已保存预设执行批量预览
- 支持日语 / 英语 / 简体中文界面（自动跟随ComfyUI的语言设置）

## 节点

### CNCC ControlNet (`CNCCNode`)

仅运行已保存预设的预处理器，不进行ControlNet应用。

- **输入**: `cn_name`（已保存的预设名称）、`image`（IMAGE，可选）、节点自身的图片拖放区域（仅在 `image` 未连接时使用）
- **输出**: `original_image`（原图）、`controlnet_image`（预处理结果图）

### CNCC Apply ControlNet (`CNCCControlNetApplyNode`)

可作为ComfyUI原生 `Apply ControlNet`（`ControlNetApplyAdvanced`）的替代节点。
将预处理执行与ControlNet模型的加载、应用整合到一个节点中。

- **输入**: `cn_name`（已保存的预设名称）、`positive`/`negative`（CONDITIONING）、
  `control_net_name`（从 `models/controlnet/` 中选择ControlNet模型名称的下拉框）、
  `strength`、`start_percent`、`end_percent`、`image`（IMAGE，可选）、
  节点自身的图片拖放区域（仅在 `image` 未连接时使用）
- **输出**: `positive`、`negative`（CONDITIONING）、`controlnet_image`（预处理结果预览图）
- 支持多个ControlNet串联应用时的链式处理（叠加应用时保留前一级的应用结果，而非覆盖）

## 故障排查

- **DWPose预处理器报错 `cv2.error: ... cv::dnn::gather`**：在没有GPU版onnxruntime
  （`CUDAExecutionProvider`）的环境下，`comfyui_controlnet_aux` 的DWPose会退回到用OpenCV的DNN
  后端运行 `bbox_detector` 的ONNX模型，而该后端与某些模型（如 `yolo_nas_*_fp16.onnx`）组合时存在
  已知问题。将预设的 `bbox_detector` 改为 `yolox_l.torchscript.pt` 后会改用torch.jit执行，从而
  完全绕开OpenCV DNN，避免此问题。

## 许可证

本软件包（CNCC自身代码）基于 [Apache License 2.0](LICENSE) 发布。

### 关于依赖包及相关模型的许可证

CNCC本身不包含任何预处理器的实现代码。它是一个轻量封装层，通过 `NODE_CLASS_MAPPINGS` 动态访问
`comfyui_controlnet_aux`，调用你本地已安装的该软件包。因此，实际执行的预处理器代码及权重（模型）
的许可证需要另行确认：

- **[comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)**: Apache License 2.0。
  但其中部分预处理器（如PiDiNet、基于OpenPose的实现等）可能各自继承了原始研究实现的许可证
  （研究/非商用等与整个软件包不同的限制条件）。如考虑商业用途，请针对每个具体使用的预处理器，
  查阅 `comfyui_controlnet_aux` 中对应的许可证说明。
- **ControlNet模型文件本身**（通过 `control_net_name` 选择的 `models/controlnet/` 目录下的文件）：
  CNCC不附带这些文件，其许可证遵循用户自行放置的模型文件本身
  （请查阅发布方的模型卡片/仓库说明）。
- **ComfyUI本体**: GNU General Public License v3.0。CNCC仅以普通自定义节点的方式调用ComfyUI的
  节点API（如 `comfy.controlnet` 的 `copy()`/`set_cond_hint()`/`set_previous_controlnet()` 等），
  未附带或修改ComfyUI本体的代码。

### 参考实现

- [ChrisColeTech/ComfyUI-ControlNet-Nodes](https://github.com/ChrisColeTech/ComfyUI-ControlNet-Nodes)
  （Apache-2.0）：参考了其README结构与许可证说明的写法。
