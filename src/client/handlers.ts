import { EventName } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { RopeService } from './services/ropes';

export class Handler {
    constructor(
        private readonly hosepipeService: HosepipeService,
        private readonly ropeService: RopeService,
    ){

        onNet(EventName('GiveNozzleToPlayer'), this.GiveNozzleToPlayer.bind(this));
        onNet(EventName('TakeNozzleFromPlayer'), this.TakeNozzleFromPlayer.bind(this));
        onNet(EventName('DropPlayerNozzle'), this.DropPlayerNozzle.bind(this));
        onNet(EventName('CreateRopeWithAttachments'), this.CreateRopeWithAttachments.bind(this));
        onNet(EventName('PickupNozzle'), this.PickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoVehicle'), this.InsertNozzleIntoVehicle.bind(this));

    }

    private async GiveNozzleToPlayer(pumpNet: number, hosepipeIndex: number) {
        const { nozzleId, pumpSlotEntity, ropeAttachements } = await this.hosepipeService.Create(NetworkGetEntityFromNetworkId(pumpNet));
        this.hosepipeService.AttachToPlayer(nozzleId);

        emitNet(EventName('NozzleCreated'), pumpNet, NetworkGetNetworkIdFromEntity(nozzleId), NetworkGetNetworkIdFromEntity(pumpSlotEntity), hosepipeIndex, ropeAttachements);
    }

    private async TakeNozzleFromPlayer(pumpEntity: number) {
        // TODO
    }

    private async DropPlayerNozzle(nozzleNet: number) {
        const nozzle = NetworkGetEntityFromNetworkId(nozzleNet);
        DetachEntity(nozzle, true, true);
    }

    private async CreateRopeWithAttachments(ropeAttachements: unknown) {
        this.ropeService.CreateWithAttachments(ropeAttachements);
    }

    private PickupNozzle(entityNet: number) {
        this.hosepipeService.AttachToPlayer(NetworkGetEntityFromNetworkId(entityNet));
    }

    private InsertNozzleIntoVehicle(vehicleNet: number, fuelCupOffset) {
        console.log('insert', fuelCupOffset);
        this.hosepipeService.AttachToVehicle(vehicleNet, fuelCupOffset);
    }

}