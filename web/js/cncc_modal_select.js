import { app } from "../../../scripts/app.js";
import { cnccApi, uploadImage } from "./cncc_api.js";
import { refreshPresetOptions, toast } from "./cncc_node.js";
import { t } from "./cncc_i18n.js";

export async function renderSelectTab(modal, container) {
    container.classList.add("cncc-select-tab");

    const leftCol = document.createElement("div");
    leftCol.className = "cncc-col cncc-col-sample";
    const sampleLabel = document.createElement("div");
    sampleLabel.className = "cncc-col-title";
    sampleLabel.textContent = t("sample");
    leftCol.appendChild(sampleLabel);

    const dropZone = document.createElement("div");
    dropZone.className = "cncc-modal-dropzone cncc-sample-dropzone";
    const dropPlaceholder = document.createElement("div");
    dropPlaceholder.className = "cncc-dropzone-placeholder";
    dropPlaceholder.textContent = t("dropImage");
    dropZone.appendChild(dropPlaceholder);
    leftCol.appendChild(dropZone);

    const centerCol = document.createElement("div");
    centerCol.className = "cncc-col cncc-col-grid";
    const grid = document.createElement("div");
    grid.className = "cncc-preset-grid";
    centerCol.appendChild(grid);

    const rightCol = document.createElement("div");
    rightCol.className = "cncc-col cncc-col-right";
    const nameLabel = document.createElement("div");
    nameLabel.className = "cncc-col-title";
    nameLabel.textContent = t("selectedCNNameNone");
    const settingsView = document.createElement("div");
    settingsView.className = "cncc-settings-view";
    const callRow = document.createElement("div");
    callRow.className = "cncc-save-row";
    const callBtn = document.createElement("button");
    callBtn.className = "cncc-action-btn";
    callBtn.textContent = t("callSettings");
    callRow.appendChild(callBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "cncc-action-btn cncc-action-btn-danger";
    deleteBtn.textContent = t("deletePreset");
    callRow.appendChild(deleteBtn);

    rightCol.appendChild(nameLabel);
    rightCol.appendChild(settingsView);
    rightCol.appendChild(callRow);

    container.appendChild(leftCol);
    container.appendChild(centerCol);
    container.appendChild(rightCol);

    let presets = [];
    let selectedPreset = null;

    function renderSettings(detail) {
        settingsView.innerHTML = "";
        const typeRow = document.createElement("div");
        typeRow.className = "cncc-param-row";
        typeRow.textContent = t("typeLabel", { type: detail.cn_type });
        settingsView.appendChild(typeRow);
        for (const [key, value] of Object.entries(detail.params || {})) {
            const row = document.createElement("div");
            row.className = "cncc-param-row";
            row.textContent = `${key}: ${value}`;
            settingsView.appendChild(row);
        }
    }

    async function selectPresetTile(entry, tileEl) {
        grid.querySelectorAll(".cncc-preset-tile").forEach((el) => el.classList.remove("active"));
        tileEl.classList.add("active");
        nameLabel.textContent = t("selectedCNName", { name: entry.name });
        try {
            const detail = await cnccApi.getPreset(entry.id);
            selectedPreset = detail;
            renderSettings(detail);
        } catch (err) {
            settingsView.textContent = t("loadFailed", { msg: err.message });
        }
    }

    async function loadGrid() {
        grid.textContent = t("loading");
        try {
            presets = await cnccApi.getPresets();
            grid.innerHTML = "";
            if (presets.length === 0) {
                grid.textContent = t("noPresets");
                return;
            }
            for (const entry of presets) {
                const tile = document.createElement("div");
                tile.className = "cncc-preset-tile";
                const img = document.createElement("img");
                img.src = cnccApi.thumbnailUrl(entry.id);
                img.onerror = () => {
                    img.style.display = "none";
                };
                const label = document.createElement("div");
                label.className = "cncc-preset-tile-label";
                label.textContent = entry.name;
                tile.appendChild(img);
                tile.appendChild(label);
                tile.onclick = () => selectPresetTile(entry, tile);
                grid.appendChild(tile);
            }
        } catch (err) {
            grid.textContent = t("loadFailed", { msg: err.message });
        }
    }

    dropZone.addEventListener("dragenter", (e) => e.preventDefault());
    dropZone.addEventListener("dragover", (e) => e.preventDefault());
    dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        try {
            const uploaded = await uploadImage(file);
            toast("info", t("bulkPreviewRunning"));
            const tiles = Array.from(grid.querySelectorAll(".cncc-preset-tile"));
            let succeeded = 0;
            let failed = 0;
            for (let i = 0; i < presets.length; i++) {
                const entry = presets[i];
                const tile = tiles[i];
                const img = tile?.querySelector("img");
                try {
                    const detail = await cnccApi.getPreset(entry.id);
                    const res = await cnccApi.preview({
                        cn_type: detail.cn_type,
                        params: detail.params,
                        image_ref: uploaded.ref,
                    });
                    if (img) {
                        // サムネイル未保存プリセットは読み込み失敗時にonerrorで
                        // display:noneになっているため、更新時に明示的に戻す。
                        img.style.display = "";
                        img.src = `data:image/png;base64,${res.image_base64}`;
                    }
                    succeeded += 1;
                } catch (err) {
                    failed += 1;
                    console.error(t("bulkPreviewFailedConsole", { name: entry.name }), err);
                    toast("error", t("bulkPreviewItemFailed", { name: entry.name, msg: err.message }));
                }
            }
            toast(
                failed === 0 ? "success" : "warn",
                t("bulkPreviewDone", { succeeded, failed })
            );
        } catch (err) {
            toast("error", t("uploadFailedMsg", { msg: err.message }));
        }
    });

    callBtn.onclick = async () => {
        if (!selectedPreset) {
            toast("warn", t("selectPresetFirst"));
            return;
        }
        await refreshPresetOptions(modal.node, selectedPreset.name);
        modal.close();
    };

    deleteBtn.onclick = async () => {
        if (!selectedPreset) {
            toast("warn", t("selectPresetFirst"));
            return;
        }
        // app.extensionManager.dialog.confirm はCNCCモーダルのoverlay(z-index:99999)より
        // 背面に描画されて操作不能になるため、確認ダイアログ表示中はCNCCモーダル自体を
        // 一時的に隠す。
        modal.overlay.style.display = "none";
        let confirmed = false;
        try {
            confirmed = await app.extensionManager.dialog.confirm({
                title: t("deleteConfirmTitle"),
                message: t("deleteConfirmMessage", { name: selectedPreset.name }),
            });
        } finally {
            modal.overlay.style.display = "flex";
        }
        if (!confirmed) return;
        try {
            await cnccApi.deletePreset(selectedPreset.id);
            toast("success", t("presetDeleted", { name: selectedPreset.name }));
            selectedPreset = null;
            nameLabel.textContent = t("selectedCNNameNone");
            settingsView.innerHTML = "";
            await loadGrid();
            await refreshPresetOptions(modal.node);
        } catch (err) {
            toast("error", t("deleteFailed", { msg: err.message }));
        }
    };

    await loadGrid();
}
