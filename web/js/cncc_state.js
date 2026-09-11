/**
 * ノードごとの CNCC UI 状態を保持する共有ストア。
 * cncc_node.js と cncc_modal*.js の間の循環importを避けるハブとして機能する。
 * ノードIDはグラフ追加前は確定しないため、キーには常にノードオブジェクト自体を使う。
 */
const stateMap = new WeakMap();

export function getNodeState(node) {
    let state = stateMap.get(node);
    if (!state) {
        state = {
            previewVisible: true,
            uploadedImageRef: "",
            modalInstance: null,
            // "original"（ドロップ/接続した元画像）と "result"（試し実行の結果画像）を
            // 赤ボタンで切り替えて同じ表示領域に出すための状態。
            viewMode: "original",
            originalImageUrl: "",
            resultImageUrl: "",
        };
        stateMap.set(node, state);
    }
    return state;
}
