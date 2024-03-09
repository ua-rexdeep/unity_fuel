import { Logger } from '../../logger';
import { Vector3, Wait } from '../../utils';
import { FuelStationService } from '../services/fuelStationService';
import { MySQLService } from '../services/mysqlService';
import { Hosepipe } from './hosepipe';
import { FuelStation } from './station';

export interface IFuelPumpDTO {
    id: string,
    stationId: number,
    defaultRotation: number,
    x: number,
    y: number,
    z: number,
}

export interface IFuelPump {
    id: string,
    netEntity: number | null,
    defaultRotation: number,
    x: number,
    y: number,
    z: number,
    hosepipe1: string,
    hosepipe2: string,
}

export class FuelPump {
    private readonly logger: Logger;
    public readonly id: string;
    public netEntity: number | null;
    public readonly defaultRotation: number;
    public readonly worldCoords: Vector3;
    private busy: number | false = false; // попереджує баги, коли об'єкт що замінюється не видаляється

    private hosepipes: (Hosepipe|null)[] = [];

    constructor(
        private readonly service: FuelStationService,
        private readonly station: FuelStation,
        private readonly MySQL: MySQLService,
        { id, defaultRotation, netEntity, x, y, z }: IFuelPump,
    ){
        this.logger = new Logger(`FuelPump(${id})`);
        this.id = id;
        this.defaultRotation = defaultRotation;
        this.netEntity = netEntity;
        this.worldCoords = new Vector3(x,y,z);
    }

    async CreateHosepipe(index: number, worldCoords: Vector3, viewDisplayWorldCoords: Vector3) {
        const [{ hosepipe1, hosepipe2 }] = await this.MySQL.FetchFuelPumpById(this.id);

        const isBroken: number | boolean = index == 0 ? JSON.parse(hosepipe1).broken : JSON.parse(hosepipe2).broken;

        const hosepipe = new Hosepipe(this.service, this.station, this, index, { viewDisplayWorldCoords, worldCoords, broken: isBroken ? 1 : 0 });
        this.hosepipes[index] = hosepipe;
        return hosepipe;
    }

    GetStation() {
        return this.station;
    }

    GetAllHosepipes() {
        return [ ...this.hosepipes ];
    }

    GetHosepipe(index: number) {
        return this.hosepipes[index];
    }

    GetPumpNetId() {
        return this.netEntity;
    }

    GetPumpLocalId() {
        if(!this.GetPumpNetId()) return null;
        return NetworkGetEntityFromNetworkId(this.GetPumpNetId()!);
    }

    GetHosepipeByIndex(index: number) {
        return this.hosepipes[index];
    }

    GetHosepipeByPlayer(player: number) {
        return this.hosepipes.find((hosepipe) => hosepipe?.GetPlayer() == player);
    }

    GetHosepipeByNozzleNetId(netId: number) {
        return this.hosepipes.find((hosepipe) => hosepipe?.GetNozzleNetId() == netId);
    }

    GetHosepipeByVehicle(vehicleNet: number) {
        return this.hosepipes.find((hosepipe) => hosepipe?.GetVehicle() == vehicleNet);
    }

    IsHosepipeBroken(index: number) {
        return this.hosepipes[index]?.IsBroken() || false;
    }

    IsElectric() {
        return this.GetReplaceData()?.isElectricOnly || false;
    }

    GetReplaceData() {
        if(!this.GetPumpNetId()) return null;
        return this.service.GetObjectReplaceData(this.GetPumpNetId()!);
    }

    GetBusy() {
        return this.busy;
    }

    SetBusy(state: number | false) {
        this.busy = state;
    }

    async UpdatePumpModelBySlot(playerSlot: number) {
        const busySlots = this.GetAllHosepipes().filter((hsp) => hsp?.IsTakenOut()).length || 0;
        const replaceData = this.GetReplaceData();
        if(!replaceData) {
            this.logger.Error('Replace data is null', {
                netEntity: this.GetPumpNetId(),
                localEntity: this.GetPumpLocalId(),
            });
            throw new Error('Replace data is null');
        }
        let replaceModel;
        
        if(busySlots == 0) replaceModel = replaceData.original;
        else if(busySlots >= replaceData.replace.length) replaceModel = replaceData.all;
        else replaceModel = replaceData.replace[playerSlot];

        // this.logger.Warn('ReplacePumpObject', busySlots, playerSlot, replaceModel, replaceData);

        const ent = this.GetPumpLocalId()!;
        const rot = Vector3.fromArray(GetEntityRotation(ent));
        rot.z = this.defaultRotation;

        DeleteEntity(ent);
        const newEntityNetId = await this.service.CreateClientObject<number>(NetworkGetEntityOwner(ent), replaceModel.hash, this.worldCoords, rot);

        while(NetworkGetEntityFromNetworkId(newEntityNetId) == 0) {
            this.logger.Warn('ReplaceObject waiting to new entity will exists', newEntityNetId);
            await Wait(100);
        }

        this.netEntity = newEntityNetId;
        return newEntityNetId;
    }

    Save() {
        return this.MySQL.FetchFuelPumpById(this.id).then((pump) => {
            if(pump.length == 0) { // create
                return this.MySQL.InsertFuelPump({
                    defaultRotation: this.defaultRotation,
                    id: this.id,
                    stationId: this.station.id,
                    x: this.worldCoords.x,
                    y: this.worldCoords.y,
                    z: this.worldCoords.z,
                });
            } else {
                throw new Error('NOT IMPLEMENTED');
            }
        });
    }
}