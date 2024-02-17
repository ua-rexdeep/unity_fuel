import { Logger } from '../../logger';
import { EventName } from '../../utils';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';

export class FuelStationHandler {
    constructor(
        private readonly service: FuelStationService,
        private readonly playerService: PlayerService) {
        onNet(EventName('PlayerUseFuelPump'), this.OnPlayerUseFuelPump.bind(this));
        onNet(EventName('NozzleCreated'), this.OnNozzleCreated.bind(this));
        onNet(EventName('PickupNozzle'), this.OnPickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoVehicle'), this.OnInsertNozzleIntoVehicle.bind(this));
    }

    private async OnPlayerUseFuelPump(pumpId: string, hosepipeIndex: number, pumpNetId: number) {
        // const logger = new Logger('Handler -> PlayerUserFuelPump', pumpId, hosepipeIndex.toString());
        const source = global.source;

        const nearestStation = this.service.GetPlayerNearestStation(source);
        const pumpStation = this.service.GetPumpStation(pumpId);
        const isAdmin = this.playerService.IsPlayerAdmin(source);

        if(pumpStation) {

            const hosepipe = this.service.GetHosepipeData(pumpId, hosepipeIndex);
            
            // logger.Log('Hosepipe', hosepipe);

            if(hosepipe.broken) return this.playerService.Notification(source, '~r~Hosepipe broken. Try another');
            if(hosepipe.fuelProcess != null) return this.playerService.Notification(source, '~r~Refuel in progress');
            if(hosepipe.inVehicle || (hosepipe.pickedUpPlayer != null && hosepipe.pickedUpPlayer != source)) return this.playerService.Notification(source, '~r~Hosepipe not installed into pump');

            if(hosepipe.pickedUpPlayer == source) {
                this.service.TakeNozzleFromPlayer(pumpId, hosepipeIndex,  source, pumpNetId);
            } else {
                this.service.GiveNozzleToPlayer(pumpId, hosepipeIndex,  source, pumpNetId);
            }

        } else {
            if(isAdmin) {

                if(!nearestStation) return this.playerService.Notification(source, '~r~[A] You need to setup fuel station first');

                this.service.InstallPumpForStation(pumpId, nearestStation.id);

                this.playerService.Notification(source, `~b~Fuel pump(${pumpId}) installed for station(${nearestStation.id})`);

            } else return this.playerService.Notification(source, '~r~Fuel pump is not working yet');
        }
    }

    private async OnNozzleCreated(pumpEntity: number, nozzleId: number, pumpSlotEntity: number, hosepipeIndex: number, ropeAttachements) {
        this.service.SetHosepipeTakenData(global.source, pumpEntity, nozzleId, pumpSlotEntity, hosepipeIndex);
        this.playerService.CreateRopeWithAttachments(-1, ropeAttachements);
    }

    // TODO: OnNozzleDeleted

    private async OnPickupNozzle(entityNet: number) {
        emitNet(EventName('PickupNozzle'), global.source, entityNet);
        this.service.SetHosepipePlayerHold(global.source, entityNet);
    }

    private async OnInsertNozzleIntoVehicle(vehicleNet: number, fuelCupOffset) {
        const hosepipe = this.service.GetHosepipeIsPlayerHold(global.source);
        this.service.SetHosepipeInVehicle(hosepipe.nozzleEntity, vehicleNet);
        emitNet(EventName('InsertNozzleIntoVehicle'), global.source, vehicleNet, fuelCupOffset);
    }

}