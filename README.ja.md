[English](README.md) | 日本語 | [中文](README.zh.md)

# ComfyUI-CNCC

**正式名称: ControlNet Control Center**

`comfyui_controlnet_aux` のプリプロセッサーを「プリセット」として保存し、1つのノードで
ControlNet前処理〜ControlNet適用までを簡単に扱えるようにするComfyUIカスタムノードです。

## 前提

- [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) がインストール済みであること。

## インストール

`ComfyUI/custom_nodes/` 配下に本リポジトリ（`comfyui-cncc/`）を配置し、ComfyUIを再起動してください。
追加の依存パッケージはありません。

## 機能

- ノード単独でのControlNetプリプロセッサー実行（元画像・ControlNet出力画像の2つを出力）
- ControlNetモデルの読み込み（`control_net_name`から選択、`Load ControlNet Model`ノード接続不要）とプリプロセス、
  `positive`/`negative` CONDITIONINGへの適用までを1ノードで完結
- CNCC設定モーダルでのプリプロセッサー種類の選択・パラメータ調整・プリセット保存
  - プリセット保存時、サムネイル画像を保存するかどうかをチェックボックスで選択可能
- 保存済みプリセットのサムネイル一覧からの選択・呼び出し・削除
- 新規画像のドラッグ&ドロップによるサンプル作成、およびプリセット一覧への一括プレビュー適用
- 日本語 / 英語 / 中国語（簡体字）のUI表示（ComfyUIの言語設定に自動追従）

## ノード

### CNCC ControlNet (`CNCCNode`)

プリセット化されたプリプロセッサーを実行するだけのノード。ControlNetの適用は行いません。

- **入力**: `cn_name`（保存済みプリセット名）、`image`（IMAGE、任意）、ノード上の画像ドロップ領域（`image`未接続時のみ使用）
- **出力**: `original_image`（元画像）、`controlnet_image`（ControlNet出力画像）

### CNCC Apply ControlNet (`CNCCControlNetApplyNode`)

ComfyUIネイティブの `Apply ControlNet`（`ControlNetApplyAdvanced`）の代替として使えるノード。
プリプロセス実行とControlNetモデルの読み込み・適用を1ノードにまとめています。

- **入力**: `cn_name`（保存済みプリセット名）、`positive`/`negative`（CONDITIONING）、
  `control_net_name`（ControlNetモデル名のコンボ、`models/controlnet/`から選択）、
  `strength`、`start_percent`、`end_percent`、`image`（IMAGE、任意）、
  ノード上の画像ドロップ領域（`image`未接続時のみ使用）
- **出力**: `positive`、`negative`（CONDITIONING）、`controlnet_image`（プリプロセス結果のプレビュー用）
- 複数のControlNetを直列に繋いだ場合のchaining処理（前段のControlNet適用結果を維持したまま重ねる）に対応

## トラブルシューティング

- **DWPoseプリプロセッサーで `cv2.error: ... cv::dnn::gather` が発生する**: GPU版onnxruntime
  （`CUDAExecutionProvider`）が無い環境では、`comfyui_controlnet_aux` のDWPoseが `bbox_detector`
  のONNXモデルをOpenCVのDNNバックエンドで実行しようとし、特定のモデル（`yolo_nas_*_fp16.onnx`など）
  との組み合わせで既知の不具合を踏むことがあります。プリセットの `bbox_detector` を
  `yolox_l.torchscript.pt` に変更すると、torch.jit経由の実行になりOpenCV DNNを経由しなくなるため
  回避できます。

## ライセンス

本パッケージ（CNCCのコード本体）は [Apache License 2.0](LICENSE) の下で公開しています。

### 依存パッケージ・関連モデルのライセンスについて

CNCC自体はプリプロセッサーの実装コードを同梱していません。`comfyui_controlnet_aux` に
`NODE_CLASS_MAPPINGS` 経由で動的にアクセスし、インストール済みの当該パッケージを呼び出す
薄いラッパーです。そのため、実際に実行されるプリプロセッサーのコード・重み（モデル）のライセンスは
以下の通り別途確認が必要です。

- **[comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)**: Apache License 2.0。
  ただし同パッケージが内包する個々のプリプロセッサー（例: PiDiNet、OpenPose系など）は、
  元の研究実装のライセンス（研究・非商用限定などパッケージ全体とは異なる条件）を個別に継承している
  場合があります。商用利用を検討する場合は、使用するプリプロセッサーごとに
  `comfyui_controlnet_aux` 側のライセンス表記を確認してください。
- **ControlNetモデル本体（`control_net_name`で選択する `models/controlnet/` 配下のファイル）**:
  CNCCには同梱されておらず、ユーザーが個別に配置したモデルファイルのライセンスに従います
  （配布元の各モデルカード・リポジトリを参照してください）。
- **ComfyUI本体**: GNU General Public License v3.0。CNCCはComfyUIのノードAPI
  （`comfy.controlnet`の`copy()`/`set_cond_hint()`/`set_previous_controlnet()`など）を
  通常のカスタムノードとして呼び出しているのみで、ComfyUI本体のコードは同梱・改変していません。

### 参考にした実装

- [ChrisColeTech/ComfyUI-ControlNet-Nodes](https://github.com/ChrisColeTech/ComfyUI-ControlNet-Nodes)
  （Apache-2.0）: README構成・ライセンス表記の書き方を参考にしました。
