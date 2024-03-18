import { Logger } from '../../logger';
import { Vector3, Wait } from '../../utils';
import { FuelStationService } from '../services/fuelStationService';
import { MySQLService } from '../services/mysqlService';
import { PlayerService } from '../services/playerService';
import { PropInteractionAPI } from '../services/propInteraction';
import { Hosepipe } from './hosepipe';
import { FuelStation } from './station';

export interface IPetrolPumpDTO {
    id: string,
    stationId: number | null,
    defaultRotation: number,
    x: number,
    y: number,
    z: number,
    number: number,
}

export interface IElecticPumpDTO {
    id: string,
    stationId: number | null,
    houseId: number | null,
    defaultRotation: number,
    x: number,
    y: number,
    z: number,
    number: number,
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
    number: number,
    isElectical: 1 | 0,
    houseId: number | null,
}

export class FuelPump {
    private readonly logger: Logger;
    public readonly id: string;
    public netEntity: number | null;
    public readonly defaultRotation: number;
    public readonly worldCoords: Vector3;
    protected busy: number | false = false; // попереджує баги, коли об'єкт що замінюється не видаляється
    protected readonly number: number; // просто нумерація колонки

    protected hosepipes: (Hosepipe | null)[] = [];

    constructor(
        protected readonly service: FuelStationService,
        protected readonly playerService: PlayerService,
        protected readonly station: FuelStation | null,
        public readonly brandName: string,
        protected readonly MySQL: MySQLService,
        {id, defaultRotation, netEntity, x, y, z, number}: IFuelPump,
    ) {
        this.logger = new Logger(`FuelPump(${id})`);
        this.id = id;
        this.defaultRotation = defaultRotation + 0.0;
        this.netEntity = netEntity;
        this.worldCoords = new Vector3(x, y, z);
        this.number = number;

        // this.CreateHosepipe(0, new Vector3(0,0,0), new Vector3(0,0,0));
        // this.CreateHosepipe(1, new Vector3(0,0,0), new Vector3(0,0,0));
    }

    async CreateHosepipe(index: number, worldCoords: Vector3, viewDisplayWorldCoords: Vector3) {
        const [{hosepipe1, hosepipe2}] = await this.MySQL.FetchFuelPumpById(this.id);

        const isBroken: number | boolean = index == 0 ? JSON.parse(hosepipe1).broken : JSON.parse(hosepipe2).broken;

        const hosepipe = new Hosepipe(this.service, this.station, this, index, {
            viewDisplayWorldCoords,
            worldCoords,
            broken: isBroken ? 1 : 0
        });
        this.hosepipes[index] = hosepipe;
        return hosepipe;
    }

    GetPumpNumber() {
        return this.number;
    }

    // GetStation() {
    //     return this.station;
    // }

    GetAllHosepipes() {
        return [...this.hosepipes];
    }

    GetHosepipe(index: number) {
        return this.hosepipes[index];
    }

    GetPumpNetId() {
        return this.netEntity;
    }

    SetPumpNetId(netId: number) {
        this.netEntity = netId;
    }

