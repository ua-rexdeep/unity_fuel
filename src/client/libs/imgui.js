"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/imgui.ts
var imgui_exports = {};
__export(imgui_exports, {
  DelayBeforeNullResponse: () => DelayBeforeNullResponse,
  GUIButton: () => GUIButton,
  GUIFloat: () => GUIFloat,
  GUIPanel: () => GUIPanel,
  GUIText: () => GUIText,
  GetFreeRID: () => GetFreeRID,
  GetGUI: () => GetGUI,
  ImGUI: () => ImGUI,
  requestedItems: () => requestedItems,
  store: () => store
});
module.exports = __toCommonJS(imgui_exports);

// src/classes/button.ts
var GUIButton = class {
  constructor(GUI, init) {
    this.GUI = GUI;
    this.init = init;
    this.id = init.id;
  }
  id;
  GetID() {
    return this.id;
  }
  SetText(text) {
    emit("imgui:updateComponent", this.GUI.GetID(), this.GetID(), { text });
  }
  JSON() {
    return {
      id: this.GetID(),
      type: "button",
      ...this.init
    };
  }
  eventListeners = {};
  On(event, cb) {
    this.eventListeners[event] = cb;
  }
  Trigger(event) {
    if (this.eventListeners[event])
      this.eventListeners[event](this);
  }
};

// src/classes/float.ts
var GUIFloat = class {
  constructor(GUI, init) {
    this.GUI = GUI;
    this.init = init;
    this.id = init.id;
  }
  id;
  GetID() {
    return this.id;
  }
  GetValue() {
    const rid = GetFreeRID();
    return new Promise((done) => {
      requestedItems[rid] = { cb: done };
      emit("imgui:requestValue", this.GUI.GetID(), this.GetID(), rid);
    });
  }
  SetValue(value) {
    emit("imgui:updateComponent", this.GUI.GetID(), this.GetID(), { value });
  }
  SetOverride(text) {
    emit("imgui:updateComponent", this.GUI.GetID(), this.GetID(), { override: text });
  }
  eventListeners = {};
  On(event, cb) {
    this.eventListeners[event] = cb;
  }
  Trigger(event, value) {
    if (this.eventListeners[event])
      this.eventListeners[event](this, value);
  }
  JSON() {
    return {
      id: this.GetID(),
      type: "float",
      ...this.init
    };
  }
};

// src/classes/gui.ts
var ImGUI = class {
  constructor(init) {
    this.init = init;
    this.id = init.id;
    if (store[init.id])
      store[init.id].gui = this;
    else {
      store[init.id] = {
        gui: this,
        components: {}
      };
    }
  }
  id;
  GetID() {
    return this.id;
  }
  GetComponentById(id) {
    if (store[this.GetID()]?.components[id])
      return store[this.GetID()].components[id];
    const rid = GetFreeRID();
    return new Promise((done) => {
      requestedItems[rid] = { cb: done, gui: this };
      emit("imgui:requestComponent", this.GetID(), id, rid);
      setTimeout(done, DelayBeforeNullResponse, null);
    });
  }
  Deploy() {
    emit("imgui:deployGUI", this.GetID(), this.JSON());
  }
  JSON() {
    return {
      id: this.GetID(),
      ...this.init,
      contents: {}
    };
  }
};

// src/classes/text.ts
var GUIText = class {
  constructor(GUI, init) {
    this.GUI = GUI;
    this.init = init;
    this.id = init.id;
  }
  id;
  GetID() {
    return this.id;
  }
  GetValue() {
    const rid = GetFreeRID();
    return new Promise((done) => {
      requestedItems[rid] = { cb: done };
      emit("imgui:requestValue", this.GUI.GetID(), this.GetID(), rid);
    });
  }
  SetValue(value) {
    emit("imgui:updateComponent", this.GUI.GetID(), this.GetID(), { value });
  }
  JSON() {
    return {
      id: this.GetID(),
      type: "text",
      ...this.init
    };
  }
};

