import { Logger } from '../../logger';
import { EventName } from '../../utils';
import { PlayerService } from './playerService';

const VehicleClasses = {
    [0]: {
        essenceMultiplier: 0.7,
        maxFuel: 25,
    }, // Compacts
    [1]: {
        essenceMultiplier: 1.1,
        maxFuel: 38,
    }, // Sedans
    [2]: {
        essenceMultiplier: 1.7,
        maxFuel: 64,
    }, // SUVs
    [3]: {
        essenceMultiplier: 1.1,
        maxFuel: 25,
    }, // Coupes
    [4]: {
        essenceMultiplier: 1.5,
        maxFuel: 55,
    }, // Muscle
    [5]: {
        essenceMultiplier: 1.3,
        maxFuel: 55,
    }, // Sports Classics
    [6]: {
        essenceMultiplier: 1.5,
        maxFuel: 55,
    }, // Sports
    [7]: {
        essenceMultiplier: 1.5,
        maxFuel: 55,
    }, // Super
    [8]: {
        essenceMultiplier: 0.6,
        maxFuel: 10,
    }, // Motorcycles
    [9]: {
        essenceMultiplier: 1.2,
        maxFuel: 64,
    }, // Off-road
    [10]: {
        essenceMultiplier: 1.0,
        maxFuel: 100,
    }, // Industrial
    [11]: {
        essenceMultiplier: 1.0,
        maxFuel: 64,
    }, // Utility
    [12]: {
        essenceMultiplier: 1.2,
        maxFuel: 64,
    }, // Vans
    [14]: {
        essenceMultiplier: 1.0,
        maxFuel: 64,
    }, // Boats
    [15]: {
        essenceMultiplier: 1.0,
        maxFuel: 200,
    }, // Helicopters
    [16]: {
        essenceMultiplier: 1.0,
        maxFuel: 200,
    }, // Planes
    [17]: {
        essenceMultiplier: 1.0,
        maxFuel: 64,
    }, // Service
    [18]: {
        essenceMultiplier: 1.0,
        maxFuel: 64,
    }, // Emergency
    [19]: {
        essenceMultiplier: 1.9,
        maxFuel: 64,
    }, // Military
    [20]: {
        essenceMultiplier: 1.8,
        maxFuel: 64,
    }, // Commercial
};

type VehicleData = { 
    fuel: number, 
    class: number, 
    refuelInterval: NodeJS.Timeout | null,
    totalRefilled: number,
    playerRefilling: number,
};

