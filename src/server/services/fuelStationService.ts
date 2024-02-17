import { Logger } from '../../logger';
import { EventName, vDist } from '../../utils';
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

export type FuelPump = {
    id: string,
    netEntity?: number,
    hosepipes: {
        nozzleEntity?: number,
        slotEntity?: number,
        pickedUpPlayer?: number,
        inVehicle?: number,
        fuelProcess?: number,
        broken: boolean,
    }[]
}

export class FuelStationService {
    private stations: Array<FuelStation & { pumps: FuelPump[] }> = [];
    private readonly fuelStationsTableName = 'unity_fuelStations';
    private readonly fuelPumpsTableName = 'unity_fuelPumps';

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
        });
    }

    InstallPumpForStation(pumpId: string, stationId: number) {
        const logger = new Logger('InstallPumpForStation');
        const station = this.stations.find((station) => station.id == stationId);
        if(!station) return logger.Log(`No station with id ${stationId}`);

        station.pumps.push({
            id: pumpId,
            hosepipes: [],
        });
    }

    IsHosepipeBroken(pumpId, hosepipeIndex) {
        const station = this.GetPumpStation(pumpId);
        return station.pumps.find((pump) => pump.id == pumpId).hosepipes[hosepipeIndex]?.broken || false;
    }

    GetPumpData(pumpId: string) {
        const station = this.GetPumpStation(pumpId);
        return station.pumps.find((pump) => pump.id == pumpId);
    }

    GetHosepipeData(pumpId: string, hosepipeIndex: number) {
        const pump = this.GetPumpData(pumpId);
        if(!pump.hosepipes[hosepipeIndex]) pump.hosepipes[hosepipeIndex] = {
            broken: false,
        };
        return pump.hosepipes[hosepipeIndex];
    }

    GetPumpFromEntity(netEntity: number) {
        for(const station of this.stations) {
            const pump = station.pumps.find((pump) => pump.netEntity == netEntity);
            if(pump) return pump;
        }
    }

    // взяти пістолет з колонки
    GiveNozzleToPlayer(pumpId: string, hosepipeIndex: number, playerId: number, pumpNetId: number) {
        const pump = this.GetPumpData(pumpId);
        pump.netEntity = pumpNetId;
        emitNet(EventName('GiveNozzleToPlayer'), playerId, pumpNetId, hosepipeIndex);
    }

    // поставити пістолет в колонку
    TakeNozzleFromPlayer(pumpId: string, hosepipeIndex: number, playerId: number, pumpNetId: number){
        const pump = this.GetPumpData(pumpId);
        const hosepipe = this.GetHosepipeData(pumpId, hosepipeIndex);
        pump.netEntity = null;
        emitNet(EventName('TakeNozzleFromPlayer'), playerId, pumpNetId, hosepipeIndex, hosepipe.nozzleEntity);
    }

    SetHosepipeTakenData(player: number, pumpEntity: number, nozzleEntity: number, pumpSlotEntity: number, hosepipeIndex: number) {
        const logger = new Logger('SetHosepipeTakenData', player.toString(), pumpEntity.toString());
        const pump = this.GetPumpFromEntity(pumpEntity);
        pump.hosepipes[hosepipeIndex].slotEntity = pumpSlotEntity;
        pump.hosepipes[hosepipeIndex].nozzleEntity = nozzleEntity;
        pump.hosepipes[hosepipeIndex].pickedUpPlayer = player;
    }

    SetHosepipePlayerHold(player: number, nozzleNet: number) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        hosepipe.inVehicle = null;
        hosepipe.pickedUpPlayer = player;
    }

    GetHosepipeIsPlayerHold(player: number) {
        for(const station of this.stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    console.log('GetHosepipeIsPlayerHold', station.id, hosepipe?.pickedUpPlayer, '==', player);
                    if(hosepipe?.pickedUpPlayer == player) return hosepipe;
                }
            }
        }
    }

    private GetHosepipeFromNozzle(nozzleNet: number) {
        for(const station of this.stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    console.log('GetHosepipeFromNozzle', station.id, hosepipe?.nozzleEntity, '==', nozzleNet);
                    if(hosepipe?.nozzleEntity == nozzleNet) return hosepipe;
                }
            }
        }
    }

    SetHosepipeInVehicle(nozzleNet: number, vehicleNet: number) {
        const hosepipe = this.GetHosepipeFromNozzle(nozzleNet);
        hosepipe.pickedUpPlayer = null;
        hosepipe.inVehicle = vehicleNet;
    }
}