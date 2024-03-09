import { Logger } from '../../logger';
import { EventName } from '../../utils';
import { FuelPump } from '../models/pump';
import { MySQLService } from './mysqlService';
import { PlayerService } from './playerService';

type VehicleData = { 
    fuel: number, 
    class: number, 
    refuelInterval: NodeJS.Timeout | null,
    totalRefilled: number,
    playerRefilling: number,
    badFuelContent: number,
    gasPump: FuelPump | null,
};

export class FuelEssenceService {
    private readonly logger = new Logger('FuelEssenceService');
    private Vehicles: Record<string, VehicleData> = {}; // cache. видаляє позиції, якщо транспорту більше не існує(ProcessVehiclesFuelEssence)
    private VehiclesRequests: Record<string, (...any) => void> = {};
    private EssenceTable: EssenceTable = {}; // кoнфігурація щодо розходу топлива відносно швидкості
    private VehicleClassesData: Record<number, VehicleConfig> = {}; // кoнфігурація щодо розходу топлива відносно швидкості
    private VehicleIndividualData: Record<number, VehicleConfig> = {}; // кoнфігурація щодо розходу топлива відносно швидкості для індивіальних моделей
    private readonly queries: {
        SaveFuelForVehicle: (variables: { fuel: number; plate: string; }) => Promise<void>,
        FetchVehicleFuel: (variables: { plate: string; }) => Promise<{ fuelLevel: number; }[]>
    };
    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions,
        private readonly playerService: PlayerService,
        private readonly MySQL: MySQLService,
    ){
        this.queries = {
            SaveFuelForVehicle: MySQL.Command<{ fuel: number, plate: string }>('update vrp_user_vehicles set `fuelLevel` = @fuel where `vehicle_plate` = @plate;'),
            FetchVehicleFuel: MySQL.Command<{ plate: string }, { fuelLevel: number }>('select `fuelLevel` from vrp_user_vehicles where `vehicle_plate` = @plate;'),
        };
        const AlterFuelColumn = MySQL.Command('ALTER TABLE vrp_user_vehicles ADD COLUMN fuelLevel FLOAT NOT NULL DEFAULT 0');

        this.MySQL.IsTableColumnExists('vrp_user_vehicles', 'fuelLevel').then((exists) => {
            if(!exists) AlterFuelColumn();
        });
    }

    AddVehicleToCache(vehicleNet: number, vehicleClass: number, startFuelLevel: number) {
        if(!Object.keys(this.Vehicles).includes(vehicleNet.toString())) {
            this.logger.Log('Added new vehicle in cache', vehicleNet, vehicleClass, startFuelLevel);
            this.Vehicles[vehicleNet] = {
                fuel: 2, // startFuelLevel
                class: vehicleClass,
                refuelInterval: null,
                totalRefilled: 0,
                playerRefilling: 0,
                badFuelContent: 0,
                gasPump: null,
            };

            this.queries.FetchVehicleFuel({ plate: GetVehicleNumberPlateText(NetworkGetEntityFromNetworkId(vehicleNet)) }).then(([vehicle_row]) => {
                if(!vehicle_row) this.SetVehicleFuel(vehicleNet, Math.random()*(20-5)+5);
                else vehicle_row.fuelLevel;
            });
        }

        if(this.VehiclesRequests[vehicleNet]) {
            this.VehiclesRequests[vehicleNet](this.Vehicles[vehicleNet]);
            delete this.VehiclesRequests[vehicleNet];
        }
        

        return this.Vehicles[vehicleNet];
    }

    GetVehicleCache(vehicleNet: number) {
        return new Promise((done: (_: VehicleData) => void) => {
            if(this.Vehicles[vehicleNet]) done(this.Vehicles[vehicleNet]);
            else {
                this.VehiclesRequests[vehicleNet] = done;
                emitNet(EventName('RequestVehicleInfo'), NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet)), vehicleNet);
            }
        });
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

    GetVehicleBadFuelContent(vehicleNet: number) {
        return this.Vehicles[vehicleNet].badFuelContent;
    }
    SetVehicleBadFuelContent(vehicleNet: number, badFuelContent: number) {
        this.Vehicles[vehicleNet].badFuelContent = badFuelContent;
        this.OnVehicleFuelUpdated(vehicleNet);
    }

    SetVehicleGasPump(vehicleNet: number, fuelPump: FuelPump) {
        this.Vehicles[vehicleNet].gasPump = fuelPump;
    }

    GetVehicleMaxFuel(vehicleNet: number): number {
        const vehicleClass = this.GetVehicleFuelData(vehicleNet);
        return vehicleClass.maxFuel;
    }

    GetVehicleFuelData(vehicleNet: number) {
        const vehicleModel = GetEntityModel(NetworkGetEntityFromNetworkId(vehicleNet));
        return this.VehicleIndividualData[vehicleModel] || this.VehicleClassesData[this.Vehicles[vehicleNet].class];
    }

    IsVehicleElectic(vehicleNet) {
        const vehicleModel = GetEntityModel(NetworkGetEntityFromNetworkId(vehicleNet));
        return this.VehicleIndividualData[vehicleModel]?.isElectic || false;
    }

    GetVehicleRefillingData(vehicleNet: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if(!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        return {
            inProgress: vehicleData.refuelInterval != null,
            playerRefilling: vehicleData.playerRefilling,
            totalRefilled: vehicleData.totalRefilled,
            gasPump: vehicleData.gasPump,
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

        if(vehicleData.refuelInterval != null) { // already refilling, so interrupt it
            this.InterruptVehicleRefill(vehicleNet, true);
            return;
        }

        if(vehicleMaxFuel - vehicleFuel! < 1) {
            this.vRPClient.notify(player, '~r~Vehicle dont need to refilling.');
            return;
        }

        this.vRP.prompt(player, 'Refill', (vehicleMaxFuel - vehicleFuel!).toFixed(1), (player, value) => {
            try {
                const fuelToRefill = parseFloat(value) * 0.997;

                if(isNaN(fuelToRefill) || fuelToRefill == 0) return;
                if(fuelToRefill < 0) return this.vRPClient.notify(player, '~r~Fuel level must be more then 0.');

                vehicleData.playerRefilling = player;
                vehicleData.totalRefilled = 0;
                vehicleData.refuelInterval = setInterval(() => {
                    this.ProcessVehicleRefill(vehicleNet, fuelToRefill);
                }, 100);

            } catch(e) {
                this.vRPClient.notify(player, '~r~Wrong input.');
            }
            return;
        });

        return null;
    }

    // один тік заправки на станції
    ProcessVehicleRefill(vehicleNet: number, fuelToRefill: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuel = this.GetVehicleMaxFuel(vehicleNet);
        this.logger.Log('RefillProcess maxFuel:', vehicleMaxFuel, vehicleData.gasPump?.IsElectric());
        const rndToAdd = (Math.random()*(3-1)+1) / (vehicleData.gasPump?.IsElectric() ? 100 : 10);
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

            const { essenceMultiplier } = this.GetVehicleFuelData(+vehicleNet);
            const vehicleMaxFuel = this.GetVehicleMaxFuel(+vehicleNet);
            
            if(vehicleData.fuel > vehicleMaxFuel) {
                vehicleData.fuel = vehicleMaxFuel;
            }

            let essence = 0; // кількість топлива, яка в кінці процедури буде відмінусована
            const isEngineRunning = GetIsVehicleEngineRunning(vehicleEntity);
            if(isEngineRunning) {
                const speed = GetEntitySpeed(vehicleEntity) * 3.6;
                essence = this.GetSpeedEssence(speed); // розхід топлива розраховується на основі швидкості та таблиці конфігурації
            }
            
            essence = essence * essenceMultiplier; // мультиплікатор відносно до моделі/класу транспорту

            if(essence > 0 && (vehicleData.fuel > 0 || isEngineRunning)) {
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
        const vehicleMaxFuelLevel = this.GetVehicleMaxFuel(vehicleNet);
        const badFuelContent = this.GetVehicleBadFuelContent(vehicleNet);
        emitNet(EventName('VehicleFuelUpdated'), driverPlayer || NetworkGetEntityOwner(vehicleEntity), +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel, badFuelContent);
    }

    SetEssenceTable(table: EssenceTable) {
        this.EssenceTable = table;
    }

    SetVehiclesIndividualData(table: Record<string, VehicleConfig>) {
        this.VehicleIndividualData = Object.entries(table).reduce((acc, [modelName, data]: [string, VehicleConfig]) => {
            acc[GetHashKey(modelName)] = data;
            return acc;
        }, {});
    }

    SetVehicleClassesData(table: Record<number, VehicleConfig>) {
        this.VehicleClassesData = table;
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