export class FuelEssenceService {
    private readonly logger = new Logger('FuelEssenceService');
    private Vehicles: Record<string, VehicleData> = {};
    private EssenceTable: EssenceTable = {};
    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions,
        private readonly playerService: PlayerService,
    ){}

    AddVehicleAsPlayerVehicle(vehicleNet: number, vehicleClass: number, startFuelLevel: number) {
        if(!Object.keys(this.Vehicles).includes(vehicleNet.toString())) {
            this.logger.Log('Added new vehicle as player vehicle', vehicleNet, vehicleClass, startFuelLevel);
            this.Vehicles[vehicleNet] = {
                fuel: startFuelLevel, // startFuelLevel
                class: vehicleClass,
                refuelInterval: null,
                totalRefilled: 0,
                playerRefilling: 0,
            };
        }

        return this.Vehicles[vehicleNet];
    }

    IsVehicleInMemory(vehicleNet: number) {
        return this.Vehicles[vehicleNet] != null;
    }

    SetVehicleFuel(vehicleNet: number, fuel: number): void {
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        this.Vehicles[vehicleNet].fuel = fuel;
        this.OnVehicleFuelUpdated(vehicleNet);
    }

    GetVehicleFuel(vehicleNet: number): number | null {
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        return this.Vehicles[vehicleNet].fuel;
    }

    GetVehicleMaxFuel(vehicleNet: number): number {
        const vehicleClass = this.GetVehicleFuelData(vehicleNet);
        return vehicleClass.maxFuel;
    }

    GetVehicleFuelData(vehicleNet: number) {
        return VehicleClasses[this.Vehicles[vehicleNet].class];
    }

    GetVehicleRefillingData(vehicleNet: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        return {
            inProgress: vehicleData.refuelInterval != null,
            playerRefilling: vehicleData.playerRefilling,
            totalRefilled: vehicleData.totalRefilled,
        };
    }

    ResetVehicleRefillingData(vehicleNet: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);

        vehicleData.playerRefilling = 0;
        vehicleData.totalRefilled = 0;
    }

    RequestVehicleRefuel(player: number, vehicleNet: number) {
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuel = this.GetVehicleMaxFuel(vehicleNet);
        const vehicleFuel = this.GetVehicleFuel(vehicleNet);

        if(vehicleData.refuelInterval != null) {
            this.InterruptVehicleRefill(vehicleNet, true);
        }

        this.vRP.prompt(player, 'Refill', (vehicleMaxFuel - vehicleFuel!).toFixed(1), (player, value) => {
            try {
                const fuelToRefill = parseFloat(value) * 0.997;

                vehicleData.playerRefilling = player;
                vehicleData.totalRefilled = 0;
                vehicleData.refuelInterval = setInterval(() => {
                    this.ProcessVehicleRefill(vehicleNet, fuelToRefill);
                }, 100);


            } catch(e) {
                this.vRPClient.notify(player, '~r~Wrong input.');
            }
            console.log('REFUEL', vehicleNet, value);
        });

        return null;
    }

    // один тік заправки на станції
    ProcessVehicleRefill(vehicleNet: number, fuelToRefill: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuel = this.GetVehicleMaxFuel(vehicleNet);
        this.logger.Log('RefillProcess maxFuel:', vehicleMaxFuel);
        const rndToAdd = (Math.random()*(3-1)+1) / 10;
        this.logger.Log('RefillProcess', `${vehicleData.fuel} + ${rndToAdd} > ${vehicleMaxFuel}`);

        if(vehicleData.fuel + rndToAdd > vehicleMaxFuel) { // next fuel value bigger then max vehicle fuel
            this.vRPClient.notify(vehicleData.playerRefilling, `~b~Vehicle refilled for ${vehicleData.totalRefilled.toFixed(1)}l. ~r~Wont fit anymore.`);

            if(vehicleData.refuelInterval) {
                clearInterval(vehicleData.refuelInterval);
                vehicleData.refuelInterval = null;
            }
        }
        else if(vehicleData.totalRefilled + rndToAdd > fuelToRefill) { // next fuel value bigger then need to refill
            vehicleData.fuel += fuelToRefill - vehicleData.totalRefilled;
            vehicleData.totalRefilled += fuelToRefill - vehicleData.totalRefilled;
            if(vehicleData.refuelInterval) {
                this.vRPClient.notify(vehicleData.playerRefilling, `~b~Vehicle refilled for ${fuelToRefill}l.`);
                clearInterval(vehicleData.refuelInterval);
                vehicleData.refuelInterval = null;
            }
        }
        else {
            vehicleData.fuel += rndToAdd;
            vehicleData.totalRefilled += rndToAdd;
        }
        this.logger.Log('RefillProcess', vehicleData.fuel.toFixed(1), vehicleData.totalRefilled.toFixed(1));
    }

    InterruptVehicleRefill(vehicleNet: number, refundMoney: boolean) {
        const vehicleData = this.Vehicles[vehicleNet];
        if(vehicleData.refuelInterval) {
            clearInterval(vehicleData.refuelInterval);
            vehicleData.refuelInterval = null;
            this.vRPClient.notify(vehicleData.playerRefilling, `~b~Refilling interrupted. Refilled for ${vehicleData.totalRefilled.toFixed(1)}l.`);
        }
    }

    ProcessVehiclesFuelEssence() {
        for(const [vehicleNet, vehicleData] of Object.entries(this.Vehicles)) {
            if(vehicleData == null) continue;

            const vehicleEntity = NetworkGetEntityFromNetworkId(+vehicleNet);
            if(!DoesEntityExist(vehicleEntity)) {
                delete this.Vehicles[vehicleNet];
                this.logger.Warn(`Vehicle ${vehicleNet} no longer exists`);
                continue;
            }

            let essence = 0;
            if(GetIsVehicleEngineRunning(vehicleEntity)) {
                const speed = GetEntitySpeed(vehicleEntity) * 3.6;
                essence = this.GetSpeedEssence(speed);
            }
            
            if(essence > 0 && vehicleData.fuel > 0) {
                vehicleData.fuel -= essence;
                if(vehicleData.fuel < 0) vehicleData.fuel = 0;

                this.logger.Warn('EssenceProcess', vehicleData.fuel.toFixed(1), `essence: ${GetEntitySpeed(vehicleEntity) * 3.6} ->`, essence);

                const driver = GetPedInVehicleSeat(vehicleEntity, -1);
                const driverPlayer = driver && this.playerService.GetPlayerByPed(driver);
                // const vehicleMaxFuelLevel = this.GetVehicleMaxFuel(+vehicleNet);
                if(driver && driverPlayer) {
                    // emitNet(EventName('VehicleFuelUpdated'), driverPlayer, +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel);
                    this.OnVehicleFuelUpdated(+vehicleNet, driverPlayer);
                } else if(vehicleData.fuel == 0) {
                    console.warn('fuel is empty, send owner');
                    // emitNet(EventName('VehicleFuelUpdated'), NetworkGetEntityOwner(vehicleEntity), +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel);
                    this.OnVehicleFuelUpdated(+vehicleNet);
                }
            }
        }
    }

    // driver is network owner by default
    OnVehicleFuelUpdated(vehicleNet: number, driverPlayer: number | null = null) {
        const vehicleEntity = NetworkGetEntityFromNetworkId(vehicleNet);
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuelLevel = this.GetVehicleMaxFuel(+vehicleNet);
        emitNet(EventName('VehicleFuelUpdated'), driverPlayer || NetworkGetEntityOwner(vehicleEntity), +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel);
    }

    SetEssenceTable(table: EssenceTable) {
        this.EssenceTable = table;
    }

    // !KMH required
    GetSpeedEssence(speed: number) {
        let essence = this.EssenceTable[0];

        for(const [key, value] of Object.entries(this.EssenceTable)) {
            if(speed >= +key) essence = value;
        }

        return essence;
    }
}