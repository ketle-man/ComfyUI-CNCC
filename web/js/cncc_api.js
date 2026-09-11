import { api } from "../../../scripts/api.js";
import { t } from "./cncc_i18n.js";

const BASE = "/cncc";

async function getJSON(path) {
    const res = await api.fetchApi(`${BASE}${path}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

async function postJSON(path, body) {
    const res = await api.fetchApi(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

async function deleteJSON(path) {
    const res = await api.fetchApi(`${BASE}${path}`, { method: "DELETE" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

export const cnccApi = {
    getPreprocessorTypes: () => getJSON("/preprocessor_types"),
    getPresets: () => getJSON("/presets"),
    getPreset: (id) => getJSON(`/presets/${id}`),
    savePreset: (data) => postJSON("/presets", data),
    deletePreset: (id) => deleteJSON(`/presets/${id}`),
    preview: (data) => postJSON("/preview", data),
    thumbnailUrl: (id) => api.apiURL(`${BASE}/thumbnail/${id}`),
};

/**
 * ComfyUI標準の /upload/image エンドポイントへファイルをアップロードする。
 * 戻り値の ref は folder_paths.get_annotated_filepath が解釈できる形式。
 */
export async function uploadImage(file, subfolder = "cncc_uploads") {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("type", "input");
    formData.append("subfolder", subfolder);
    formData.append("overwrite", "true");
    const res = await api.fetchApi("/upload/image", {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        throw new Error(t("uploadFailed"));
    }
    const data = await res.json();
    const relPath = data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
    return {
        ref: `${relPath} [input]`,
        name: data.name,
        subfolder: data.subfolder,
        previewUrl: api.apiURL(
            `/view?filename=${encodeURIComponent(data.name)}&subfolder=${encodeURIComponent(data.subfolder || "")}&type=input`
        ),
    };
}
