type MySQLInsertReturn = {
    insertId: number,
}
type VectorArray = [number, number, number];
type vRPServerFunctions = {
    getUserId(source: number): Promise<number>,
    defInventoryItem(
        idname: string,
        name: string,
        description: string,
        choices: (itemid: string) => Record<string, [(source: number, choiceName: string) => unknown], string?>,
        weight: number,
        listeners: Record<string, (source: number, idname: string) => unknown>): Promise<void>,
    getUserDataTable(userId: number): Promise<UserDataTable>,
    hasInventoryItem(userId: number, idname: string): Promise<boolean>,
    getInventoryItemAmount(userId: number, idname: string): Promise<boolean>,
    giveInventoryItem(userId: number, idname: string, amount: number, notify: boolean, addon?: Record<string, string | number>): Promise<void>,
    tryGetInventoryItem(userId: number, idname: string, amount: number, notify: boolean): Promise<boolean>,
    openInventory(source: number): Promise<void>,
    createItem(type: 'item',idname: string,name: string,description: string,weight: number): Promise<void>,
    openMenu(source: number, menudata: MenuDataType),
    closeMenu(source: number),
    getUserGroups(userId: number): Promise<Record<string, boolean>>,
    getBankMoney(userId: number): Promise<number>, // @deprecated
    registerMenuBuilder(menuName: string, registration: (add, data: ({ player: number })) => void),
    buildMenu(menuName: string, data: { player: number }, builder: (menudata: any) => void),
    prompt(source: number, title: string, placeholder: string, cb: (player: number, value: string) => void),
    giveMoney(userid: number, value: number),
    tryPayment(userid: number, value: number): Promise<boolean>,
    getMoney(userid: number): Promise<number>,
    getUserIdentity(userid: number): Promise<UserIdentities>,
    getInventoryItemData(userid: number, idname: string): Promise<Record<string, string | number>>,
    addItemListener<DataType>(idname: string, eventname: string, callback: (player: number, data: DataType) => void): void,
    updateUserDataTable(userid: number, datatable: Record<string, any>): Promise<UserDataTable>,
}

type vRPClientFunctions = {
    notify(source: number, notifs: string): Promise<void>,
    isInComa(source: number, data: Record<string, never>): Promise<boolean>,
    getWeapons(source: number): Promise<any>,
}

type UserDataTable = {
    armour: number,
    gaptitudes: Record<string, Record<string, number>>,
    health: number,
    inventory: Record<string, Record<string, string | number> & { amount: number }>,
    position: {
        x: number,
        y: number,
        z: number,
    },
    groups: Record<string, boolean>,
    weapons: Record<string, Record<string, string | number> & { ammo: number }>,
    hunger: number,
    thirst: number,
    customization: Record<string, number[]>,

    jerryCanWeaponData?: {
        petrol?: number,
        solvent?: number,
    }
}

type MenuDataType = {
    [key: string]: [(source?: number, choiceName?: string) => void, string?]
} | {
    name: string,
    css?: {
        top: string,
        header_color: string,
    },
    onclose?: (source: number) => void,
}

type UserIdentities = {
    user_id: number,
    registration: string,
    phone: string,
    firstname: string,
    name: string,
    age: string,
}

type VehicleConfig = { 
    essenceMultiplier: number, 
    maxFuel: number,
    refillNozzleOffset: { x: number, y: number, z: number },
    refillNozzleRotation: { x: number, y: number, z: number },
    isElectic?: boolean,
};
type EssenceTable = Record<number, number>;
type FuelPumpReplaceData = {
    objects: string[];
    original: {
        hash: string;
    };
    replace: {
        hash: string;
    }[];
    all: {
        hash: string;
    };
    offsets: { x: number, y: number, z: number }[];
    slotOffsets: { x: number, y: number, z: number }[];
    viewDisplays: { x: number, y: number, z: number }[];
    isElectricOnly?: boolean,
}
type ServerConfig = {
    EssenceTable: EssenceTable,
    VehicleClassesData: Record<number, VehicleConfig>,
    IndividualVehicleData: Record<string, VehicleConfig>,
    PumpsReplaceData: FuelPumpReplaceData[],
}
type ClientConfig = {
    MinFuelForDegrade: number,
    IndividualVehicleData: Record<string, VehicleConfig>,
}
interface RopeAttachements {
    pumpCoords: number[];
    from: {
        netEntity: number;
        offset: {
            x: number;
            y: number;
            z: number;
        };
    };
    to: {
        netEntity: number;
        offset: {
            x: number;
            y: number;
            z: number;
        };
    };
}