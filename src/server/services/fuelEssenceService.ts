import { Logger } from '../../logger';
import { EventName } from '../../utils';
import { FuelPump } from '../models/fuelPump';
import { Hosepipe } from '../models/hosepipe';
import { FuelStationService } from './fuelStationService';
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
    valuePerUnit: number,
    fuelToRefill: number,
    playerPayMethod: null | string, // null - money, string - bankCard
    licensePlate: string,
};

type JerryCanData = {
    refuelInterval: NodeJS.Timeout | null,
    totalRefilled: number,
    playerRefilling: number | null,
    gasPump: FuelPump | null,
    content: {
        petrol: number,
        solvent: number,
    },
    valuePerUnit: number,
    fuelToRefill: number,
    itemid: string,
    playerPayMethod: null | string, // null - money, string - bankCard
}

export class FuelEssenceService {
    private readonly logger = new Logger('FuelEssenceService');
    static readonly MAX_JERRY_CAN_FUEL = 15.00;
    private Vehicles: Record<string, VehicleData> = {}; // cache. видаляє позиції, якщо транспорту більше не існує(ProcessVehiclesFuelEssence)
    private PlacedJerryCans: Record<number, JerryCanData> = {};
    private VehiclesRequests: Record<string, (...any: any[]) => void> = {};
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
    ) {
        this.queries = {
            SaveFuelForVehicle: MySQL.Command<{
                fuel: number,
                plate: string
            }>('update vrp_user_vehicles set `fuelLevel` = @fuel where `vehicle_plate` = @plate;'),
            FetchVehicleFuel: MySQL.Command<{ plate: string }, {
                fuelLevel: number
            }>('select `fuelLevel` from vrp_user_vehicles where `vehicle_plate` = @plate;'),
        };
        const AlterFuelColumn = MySQL.Command('ALTER TABLE vrp_user_vehicles ADD COLUMN fuelLevel FLOAT NOT NULL DEFAULT -1');

        this.MySQL.IsTableColumnExists('vrp_user_vehicles', 'fuelLevel').then((exists) => {
            if (!exists) AlterFuelColumn();
        });
    }

    async AddVehicleToCache(vehicleNet: number, vehicleClass: number, startFuelLevel: number) {
        if (!Object.keys(this.Vehicles).includes(vehicleNet.toString())) {
            this.logger.Log('Added new vehicle in cache', vehicleNet, vehicleClass, startFuelLevel);
            this.Vehicles[vehicleNet] = {
                fuel: startFuelLevel,
                class: vehicleClass,
                refuelInterval: null,
                totalRefilled: 0,
                playerRefilling: 0,
                badFuelContent: 0,
                gasPump: null,
                valuePerUnit: 0,
                fuelToRefill: 0,
                playerPayMethod: null,
                licensePlate: GetVehicleNumberPlateText(NetworkGetEntityFromNetworkId(vehicleNet)),
            };

            this.queries.FetchVehicleFuel({plate: GetVehicleNumberPlateText(NetworkGetEntityFromNetworkId(vehicleNet))}).then(([vehicle_row]) => {
                if (!vehicle_row) this.SetVehicleFuel(vehicleNet, Math.random() * (20 - 5) + 5);
                else {
                    if(vehicle_row.fuelLevel == -1) vehicle_row.fuelLevel = this.GetVehicleMaxFuel(vehicleNet);
                    this.SetVehicleFuel(vehicleNet, vehicle_row.fuelLevel);
                }
            });
        }

        if (this.VehiclesRequests[vehicleNet]) {
            this.VehiclesRequests[vehicleNet](this.Vehicles[vehicleNet]);
            delete this.VehiclesRequests[vehicleNet];
        }


        return this.Vehicles[vehicleNet];
    }

    AddPlacedJerryCan(jerryCanNet: number, content: { petrol?: number, solvent?: number, itemid: string }) {
        this.PlacedJerryCans[jerryCanNet] = {
            content: {
                petrol: content.petrol || 0.00,
                solvent: content.solvent || 0.00,
            },
            itemid: content.itemid,
            totalRefilled: 0,
            gasPump: null,
            playerRefilling: null,
            refuelInterval: null,
            valuePerUnit: 0,
            fuelToRefill: 0,
            playerPayMethod: null,
        };
    }

    GetPlacedJerryCan(jerryCanNet: number) {
        return this.PlacedJerryCans[jerryCanNet];
    }

    DeletePlacedJerryCan(jerryCanNet: number) {
        if (this.PlacedJerryCans[jerryCanNet].refuelInterval) {
            clearInterval(this.PlacedJerryCans[jerryCanNet].refuelInterval!);

        }
        delete this.PlacedJerryCans[jerryCanNet];
    }

    GetVehicleCache(vehicleNet: number) {
        return new Promise((done: (_: VehicleData) => void) => {
            if (this.Vehicles[vehicleNet]) done(this.Vehicles[vehicleNet]);
            else {
                this.VehiclesRequests[vehicleNet] = done;
                console.log('reqvehinfo', vehicleNet, );
                console.log('reqvehinfo2', NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet)));
                emitNet(EventName('RequestVehicleInfo'), NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet)), vehicleNet);
            }
        });
    }

    IsVehicleInMemory(vehicleNet: number) {
        return this.Vehicles[vehicleNet] != null;
    }

    SetVehicleFuel(vehicleNet: number, fuel: number): void {
        if (!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        this.Vehicles[vehicleNet].fuel = fuel;
        this.OnVehicleFuelUpdated(vehicleNet);
    }

    GetVehicleFuel(vehicleNet: number): number | null {
        if (!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
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
        return {
            ...this.VehicleClassesData[this.Vehicles[vehicleNet].class],
            ...this.VehicleIndividualData[vehicleModel],
        };
    }

    IsVehicleElectic(vehicleNet: number) {
        const vehicleModel = GetEntityModel(NetworkGetEntityFromNetworkId(vehicleNet));
        return this.VehicleIndividualData[vehicleModel]?.isElectic || false;
    }

    GetVehicleRefillingData(vehicleNet: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if (!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        return {
            inProgress: vehicleData.refuelInterval != null,
            playerRefilling: vehicleData.playerRefilling,
            totalRefilled: vehicleData.totalRefilled,
            gasPump: vehicleData.gasPump,
        };
    }

    ResetVehicleRefillingData(vehicleNet: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if (!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);

        vehicleData.playerRefilling = 0;
        vehicleData.totalRefilled = 0;
        vehicleData.valuePerUnit = 0;
        vehicleData.fuelToRefill = 0;
    }

    ResetJerryCanRefillingData(jerryCanNet: number) {
        const data = this.GetPlacedJerryCan(jerryCanNet);

        data.playerRefilling = 0;
        data.totalRefilled = 0;
        data.valuePerUnit = 0;
        data.fuelToRefill = 0;
    }

    RequestVehicleRefuel(player: number, vehicleNet: number, valuePerUnit: number, stationService: FuelStationService) {
        if (!this.IsVehicleInMemory(vehicleNet)) throw new Error(`Vehicle ${vehicleNet} is not in memory`);
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuel = this.GetVehicleMaxFuel(vehicleNet);
        const vehicleFuel = this.GetVehicleFuel(vehicleNet);

        const hosepipe = stationService.GetHosepipeFromVehicle(vehicleNet);
        if (!hosepipe) throw new Error('Vehicle was not connected to hosepipe');

        if (vehicleData.refuelInterval != null) { // already refilling, so interrupt it
            this.InterruptVehicleRefill(vehicleNet, null, true);
            return;
        }

        if (vehicleMaxFuel - vehicleFuel! < 1) {
            this.vRPClient.notify(player, '~r~Транспорту не нужна заправка.');
            return;
        }

        this.vRP.prompt(player, 'Кол-во топлива для заправки', (vehicleMaxFuel - vehicleFuel!).toFixed(1), (player, value) => {
            try {
                const fuelToRefill = parseFloat(value) * 0.997;

                if (isNaN(fuelToRefill) || fuelToRefill == 0) return;
                if (fuelToRefill < 0) return this.vRPClient.notify(player, '~r~Значение должно быть больше 0.');

                this.playerService.OpenPaymentMenu(player, valuePerUnit * fuelToRefill, hosepipe.GetPump().brandName)
                    .then(([ok, method, card]) => {
                        if (ok) {
                            vehicleData.playerPayMethod = method == 'BANK' ? card : null;
                            vehicleData.playerRefilling = player;
                            vehicleData.totalRefilled = 0;
                            vehicleData.valuePerUnit = valuePerUnit;
                            vehicleData.fuelToRefill = fuelToRefill;
                            vehicleData.refuelInterval = setInterval(() => {
                                this.ProcessVehicleRefill(vehicleNet, fuelToRefill);
                            }, 100);
                            this.vRP.closeMenu(player);
                        } else {
                            this.vRPClient.notify(player, '~r~Недостаточно денег');
                        }
                    });

            } catch (e) {
                this.vRPClient.notify(player, '~r~Неверное значение.');
            }
            return;
        });

        return null;
    }

    RequestJerryCanRefuel(player: number, hosepipe: Hosepipe, jerryCanNet: number, valuePerUnit: number) {
        if (!this.GetPlacedJerryCan(jerryCanNet)) {
            throw new Error('Cannot refuel undefined jerry can');
            // this.AddPlacedJerryCan(jerryCanNet, {petrol: 0, solvent: 0});
        }

        const {content, refuelInterval} = this.GetPlacedJerryCan(jerryCanNet);
        if (refuelInterval) {
            this.InterruptJerryCanRefill(jerryCanNet, null, true);
            return;
        }

        const totalContentValue = (content.petrol || 0) + (content.solvent || 0);
        if (totalContentValue >= FuelEssenceService.MAX_JERRY_CAN_FUEL) {
            this.vRPClient.notify(player, '~r~Канистра не нуждается в заправке.');
            return;
        }

        this.vRP.prompt(player, 'Кол-во топлива для заправки', (FuelEssenceService.MAX_JERRY_CAN_FUEL - totalContentValue).toFixed(2), (player, value) => {
            try {
                const fuelToRefill = parseFloat(value) * 0.997;
                if (isNaN(fuelToRefill) || fuelToRefill == 0) return;
                if (fuelToRefill < 0) return this.vRPClient.notify(player, '~r~Значение должно быть больше 0.');

                this.playerService.OpenPaymentMenu(player, valuePerUnit * fuelToRefill, hosepipe.GetPump().brandName).then(([ok, method, card]) => {
                    if (ok) {
                        this.PlacedJerryCans[jerryCanNet].playerPayMethod = method == 'BANK' ? card : null;
                        this.PlacedJerryCans[jerryCanNet].gasPump = hosepipe.GetPump();
                        this.PlacedJerryCans[jerryCanNet].playerRefilling = player;
                        this.PlacedJerryCans[jerryCanNet].totalRefilled = 0;
                        this.PlacedJerryCans[jerryCanNet].valuePerUnit = valuePerUnit;
                        this.PlacedJerryCans[jerryCanNet].fuelToRefill = fuelToRefill;
                        this.PlacedJerryCans[jerryCanNet].refuelInterval = setInterval(() => {
                            this.ProcessJerryCanRefill(jerryCanNet, fuelToRefill);
                        }, 100);
                        this.vRP.closeMenu(player);
                    } else {
                        this.vRPClient.notify(player, '~r~Недостаточно денег');
                    }
                });
            } catch (e) {
                this.vRPClient.notify(player, '~r~Неверное значение.');
            }

            return null;
        });
    }

    // один тік заправки на станції
    ProcessVehicleRefill(vehicleNet: number, fuelToRefill: number) {
        const vehicleData = this.Vehicles[vehicleNet];
        if (!DoesEntityExist(NetworkGetEntityFromNetworkId(vehicleNet))) {
            this.vRPClient.notify(vehicleData.playerRefilling, '~b~Что-то случилось с машиной. ~r~Заправка прервана');
            clearInterval(vehicleData.refuelInterval!);
            vehicleData.refuelInterval = null;
            this.SaveVehicleFuel(vehicleNet);
            return;
        }
        const fuelRefillSpeedMultiplier = 2.5; // TODO: move into config
        const vehicleMaxFuel = this.GetVehicleMaxFuel(vehicleNet);
        // this.logger.Log('RefillProcess maxFuel:', vehicleMaxFuel, vehicleData.gasPump!.IsElectric());
        const rndToAdd = (Math.random() * (3 - 1) + 1) / (vehicleData.gasPump?.IsElectric() ? 100 : (10 * fuelRefillSpeedMultiplier));
        // this.logger.Log('RefillProcess', `${vehicleData.fuel} + ${rndToAdd} > ${vehicleMaxFuel}`);

        if (vehicleData.fuel + rndToAdd > vehicleMaxFuel) { // next fuel value bigger then max vehicle fuel
            this.InterruptVehicleRefill(vehicleNet, `~b~Транспорт заправлен на ${vehicleData.totalRefilled.toFixed(1)}l. ~r~Больше не поместилось.`, true);
        } else if (vehicleData.totalRefilled + rndToAdd > fuelToRefill) { // next fuel value bigger then need to refill
            vehicleData.fuel += fuelToRefill - vehicleData.totalRefilled;
            vehicleData.totalRefilled += fuelToRefill - vehicleData.totalRefilled;
            if (vehicleData.refuelInterval) {
                this.vRPClient.notify(vehicleData.playerRefilling, `~b~Транспорт заправлен на ${fuelToRefill}l.`);
                clearInterval(vehicleData.refuelInterval);
                vehicleData.refuelInterval = null;
                this.SaveVehicleFuel(vehicleNet);
            }
        } else {
            vehicleData.fuel += rndToAdd;
            vehicleData.totalRefilled += rndToAdd;
        }
        // this.logger.Log('RefillProcess', vehicleData.fuel.toFixed(1), vehicleData.totalRefilled.toFixed(1));
    }

    ProcessJerryCanRefill(jerryCanNet: number, fuelToRefill: number) {
        const {playerRefilling, refuelInterval, content, totalRefilled} = this.PlacedJerryCans[jerryCanNet];
        const jerryCanMaxFit = FuelEssenceService.MAX_JERRY_CAN_FUEL;

        if (!playerRefilling) throw new Error('player refilling is null');
        if (!refuelInterval) return;

        if (!DoesEntityExist(NetworkGetEntityFromNetworkId(jerryCanNet))) {
            this.vRPClient.notify(playerRefilling, '~b~Что-то случилось с канистрой. ~r~Заправка прервана');
            clearInterval(refuelInterval);
            this.PlacedJerryCans[jerryCanNet].refuelInterval = null;
            return;
        }

        const rndToAdd = (Math.random() * (3 - 1) + 1) / 30;
        // this.logger.Log('RefillProcess', `${content.petrol} + ${rndToAdd} > ${jerryCanMaxFit}`);

        if (content.petrol + rndToAdd > jerryCanMaxFit) {
            this.InterruptJerryCanRefill(jerryCanNet, `~b~Канистра заправлена на ${totalRefilled.toFixed(1)}l. ~r~Больше не поместилось.`, true);
        } else if (totalRefilled + rndToAdd > fuelToRefill) {// next fuel value bigger then need to refill
            content.petrol += fuelToRefill - totalRefilled;
            this.PlacedJerryCans[jerryCanNet].totalRefilled += fuelToRefill - totalRefilled;
            if (refuelInterval) {
                this.vRPClient.notify(playerRefilling, `~b~Канистра заправлена на ${fuelToRefill}l.`);
                clearInterval(refuelInterval);
                this.PlacedJerryCans[jerryCanNet].refuelInterval = null;
            }
        } else {
            content.petrol += rndToAdd;
            this.PlacedJerryCans[jerryCanNet].totalRefilled += rndToAdd;
        }

        if (this.GetPlacedJerryCan(jerryCanNet)) {
            this.GetPlacedJerryCan(jerryCanNet)!.content.petrol = content.petrol;
        }
        // this.logger.Log('RefillProcess', content.petrol.toFixed(1), totalRefilled.toFixed(1));
    }

    async InterruptVehicleRefill(vehicleNet: number, message: string | null, refundMoney: boolean) {
        const vehicleData = this.Vehicles[vehicleNet];
        if (vehicleData.refuelInterval) {
            clearInterval(vehicleData.refuelInterval);
            vehicleData.refuelInterval = null;
            this.vRPClient.notify(vehicleData.playerRefilling, message || `~b~Заправка прервана. Заправлено на ${vehicleData.totalRefilled.toFixed(1)}l.`);
            this.SaveVehicleFuel(vehicleNet);
        }

        if (refundMoney && (vehicleData.fuelToRefill - vehicleData.totalRefilled) > 0.1) {
            const refundMoney = +((vehicleData.fuelToRefill - vehicleData.totalRefilled) * vehicleData.valuePerUnit).toFixed(2);
            const userid = await this.vRP.getUserId(vehicleData.playerRefilling);
            if (vehicleData.playerPayMethod == null) {
                this.vRP.giveMoney(userid, refundMoney);
            } else {
                this.playerService.CreateLynxPayment(userid, refundMoney, vehicleData.gasPump?.brandName || 'Возврат');
            }
        }
    }

    async InterruptJerryCanRefill(jerryCanNet: number, message: string | null, refundMoney: boolean) {
        const data = this.PlacedJerryCans[jerryCanNet];
        if (data.refuelInterval) {
            clearInterval(data.refuelInterval);
            data.refuelInterval = null;
            this.vRPClient.notify(data.playerRefilling!, message || `~b~Заправка прервана. Заправлено на ${data.totalRefilled.toFixed(1)}l.`);
        }
        if (refundMoney && (data.fuelToRefill - data.totalRefilled) > 0.1) {
            const refundMoney = +((data.fuelToRefill - data.totalRefilled) * data.valuePerUnit).toFixed(2);
            const userid = await this.vRP.getUserId(data.playerRefilling!);
            if (data.playerPayMethod == null) {
                this.vRP.giveMoney(userid, refundMoney);
            } else {
                this.playerService.CreateLynxPayment(userid, refundMoney, data.gasPump?.brandName || 'Возврат');
            }
        }
    }

    async ProcessVehiclesFuelEssence() {
        for (const [vehicleNet, vehicleData] of Object.entries(this.Vehicles)) {
            if (vehicleData == null) continue;

            const vehicleEntity = NetworkGetEntityFromNetworkId(+vehicleNet);
            if (!DoesEntityExist(vehicleEntity)) {
                await this.SaveVehicleFuel(+vehicleNet);
                delete this.Vehicles[vehicleNet];
                this.logger.Warn(`Vehicle ${vehicleNet} no longer exists`);
                continue;
            }

            const {essenceMultiplier} = this.GetVehicleFuelData(+vehicleNet);
            const vehicleMaxFuel = this.GetVehicleMaxFuel(+vehicleNet);

            if (vehicleData.fuel > vehicleMaxFuel) {
                vehicleData.fuel = vehicleMaxFuel;
            }

            let essence = 0; // кількість топлива, яка в кінці процедури буде відмінусована
            const isEngineRunning = GetIsVehicleEngineRunning(vehicleEntity);
            if (isEngineRunning) {
                const speed = GetEntitySpeed(vehicleEntity) * 3.6;
                essence = this.GetSpeedEssence(speed); // розхід топлива розраховується на основі швидкості та таблиці конфігурації
            }

            essence = essence * essenceMultiplier; // мультиплікатор відносно до моделі/класу транспорту

            if (essence > 0 && (vehicleData.fuel > 0 || isEngineRunning)) {
                vehicleData.fuel -= essence;
                if (vehicleData.fuel < 0) vehicleData.fuel = 0;

                // this.logger.Warn('EssenceProcess', vehicleData.fuel.toFixed(1), `essence: ${GetEntitySpeed(vehicleEntity) * 3.6} ->`, essence);

                const driver = GetPedInVehicleSeat(vehicleEntity, -1);
                const driverPlayer = driver && this.playerService.GetPlayerByPed(driver);
                // const vehicleMaxFuelLevel = this.GetVehicleMaxFuel(+vehicleNet);
                if (driver && driverPlayer) {
                    // emitNet(EventName('VehicleFuelUpdated'), driverPlayer, +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel);
                    this.OnVehicleFuelUpdated(+vehicleNet, driverPlayer);
                } else if (vehicleData.fuel == 0) {
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
        if(driverPlayer == null && !NetworkGetEntityOwner(vehicleEntity)) return;
        const vehicleData = this.Vehicles[vehicleNet];
        const vehicleMaxFuelLevel = this.GetVehicleMaxFuel(vehicleNet);
        const badFuelContent = this.GetVehicleBadFuelContent(vehicleNet);
        emitNet(EventName('VehicleFuelUpdated'), driverPlayer || NetworkGetEntityOwner(vehicleEntity), +vehicleNet, vehicleData.fuel, vehicleMaxFuelLevel, badFuelContent);
    }

    SetEssenceTable(table: EssenceTable) {
        this.EssenceTable = table;
    }

    SetVehiclesIndividualData(table: Record<string, VehicleConfig>) {
        this.VehicleIndividualData = Object.entries(table).reduce<Record<string, VehicleConfig>>((acc, [modelName, data]: [string, VehicleConfig]) => {
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

        for (const [key, value] of Object.entries(this.EssenceTable)) {
            if (speed >= +key) essence = value;
        }

        return essence;
    }

    async SaveVehicleFuel(vehicleNet: number) {
        const vehicleData = await this.GetVehicleCache(vehicleNet);
        if(vehicleData) {
            const fuel = this.GetVehicleFuel(vehicleNet)!;
            this.logger.Log('Save vehicle fuel', vehicleNet, vehicleData.licensePlate, `${fuel}L`);
            await this.queries.SaveFuelForVehicle({ fuel, plate: vehicleData.licensePlate });
        }
    }
}