import { Logger } from '../../logger';
import { FuelStationService } from '../services/fuelStationService';
import { MySQLService } from '../services/mysqlService';
import { FuelPump, IFuelPump } from './pump';

export interface IFuelStation {
    id: number,
    x: number,
    y: number,
    fuel: number,
    owner?: number,
    brand: string,
    address: string,
    fuelCost: number,
    electricityCost: number,
}

export interface FuelStationDTO { x: number, y: number, brand: string, address: string }

export class FuelStation {
    private readonly logger: Logger;
    readonly id: number;
    readonly x: number;
    readonly y: number;
    private fuel: number;
    private owner?: number;
    readonly brand: string;
    readonly address: string;
    private fuelCost: number;

    private pumps: FuelPump[] = [];

    constructor(
        private readonly service: FuelStationService,
        private readonly MySQL: MySQLService,
        { id, x, y, fuel, owner, brand, address, fuelCost }: IFuelStation,
    ){
        this.logger = new Logger(`FuelStation(${id})`);
        this.id = id;
        this.x = x;
        this.y = y;
        this.fuel = fuel;
        this.owner = owner;
        this.brand = brand;
        this.address = address;
        this.fuelCost = fuelCost;

        this.MySQL.FetchStationFuelPumps(id).then((pumps) => {
            for(const init of pumps) {
                const pump = new FuelPump(this.service, this, this.MySQL, init);
                this.pumps.push(pump);
            }
        });
    }

    GetFuelValue() {
        return this.fuel;
    }

    GetFuelCost() {
        return this.fuelCost;
    }

    SetFuelCost(value: number) {
        this.fuelCost = value;
    }

    GetOwnerUserId() {
        return this.owner;
    }

    GetAllPumps() {
        return [...this.pumps];
    }

    AddPump(init: IFuelPump) {
        const pump = new FuelPump(this.service, this, this.MySQL, init);
        this.pumps.push(pump);
        return pump;
    }

    GetPumpById(id: string) {
        return this.pumps.find((pump) => pump.id == id);
    }

    GetPumpFromEntity(pumpNetId: number) {
        return this.GetAllPumps().find((pump) => pump.GetPumpNetId() == pumpNetId);
    }

    Save() {
        this.MySQL.UpdateFuelStation(this.id, {
            fuel: this.GetFuelValue(),
            fuelCost: this.GetFuelCost(),
            owner: this.GetOwnerUserId(),
        });
    }
}