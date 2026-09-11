import { app } from "../../../scripts/app.js";
import { cnccApi, uploadImage } from "./cncc_api.js";
import { getNodeState } from "./cncc_state.js";
import { openCNCCModal } from "./cncc_modal.js";
import { ensureCSS } from "./cncc_css.js";
import { t } from "./cncc_i18n.js";

const NODE_NAMES = ["CNCCNode", "CNCCControlNetApplyNode"];
const PLACEHOLDER_NAME = "<プリセット未作成>";
// 3段の通常ボタン列の高さと、Mask Editor One相当までノードを縦に伸ばすための
// プレビュー（ドロップゾーン）の高さ。両方ともDOMウィジェットのcomputeSizeを
// 固定して確保する。
const BUTTON_COL_HEIGHT = 100;
const DROPZONE_HEIGHT = 260;
const NODE_WIDTH_SCALE = 1.3;

export function toast(severity, detail) {
    app.extensionManager?.toast?.add?.({ severity, summary: "CNCC", detail, life: 4000 });
}

function findWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function hideWidget(node, widgetName) {
    const w = findWidget(node, widgetName);
    if (!w) return w;
    w.computeSize = () => [0, -4];
    w.type = "hidden";
    w.draw = () => {};
    w.mouse = () => false;
    return w;
}

function makeActionButton(label, title, onClick) {
    const btn = document.createElement("button");
    btn.title = title;
    btn.textContent = label;
    btn.className = "cncc-node-btn";
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick();
    };
    return btn;
}

export async function refreshPresetOptions(node, selectName) {
    const widget = findWidget(node, "cn_name");
    if (!widget) return;
    let presets = [];
    try {
        presets = await cnccApi.getPresets();
    } catch (err) {
        console.error(t("presetFetchFailedConsole"), err);
        return;
    }
    const names = presets.map((p) => p.name);
    const values = names.length ? names : [PLACEHOLDER_NAME];
    widget.options.values = values;
    if (selectName && values.includes(selectName)) {
        widget.value = selectName;
    } else if (!values.includes(widget.value)) {
        widget.value = values[0];
    }
    node.graph?.setDirtyCanvas(true, true);
}

function labelForView(viewMode) {
    return viewMode === "result" ? t("viewResult") : t("viewOriginal");
}

function toggleLabelForView(viewMode) {
    return viewMode === "result" ? t("toggleResult") : t("toggleOriginal");
}

/**
 * ノード上のプレビュー領域を state.viewMode（"original" | "result"）に応じて描画する。
 * 表示切替ボタンは、Mask Editor Oneのレイヤー切り替えのように同じ表示領域内で
 * 元画像とプリプロセッサー実行結果を切り替える。ボタン自体のラベルも現在の
 * 表示状態（次に何が見えるかではなく、今何を表示しているか）を示す。
 */
function renderPreview(node) {
    const state = getNodeState(node);
    const img = node._cnccPreviewImg;
    const placeholder = node._cnccDropPlaceholder;
    const viewLabel = node._cnccViewLabel;
    const toggleBtn = node._cnccViewToggleBtn;
    if (!img) return;

    const url = state.viewMode === "result" ? state.resultImageUrl : state.originalImageUrl;

    if (url) {
        img.src = url;
        img.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
    } else {
        img.removeAttribute("src");
        img.style.display = "none";
        if (placeholder) placeholder.style.display = "flex";
    }
    if (viewLabel) viewLabel.textContent = labelForView(state.viewMode);
    if (toggleBtn) toggleBtn.textContent = toggleLabelForView(state.viewMode);
}

function isImageSocketConnected(node) {
    const input = node.inputs?.find((i) => i.name === "image");
    return !!(input && input.link != null);
}

function updateDropZoneEnabled(node) {
    const zone = node._cnccDropZone;
    if (!zone) return;
    const connected = isImageSocketConnected(node);
    zone.classList.toggle("cncc-dropzone-disabled", connected);
    zone.title = connected ? t("dropDisabledTitle") : t("dropEnabledTitle");
}

/**
 * アップロード済み画像（{ref, previewUrl}）をノードへ反映する。
 * ノード上のドロップと、CNCC設定モーダルの「CN設定」タブでのドロップの
 * 両方から呼ばれ、どちらで画像を投入してもノード側の状態・表示に反映される。
 */
export function applyUploadedImage(node, uploaded) {
    const hidden = findWidget(node, "uploaded_image");
    if (hidden) hidden.value = uploaded.ref;
    const state = getNodeState(node);
    state.uploadedImageRef = uploaded.ref;
    state.originalImageUrl = uploaded.previewUrl;
    state.viewMode = "original";
    renderPreview(node);
    node.graph?.setDirtyCanvas(true, true);
}

