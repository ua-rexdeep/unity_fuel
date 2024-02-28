import { Logger } from '../../logger';
import { EventName, Vector3 } from '../../utils';
import { FuelEssenceService } from '../services/fuelEssenceService';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';

export class FuelStationHandler {
    constructor(
        private readonly service: FuelStationService,
        private readonly essenceService: FuelEssenceService,
        private readonly playerService: PlayerService) {
        onNet(EventName('PlayerUseFuelPump'), this.OnPlayerUseFuelPump.bind(this));
        onNet(EventName('NozzleCreated'), this.OnNozzleCreated.bind(this));
        onNet(EventName('PickupNozzle'), this.OnPickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoVehicle'), this.OnInsertNozzleIntoVehicle.bind(this));
        onNet(EventName('PlayerEnterVehicle'), this.PlayerEnterVehicle.bind(this));
        onNet(EventName('RefuelVehicle'), this.RefuelVehicle.bind(this));
        onNet(EventName('RequestDetachNozzle'), this.RequestDetachNozzle.bind(this));

        onNet('proptInt:OnPlayerRegisterObject', this.OnPlayerRegisterObject.bind(this));
        onNet(EventName('DEVSetFuelLevel'), this.DEVSetFuelLevel.bind(this));

        on(EventName('Config'), this.OnConfigReceived.bind(this));

        if(process.env.NODE_ENV == 'development') {
            process.on('warning', (e) => console.warn(e.stack)); // memory leak trace
        }
    }

    private DEVSetFuelLevel(vehicleNet: number, fuel: number) {
        this.essenceService.SetVehicleFuel(vehicleNet, fuel);
    }

    private ACTION_ID = 0;
    private async OnPlayerUseFuelPump(pumpId: string, hosepipeIndex: number, pumpNetId: number, slotWorldCoords: number[], viewDisplayWorldCoords: VectorArray) {
        this.ACTION_ID++;
        const logger = new Logger('Handler -> PlayerUserFuelPump', pumpId, `S(${this.ACTION_ID})`);

        const source = global.source;

        const nearestStation = this.service.GetPlayerNearestStation(source);
        const pumpStation = this.service.GetPumpStation(pumpId);
        const pumpData = this.service.GetPumpData(pumpId);
        const isAdmin = await this.playerService.IsPlayerAdmin(source);

        if(pumpStation && pumpData) {

            hosepipeIndex--;

            if(!pumpData.hosepipes[hosepipeIndex]) {
                pumpData.hosepipes[hosepipeIndex] = {
                    broken: false,
                    fuelProcess: null,
                    inVehicle: null,
                    nozzleEntity: null,
                    pickedUpPlayer: null,
                    slotEntity: null,
                    worldCoords: Vector3.fromArray(slotWorldCoords),
                    viewDisplayWorldCoords: Vector3.fromArray(viewDisplayWorldCoords),
                };
            }
            
            const hosepipe = this.service.GetHosepipeData(pumpId, hosepipeIndex);
            if(!hosepipe) throw new Error('No hosepipe', { cause: { pumpId, hosepipeIndex} });
            // logger.Log('Hosepipe', hosepipe);

            if(hosepipe.fuelProcess != null) return this.playerService.Notification(source, '~r~Refuel in progress');
            if(hosepipe.inVehicle || (hosepipe.pickedUpPlayer != null && hosepipe.pickedUpPlayer != source)) return this.playerService.Notification(source, '~r~Hosepipe not installed into pump');
            if(pumpData.busy) return this.playerService.Notification(source, '~r~Try one more time');

            pumpData.busy = this.ACTION_ID;
            if(hosepipe.pickedUpPlayer == source) {                
                this.service.DeleteNozzle(pumpId, hosepipeIndex);
                this.playerService.OnPlayerDropNozzle(source);
                pumpData.netEntity = await this.service.ReplacePumpObject(pumpId, pumpData.netEntity!, hosepipeIndex);
                
                pumpData.busy = false;
            } else {
                const playerHosepipe = this.service.GetHosepipeIsPlayerHold(source);
                if(hosepipe.broken) {
                    pumpData.busy = false;
                    return this.playerService.Notification(source, '~r~Hosepipe broken. Try another');
                }
                if(playerHosepipe) {
                    pumpData.busy = false;
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
        if(hosepipe.inVehicle) {
            const refilling = this.essenceService.GetVehicleRefillingData(hosepipe.inVehicle);
            if(refilling.inProgress) this.essenceService.InterruptVehicleRefill(hosepipe.inVehicle, true);
            this.essenceService.ResetVehicleRefillingData(hosepipe.inVehicle);
        }

        this.service.SetHosepipePlayerHold(global.source, entityNet);
        this.playerService.OnPlayerHoldsNozzle(global.source, entityNet);
    }

    private async OnInsertNozzleIntoVehicle(vehicleNet: number, fuelCupOffset) {
        this.ACTION_ID++;
        const source = global.source;
        const hosepipe = this.service.GetHosepipeIsPlayerHold(source);
        if(!hosepipe) throw new Error('No hosepipe', { cause: { player: source } });
        if(!hosepipe.nozzleEntity) throw new Error('No nozzle entity for hosepipe', { cause: { player: source, hosepipe } });
        if(vehicleNet == 0) throw new Error(`Vehicle ${vehicleNet} is not networked`);

        if(this.service.GetHosepipeFromVehicle(vehicleNet)) {
            return this.playerService.Notification(source, '~r~Some hosepipe already in vehicle');
        }

        this.service.SetHosepipeInVehicle(hosepipe.nozzleEntity, vehicleNet);
        this.playerService.SetPlayerLastVehicle(source, vehicleNet);
        this.playerService.OnPlayerDropNozzle(source);

        const vehicleOwner = NetworkGetEntityOwner(NetworkGetEntityFromNetworkId(vehicleNet));
        if(vehicleOwner != source) {
            emitNet(EventName('RequestDetachNozzle'), source, hosepipe.nozzleEntity);
            emitNet(EventName('InsertNozzleIntoVehicle'), vehicleOwner, hosepipe.nozzleEntity, vehicleNet, fuelCupOffset);
        } else {
            emitNet(EventName('InsertNozzleIntoVehicle'), source, hosepipe.nozzleEntity, vehicleNet, fuelCupOffset);
        }
    }

    private async OnPlayerRegisterObject(propNetId, model, isAmbient, rID) {
        this.ACTION_ID++;
        console.log(`OnPlayerRegisterObject(${propNetId}, ${model}, ${rID})`);
        this.service.ClientObjectCreated(global.source, propNetId, model, rID);
    }
    
    private async PlayerEnterVehicle(vehicleNet, vehicleClass, startFuelLevel) {
        this.ACTION_ID++;
        // this.playerService.SetPlayerLastVehicle(global.source, vehicleNet);
        const vehicleData = this.essenceService.AddVehicleAsPlayerVehicle(vehicleNet, vehicleClass, startFuelLevel);
        console.log('plen', EventName('VehicleFuelUpdated'), global.source, vehicleNet, vehicleData.fuel);
        emitNet(EventName('VehicleFuelUpdated'), global.source, vehicleNet, vehicleData.fuel, this.essenceService.GetVehicleMaxFuel(vehicleNet));
    }

    private async RefuelVehicle(vehicleNet) {
        this.ACTION_ID++;
        this.essenceService.RequestVehicleRefuel(global.source, vehicleNet);
    }

    private OnConfigReceived(config: ServerConfig) {
        this.ACTION_ID++;
        this.essenceService.SetEssenceTable(config.EssenceTable);
    }

    private async RequestDetachNozzle(nozzleNet: number){
        const entityId = NetworkGetEntityFromNetworkId(nozzleNet);
        if(entityId == 0) throw new Error(`Entity(${nozzleNet}) not exists`);
        emitNet(EventName('RequestDetachNozzle'), NetworkGetEntityOwner(entityId), nozzleNet);
    }

}