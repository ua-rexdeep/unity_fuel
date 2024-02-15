import { Logger } from '../../logger';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';

export class FuelStationHandler {
    constructor(
        private readonly service: FuelStationService,
        private readonly playerService: PlayerService) {
        onNet('UnityFuel::PlayerUseFuelPump', this.OnPlayerUseFuelPump.bind(this));
    }

    private async OnPlayerUseFuelPump(pumpId: string, hosepipeIndex: number, localEntity: number) {
        const logger = new Logger('Handler -> PlayerUserFuelPump', pumpId, hosepipeIndex.toString());
        const source = global.source;

        const nearestStation = this.service.GetPlayerNearestStation(source);
        const pumpStation = this.service.GetPumpStation(pumpId);
        const isAdmin = this.playerService.IsPlayerAdmin(source);

        if(pumpStation) {

            const hosepipe = this.service.GetHosepipeData(pumpId, hosepipeIndex);

            if(hosepipe.broken) return this.playerService.Notification(source, '~r~Hosepipe broken. Try another');
            if(hosepipe.fuelProcess != null) return this.playerService.Notification(source, '~r~Refuel in progress');
            if(hosepipe.inVehicle || hosepipe.pickedUpPlayer != source) return this.playerService.Notification(source, '~r~Hosepipe not installed into pump');

            if(hosepipe.pickedUpPlayer == source) {
                // покласти назад
            } else {
                // взяти
            }

        } else {
            if(isAdmin) {

                if(!nearestStation) return this.playerService.Notification(source, '~r~[A] You need to setup fuel station first');

                this.service.InstallPumpForStation(pumpId, nearestStation.id);

                this.playerService.Notification(source, `~b~Fuel pump(${pumpId}) installed for station(${nearestStation.id})`);

            } else return this.playerService.Notification(source, '~r~Fuel pump is not working yet');
        }
    }
}