import { Logger } from '../../logger';
import { EventName, Vector3 } from '../../utils';
import { FuelStationService } from '../services/fuelStationService';
import { FuelPump } from './pump';
import { FuelStation } from './station';

export interface IHosepipe {
    worldCoords: Vector3,
    viewDisplayWorldCoords: Vector3,
    broken: 0 | 1,
}

export class Hosepipe {
    private readonly logger: Logger;
    private nozzleEntity: number | null;
    private slotEntity: number | null; // ball
    private pickedUpPlayer: number | null;
    private inVehicle: number | null;
    private broken = false;
    public readonly worldCoords: Vector3;
    public readonly viewDisplayWorldCoords: Vector3;

    constructor(
        private readonly service: FuelStationService,
        private readonly station: FuelStation,
        private readonly pump: FuelPump,
        public readonly index: number,
        { viewDisplayWorldCoords, worldCoords, broken }: IHosepipe,
    ){
        this.logger = new Logger(`Hosepipe(${this.pump.id} / ${this.index})`);
        this.viewDisplayWorldCoords = viewDisplayWorldCoords;        
        this.worldCoords = worldCoords;
        console.log('broken', broken);
        if(broken == 1) this.SetBroken();
    }

    GetPump() {
        return this.pump;
    }

    // sets player as picked up. clears that nozzle in vehicle
    SetPlayer(player: number) {
        this.pickedUpPlayer = player;
        this.inVehicle = null;
    }

    GetNozzleNetId() {
        return this.nozzleEntity;
    }

    GetNozzleLocalId() {
        return NetworkGetEntityFromNetworkId(this.GetNozzleNetId()!);
    }

    GetSlotNetId() {
        return this.slotEntity;
    }

    GetSlotLocalId() {
        return NetworkGetEntityFromNetworkId(this.GetSlotNetId()!);
    }

    SetBroken() {
        this.broken = true;
    }

    IsBroken() {
        return this.broken;
    }

    GetVehicle() {
        return this.inVehicle;
    }

    IsTakenOut() {
        return Boolean(this.GetPlayer() || this.GetVehicle() || this.GetNozzleNetId());
    }

    SetVehicle(vehicleNet: number) {
        this.pickedUpPlayer = null;
        this.inVehicle = vehicleNet;
    }

    GetPlayer(){
        return this.pickedUpPlayer;
    }

    PickedUp(slotEntity: number, nozzleEntity: number) {
        this.slotEntity = slotEntity;
        this.nozzleEntity = nozzleEntity;
    }

    DeleteNozzle() {
        if(this.nozzleEntity) DeleteEntity(NetworkGetEntityFromNetworkId(this.nozzleEntity));
        if(this.slotEntity) DeleteEntity(NetworkGetEntityFromNetworkId(this.slotEntity));
        emitNet(EventName('RemoveNozzleRope'), -1, this.nozzleEntity);
        this.nozzleEntity = null;
        this.slotEntity = null;
        this.pickedUpPlayer = null;
        this.inVehicle = null;
    }

    SetDropped() {
        this.inVehicle = null;
        this.pickedUpPlayer = null;
    }

    // в деяких випадках, мережевий ID існує, але об'єкт не на своєму місці
    IsNozzleExistsAndValid() {
        if(this.nozzleEntity == null) return false;
        const localEntity = NetworkGetEntityFromNetworkId(this.nozzleEntity);
        return localEntity != 0 && DoesEntityExist(localEntity) && GetEntityModel(localEntity) == GetHashKey('prop_cs_electro_nozle');
    }
}