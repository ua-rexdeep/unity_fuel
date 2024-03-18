import { Logger } from '../../logger';
import { EventName, vDist, Vector3 } from '../../utils';
import { AircraftService } from '../services/aircraftService';
import { FuelEssenceService } from '../services/fuelEssenceService';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';

export class FuelStationHandler {
    private readonly logger = new Logger('FuelStationHandler');

    constructor(
        private readonly vRP: vRPServerFunctions,
        private readonly vRPClient: vRPClientFunctions,
        private readonly service: FuelStationService,
        private readonly essenceService: FuelEssenceService,
        private readonly playerService: PlayerService,
        private readonly aircraftService: AircraftService,
    ) {
        onNet(EventName('PlayerUseFuelPump'), this.OnPlayerUseFuelPump.bind(this));
        onNet(EventName('NozzleCreated'), this.OnNozzleCreated.bind(this));
        onNet(EventName('PickupNozzle'), this.OnPickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoVehicle'), this.OnInsertNozzleIntoVehicle.bind(this));
        onNet(EventName('InsertNozzleIntoJerryCan'), this.InsertNozzleIntoJerryCan.bind(this));
        onNet(EventName('SendVehicleInfo'), this.SendVehicleInfo.bind(this));
        onNet(EventName('PlayerInteractWithGasWorker'), this.OnPlayerInteractGasWorker.bind(this));
        onNet(EventName('PlayerInteractWithAirHostess'), this.PlayerInteractWithAirHostess.bind(this));
        onNet(EventName('RequestDetachNozzle'), this.RequestDetachNozzle.bind(this));
        onNet(EventName('PlayerEnterVehicle'), this.OnPlayerEnterVehicle.bind(this));

        onNet('proptInt:OnPlayerRegisterObject', this.OnPlayerRegisterObject.bind(this));
        onNet(EventName('DEVSetFuelLevel'), this.DEVSetFuelLevel.bind(this));
        onNet(EventName('UpdatePlayerJerryCanData'), this.UpdatePlayerJerryCanData.bind(this));
        onNet(EventName('UpdatePlayerVehicleRefillJerryCan'), this.UpdatePlayerVehicleRefillJerryCan.bind(this));
        on('vRP:playerSpawn', this.playerSpawn.bind(this));
        onNet('propInt:onPropPickup', this.OnPropPickup.bind(this));
        onNet('propInt:OnPlayerPlaceJerryCan', this.OnPlayerPlaceJerryCan.bind(this));
        onNet(EventName('GetPumpNumberById'), this.GetPumpNumberById.bind(this));
        onNet(EventName('ConnectFuelTruckToAircraft'), this.ConnectFuelTruckToAircraft.bind(this));
        onNet(EventName('ToggleFuelTruckRefuel'), this.ToggleFuelTruckRefuel.bind(this));

        on(EventName('Config'), this.OnConfigReceived.bind(this));

        if (process.env.NODE_ENV == 'development') {
            process.on('warning', (e) => console.warn(e.stack)); // memory leak trace
        }
    }

    private DEVSetFuelLevel(vehicleNet: number, fuel: number) {
        console.log('DEVSetFuelLevel', vehicleNet, fuel);
        this.essenceService.SetVehicleFuel(vehicleNet, fuel);
    }

    private ACTION_ID = 0;

    private async OnPlayerUseFuelPump(pumpId: string, hosepipeIndex: number, pumpNetId: number, slotWorldCoords: VectorArray, viewDisplayWorldCoords: VectorArray) {
        this.ACTION_ID++;
        new Logger('Handler -> PlayerUserFuelPump', pumpId, `S(${this.ACTION_ID})`);

        const source = global.source;

        const nearestStation = this.service.GetPlayerNearestStation(source);
        const pumpData = nearestStation?.GetPumpById(pumpId);
        const isAdmin = await this.playerService.IsPlayerAdmin(source);

        if (nearestStation && pumpData) {

            pumpData.SetPumpNetId(pumpNetId);

            if (pumpData.GetBusy()) return this.playerService.Notification(source, '~r~Попробуйте ещё раз');
            pumpData.SetBusy(this.ACTION_ID);
            void pumpData.PlayerUsePump(source, hosepipeIndex, Vector3.fromArray(slotWorldCoords), Vector3.fromArray(viewDisplayWorldCoords));
        } else {
            if (isAdmin) {

                if (!nearestStation) return this.playerService.Notification(source, '~r~[A] Нужно установить станцию');

                this.service.InstallPumpForStation(pumpId, nearestStation.id, pumpNetId);
                this.playerService.Notification(source, `~b~Колонка(${pumpId}) установлена для станции(${nearestStation.id})`);

            } else return this.playerService.Notification(source, '~r~Колонка не работает');
        }
    }

    private async OnNozzleCreated(pumpEntity: number, pumpId: string, nozzleId: number, pumpSlotEntity: number, hosepipeIndex: number, ropeAttachements: RopeAttachements) {
        const logger = new Logger('Handler -> OnNozzleCreated', pumpId, `S(${this.ACTION_ID})`);
        const source = global.source;
        this.ACTION_ID++;
        this.service.SetHosepipeTakenData(source, pumpId, nozzleId, pumpSlotEntity, hosepipeIndex);

        const hosepipe = this.service.GetHosepipeFromNozzle(nozzleId);
        if (!hosepipe) throw new Error('hosepipe is null');
        hosepipe.ropeAttachements = ropeAttachements;
        this.playerService.OnPlayerHoldsNozzle(source, nozzleId);
    }

    private async OnPickupNozzle(entityNet: number) {
        this.ACTION_ID++;

        if (this.service.GetHosepipeIsPlayerHold(global.source)) {
            return this.playerService.Notification(source, '~r~Вы уже держите пистолет');
        }

        const hosepipe = this.service.GetHosepipeFromNozzle(entityNet);
        if (!hosepipe) throw new Error('hosepipe is null');

        if (hosepipe.GetVehicle()) {
            if (this.essenceService.IsVehicleElectic(hosepipe.GetVehicle()!) && GetVehicleDoorLockStatus(hosepipe.GetVehicleLocalId()!)) {
                return this.playerService.Notification(source, '~r~Транспорт закрыт');

            }
        }

        emitNet(EventName('PickupNozzle'), global.source, entityNet);

        if (!hosepipe) throw new Error('Hosepipe is null');
        if (hosepipe.GetVehicle()) {
            const refilling = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);
            if (refilling.inProgress) this.essenceService.InterruptVehicleRefill(hosepipe.GetVehicle()!, null, true);
            this.essenceService.ResetVehicleRefillingData(hosepipe.GetVehicle()!);
        }
        if (hosepipe.GetJerryCan()) {
            const jerryCanData = this.essenceService.GetPlacedJerryCan(hosepipe.GetJerryCan()!);
            if (jerryCanData.refuelInterval) this.essenceService.InterruptJerryCanRefill(hosepipe.GetJerryCan()!, null, true);
            this.essenceService.ResetJerryCanRefillingData(hosepipe.GetJerryCan()!);
        }

        hosepipe.SetPlayer(source);
        this.playerService.OnPlayerHoldsNozzle(global.source, entityNet);
    }

