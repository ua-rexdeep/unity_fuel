import { Logger } from '../../logger';
import { vDist } from '../../utils';
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
    hosepipes: {
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
        this.stations.push({
            ...station,
            pumps: [],
        });
    }

    private FetchAllFuelStations() {
        return this.MySQL.Command<void, FuelStation[]>(`select * from ${this.fuelStationsTableName};`)();
    }

    private FetchFuelStationByID(stationId: number) {
        return this.MySQL.Command<{ stationId: number }, FuelStation>(`
            select * from ${this.fuelStationsTableName} where \`id\` = @stationId;
        `)({ stationId });
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
        console.log(this.stations);
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
}