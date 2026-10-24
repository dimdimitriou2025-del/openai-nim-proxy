// Mock @minecraft/server-ui: forms record their controls and resolve with
// scripted responses pushed by the tests (UI.respond(...)).
export const FormCancelationReason = { UserBusy: "UserBusy", UserClosed: "UserClosed" };
export const FormRejectReason = { MalformedResponse: "MalformedResponse", PlayerQuit: "PlayerQuit", ServerShutdown: "ServerShutdown" };

export const UI = {
  shown: [],
  responses: [],
  respond(r) { this.responses.push(r); },
  reset() { this.shown.length = 0; this.responses.length = 0; },
};

class Base {
  constructor(kind) { this.kind = kind; this.controls = []; this._title = ""; this._body = ""; }
  title(t) { this._title = t; return this; }
  body(t) { this._body = t; return this; }
  label(t) { this.controls.push({ type: "label", t }); return this; }
  header(t) { this.controls.push({ type: "header", t }); return this; }
  divider() { this.controls.push({ type: "divider" }); return this; }
  async show(player) {
    if (!player || !player.isValid) throw new Error("show on invalid player");
    UI.shown.push(this);
    const r = UI.responses.shift();
    if (r === undefined) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    if (typeof r === "function") return r(this);
    return { canceled: false, ...r };
  }
}

export class ActionFormData extends Base {
  constructor() { super("action"); this.buttons = []; }
  button(text, icon) {
    if (typeof text !== "string") throw new Error("button text must be string");
    this.buttons.push({ text, icon });
    this.controls.push({ type: "button", text, icon });
    return this;
  }
}

export class MessageFormData extends Base {
  constructor() { super("message"); }
  button1(t) { this.b1 = t; return this; }
  button2(t) { this.b2 = t; return this; }
}

export class ModalFormData extends Base {
  constructor() { super("modal"); }
  textField(label, placeholder, opts) { this.controls.push({ type: "text", label, placeholder, opts }); return this; }
  toggle(label, opts) { this.controls.push({ type: "toggle", label, opts }); return this; }
  slider(label, min, max, opts) {
    if (!(max > min)) throw new Error(`slider max must exceed min (${min}, ${max})`);
    this.controls.push({ type: "slider", label, min, max, opts });
    return this;
  }
  dropdown(label, items, opts) { this.controls.push({ type: "dropdown", label, items, opts }); return this; }
  submitButton(t) { this.submit = t; return this; }
  /** Build formValues aligned with controls (labels/headers/dividers -> undefined). */
  values(byType) {
    return this.controls.map((c) => (c.type in byType ? byType[c.type] : (["label", "header", "divider"].includes(c.type) ? undefined : null)));
  }
}

export class UIManager {
  closeAllForms() {}
}
export const uiManager = new UIManager();
