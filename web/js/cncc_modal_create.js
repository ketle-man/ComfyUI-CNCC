import { cnccApi, uploadImage } from "./cncc_api.js";
import { refreshPresetOptions, toast, applyUploadedImage } from "./cncc_node.js";
import { getNodeState } from "./cncc_state.js";
import { t } from "./cncc_i18n.js";

export async function renderCreateTab(modal, container) {
    container.classList.add("cncc-create-tab");

    const listCol = document.createElement("div");
    listCol.className = "cncc-col cncc-col-list";
    const listHeader = document.createElement("div");
    listHeader.className = "cncc-col-title";
    listHeader.textContent = t("cnList");
    listCol.appendChild(listHeader);
    const listBody = document.createElement("div");
    listBody.className = "cncc-cn-list";
    listCol.appendChild(listBody);

    const centerCol = document.createElement("div");
    centerCol.className = "cncc-col cncc-col-center";

    const dropZone = document.createElement("div");
    dropZone.className = "cncc-modal-dropzone";
    const dropPlaceholder = document.createElement("div");
    dropPlaceholder.className = "cncc-dropzone-placeholder";
    dropPlaceholder.textContent = t("dropImage");
    dropZone.appendChild(dropPlaceholder);
    const dropImg = document.createElement("img");
    dropImg.style.display = "none";
    dropZone.appendChild(dropImg);

    const resultZone = document.createElement("div");
    resultZone.className = "cncc-modal-resultzone";
    const resultLabel = document.createElement("div");
    resultLabel.className = "cncc-result-label";
    resultLabel.textContent = t("result");
    resultZone.appendChild(resultLabel);
    const resultImg = document.createElement("img");
    resultImg.style.display = "none";
    resultZone.appendChild(resultImg);

    centerCol.appendChild(dropZone);
    centerCol.appendChild(resultZone);

    const rightCol = document.createElement("div");
    rightCol.className = "cncc-col cncc-col-right";

    const runRow = document.createElement("div");
    runRow.className = "cncc-run-row";
    const runBtn = document.createElement("button");
    runBtn.className = "cncc-action-btn";
    runBtn.textContent = t("run");
    runRow.appendChild(runBtn);

    const selectedLabel = document.createElement("div");
    selectedLabel.className = "cncc-col-title";
    selectedLabel.textContent = t("selectedCNNone");

    const paramForm = document.createElement("div");
    paramForm.className = "cncc-param-form";

    const saveRow = document.createElement("div");
    saveRow.className = "cncc-save-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = t("presetNamePlaceholder");
    nameInput.className = "cncc-name-input";
    const saveBtn = document.createElement("button");
    saveBtn.className = "cncc-action-btn";
    saveBtn.textContent = t("save");
    saveRow.appendChild(nameInput);
    saveRow.appendChild(saveBtn);

    const thumbnailRow = document.createElement("label");
    thumbnailRow.className = "cncc-checkbox-row";
    const thumbnailCheckbox = document.createElement("input");
    thumbnailCheckbox.type = "checkbox";
    thumbnailCheckbox.checked = true;
    thumbnailRow.appendChild(thumbnailCheckbox);
    thumbnailRow.appendChild(document.createTextNode(t("saveThumbnail")));

    rightCol.appendChild(selectedLabel);
    rightCol.appendChild(thumbnailRow);
    rightCol.appendChild(saveRow);
    rightCol.appendChild(paramForm);
    rightCol.appendChild(runRow);

    container.appendChild(listCol);
    container.appendChild(centerCol);
    container.appendChild(rightCol);

    let selected = null;
    let paramValues = {};
    let lastResultBase64 = "";

    // ノード上のドロップ領域と同じ状態を共有する。ノード側で既に画像が
    // 投入済みならここにも反映し、ここでドロップした画像はノード側にも反映する。
    const nodeState = getNodeState(modal.node);
    if (nodeState.originalImageUrl) {
        dropImg.src = nodeState.originalImageUrl;
        dropImg.style.display = "block";
        dropPlaceholder.style.display = "none";
    }

    function buildParamForm() {
        paramForm.innerHTML = "";
        if (!selected) return;
        for (const [key, spec] of Object.entries(selected.schema)) {
            const row = document.createElement("div");
            row.className = "cncc-param-row";
            const label = document.createElement("label");
            label.textContent = key;
            row.appendChild(label);

            let input;
            if (spec.type === "COMBO") {
                input = document.createElement("select");
                for (const choice of spec.choices || []) {
                    const opt = document.createElement("option");
                    opt.value = choice;
                    opt.textContent = choice;
                    input.appendChild(opt);
                }
                input.value = paramValues[key] ?? spec.default ?? (spec.choices && spec.choices[0]) ?? "";
            } else if (spec.type === "BOOLEAN") {
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = paramValues[key] ?? spec.default ?? false;
            } else if (spec.type === "INT" || spec.type === "FLOAT") {
                input = document.createElement("input");
                input.type = "number";
                if (spec.step != null) input.step = spec.step;
                else if (spec.type === "FLOAT") input.step = "0.01";
                if (spec.min != null) input.min = spec.min;
                if (spec.max != null) input.max = spec.max;
                input.value = paramValues[key] ?? spec.default ?? 0;
            } else {
                input = document.createElement("input");
                input.type = "text";
                input.value = paramValues[key] ?? spec.default ?? "";
            }
            input.className = "cncc-param-input";
            input.addEventListener("change", () => {
                if (input.type === "checkbox") paramValues[key] = input.checked;
                else if (input.type === "number") paramValues[key] = Number(input.value);
                else paramValues[key] = input.value;
            });
            row.appendChild(input);
            paramForm.appendChild(row);

            if (!(key in paramValues)) {
                paramValues[key] =
                    spec.type === "BOOLEAN" ? spec.default ?? false : spec.default ?? (input.type === "number" ? 0 : "");
            }
        }
    }

    function selectCN(item, category) {
        selected = { ...item, category };
        paramValues = {};
        selectedLabel.textContent = t("selectedCN", { name: item.display_name });
        buildParamForm();
        listBody.querySelectorAll(".cncc-cn-item").forEach((el) => {
            el.classList.toggle("active", el.dataset.nodeType === item.node_type);
        });
    }

    async function loadCatalog() {
        listBody.textContent = t("loading");
        try {
            const categories = await cnccApi.getPreprocessorTypes();
            listBody.innerHTML = "";
            for (const cat of categories) {
                const catEl = document.createElement("div");
                catEl.className = "cncc-cn-category";
                catEl.textContent = cat.category;
                listBody.appendChild(catEl);
                for (const item of cat.items) {
                    const itemEl = document.createElement("div");
                    itemEl.className = "cncc-cn-item";
                    if (!item.available) itemEl.classList.add("cncc-cn-item-unavailable");
                    itemEl.dataset.nodeType = item.node_type;
                    itemEl.textContent = item.display_name;
                    if (item.available) {
                        itemEl.onclick = () => selectCN(item, cat.category);
                    } else {
                        itemEl.title = t("notFoundInAux");
                    }
                    listBody.appendChild(itemEl);
                }
            }
        } catch (err) {
            listBody.textContent = t("loadFailed", { msg: err.message });
        }
    }

    dropZone.addEventListener("dragover", (e) => e.preventDefault());
    dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        try {
            const uploaded = await uploadImage(file);
            // ノード側の状態・表示も同時に更新する（双方向同期）。
            applyUploadedImage(modal.node, uploaded);
            dropImg.src = uploaded.previewUrl;
            dropImg.style.display = "block";
            dropPlaceholder.style.display = "none";
        } catch (err) {
            toast("error", t("uploadFailedMsg", { msg: err.message }));
        }
    });

    runBtn.onclick = async () => {
        if (!selected) {
            toast("warn", t("selectCNFirst"));
            return;
        }
        const imageRef = getNodeState(modal.node).uploadedImageRef;
        if (!imageRef) {
            toast("warn", t("dropImageFirst"));
            return;
        }
        try {
            const res = await cnccApi.preview({
                cn_type: selected.node_type,
                params: paramValues,
                image_ref: imageRef,
            });
            lastResultBase64 = res.image_base64;
            resultImg.src = `data:image/png;base64,${res.image_base64}`;
            resultImg.style.display = "block";
        } catch (err) {
            toast("error", t("runFailed", { msg: err.message }));
        }
    };

    saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) {
            toast("warn", t("presetNameRequired"));
            return;
        }
        if (!selected) {
            toast("warn", t("selectCNFirst"));
            return;
        }
        try {
            await cnccApi.savePreset({
                name,
                cn_type: selected.node_type,
                category: selected.category,
                params: paramValues,
                thumbnail: thumbnailCheckbox.checked ? lastResultBase64 || undefined : undefined,
            });
            nameInput.value = "";
            await refreshPresetOptions(modal.node, name);
            toast("success", t("presetSaved", { name }));
        } catch (err) {
            toast("error", t("saveFailed", { msg: err.message }));
        }
    };

    await loadCatalog();
}