    GetPumpLocalId() {
        if (!this.GetPumpNetId()) return null;
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

    GetHosepipeByJerryCan(entitynet: number) {
        return this.hosepipes.find((hosepipe) => hosepipe?.GetJerryCan() == entitynet);
    }

    IsElectric() {
        return false;
    }

    GetReplaceData() {
        if (!this.GetPumpNetId()) return null;
        return this.service.GetObjectReplaceData(this.GetPumpNetId()!);
    }

    GetBusy() {
        return this.busy;
    }

    // вказує, чи зайнята колонка якоюсь операцією. будь це заміна об'єкту чи щось інше.
    SetBusy(state: number | false) {
        this.busy = state;
    }

    async UpdatePumpModelBySlot(playerSlot: number) {
        const busySlots = this.GetAllHosepipes().filter((hsp) => hsp?.IsTakenOut()).length || 0;
        const replaceData = this.GetReplaceData();
        if (!replaceData) {
            this.logger.Error('Replace data is null', {
                netEntity: this.GetPumpNetId(),
                localEntity: this.GetPumpLocalId(),
            });
            throw new Error('Replace data is null');
        }
        let replaceModel;

        if (busySlots == 0) replaceModel = replaceData.original;
        else if (busySlots >= replaceData.replace.length) replaceModel = replaceData.all;
        else replaceModel = replaceData.replace[playerSlot];

        // this.logger.Warn('ReplacePumpObject', busySlots, playerSlot, replaceModel, `defRot:${this.defaultRotation}`);

        const ent = this.GetPumpLocalId()!;
        const rot = Vector3.fromArray(GetEntityRotation(ent));
        rot.z = this.defaultRotation;

        DeleteEntity(ent);
        const newEntityNetId = await this.service.CreateClientObject<number>(NetworkGetEntityOwner(ent), replaceModel.hash, this.worldCoords, rot);

        while (NetworkGetEntityFromNetworkId(newEntityNetId) == 0) {
            // this.logger.Warn('ReplaceObject waiting to new entity will exists', newEntityNetId);
            await Wait(100);
        }
        this.netEntity = newEntityNetId;
        return newEntityNetId;
    }

    async Save() {
        const pump = await this.MySQL.FetchFuelPumpById(this.id);
        if (pump.length == 0) { // create
            return this.MySQL.InsertPetrolPump({
                defaultRotation: this.defaultRotation,
                id: this.id,
                stationId: this.station?.id || null,
                x: this.worldCoords.x,
                y: this.worldCoords.y,
                z: this.worldCoords.z,
                number: this.number,
            });
        } else {
            return this.MySQL.UpdateFuelStationPump(this.id, {
                broken: this.hosepipes.some((hosepipe) => hosepipe?.IsBroken()),
            });
        }
    }

    async PlayerUsePump(source: number, hosepipeIndex: number, slotWorldCoords: Vector3, viewDisplayWorldCoords: Vector3) {
        let hosepipe = this.GetHosepipe(hosepipeIndex);
        if (!hosepipe) hosepipe = await this.CreateHosepipe(hosepipeIndex, slotWorldCoords, viewDisplayWorldCoords);

        if (hosepipe.IsTakenOut()) {
            if(hosepipe.GetPlayer() == null || (hosepipe.GetPlayer() != null && hosepipe.GetPlayer() != source)) {
                this.playerService.Notification(source, '~r~В колонке нет пистолета');
                setTimeout(() => this.SetBusy(false));
                return false;
            }
        }

        if (hosepipe.GetPlayer() == source) {
            hosepipe.DeleteNozzle();
            const countOfBusySlots = this.GetAllHosepipes().filter((hsp) => hsp?.IsTakenOut()).length || 0;

            const nextSlot = (this.GetReplaceData()?.replace.length == 2 && countOfBusySlots == 1) ? (hosepipeIndex == 1 ? 0 : 1) : hosepipeIndex; // * https://unityrp.atlassian.net/browse/URP-33

            this.playerService.OnPlayerDropNozzle(source);
            this.UpdatePumpModelBySlot(nextSlot).then((newPumpNetId: number) => {
                const propIntAPI = new PropInteractionAPI();
                setTimeout(() => this.SetBusy(false));
                propIntAPI.DisableEntityDespawn(newPumpNetId, false);
            });
        } else {
            const playerHosepipe = this.service.GetHosepipeIsPlayerHold(source);
            if (hosepipe.IsBroken()) {
                setTimeout(() => this.SetBusy(false));
                return this.playerService.Notification(source, '~r~Колонка сломана, попробуйте другую');
            }
            if (playerHosepipe) {
                setTimeout(() => this.SetBusy(false));
                return this.playerService.Notification(source, '~r~Вы уже держите пистолет');
            }

            this.service.GiveNozzleToPlayer(this.id, hosepipeIndex, source, this.netEntity!);
        }
    }
}