    private async OnInsertNozzleIntoVehicle(vehicleNet: number, fuelCupOffset: { x: number, y: number, z: number }) {
        this.ACTION_ID++;
        const source = global.source;
        const hosepipe = this.service.GetHosepipeIsPlayerHold(source);
        if (!hosepipe) throw new Error('No hosepipe', {cause: {player: source}});
        if (!hosepipe.GetNozzleNetId()) throw new Error('No nozzle entity for hosepipe', {
            cause: {
                player: source,
                hosepipe
            }
        });
        if (vehicleNet == 0) throw new Error(`Vehicle ${vehicleNet} is not networked`);

        if (this.service.GetHosepipeFromVehicle(vehicleNet)) {
            return this.playerService.Notification(source, '~r~В транспорт уже вставлен пистолет');
        }

        await this.essenceService.GetVehicleCache(vehicleNet);

        if (this.essenceService.IsVehicleElectic(vehicleNet) != hosepipe.GetPump().IsElectric()) {
            this.playerService.Notification(source, '~r~Неправильный пистолет');
            return;
        }

        hosepipe.SetVehicle(vehicleNet);
        this.essenceService.SetVehicleGasPump(vehicleNet, hosepipe.GetPump());
        this.playerService.SetPlayerLastVehicle(source, vehicleNet);
        this.playerService.OnPlayerDropNozzle(source);

        const vehicleOwner = NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet));
        if (vehicleOwner != source) {
            emitNet(EventName('RequestDetachNozzle'), source, hosepipe.GetNozzleNetId());
            emitNet(EventName('InsertNozzleIntoEntity'), vehicleOwner, hosepipe.GetNozzleNetId(), vehicleNet, fuelCupOffset);
        } else {
            emitNet(EventName('InsertNozzleIntoEntity'), source, hosepipe.GetNozzleNetId(), vehicleNet, fuelCupOffset);
        }
    }

    private async InsertNozzleIntoJerryCan(jerryCanNet: number) {
        this.ACTION_ID++;
        const source = global.source;
        const hosepipe = this.service.GetHosepipeIsPlayerHold(source);
        if (!hosepipe) throw new Error('No hosepipe', {cause: {player: source}});
        if (!hosepipe.GetNozzleNetId()) throw new Error('No nozzle entity for hosepipe', {
            cause: {
                player: source,
                hosepipe
            }
        });
        if (this.service.GetHosepipeFromJerryCan(jerryCanNet)) {
            return this.playerService.Notification(source, '~r~В канистру уже вставлен пистолет');
        }

        if (hosepipe.GetPump().IsElectric()) {
            return this.playerService.Notification(source, '~r~Нельзя вставить этот пистолет в канистру');
        }

        if (!this.essenceService.GetPlacedJerryCan(jerryCanNet)) {
            throw new Error('cannot insert nozzle into undefined jerry can');
            // this.essenceService.AddPlacedJerryCan(jerryCanNet, {petrol: 0, solvent: 0});
        }

        hosepipe.SetJerryCan(jerryCanNet);
        this.playerService.OnPlayerDropNozzle(source);
        emitNet(EventName('InsertNozzleIntoEntity'), source, hosepipe.GetNozzleNetId(), jerryCanNet, new Vector3(0.27, 0.03, 0.467).toObject());
    }

    private async OnPlayerRegisterObject(propNetId: number, model: string, isAmbient: boolean, rID: number) {
        this.ACTION_ID++;
        this.service.ClientObjectCreated(global.source, propNetId, model, rID);
    }

    private async SendVehicleInfo(vehicleNet: number, vehicleClass: number, startFuelLevel: number) {
        this.ACTION_ID++;
        console.log('SendVehicleInfo', 'received', vehicleNet);
        this.essenceService.AddVehicleToCache(vehicleNet, vehicleClass, startFuelLevel);
    }

    private async OnPlayerEnterVehicle(vehicleNet: number) {
        const source = global.source;
        const vehicleData = await this.essenceService.GetVehicleCache(vehicleNet);
        this.essenceService.OnVehicleFuelUpdated(vehicleNet, source);
    }

    private async OnPlayerInteractGasWorker() {
        this.ACTION_ID++;
        this.service.OpenWorkerInteractMenu(global.source, this.playerService.GetPlayerLastVehicle(global.source));
    }

    private OnConfigReceived(config: ServerConfig) {
        this.ACTION_ID++;
        this.essenceService.SetEssenceTable(config.EssenceTable);
        this.essenceService.SetVehicleClassesData(config.VehicleClassesData);
        this.essenceService.SetVehiclesIndividualData(config.IndividualVehicleData);
        this.service.SetReplacePumpConfig(config.PumpsReplaceData);

        const [firstPlayer] = this.playerService.GetPlayers();
        if (firstPlayer) this.service.CreateElectricPumpProps(firstPlayer, config.ElecticPumpSpawnLocations);
    }

    private async RequestDetachNozzle(nozzleNet: number) {
        this.ACTION_ID++;
        const entityId = NetworkGetEntityFromNetworkId(nozzleNet);
        if (entityId == 0) throw new Error(`Entity(${nozzleNet}) not exists`);
        emitNet(EventName('RequestDetachNozzle'), NetworkGetEntityOwner(entityId), nozzleNet);
    }

    private async UpdatePlayerJerryCanData(data: { petrol?: number, solvent?: number }) {
        this.playerService.UpdatePlayerDataTable(global.source, {
            jerryCanWeaponData: data,
        });
    }

    private async UpdatePlayerVehicleRefillJerryCan(vehicleNet: number, data: { petrol: number, solvent: number }) {
        await this.essenceService.GetVehicleCache(vehicleNet);
        if (data.petrol) {
            this.essenceService.SetVehicleFuel(vehicleNet, this.essenceService.GetVehicleFuel(vehicleNet)! + data.petrol);
        }
        if (data.solvent) {
            this.essenceService.SetVehicleBadFuelContent(vehicleNet, this.essenceService.GetVehicleBadFuelContent(vehicleNet) + data.solvent);
        }
        this.essenceService.SaveVehicleFuel(vehicleNet);
    }

    private async playerSpawn(_: void, player: number) {
        this.logger.Log('playerSpawn', player);
        this.service.CreateElectricPumpProps(player);
    }

    private async OnPropPickup(entityNet: number) {
        const player = global.source;
        const hosepipe = this.service.GetHosepipeFromJerryCan(entityNet);
        if (hosepipe) {
            emitNet(EventName('DropPlayerNozzle'), player, hosepipe.GetNozzleNetId());
            hosepipe.SetDropped();
        }

        const jerryCanData = this.essenceService.GetPlacedJerryCan(entityNet);
        console.log('OnPropPickup', entityNet, jerryCanData);
        if (jerryCanData) {
            this.playerService.UpdatePlayerDataTable(player, {
                jerryCanWeaponData: {
                    ...jerryCanData.content,
                    itemid: jerryCanData.itemid,
                },
            });
            this.essenceService.DeletePlacedJerryCan(entityNet);
        }
    }

    private async OnPlayerPlaceJerryCan(entityNet: number) {
        const player = global.source;
        console.log('OnPlayerPlaceJerryCan', player, entityNet);
        const {jerryCanWeaponData} = await this.playerService.GetPlayerDataTable(player);
        if (!jerryCanWeaponData) throw new Error('cant place undefined jerry can');
        else this.essenceService.AddPlacedJerryCan(entityNet, jerryCanWeaponData);

        void this.playerService.UpdatePlayerDataTable(player, {
            jerryCanWeaponData: null,
        });
    }

    private GetPumpNumberById(pumpId: string) {
        const station = this.service.GetPumpStation(pumpId);
        if (!station) return;
        const pump = station.GetPumpById(pumpId);
        if (!pump) return;
        console.log('GetPumpNumberById', pumpId);
        emitNet(EventName('ReturnPumpNumber'), global.source, pumpId, pump.GetPumpNumber());
    }

    private PlayerInteractWithAirHostess() {
        void this.aircraftService.OpenAirHostessInteractMenu(global.source);
    }

    private async ConnectFuelTruckToAircraft(fuelTruckNet: number, offset: { x: number, y: number, z: number }) {
        const player = global.source;
        const rentData = this.aircraftService.GetFuelTruckRefuelData(fuelTruckNet);
        if (!rentData) throw new Error('No rent data for fuel truck');
        if (rentData.connectedToAircraft) {
            this.aircraftService.DisconnectFuelTruck(player, fuelTruckNet);
        } else {
            const fuelTruckLocal = NetworkGetEntityFromNetworkId(fuelTruckNet);
            const [fx, fy, fz] = GetEntityCoords(fuelTruckLocal);
            let aircraft: number | undefined;
            for (const vehicle of GetAllVehicles()) {
                const [vx, vy, vz] = GetEntityCoords(vehicle);
                const vehicleNet = NetworkGetNetworkIdFromEntity(vehicle);
                if (vDist(fx, fy, fz, vx, vy, vz) <= 50.0) {
                    if (this.essenceService.IsVehicleInMemory(vehicleNet)) { // to not store in cache ALL vehi
                        const cache = await this.essenceService.GetVehicleCache(vehicleNet);
                        if (cache.class == 15) { // only aircraft
                            aircraft = vehicle;
                            break;
                        }
                    }
                }
            }

            if (!aircraft) return this.playerService.Notification(player, '~r~Поблизости нет вертолетов/самолётов.');
            void this.aircraftService.ConnectFuelTruckToAircraft(player, fuelTruckNet, NetworkGetNetworkIdFromEntity(aircraft), offset);
        }
    }

    private ToggleFuelTruckRefuel(truckNet: number) {
        this.aircraftService.ToggleFuelTruckRefuel(global.source, truckNet);
    }
}