type MySQLInsertReturn = {
    insertId: number,
}
type VectorArray = [number, number, number];
type XYZ = { x: number, y: number, z: number };
type UserId = number;
type Source = number;
type vRPServerFunctions = {
    getUserId(source: number): Promise<UserId>,
    defInventoryItem(
        id_name: string,
        name: string,
        description: string,
        choices: ([item_id]: [string]) => Record<string, [(source: number, choiceName: string) => unknown], string?>,
        weight: number,
        listeners: Record<string, (source: number, idname: string) => unknown>): Promise<void>,
    getUserDataTable(userId: UserId): Promise<UserDataTable>,
    hasInventoryItem(userId: UserId, idname: string): Promise<boolean>,
    getInventoryItemAmount(userId: UserId, idname: string): Promise<boolean>,
    giveInventoryItem(userId: UserId, idname: string, amount: number, notify: boolean, addon?: Record<string, string | number>): Promise<void>,
    tryGetInventoryItem(userId: UserId, idname: string, amount: number, notify: boolean): Promise<boolean>,
    openInventory(source: number): Promise<void>,
    createItem(type: 'item',idname: string,name: string,description: string,weight: number): Promise<void>,
    openMenu(source: number, menudata: MenuDataType),
    closeMenu(source: number),
    getUserGroups(userId: UserId): Promise<Record<string, boolean>>,
    getBankMoney(userId: UserId): Promise<number>, // @deprecated
    registerMenuBuilder(menuName: string, registration: (add, data: ({ player: number })) => void),
    buildMenu(menuName: string, data: { player: number }, builder: (menudata: any) => void),
    prompt(source: number, title: string, placeholder: string, cb: (player: number, value: string) => void),
    request(source: number, title: string, time: number, cb: (source: number, ok: boolean) => void),
    giveMoney(userid: UserId, value: number),
    tryPayment(userid: UserId, value: number): Promise<boolean>,
    getMoney(userid: UserId): Promise<number>,
    getUserIdentity(userid: UserId): Promise<UserIdentities>,
    getInventoryItemData(userid: UserId, idname: string): Promise<Record<string, string | number>>,
    addItemListener<DataType>(idname: string, eventname: string, callback: (player: number, data: DataType) => void): void,
    updateUserDataTable(userid: UserId, datatable: Record<string, any>): Promise<UserDataTable>,
    isConnected(userid: UserId): Promise<boolean>,
    getUserSource(userid: UserId): Promise<number>,
}

type vRPClientFunctions = {
    notify(source: number, notifs: string): Promise<void>,
    isInComa(source: number, data: Record<string, never>): Promise<boolean>,
    getWeapons(source: number): Promise<any>,
    addBlip(source: number, x: number,y: number,z: number,idtype: number,idcolor: numebr,text: string, rotation?: number): Promise<number>,
    setNamedBlip(source: number, name: string, x: number,y: number,z: number,idtype: number,idcolor: numebr,text: string, rotation?: number): Promise<number>,
    removeBlip(source: number, blipId: number): Promise<void>,
    removeNamedBlip(source: number, blipName: string): Promise<void>,
    setGPS(source: number, x: number, y: number): Promise<void>,
    setBlipRoute(source: number, id: boolean): Promise<void>,
    addEntityBlip(source: number, entityNet: number, idtype: number, idcolor: number,text: string, rotation?: number): Promise<number>,
    giveWeapons(source: number, weapons: Record<string, { ammo: number }>): Promise<void>,
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

    jerryCanWeaponData: null | {
        petrol?: number,
        solvent?: number,
        itemid: string,
    }
}

type MenuDataType = {
    [key: string]: [(source: number, choiceName?: string) => void, string?] | undefined,
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
type ElecticPumpSpawnLocation = {
    position: XYZ,
    rotation: XYZ | null,
};
type ServerConfig = {
    EssenceTable: EssenceTable,
    VehicleClassesData: Record<number, VehicleConfig>,
    IndividualVehicleData: Record<string, VehicleConfig>,
    PumpsReplaceData: FuelPumpReplaceData[],
    ElecticPumpSpawnLocations: ElecticPumpSpawnLocation[],
}
type ClientConfig = {
    MinFuelForDegrade: number,
    IndividualVehicleData: Record<string, VehicleConfig>,
}
interface RopeAttachements {
    pumpCoords: [number, number, number];
    from: {
        netEntity: number;
        offset: {
            x: number;
            y: number;
            z: number;
        };
    },
    to: {
        netEntity: number;
        offset: {
            x: number;
            y: number;
            z: number;
        };
    },
    ropeLength: number,
    ropeType: 2 | 3 | 4,
}

type PlayerLynxAccount = {
    cardHolder: string,
    card: string,
    phone: string,
    bankMoney: number,
    payments: [],
    registerState: 1 | 0,
    value: number,
}