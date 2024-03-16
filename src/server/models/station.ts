import { Logger } from '../../logger';
import { FuelStationService } from '../services/fuelStationService';
import { MySQLService } from '../services/mysqlService';
import { PlayerService } from '../services/playerService';
import { ElecticalPump } from './electicalPump';
import { FuelPump, IFuelPump } from './fuelPump';

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
    isElecticParking: 0 | 1,
}

export interface FuelStationDTO {
    x: number,
    y: number,
    brand: string,
    address: string
}

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
    private electricityCost: number;
    public readonly isElecticParking: 0 | 1;

    private pumps: (FuelPump | ElecticalPump)[] = [];

    constructor(
        private readonly service: FuelStationService,
        private readonly playerService: PlayerService,
        private readonly MySQL: MySQLService,
        {id, x, y, fuel, owner, brand, address, fuelCost, electricityCost, isElecticParking}: IFuelStation,
    ) {
        this.logger = new Logger(`FuelStation(${id})`);
        this.id = id;
        this.x = x;
        this.y = y;
        this.fuel = fuel;
        this.owner = owner;
        this.brand = brand;
        this.address = address;
        this.fuelCost = fuelCost;
        this.electricityCost = electricityCost;
        this.isElecticParking = isElecticParking;

        this.MySQL.FetchStationFuelPumps(id).then((pumps) => {
            for (const init of pumps) {
                let pump;
                if(init.isElectical) pump = new ElecticalPump(this.service, this.playerService, this, this.brand, this.MySQL, init);
                else pump = new FuelPump(this.service, this.playerService, this, this.brand, this.MySQL, init);
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

    GetElectricityCost() {
        return this.electricityCost;
    }

    SetFuelCost(value: number) {
        this.fuelCost = value;
        this.Save();
    }

    SetElectricityCost(value: number) {
        this.electricityCost = value;
        this.Save();
    }

    GetOwnerUserId() {
        return this.owner;
    }

    GetAllPumps() {
        return [...this.pumps];
    }

    AddPump(init: IFuelPump) {
        let pump;
        if(init.isElectical) pump = new ElecticalPump(this.service, this.playerService, this, this.brand, this.MySQL, init);
        else pump = new FuelPump(this.service, this.playerService, this, this.brand, this.MySQL, init);
        this.pumps.push(pump);
        return pump;
    }

    GetPumpById(id: string) {
        return this.pumps.find((pump) => pump.id == id);
    }

    GetPumpFromEntity(pumpNetId: number) {
        return this.GetAllPumps().find((pump) => pump.GetPumpNetId() == pumpNetId);
    }

    GetPumpByNumber(pumpNumber: number) {
        return this.GetAllPumps().find((pump) => pump.GetPumpNumber() == pumpNumber);
    }

    Save() {
        this.MySQL.UpdateFuelStation(this.id, {
            fuel: this.GetFuelValue(),
            fuelCost: this.GetFuelCost(),
            owner: this.GetOwnerUserId(),
            electricityCost: this.GetElectricityCost(),
        });
    }

    GetAllHosepipes() {
        return this.pumps.map((pump) => pump.GetAllHosepipes()).flat(2);
    }
}