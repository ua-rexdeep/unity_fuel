import { Logger } from '../../logger';
import { EventName, Vector3, Wait, vDist } from '../../utils';
import { MySQLService } from './mysqlService';

export type FuelStation = {
    id: number,
    x: number,
    y: number,
    fuel: number,
    owner: number,
    brand: string,
    address: string,
}
export type FuelStationDTO = {
    x: number,
    y: number,
    brand: string,
    address: string,
}
type FuelStationLocalData = {
    initialized: boolean,
}

export type FuelHosepipe = {
    nozzleEntity: number | null,
    slotEntity: number | null,
    pickedUpPlayer: number | null,
    inVehicle: number | null, // network id of vehicle
    fuelProcess: number | null,
    broken: boolean,
    worldCoords: Vector3,
    viewDisplayWorldCoords: Vector3,
}

export type FuelPump = {
    id: string,
    netEntity: number | null,
    hosepipes: FuelHosepipe[],
    defaultRotation: number,
    worldCoords: Vector3,
    busy: number | false, // попереджує баги, коли об'єкт що замінюється не видаляється
}

export class FuelStationService {
    private stations: Array<FuelStation & { pumps: FuelPump[] } & FuelStationLocalData> = [];
    private readonly fuelStationsTableName = 'unity_fuelStations';
    private readonly fuelPumpsTableName = 'unity_fuelPumps';
    private readonly logger = new Logger('FuelStationService');
    private createObjectReturnPool: Record<number, any> = {};
    private readonly PumpReplaceData = [ // rotate = boolean; rotate object on 180 deg
        {
            objects: ['prop_gas_pump_1d', 'prop_gas_pump_1d_1', 'prop_gas_pump_1d_2'],
            original: { hash: 'prop_gas_pump_1d' },
            replace: [ // TODO
                { hash: 'prop_gas_pump_1d_1' },
                { hash: 'prop_gas_pump_1d_1' },
            ],
            all: { hash: 'prop_gas_pump_1d_2' },
            offsets: [ // відносні координати слотів
                new Vector3(0, -1, 0),
                new Vector3(0, 1, 0),
            ],
            slotOffsets: [ // відносні координати, де буде розміщений м'ячик(місце приєднання канату до помпи)
                new Vector3(0.345, -0.22, 2.08),
                new Vector3(-0.346, 0.215, 2.05),
            ],
            viewDisplays: [ // де гравець може стояти, щоб бачити панель заправки
                new Vector3(0, -2.5, 0),
                new Vector3(0, 2.5, 0),
            ]
        }
    ];

    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions,
        private readonly MySQL: MySQLService,
    ){
        this.IsFuelStationsTableExists().then((table_exists) => {
            if(table_exists) {
                this.FetchAllFuelStations().then((stations) => {
                    for(const station of stations) {
                        this.stations.push({
                            ...station,
                            pumps: [],
                            initialized: false,
                        });
                    }
                });
            } else {
                this.CreateFuelStationsTable().then(() => {
                    this.CreateFuelStation({
                        x: 0, y: 0, address:'', brand:''
                    });
                });
                
            }
        });

        this.PumpReplaceData.forEach((replaceData) => {
            replaceData.objects.forEach((hash) => {
                console.log('AddPropInteraction', hash);
                emit('propInt:AddPropInteraction', hash, {
                    label: 'Безнинова колонка', 
                    action: 'useFuelPump',
                    denyBroken: true, 
                    preventNetworking: false, 
                    offsets: replaceData.offsets.map((offset) => offset.toArray()),
                    viewDisplays: replaceData.viewDisplays.map((offset) => offset.toArray()),
                });
            });
        });
    }

    private IsFuelStationsTableExists(){
        return this.MySQL.IsTableExists(this.fuelStationsTableName);
    }

    private CreateFuelStationsTable() {
        return this.MySQL.Command(`
        CREATE TABLE ${this.fuelStationsTableName} (
            id INT NOT NULL AUTO_INCREMENT,
            x FLOAT NOT NULL,
            y FLOAT NOT NULL,
            fuel FLOAT NOT NULL DEFAULT 0,
            owner INT DEFAULT NULL,
            brand VARCHAR(128) DEFAULT NULL,
            address VARCHAR(248) DEFAULT NULL,
            PRIMARY KEY (id)
        )`)();
    }

    async CreateFuelStation(dto: FuelStationDTO) {
        const { insertId } = await this.MySQL.Command<FuelStationDTO, { insertId: number }>(`
            INSERT INTO ${this.fuelStationsTableName} (x, y, brand, address) 
            values (@x, @y, @brand, @address);
        `)(dto);
        
        const station = await this.FetchFuelStationByID(insertId);
        const fuelWithPumps = {
            ...station,
            pumps: [],
            initialized: false,
        };
        this.stations.push(fuelWithPumps);
        return fuelWithPumps;
    }

    private FetchAllFuelStations() {
        return this.MySQL.Command<void, FuelStation[]>(`select * from ${this.fuelStationsTableName};`)();
    }

    private FetchFuelStationByID(stationId: number) {
        return this.MySQL.Command<{ stationId: number }, FuelStation>(`
            select * from ${this.fuelStationsTableName} where \`id\` = @stationId;
        `)({ stationId });
    }

    GetAllStations(){
        return JSON.parse(JSON.stringify(this.stations)) as Array<FuelStation & { pumps: FuelPump[] }>;
    }

    GetPlayerNearestStation(player: number) {
        const playerPed = GetPlayerPed(player);
        const playerCoords = GetEntityCoords(playerPed);

        for(const station of this.stations) {
            const dist = vDist(playerCoords[0], playerCoords[1], playerCoords[2], station.x, station.y, playerCoords[2]);
            if(dist <= 50) {
                return station;
            }
        }

        return null;
    }

    GetPumpStation(pumpId: string) {
        return this.stations.find((station) => {
            if(station.pumps.some((pump) => pump.id == pumpId)) return station;
            return null;
        });
    }

    InstallPumpForStation(pumpId: string, stationId: number, pumpNetId: number) {
        const logger = new Logger('InstallPumpForStation');
        const station = this.stations.find((station) => station.id == stationId);
        if(!station) return logger.Log(`No station with id ${stationId}`);
        const pumpEntity = NetworkGetEntityFromNetworkId(pumpNetId);

        station.pumps.push({
            id: pumpId,
            hosepipes: [],
            netEntity: pumpNetId,
            defaultRotation: GetEntityHeading(pumpEntity),
            worldCoords: Vector3.fromArray(GetEntityCoords(pumpEntity)),
            busy: false,
        });
    }

    IsHosepipeBroken(pumpId, hosepipeIndex) {
        const station = this.GetPumpStation(pumpId);
        if(!station) throw new Error('Station is null', { cause: { pumpId } });
        return station.pumps.find((pump) => pump.id == pumpId)?.hosepipes[hosepipeIndex]?.broken || false;
    }

    GetPumpData(pumpId: string) {
        const station = this.GetPumpStation(pumpId);
        if(!station) return;
        return station.pumps.find((pump) => pump.id == pumpId);
    }

    GetHosepipeData(pumpId: string, hosepipeIndex: number): FuelHosepipe | null {
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        return pump.hosepipes[hosepipeIndex];
    }

    GetPumpFromEntity(netEntity: number) {
        for(const station of this.stations) {
            const pump = station.pumps.find((pump) => pump.netEntity == netEntity);
            if(pump) return pump;
        }
        return null;
    }

    // взяти пістолет з колонки
    GiveNozzleToPlayer(pumpId: string, hosepipeIndex: number, playerId: number, pumpNetId: number) {
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        pump.netEntity = pumpNetId;
        pump.hosepipes[hosepipeIndex].pickedUpPlayer = playerId;

        const replaceData = this.GetObjectReplaceData(pumpNetId);
        if(!replaceData) throw new Error(`No replace data for pump(${pumpNetId})`);
        emitNet(EventName('GiveNozzleToPlayer'), playerId, pumpNetId, pumpId, hosepipeIndex, replaceData.slotOffsets[hosepipeIndex].toArray());
    }

    // поставити пістолет в колонку
    DeleteNozzle(pumpId: string, hosepipeIndex: number){
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        const hosepipe = this.GetHosepipeData(pumpId, hosepipeIndex);
        if(!hosepipe) throw new Error('Hosepipe is null', { cause: { pumpId, hosepipeIndex } });
        if(hosepipe.nozzleEntity) DeleteEntity(NetworkGetEntityFromNetworkId(hosepipe.nozzleEntity));
        if(hosepipe.slotEntity) DeleteEntity(NetworkGetEntityFromNetworkId(hosepipe.slotEntity));
        emitNet(EventName('RemoveNozzleRope'), -1, hosepipe.nozzleEntity);
        hosepipe.nozzleEntity = null;
        hosepipe.slotEntity = null;
        hosepipe.pickedUpPlayer = null;
        hosepipe.inVehicle = null;
    }

    // встановлює інформацію про об'єкти у колонки
    async SetHosepipeTakenData(player: number, pumpId: string, nozzleEntity: number, pumpSlotEntity: number, hosepipeIndex: number) {
        const logger = new Logger('SetHosepipeTakenData', player.toString(), pumpId.toString());
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        if(!pump.netEntity) throw new Error('Pump network entity is null', { cause: { pumpId } });
        const hosepipe = this.GetHosepipeIsPlayerHold(player);
        if(!hosepipe) throw new Error('Hosepipe is null', { cause: { player } });
        hosepipe.slotEntity = pumpSlotEntity;
        hosepipe.nozzleEntity = nozzleEntity;

        pump.netEntity = await this.ReplacePumpObject(pumpId, pump.netEntity, hosepipeIndex);
        pump.busy = false;
    }

    SetHosepipePlayerHold(player: number, nozzleNet: number) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        if(!hosepipe) throw new Error('Hosepipe is null for nozzleNet', { cause: { nozzleNet } });
        hosepipe.inVehicle = null;
        hosepipe.pickedUpPlayer = player;
    }

    GetHosepipeIsPlayerHold(player: number) {
        for(const station of this.stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    if(hosepipe?.pickedUpPlayer == player) return hosepipe;
                }
            }
        }
        
        return null;
    }

    GetHosepipeFromNozzle(nozzleNet: number) {
        for(const station of this.stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    if(hosepipe?.nozzleEntity == nozzleNet) return hosepipe;
                }
            }
        }
        
        return null;
    }

    GetHosepipeFromVehicle(vehicleNet: number) {
        for(const station of this.stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    if(hosepipe?.inVehicle == vehicleNet) return hosepipe;
                }
            }
        }
        
        return null;
    }

    // встановлює, що вказанйи пістолет встановлений в машину
    SetHosepipeInVehicle(nozzleNet: number, vehicleNet: number) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        if(!hosepipe) throw new Error('Hosepipe is null for nozzleNet', { cause: { nozzleNet } });
        hosepipe.pickedUpPlayer = null;
        hosepipe.inVehicle = vehicleNet;
    }

    // встановлює, що вказаний пістолет більше не піднятий гравцем
    SetHosepipeDropped(nozzleNet: number) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        if(!hosepipe) throw new Error('Hosepipe is null for nozzleNet', { cause: { nozzleNet } });
        hosepipe.pickedUpPlayer = null;
    }

    // встановлює, чи поломаний пістолет
    SetHosepipeBroken(nozzleNet: number, broken = true) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        if(!hosepipe) throw new Error('Hosepipe is null for nozzleNet', { cause: { nozzleNet } });
        hosepipe.broken = broken;
    }

    /**
     * @deprecated видаляє всі об'єкти пов'язані з колонкою, якщо такої більше не існує
     */
    OnPumpNotLongerExists(pumpId: string) {
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        pump.hosepipes.forEach((_, i) => this.DeleteNozzle(pump.id, i));
        pump.netEntity = null;
        this.logger.Warn('Pump network entity does not longer exists. Deleting all nozzels');
    }

    // замінює модель об'єкту колонки в залежності від кількості зайнятих слотів
    async ReplacePumpObject(pumpId: string, pumpNetId: number, playerSlot: number) {
        const pump = this.GetPumpData(pumpId);
        if(!pump) throw new Error('Pump is null', { cause: { pumpId } });
        
        const busySlots = pump.hosepipes.filter((hsp) => hsp?.pickedUpPlayer || hsp?.nozzleEntity).length || 0;
        const replaceData = this.GetObjectReplaceData(pumpNetId);
        if(!replaceData) {
            this.logger.Error('Replace data is null', {
                netEntity: pumpNetId,
                localEntity: NetworkGetEntityFromNetworkId(pumpNetId),
                pump,
            });
            throw new Error('Replace data is null', { cause: { pumpId } });
        }
        let replaceModel;
        if(busySlots == 0) replaceModel = replaceData.original;
        else if(busySlots == replaceData.replace.length) replaceModel = replaceData.all;
        else replaceModel = replaceData.replace[playerSlot];

        // this.logger.Warn('ReplacePumpObject', busySlots, playerSlot, replaceModel, replaceData);

        const ent = NetworkGetEntityFromNetworkId(pumpNetId);
        const rot = Vector3.fromArray(GetEntityRotation(ent));
        rot.z = pump.defaultRotation;

        DeleteEntity(ent);
        const newEntityNetId = await this.CreateClientObject<number>(NetworkGetEntityOwner(ent), replaceModel.hash, pump.worldCoords, rot);

        while(NetworkGetEntityFromNetworkId(newEntityNetId) == 0) {
            this.logger.Warn('ReplaceObject waiting to new entity will exists', newEntityNetId);
            await Wait(100);
        }

        return newEntityNetId;
    }

    async CreateClientObject<T>(player: number, model: string | number, pos: Vector3, rot: Vector3) {
        return new Promise<T>((done) => {
            let rid = 0;
            while(this.createObjectReturnPool[rid] != null) {
                rid++;
            }
            this.createObjectReturnPool[rid] = done;
            console.log('Sending create object request with rid: ', rid);
            TriggerClientEvent('propInt:CreateObject', player, model, pos.toObject(), rot.toObject(), rid);
        });
    }

    ClientObjectCreated(player: number, netId: number, model: string, rID: number) {
        this.logger.Log('ClientObjectCreated', netId, model, rID, typeof(this.createObjectReturnPool[rID]));
        if(this.createObjectReturnPool[rID]) {
            this.createObjectReturnPool[rID](netId);
            delete this.createObjectReturnPool[rID];
        }
    }

    GetObjectReplaceData(propNetId: number){
        const prop = NetworkGetEntityFromNetworkId(propNetId);
        const model = GetEntityModel(prop);
        return this.PumpReplaceData.find((obj) => obj.objects.find((hash) => GetHashKey(hash) == model));
    }
}