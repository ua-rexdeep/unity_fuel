import { EventName } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { JerryCanService } from './services/jerrycan';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';

export class Handler {
    constructor(
        private readonly hosepipeService: HosepipeService,
        private readonly ropeService: RopeService,
        private readonly vehicleService: VehicleService,
        private readonly UIService: UserInterface,
        private readonly JerryCanService: JerryCanService,
    ){

        onNet(EventName('GiveNozzleToPlayer'), this.GiveNozzleToPlayer.bind(this));
        onNet(EventName('RemoveNozzleRope'), this.RemoveNozzleRope.bind(this));
        onNet(EventName('DropPlayerNozzle'), this.DropPlayerNozzle.bind(this));
        onNet(EventName('CreateRopeWithAttachments'), this.CreateRopeWithAttachments.bind(this));
        onNet(EventName('PickupNozzle'), this.PickupNozzle.bind(this));
        onNet(EventName('InsertNozzleIntoEntity'), this.InsertNozzleIntoEntity.bind(this));
        onNet(EventName('HosepipeSlotBrokenByVehicle'), this.OnHosepipeSlotBrokenByVehicle.bind(this));
        onNet(EventName('VehicleFuelUpdated'), this.VehicleFuelUpdated.bind(this));
        
        onNet(EventName('PlayerOnNozzleViewDisplay'), this.PlayerOnNozzleViewDisplay.bind(this));
        onNet(EventName('PlayerHideRefillData'), this.PlayerHideRefillData.bind(this));

        onNet(EventName('ClientConfig'), this.OnConfigReceived.bind(this));
        onNet(EventName('RequestDetachNozzle'), this.RequestDetachNozzle.bind(this));
        onNet(EventName('RequestVehicleInfo'), this.RequestVehicleInfo.bind(this));
        onNet(EventName('PlayerJerryCanUpdated'), this.OnPlayerJerryCanUpdated.bind(this));


        // if(process.env.NODE_ENV == 'development') {
        //     ClearOverrideWeather();
        //     ClearWeatherTypePersist();
        //     SetWeatherTypePersist('XMAS');
        //     SetWeatherTypeNow('XMAS');
        //     SetWeatherTypeNowPersist('XMAS');
        //     SetForceVehicleTrails(true);
        //     SetForcePedFootstepsTracks(true);
        // }
    }

    private async GiveNozzleToPlayer(pumpNet: number, pumpId: number, hosepipeIndex: number, offset: [number, number, number], isElectical: boolean) {
        const { 
            nozzleId, pumpSlotEntity, ropeAttachements 
        } = await this.hosepipeService.Create(NetworkGetEntityFromNetworkId(pumpNet), offset, isElectical);
        this.hosepipeService.AttachToPlayer(nozzleId);
        emitNet(EventName('NozzleCreated'), pumpNet, pumpId, NetworkGetNetworkIdFromEntity(nozzleId), 
            NetworkGetNetworkIdFromEntity(pumpSlotEntity), hosepipeIndex, ropeAttachements);
    }

    private async RemoveNozzleRope(nozzleNetId: number) {
        const ropeId = this.ropeService.GetRopeEntityAttachedTo(nozzleNetId);
        console.log('RemoveNozzleRope', nozzleNetId, ropeId);
        if(ropeId != null) this.ropeService.DeleteRope(ropeId);
    }

    private async DropPlayerNozzle(nozzleNet: number) {
        const nozzle = NetworkGetEntityFromNetworkId(nozzleNet);
        SetEntityVisible(nozzle, true, true);
        DetachEntity(nozzle, true, true);
    }

    private async CreateRopeWithAttachments(ropeAttachements: RopeAttachements) {
        this.ropeService.CreateWithAttachments(ropeAttachements);
    }

    private PickupNozzle(entityNet: number) {
        this.hosepipeService.AttachToPlayer(NetworkGetEntityFromNetworkId(entityNet));
    }

    private async InsertNozzleIntoEntity(nozzleEntity: number, entNet: number, fuelCupOffset: { x: number, y: number, z: number }) {
        this.hosepipeService.AttachToEntity(nozzleEntity, entNet, fuelCupOffset, await this.vehicleService.GetAsyncVehicleRefillConfig(NetworkGetEntityFromNetworkId(entNet)));
    }

    private OnHosepipeSlotBrokenByVehicle(slotEntityNet: number) {
        const slotEntity = NetworkGetEntityFromNetworkId(slotEntityNet);
        FreezeEntityPosition(slotEntity, false);
        ActivatePhysics(slotEntity);
    }

    private VehicleFuelUpdated(vehicleNet: number, fuel: number, maxFuel: number, badFuelContent: number) {
        const playerPed = GetPlayerPed(-1);
        const playerVehicle = GetVehiclePedIsIn(playerPed, false);
        const vehicleEntity = NetworkGetEntityFromNetworkId(vehicleNet);

        SetVehicleFuelLevel(vehicleEntity, fuel == 0 ? 20 : 50);
        if(playerVehicle == vehicleEntity) {
            this.vehicleService.VehicleFuelUpdated(vehicleEntity, fuel, maxFuel, badFuelContent);
        } else {
            this.vehicleService.ProcessVehicleFuelState(vehicleEntity);
        }
    }

    private PlayerOnNozzleViewDisplay(fuelCost: string, fuelTank: string) {
        console.log('PlayerOnNozzleViewDisplay');
        this.UIService.ShowNozzleDisplay();
        this.UIService.UpdateNozzleDisplay(fuelCost, fuelTank);
    }

    private PlayerHideRefillData() {
        console.log('PlayerHideRefillData');
        this.UIService.HideNozzleDisplay();
    }

    private OnConfigReceived(config: ClientConfig) {
        // this.vehicleService.SetDegradeFuelLevel(config.MinFuelForDegrade); // TODO
        this.vehicleService.SetIndividualVehicleConfig(config.modelHash, config.config);
    }

    private RequestDetachNozzle(nozzleNet: number) {
        if(NetworkDoesEntityExistWithNetworkId(nozzleNet)) {
            const entity = NetworkGetEntityFromNetworkId(nozzleNet);
            DetachEntity(entity, true, true);
        } else throw new Error(`EntityNet(${nozzleNet}) not exists`);
    }

    private RequestVehicleInfo(vehicleNet: number) {
        const vehicle = NetworkGetEntityFromNetworkId(vehicleNet);
        emitNet(EventName('SendVehicleInfo'), vehicleNet, GetVehicleClass(vehicle), GetVehicleFuelLevel(vehicle));
    }

    private OnPlayerJerryCanUpdated(jerryCanData: { petrol?: number, solvent?: number }) {
        this.JerryCanService.UpdateData(jerryCanData);
    }

}