// src/classes/panel.ts
var GUIPanel = class _GUIPanel {
  constructor(GUI, init) {
    this.GUI = GUI;
    this.init = init;
    this.id = init.id;
    this.type = init.type;
  }
  id;
  type;
  GetID() {
    return this.id;
  }
  AddFloat(id, value, min, max, step, data) {
    const component = new GUIFloat(this.GUI, { id, ...data, value, min, max, step });
    emit("imgui:addComponent", this.GUI.GetID(), this.GetID(), component.JSON());
    if (id && store[this.GUI.GetID()])
      store[this.GUI.GetID()].components[id] = component;
    return component;
  }
  AddText(id, value, data) {
    const component = new GUIText(this.GUI, { id, ...data, value });
    emit("imgui:addComponent", this.GUI.GetID(), this.GetID(), component.JSON());
    if (id && store[this.GUI.GetID()])
      store[this.GUI.GetID()].components[id] = component;
    return component;
  }
  AddButton(id, text, data) {
    const component = new GUIButton(this.GUI, { id, ...data, text });
    emit("imgui:addComponent", this.GUI.GetID(), this.GetID(), component.JSON());
    if (id && store[this.GUI.GetID()])
      store[this.GUI.GetID()].components[id] = component;
    return component;
  }
  AddPanel(id, type, data) {
    const component = new _GUIPanel(this.GUI, { id, ...data, type });
    emit("imgui:addComponent", this.GUI.GetID(), this.GetID(), component.JSON());
    if (id && store[this.GUI.GetID()])
      store[this.GUI.GetID()].components[id] = component;
    return component;
  }
  JSON() {
    return {
      id: this.GetID(),
      type: this.type,
      ...this.init,
      content: []
    };
  }
};

// src/imgui.ts
var DelayBeforeNullResponse = 1e3;
var store = {};
var requestedItems = [];
var GetFreeRID = () => {
  let rid = 0;
  while (requestedItems[rid] != null)
    rid++;
  return rid;
};
on("imgui:returnGUI", (rid, item) => {
  if (requestedItems[rid] && item) {
    if (item) {
      const gui = new ImGUI(item);
      if (store[item.id]) {
        store[item.id].gui = gui;
      } else {
        store[item.id] = { gui, components: {} };
      }
      requestedItems[rid].cb(gui);
    } else {
      requestedItems[rid].cb(null);
      delete store[item.id];
    }
  }
  if (!item) {
    requestedItems[rid].cb(null);
    delete store[requestedItems[rid].guiid];
  }
  delete requestedItems[rid];
});
on("imgui:returnComponent", (rid, item) => {
  const gui = requestedItems[rid]?.gui;
  if (requestedItems[rid] && item) {
    if (!gui)
      throw new Error("No GUI on return");
    let component;
    if (item.type == "float")
      component = new GUIFloat(gui, item);
    else if (item.type == "text")
      component = new GUIText(gui, item);
    else if (item.type == "horizontal" || item.type == "vertical")
      component = new GUIPanel(gui, item);
    else if (item.type == "button")
      component = new GUIButton(gui, item);
    else
      console.error("imguilib error, wrong type", item);
    if (component && store[gui.GetID()]) {
      store[gui.GetID()].components[item.id] = component;
    }
    requestedItems[rid].cb(component);
  }
  if (!item) {
    requestedItems[rid].cb(null);
    if (gui)
      delete store[gui.GetID()];
  }
  delete requestedItems[rid];
});
on("imgui:returnValue", (rid, value) => {
  requestedItems[rid]?.cb(value);
  delete requestedItems[rid];
});
on("gui:componentTrigger", (guiid, componentId, event, data) => {
  const component = store[guiid]?.components[componentId];
  if (component && "Trigger" in component)
    component.Trigger(event, data);
});
on("imgui:componentNotExist", (guiid, componentId) => {
  if (store[guiid])
    delete store[guiid].components[componentId];
});
async function GetGUI(id) {
  const rid = GetFreeRID();
  return new Promise((done) => {
    requestedItems[rid] = { cb: done, guiid: id };
    emit("imgui:requestGUI", id, rid);
    setTimeout(done, DelayBeforeNullResponse, null);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DelayBeforeNullResponse,
  GUIButton,
  GUIFloat,
  GUIPanel,
  GUIText,
  GetFreeRID,
  GetGUI,
  ImGUI,
  requestedItems,
  store
});
