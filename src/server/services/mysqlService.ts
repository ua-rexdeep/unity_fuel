import { IFuelPump, IFuelPumpDTO } from '../models/pump';
import { FuelStationDTO, IFuelStation } from '../models/station';

export class MySQLService {
    constructor(){}

    Command<Q = void, R = void>(query: string) {
        return (variables: Q) => new Promise((done: (rows: R extends MySQLInsertReturn ? MySQLInsertReturn : (R extends void ? void : Array<R>)) => void) => {
            global.exports['ghmattimysql'].execute(query, variables, done);
        });
    }

    async IsTableExists(table_name: string) {
        const [{ table_exists }] = await this.Command<{ table_name: string }, { table_exists: number }>(`SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = @table_name
        ) AS table_exists;`)({ table_name });

        return table_exists == 1;
    }

    async IsTableColumnExists(table_name: string, column_name: string) {
        const [{ column_exists }] = await this.Command<{ table_name: string, column_name: string }, { column_exists: number }>(`SELECT EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE table_name = '${table_name}' AND column_name = '${column_name}'
        ) AS column_exists;`)({ column_name, table_name });

        return column_exists == 1;
    }

    // FuelStations //

    private fuelStationsTableName = 'vrp_fuelStations';
    CreateFuelStationsTable() {
        return this.Command(`
        CREATE TABLE ${this.fuelStationsTableName} (
            id INT NOT NULL AUTO_INCREMENT,
            x FLOAT NOT NULL,
            y FLOAT NOT NULL,
            fuel FLOAT NOT NULL DEFAULT 0,
            fuelCost FLOAT NOT NULL DEFAULT 0,
            electricityCost FLOAT NOT NULL DEFAULT 0,
            owner INT DEFAULT NULL,
            brand VARCHAR(128) DEFAULT NULL,
            address VARCHAR(248) DEFAULT NULL,
            PRIMARY KEY (id)
        )`)();
    }

    IsFuelStationsTableExists() {
        return this.IsTableExists(this.fuelStationsTableName);
    }

    async InsertFuelStation(dto: FuelStationDTO) {
        return await this.Command<FuelStationDTO, { insertId: number }>(`
            INSERT INTO ${this.fuelStationsTableName} (x, y, brand, address) 
            values (@x, @y, @brand, @address);
        `)(dto);
    }

    FetchFuelStationById(id: number) {
        return this.Command<{ stationId: number }, IFuelStation>(`
            select * from ${this.fuelStationsTableName} where \`id\` = @stationId;
        `)({ stationId: id });
    }

    FetchAllFuelStations() {
        return this.Command<void, IFuelStation>(`select * from ${this.fuelStationsTableName};`)();
    }

    UpdateFuelStation(stationId: number, dto: { fuel: number, fuelCost: number, owner?: number }) {
        return this.Command<typeof dto & {stationId:number}, void>(`update ${this.fuelStationsTableName} set fuel = @fuel, fuelCost = @fuelCost, owner = @owner where id = @stationId;`)({
            stationId,
            ...dto,
        });
    }

    // FuelPumps //

    private fuelPumpsTableName = 'vrp_fuelPumps';
    CreateFuelPumpsTable() {
        return this.Command(`
        CREATE TABLE ${this.fuelPumpsTableName} (
            id VARCHAR(24) NOT NULL,
            stationId INT NOT NULL,
            x FLOAT DEFAULT 0,
            y FLOAT DEFAULT 0,
            z FLOAT DEFAULT 0,
            defaultRotation FLOAT DEFAULT 0,
            hosepipe1 TEXT,
            hosepipe2 TEXT,
            PRIMARY KEY (id)
        )`)();
    }

    IsFuelPumpsTableExists() {
        return this.IsTableExists(this.fuelPumpsTableName);
    }

    async InsertFuelPump(dto: IFuelPumpDTO) {
        return await this.Command<typeof dto, MySQLInsertReturn>(`
            INSERT INTO ${this.fuelPumpsTableName} (id, stationId, x, y, z, defaultRotation, hosepipe1, hosepipe2) 
            values (@id, @stationId, @x, @y, @z, @defaultRotation, '{ "broken": false }', '{ "broken": false }');
        `)(dto);
    }

    FetchFuelPumpById(id: string) {
        return this.Command<{ pumpId: string }, IFuelPump>(`
            select * from ${this.fuelPumpsTableName} where \`id\` = @pumpId;
        `)({ pumpId: id });
    }

    FetchStationFuelPumps(stationId: number) {
        return this.Command<{ stationId: number }, IFuelPump>(`
            select * from ${this.fuelPumpsTableName} where stationId = @stationId;
        `)({ stationId });
    }

    UpdateFuelStationPump(stationId: number, pumpId: string, dto: { broken: 0 | 1 }) {
        return this.Command<typeof dto & {stationId:number,pumpId:string,broken:0|1}, void>(`update ${this.fuelPumpsTableName} set broken = @broken where id = @pumpId and stationId = @stationId;`)({
            stationId,
            pumpId,
            ...dto,
        });
    }
}