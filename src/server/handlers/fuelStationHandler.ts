import { Logger } from '../../logger';
import { EventName, Vector3 } from '../../utils';
import { FuelEssenceService } from '../services/fuelEssenceService';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';

export class FuelStationHandler {
    private readonly logger = new Logger('FuelStationHandler');
    private isElectricStationsSpawnLocked = false;
    constructor(
        private readonly service: FuelStationService,
        private readonly essenceService: FuelEssenceService,
        private readonly playerService: PlayerService) {
        onNet(EventName('PlayerUseFuelPump'), this.OnPlayerUseFuelPump.bind(this));
        onNet(EventName('NozzleCreated'), this.OnNozzleCreated.bind(this));
        onNet(EventName('PickupNozzle'), this.OnPickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoVehicle'), this.OnInsertNozzleIntoVehicle.bind(this));
        onNet(EventName('SendVehicleInfo'), this.SendVehicleInfo.bind(this));
        onNet(EventName('PlayerInteractWithGasWorker'), this.OnPlayerInteractGasWorker.bind(this));
        onNet(EventName('RequestDetachNozzle'), this.RequestDetachNozzle.bind(this));
        onNet(EventName('PlayerEnterVehicle'), this.OnPlayerEnterVehicle.bind(this));

        onNet('proptInt:OnPlayerRegisterObject', this.OnPlayerRegisterObject.bind(this));
        onNet(EventName('DEVSetFuelLevel'), this.DEVSetFuelLevel.bind(this));
        onNet(EventName('UpdatePlayerJerryCanData'), this.UpdatePlayerJerryCanData.bind(this));
        onNet(EventName('UpdatePlayerVehicleRefillJerryCan'), this.UpdatePlayerVehicleRefillJerryCan.bind(this));
        on('vRP:playerJoin', this.OnPlayerJoin.bind(this));

        on(EventName('Config'), this.OnConfigReceived.bind(this));

        if(process.env.NODE_ENV == 'development') {
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
        const logger = new Logger('Handler -> PlayerUserFuelPump', pumpId, `S(${this.ACTION_ID})`);

        const source = global.source;

        const nearestStation = this.service.GetPlayerNearestStation(source);
        const pumpData = nearestStation?.GetPumpById(pumpId);
        const isAdmin = await this.playerService.IsPlayerAdmin(source);

        if(nearestStation && pumpData) {

            hosepipeIndex--;
            
            let hosepipe = pumpData.GetHosepipe(hosepipeIndex);
            if(!hosepipe) hosepipe = await pumpData.CreateHosepipe(hosepipeIndex, Vector3.fromArray(slotWorldCoords), Vector3.fromArray(viewDisplayWorldCoords));
            logger.Log('Hosepipe', hosepipe ? 'exists' : 'notexists');

            // return this.playerService.Notification(source, '~r~Refuel in progress'); TODO:
            if(hosepipe.GetVehicle() || (hosepipe.GetPlayer() != null && hosepipe.GetPlayer() != source)) return this.playerService.Notification(source, '~r~Hosepipe not installed into pump');
            if(pumpData.GetBusy()) return this.playerService.Notification(source, '~r~Try one more time');

            pumpData.SetBusy(this.ACTION_ID);
            if(hosepipe.GetPlayer() == source) {                
                hosepipe.DeleteNozzle();
                this.playerService.OnPlayerDropNozzle(source);
                pumpData.UpdatePumpModelBySlot(hosepipeIndex);
                
                pumpData.SetBusy(false);
            } else {
                const playerHosepipe = this.service.GetHosepipeIsPlayerHold(source);
                if(hosepipe.IsBroken()) {
                    pumpData.SetBusy(false);
                    return this.playerService.Notification(source, '~r~Hosepipe broken. Try another');
                }
                if(playerHosepipe) {
                    pumpData.SetBusy(false);
                    return this.playerService.Notification(source, '~r~You are already hold another hosepipe');
                }
                
                this.service.GiveNozzleToPlayer(pumpId, hosepipeIndex, source, pumpNetId);
            }
        } else {
            if(isAdmin) {

                if(!nearestStation) return this.playerService.Notification(source, '~r~[A] You need to setup fuel station first');

                this.service.InstallPumpForStation(pumpId, nearestStation.id, pumpNetId);
                this.playerService.Notification(source, `~b~Fuel pump(${pumpId}) installed for station(${nearestStation.id})`);

            } else return this.playerService.Notification(source, '~r~Fuel pump is not working yet');
        }
    }

    private async OnNozzleCreated(pumpEntity: number, pumpId: string, nozzleId: number, pumpSlotEntity: number, hosepipeIndex: number, ropeAttachements: RopeAttachements) {
        const logger = new Logger('Handler -> OnNozzleCreated', pumpId, `S(${this.ACTION_ID})`);
        const source = global.source;
        this.ACTION_ID++;
        this.service.SetHosepipeTakenData(source, pumpId, nozzleId, pumpSlotEntity, hosepipeIndex);

        this.playerService.CreateRopeWithAttachments(-1, ropeAttachements);
        this.playerService.OnPlayerHoldsNozzle(source, nozzleId);
    }

    private async OnPickupNozzle(entityNet: number) {
        this.ACTION_ID++;

        if(this.service.GetHosepipeIsPlayerHold(global.source)) {
            return this.playerService.Notification(source, '~r~You are already hold another hosepipe');
        }

        emitNet(EventName('PickupNozzle'), global.source, entityNet);

        const hosepipe = this.service.GetHosepipeFromNozzle(entityNet);
        if(!hosepipe) throw new Error('Hosepipe is null');
        if(hosepipe.GetVehicle()) {
            const refilling = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);
            if(refilling.inProgress) this.essenceService.InterruptVehicleRefill(hosepipe.GetVehicle()!, true);
            this.essenceService.ResetVehicleRefillingData(hosepipe.GetVehicle()!);
        }

        hosepipe.SetPlayer(source);
        this.playerService.OnPlayerHoldsNozzle(global.source, entityNet);
    }

    private async OnInsertNozzleIntoVehicle(vehicleNet: number, fuelCupOffset) {
        this.ACTION_ID++;
        const source = global.source;
        const hosepipe = this.service.GetHosepipeIsPlayerHold(source);
        if(!hosepipe) throw new Error('No hosepipe', { cause: { player: source } });
        if(!hosepipe.GetNozzleNetId()) throw new Error('No nozzle entity for hosepipe', { cause: { player: source, hosepipe } });
        if(vehicleNet == 0) throw new Error(`Vehicle ${vehicleNet} is not networked`);

        if(this.service.GetHosepipeFromVehicle(vehicleNet)) {
            return this.playerService.Notification(source, '~r~Some hosepipe already in vehicle');
        }

        await this.essenceService.GetVehicleCache(vehicleNet);
        
        if(this.essenceService.IsVehicleElectic(vehicleNet) != hosepipe.GetPump().IsElectric()) {
            this.playerService.Notification(source, '~r~Invalid plug slot.');
            return;
        }

        hosepipe.SetVehicle(vehicleNet);
        this.essenceService.SetVehicleGasPump(vehicleNet, hosepipe.GetPump());
        this.playerService.SetPlayerLastVehicle(source, vehicleNet);
        this.playerService.OnPlayerDropNozzle(source);

        const vehicleOwner = NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet));
        if(vehicleOwner != source) {
            emitNet(EventName('RequestDetachNozzle'), source, hosepipe.GetNozzleNetId());
            emitNet(EventName('InsertNozzleIntoVehicle'), vehicleOwner, hosepipe.GetNozzleNetId(), vehicleNet, fuelCupOffset);
        } else {
            emitNet(EventName('InsertNozzleIntoVehicle'), source, hosepipe.GetNozzleNetId(), vehicleNet, fuelCupOffset);
        }
    }

    private async OnPlayerRegisterObject(propNetId, model, isAmbient, rID) {
        this.ACTION_ID++;
        console.log(`OnPlayerRegisterObject(${propNetId}, ${model}, ${rID})`);
        this.service.ClientObjectCreated(global.source, propNetId, model, rID);
    }
    
    private async SendVehicleInfo(vehicleNet, vehicleClass, startFuelLevel) {
        this.ACTION_ID++;
        console.log('SendVehicleInfo', 'received', vehicleNet);
        this.essenceService.AddVehicleToCache(vehicleNet, vehicleClass, startFuelLevel);
    }

    private async OnPlayerEnterVehicle(vehicleNet) {
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
    }

    private async RequestDetachNozzle(nozzleNet: number){
        this.ACTION_ID++;
        const entityId = NetworkGetEntityFromNetworkId(nozzleNet);
        if(entityId == 0) throw new Error(`Entity(${nozzleNet}) not exists`);
        emitNet(EventName('RequestDetachNozzle'), NetworkGetEntityOwner(entityId), nozzleNet);
    }

    private async UpdatePlayerJerryCanData(data: { petrol?: number, solvent?: number }) {
        this.playerService.UpdatePlayerDataTable(global.source, {
            jerryCanWeaponData: data,
        });
    }

    private async UpdatePlayerVehicleRefillJerryCan(vehicleNet: number, data: { petrol: number, solvent: number }) {
        await this.essenceService.GetVehicleCache(vehicleNet);
        if(data.petrol) {
            this.essenceService.SetVehicleFuel(vehicleNet, this.essenceService.GetVehicleFuel(vehicleNet)! + data.petrol);
        }
        if(data.solvent) {
            this.essenceService.SetVehicleBadFuelContent(vehicleNet, this.essenceService.GetVehicleBadFuelContent(vehicleNet) + data.solvent);
        }
    }

    private async OnPlayerJoin(_: void, player: number) {
        this.logger.Log('OnPlayerJoin', player);
        if(!this.isElectricStationsSpawnLocked) {
            this.isElectricStationsSpawnLocked = true;
            this.service.CreateElecticStations(player);
        }
    }
}