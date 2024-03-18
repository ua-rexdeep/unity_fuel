import { Logger } from '../../logger';
import { Vector3 } from '../../utils';
import { FuelStationService } from '../services/fuelStationService';
import { PlayerService } from '../services/playerService';
import { FuelPump } from './fuelPump';
import { FuelStation } from './station';

export interface IHosepipe {
    worldCoords: Vector3,
    viewDisplayWorldCoords: Vector3,
    broken: 0 | 1,
}

export class Hosepipe {
    private readonly logger: Logger;
    private latestNozzleNetId: number | null = null;
    private nozzleEntity: number | null = null;
    private slotEntity: number | null = null; // ball
    private pickedUpPlayer: number | null = null;
    private inVehicle: number | null = null;
    private inJerryCan: number | null = null;
    private broken = false;
    public readonly worldCoords: Vector3;
    public readonly viewDisplayWorldCoords: Vector3;

    public playersInRange: number[] = [];
    public ropeAttachements: RopeAttachements | null = null;

    constructor(
        private readonly service: FuelStationService,
        private readonly station: FuelStation | null,
        private readonly pump: FuelPump,
        public readonly index: number,
        {viewDisplayWorldCoords, worldCoords, broken}: IHosepipe,
    ) {
        this.logger = new Logger(`Hosepipe(${this.pump.id} / ${this.index})`);
        this.viewDisplayWorldCoords = viewDisplayWorldCoords;
        this.worldCoords = worldCoords;

        if (broken == 1) this.SetBroken();
    }

    GetPump() {
        return this.pump;
    }

    // sets player as picked up. clears that nozzle in vehicle
    SetPlayer(player: number) {
        this.pickedUpPlayer = player;
        this.inVehicle = null;
        this.inJerryCan = null;
    }

    GetNozzleNetId() {
        return this.nozzleEntity;
    }

    // if nozzle net id null
    GetLatestNozleNetId() {
        return this.latestNozzleNetId;
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
        if (this.inVehicle && !DoesEntityExist(this.GetVehicleLocalId()!)) {
            this.inVehicle = null;
        }
        return this.inVehicle;
    }

    GetVehicleLocalId() {
        if (!this.inVehicle) return;
        return NetworkGetEntityFromNetworkId(this.inVehicle);
    }

    GetJerryCan() {
        return this.inJerryCan;
    }

    GetJerryCanLocalId() {
        if (!this.inJerryCan) return;
        return NetworkGetEntityFromNetworkId(this.inJerryCan);
    }

    SetJerryCan(entityNet: number) {
        this.inJerryCan = entityNet;
        this.pickedUpPlayer = null;
        this.inVehicle = null;
    }

    IsTakenOut() {
        return Boolean(this.GetNozzleNetId());
    }

    SetVehicle(vehicleNet: number) {
        this.pickedUpPlayer = null;
        this.inJerryCan = null;
        this.inVehicle = vehicleNet;
    }

    GetPlayer() {
        return this.pickedUpPlayer;
    }

    PickedUp(slotEntity: number, nozzleEntity: number) {
        this.slotEntity = slotEntity;
        this.nozzleEntity = nozzleEntity;
        this.latestNozzleNetId = nozzleEntity;
    }

    DeleteNozzle() {
        if (this.nozzleEntity) DeleteEntity(NetworkGetEntityFromNetworkId(this.nozzleEntity));
        if (this.slotEntity) DeleteEntity(NetworkGetEntityFromNetworkId(this.slotEntity));
        this.nozzleEntity = null;
        this.slotEntity = null;
        this.pickedUpPlayer = null;
        this.inVehicle = null;
        this.inJerryCan = null;
    }

    SetDropped() {
        this.inVehicle = null;
        this.pickedUpPlayer = null;
        this.inJerryCan = null;
    }

    // в деяких випадках, мережевий ID існує, але об'єкт не на своєму місці
    IsNozzleExistsAndValid() {
        if (this.nozzleEntity == null) return false;
        const localEntity = NetworkGetEntityFromNetworkId(this.nozzleEntity);
        return localEntity != 0 && DoesEntityExist(localEntity) && (GetEntityModel(localEntity) == GetHashKey('prop_cs_electro_nozle') || GetEntityModel(localEntity) == GetHashKey('prop_cs_fuel_nozle'));
    }

    CreateRopeForPlayer(playerService: PlayerService, player: number) {
        // console.log('create rope for player', player, this.GetNozzleNetId(), this.GetSlotNetId(), this.ropeAttachements);
        playerService.CreateRopeWithAttachments(player, this.ropeAttachements!);
        this.playersInRange.push(player);
    }

    DeleteRopeForPlayer(playerService: PlayerService, player: number) {
        console.log('player out of hosepipes range', this.GetPump().id, this.index);
        this.playersInRange.splice(this.playersInRange.indexOf(player), 1);
        playerService.DeleteRopeForNozzle(player, this.GetLatestNozleNetId()!);
    }

    GetHandlingName(): 'N' | 'S' | 'W' | 'E' {
        const x = this.worldCoords.x - this.GetPump().worldCoords.x;
        const y = this.worldCoords.y - this.GetPump().worldCoords.y;
        if (x > 0.5) return 'E';
        else if (x < 0.5) return 'W';
        else if (y > 0.5) return 'N';
        else if (y < 0.5) return 'S';
        else return 'E';
    }

    GetHandlingNameFull() {
        const name = this.GetHandlingName();
        if (name == 'N') return 'North';
        if (name == 'E') return 'East';
        if (name == 'W') return 'West';
        if (name == 'S') return 'South';

        return 'East';
    }
}