async function handleDroppedFile(node, file) {
    if (!file || !file.type.startsWith("image/")) return;
    try {
        const uploaded = await uploadImage(file);
        applyUploadedImage(node, uploaded);
    } catch (err) {
        console.error(t("uploadFailed"), err);
        toast("error", t("uploadFailed"));
    }
}

function buildButtonsWidget(node) {
    const wrapper = document.createElement("div");
    wrapper.className = "cncc-button-col";

    wrapper.appendChild(makeActionButton(t("settings"), t("openSettingsTitle"), () => openCNCCModal(node)));

    const toggleBtn = makeActionButton(
        toggleLabelForView("original"),
        t("toggleViewTitle"),
        () => {
            const state = getNodeState(node);
            state.viewMode = state.viewMode === "original" ? "result" : "original";
            renderPreview(node);
        }
    );
    node._cnccViewToggleBtn = toggleBtn;
    wrapper.appendChild(toggleBtn);

    wrapper.appendChild(makeActionButton(t("runPreview"), t("runPreviewTitle"), () => runPreview(node)));

    const widget = node.addDOMWidget("cncc_buttons", "cncc_buttons", wrapper, {
        getValue() {
            return "";
        },
        setValue() {},
        serialize: false,
    });
    widget.computeSize = () => [0, BUTTON_COL_HEIGHT];
    return widget;
}

function buildDropZoneWidget(node) {
    const zone = document.createElement("div");
    zone.className = "cncc-dropzone";

    const placeholder = document.createElement("div");
    placeholder.className = "cncc-dropzone-placeholder";
    placeholder.textContent = t("dropImage");
    zone.appendChild(placeholder);

    const viewLabelEl = document.createElement("div");
    viewLabelEl.className = "cncc-dropzone-view-label";
    viewLabelEl.textContent = labelForView("original");
    zone.appendChild(viewLabelEl);

    const img = document.createElement("img");
    img.className = "cncc-dropzone-img";
    img.style.display = "none";
    zone.appendChild(img);

    node._cnccDropZone = zone;
    node._cnccDropPlaceholder = placeholder;
    node._cnccPreviewImg = img;
    node._cnccViewLabel = viewLabelEl;

    zone.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (isImageSocketConnected(node)) return;
        zone.classList.add("cncc-dropzone-over");
    });
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        zone.classList.remove("cncc-dropzone-over");
    });
    zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("cncc-dropzone-over");
        if (isImageSocketConnected(node)) return;
        const file = e.dataTransfer?.files?.[0];
        await handleDroppedFile(node, file);
    });

    const widget = node.addDOMWidget("cncc_dropzone", "cncc_dropzone", zone, {
        getValue() {
            return "";
        },
        setValue() {},
        serialize: false,
    });
    widget.computeSize = () => [0, DROPZONE_HEIGHT];
    return widget;
}

async function runPreview(node) {
    const state = getNodeState(node);
    const cnNameWidget = findWidget(node, "cn_name");
    const cnName = cnNameWidget?.value;
    if (!cnName || cnName === PLACEHOLDER_NAME) {
        toast("warn", t("presetNotCreated"));
        return;
    }

    const hidden = findWidget(node, "uploaded_image");
    const imageRef = hidden?.value || state.uploadedImageRef;

    if (!imageRef) {
        toast("warn", t("needRunOrDrop"));
        return;
    }

    try {
        const presets = await cnccApi.getPresets();
        const found = presets.find((p) => p.name === cnName);
        if (!found) throw new Error(t("presetNotFound"));
        const detail = await cnccApi.getPreset(found.id);
        const res = await cnccApi.preview({
            cn_type: detail.cn_type,
            params: detail.params,
            image_ref: imageRef,
        });
        state.resultImageUrl = `data:image/png;base64,${res.image_base64}`;
        state.viewMode = "result";
        renderPreview(node);
        node.graph?.setDirtyCanvas(true, true);
    } catch (err) {
        console.error(t("previewFailed", { msg: err.message }), err);
        toast("error", t("previewFailed", { msg: err.message }));
    }
}

export function attachCNCCWidgets(node) {
    if (node._cnccInitialized) return;
    node._cnccInitialized = true;

    ensureCSS();
    hideWidget(node, "uploaded_image");
    buildButtonsWidget(node);
    buildDropZoneWidget(node);

    refreshPresetOptions(node);
    renderPreview(node);

    const origOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (...args) {
        origOnConnectionsChange?.apply(this, args);
        updateDropZoneEnabled(this);
    };
    updateDropZoneEnabled(node);

    const size = node.computeSize();
    size[0] *= NODE_WIDTH_SCALE;
    node.setSize(size);
    node.graph?.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "CNCC.node",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!NODE_NAMES.includes(nodeData.name)) return;
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.apply(this, arguments);
            attachCNCCWidgets(this);
        };
    },
});
