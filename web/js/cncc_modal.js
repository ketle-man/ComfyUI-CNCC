import { getNodeState } from "./cncc_state.js";
import { renderCreateTab } from "./cncc_modal_create.js";
import { renderSelectTab } from "./cncc_modal_select.js";
import { ensureCSS } from "./cncc_css.js";
import { t } from "./cncc_i18n.js";

const TABS = [
    { id: "create", label: () => t("tabCreate") },
    { id: "select", label: () => t("tabSelect") },
];

class CNCCModal {
    constructor(node) {
        this.node = node;
        this.activeTab = "select";
        this._buildDOM();
    }

    _buildDOM() {
        ensureCSS();

        const overlay = document.createElement("div");
        overlay.className = "cncc-overlay";
        overlay.style.display = "none";
        overlay.addEventListener("mousedown", (e) => {
            if (e.target === overlay) this.close();
        });
        overlay.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.close();
        });
        overlay.tabIndex = -1;

        const modal = document.createElement("div");
        modal.className = "cncc-modal";
        overlay.appendChild(modal);

        const header = document.createElement("div");
        header.className = "cncc-modal-header";
        modal.appendChild(header);

        const tabRow = document.createElement("div");
        tabRow.className = "cncc-tab-row";
        header.appendChild(tabRow);

        this._tabButtons = {};
        for (const tab of TABS) {
            const btn = document.createElement("button");
            btn.className = "cncc-tab-btn";
            btn.textContent = tab.label();
            btn.onclick = () => this._selectTab(tab.id);
            tabRow.appendChild(btn);
            this._tabButtons[tab.id] = btn;
        }

        const closeBtn = document.createElement("button");
        closeBtn.className = "cncc-modal-close";
        closeBtn.textContent = "×";
        closeBtn.title = t("close");
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "cncc-modal-body";
        modal.appendChild(body);

        this.overlay = overlay;
        this.modal = modal;
        this.body = body;

        document.body.appendChild(overlay);
    }

    _selectTab(tabId) {
        this.activeTab = tabId;
        for (const [id, btn] of Object.entries(this._tabButtons)) {
            btn.classList.toggle("active", id === tabId);
        }
        this.body.innerHTML = "";
        if (tabId === "create") {
            renderCreateTab(this, this.body);
        } else {
            renderSelectTab(this, this.body);
        }
    }

    open(initialTab = "select") {
        this.overlay.style.display = "flex";
        this.overlay.focus();
        this._selectTab(initialTab);
    }

    close() {
        this.overlay.style.display = "none";
    }
}

export function openCNCCModal(node, opts = {}) {
    const state = getNodeState(node);
    if (!state.modalInstance) {
        state.modalInstance = new CNCCModal(node);
    }
    state.modalInstance.open(opts.initialTab || "select");
}
