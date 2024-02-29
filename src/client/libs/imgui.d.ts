declare class GUIFloat {
    private readonly GUI;
    private readonly init;
    private readonly id;
    constructor(GUI: ImGUI, init: any);
    GetID(): string | number;
    GetValue(): Promise<number>;
    SetValue(value: number): void;
    SetOverride(text: string): void;
    private eventListeners;
    On(event: string, cb: (thisComponent: GUIFloat, value: string | number | boolean) => void): void;
    Trigger(event: string, value: string | number | boolean): void;
    JSON(): any;
}

declare class GUIText {
    private readonly GUI;
    private readonly init;
    private readonly id;
    constructor(GUI: ImGUI, init: any);
    GetID(): string | number;
    GetValue(): Promise<number>;
    SetValue(value: number): void;
    JSON(): any;
}

declare class GUIPanel {
    private readonly GUI;
    private readonly init;
    private readonly id;
    private readonly type;
    constructor(GUI: ImGUI, init: any);
    GetID(): string | number;
    AddFloat(id: string | null, value: number, min: number, max: number, step: number, data?: Record<string, any>): GUIFloat;
    AddText(id: string | null, value: string, data?: Record<string, any>): GUIText;
    AddButton(id: string | null, text: string, data?: Record<string, any>): GUIButton;
    AddPanel(id: string | null, type: 'vertical' | 'horizontal', data?: Record<string, any>): GUIPanel;
    JSON(): any;
}

declare class ImGUI {
    private readonly init;
    private readonly id;
    constructor(init: any);
    GetID(): string;
    GetComponentById<T = GUIFloat | GUIPanel | GUIText | GUIButton>(id: string | number): Promise<T>;
    Deploy(): void;
    JSON(): any;
}

declare class GUIButton {
    private readonly GUI;
    private readonly init;
    private readonly id;
    constructor(GUI: ImGUI, init: any);
    GetID(): string | number;
    SetText(text: string): void;
    JSON(): any;
    private eventListeners;
    On(event: string, cb: (thisComponent: GUIButton) => void): void;
    Trigger(event: string): void;
}

declare const DelayBeforeNullResponse = 1000;
declare const store: Record<string, {
    gui: ImGUI;
    components: Record<string, GUIFloat | GUIText | GUIButton | GUIPanel>;
}>;
declare const requestedItems: {
    cb: (gui: any) => void;
    gui?: ImGUI;
    guiid?: string;
}[];
declare const GetFreeRID: () => number;
declare function GetGUI(id: string): Promise<ImGUI | null>;

export { DelayBeforeNullResponse, GUIButton, GUIFloat, GUIPanel, GUIText, GetFreeRID, GetGUI, ImGUI, requestedItems, store };
