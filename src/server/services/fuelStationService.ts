import { Logger } from '../../logger';
import { EventName, vDist, Vector3 } from '../../utils';
import { Hosepipe } from '../models/hosepipe';
import { FuelStation, FuelStationDTO } from '../models/station';
import { FuelEssenceService } from './fuelEssenceService';
import { MySQLService } from './mysqlService';
import { PlayerService } from './playerService';
import { PropInteractionAPI } from './propInteraction';

export class FuelStationService {
    private stations: Array<FuelStation> = [];
    private readonly logger = new Logger('FuelStationService');
    private createObjectReturnPool: Record<number, any> = {};
    private PumpReplaceData: FuelPumpReplaceData[] = [];

    constructor(
        private readonly vRP: vRPServerFunctions,
        private readonly vRPClient: vRPClientFunctions,
        private readonly playerService: PlayerService,
        private readonly MySQL: MySQLService,
        private readonly essenceService: FuelEssenceService
    ) {

        vRP.addItemListener('wbody|WEAPON_PETROLCAN', 'equipWeapon', async (player, itemdata) => {
            const userid = await vRP.getUserId(player);
            vRP.updateUserDataTable(userid, {jerryCanWeaponData: itemdata});
        });
        vRP.addItemListener('wbody|WEAPON_PETROLCAN', 'storeWeapon', async (player) => {
            const userid = await vRP.getUserId(player);
            const datatable = await vRP.getUserDataTable(userid);
            if (datatable?.jerryCanWeaponData) {
                await vRP.tryGetInventoryItem(userid, 'wbody|WEAPON_PETROLCAN', 1, false);
                await vRP.giveInventoryItem(userid, 'wbody|WEAPON_PETROLCAN', 1, false, datatable?.jerryCanWeaponData);
            }
        });

        this.CheckAndFetchStations();
        this.MySQL.IsFuelPumpsTableExists().then((exists) => {
            if (!exists) {
                this.MySQL.CreateFuelPumpsTable();
            }
        });
    }

    CheckAndFetchStations() {
        this.MySQL.IsFuelStationsTableExists().then((table_exists) => {
            if (table_exists) {
                this.MySQL.FetchAllFuelStations().then((stations) => {
                    for (const station of stations) {
                        const fuelStation = new FuelStation(this, this.playerService, this.MySQL, station);
                        this.stations.push(fuelStation);
                    }
                });
            } else {
                this.MySQL.CreateFuelStationsTable();
            }
        });
    }

    async CreateFuelStation(dto: FuelStationDTO) {
        const {insertId} = await this.MySQL.InsertFuelStation(dto);

        const [init] = await this.MySQL.FetchFuelStationById(insertId);
        const station = new FuelStation(this, this.playerService, this.MySQL, init);
        this.stations.push(station);
        return station;
    }

    GetAllStations() {
        return [...this.stations];
    }

    GetPlayerNearestStation(player: number) {
        const playerPed = GetPlayerPed(player);
        const playerCoords = GetEntityCoords(playerPed);

        for (const station of this.stations) {
            const dist = vDist(playerCoords[0], playerCoords[1], playerCoords[2], station.x, station.y, playerCoords[2]);
            if (dist <= 50) {
                return station;
            }
        }

        return null;
    }

    GetPumpStation(pumpId: string) {
        return this.stations.find((station) => {
            if (station.GetAllPumps().some((pump) => pump.id == pumpId)) return station;
            return null;
        });
    }

    InstallPumpForStation(pumpId: string, stationId: number, pumpNetId: number) {
        const logger = new Logger('InstallPumpForStation');
        const station = this.stations.find((station) => station.id == stationId);
        if (!station) return logger.Log(`No station with id ${stationId}`);
        const pumpEntity = NetworkGetEntityFromNetworkId(pumpNetId);

        const [px, py, pz] = GetEntityCoords(pumpEntity);

        let pumpNum = 1;
        for (const stationPump of station.GetAllPumps()) {
            if (stationPump.GetPumpNumber() <= pumpNum) pumpNum = stationPump.GetPumpNumber() + 1;
        }

        const pump = station.AddPump({
            id: pumpId,
            netEntity: pumpNetId,
            defaultRotation: GetEntityHeading(pumpEntity),
            x: px,
            y: py,
            z: pz,
            hosepipe1: JSON.stringify({broken: false}),
            hosepipe2: JSON.stringify({broken: false}),
            number: pumpNum,
            isElectical: (GetEntityModel(pumpEntity) == GetHashKey('prop_electro_airunit01')) ? 1 : 0,
            houseId: null,
        });
        pump.Save();
        return pump;
    }

    // взяти пістолет з колонки
    GiveNozzleToPlayer(pumpId: string, hosepipeIndex: number, playerId: number, pumpNetId: number) {
        const station = this.GetPumpStation(pumpId);
        if (!station) throw new Error('station is null');
        const pump = station.GetPumpById(pumpId);
        if (!pump) throw new Error('Pump is null');

        pump.netEntity = pumpNetId;
        pump.GetHosepipeByIndex(hosepipeIndex)?.SetPlayer(playerId);

        const replaceData = this.GetObjectReplaceData(pumpNetId);
        if (!replaceData) throw new Error(`No replace data for pump(${pumpNetId})`);
        emitNet(EventName('GiveNozzleToPlayer'), playerId, pumpNetId, pumpId, hosepipeIndex, Vector3.fromXYZ(replaceData.slotOffsets[hosepipeIndex]).toArray(), pump.IsElectric());
    }

    // встановлює інформацію про об'єкти у колонки
    async SetHosepipeTakenData(player: number, pumpId: string, nozzleEntity: number, pumpSlotEntity: number, hosepipeIndex: number) {
        new Logger('SetHosepipeTakenData', player.toString(), pumpId.toString());
        const pump = this.GetPumpStation(pumpId)?.GetPumpById(pumpId);
        if (!pump) throw new Error('Pump is null', {cause: {pumpId}});
        if (!pump.netEntity) throw new Error('Pump network entity is null', {cause: {pumpId}});
        const hosepipe = this.GetHosepipeIsPlayerHold(player);
        if (!hosepipe) throw new Error('Hosepipe is null', {cause: {player}});
        hosepipe.PickedUp(pumpSlotEntity, nozzleEntity);

        pump.UpdatePumpModelBySlot(hosepipeIndex).then((newPumpNetId: number) => {
            const propIntAPI = new PropInteractionAPI();
            pump.SetBusy(false);
            propIntAPI.DisableEntityDespawn(newPumpNetId, true);
        });
    }

    GetHosepipeIsPlayerHold(player: number) {
        for (const station of this.stations) {
            for (const pump of station.GetAllPumps()) {
                const hosepipe = pump.GetHosepipeByPlayer(player);
                if (hosepipe) return hosepipe;
            }
        }
        return null;
    }

    GetHosepipeFromNozzle(nozzleNet: number) {
        for (const station of this.stations) {
            for (const pump of station.GetAllPumps()) {
                const hosepipe = pump.GetHosepipeByNozzleNetId(nozzleNet);
                if (hosepipe) return hosepipe;
            }
        }
        return null;
    }

    GetHosepipeFromVehicle(vehicleNet: number) {
        for (const station of this.stations) {
            for (const pump of station.GetAllPumps()) {
                const hosepipe = pump.GetHosepipeByVehicle(vehicleNet);
                if (hosepipe) return hosepipe;
            }
        }
        return null;
    }

    GetHosepipeFromJerryCan(entityNet: number) {
        for (const station of this.stations) {
            for (const pump of station.GetAllPumps()) {
                const hosepipe = pump.GetHosepipeByJerryCan(entityNet);
                if (hosepipe) return hosepipe;
            }
        }
        return null;
    }

    SetReplacePumpConfig(cfg: FuelPumpReplaceData[]) {
        this.PumpReplaceData = cfg;
        cfg.forEach((replaceData) => {
            replaceData.objects.forEach((hash) => {
                emit('propInt:AddPropInteraction', hash, {
                    label: replaceData.isElectricOnly ? 'Станция електро-заправки' : 'Топливная колонка',
                    action: 'useFuelPump',
                    denyBroken: true,
                    preventNetworking: false,
                    offsets: replaceData.offsets.map((offset) => ([offset.x, offset.y, offset.z])),
                    viewDisplays: replaceData.viewDisplays.map((offset) => ([offset.x, offset.y, offset.z])),
                });
            });
        });
    }

    GetPumpById(pumpId: string) {

    }

    async CreateClientObject<T>(player: number, model: string | number, pos: Vector3, rot: Vector3) {
        return new Promise<T>((done) => {
            let rid = 0;
            while (this.createObjectReturnPool[rid] != null) rid++;
            this.createObjectReturnPool[rid] = done;
            console.warn('propInt:CreateObject', player, model, pos.toObject(), rot.toObject(), rid);
            TriggerClientEvent('propInt:CreateObject', player, model, pos.toObject(), rot.toObject(), rid);
        });
    }

    ClientObjectCreated(player: number, netId: number, model: string, rID: number) {
        // this.logger.Log('ClientObjectCreated', netId, model, rID, typeof(this.createObjectReturnPool[rID]));
        if (this.createObjectReturnPool[rID]) {
            this.createObjectReturnPool[rID](netId);
            delete this.createObjectReturnPool[rID];
        }
    }

    GetObjectReplaceData(propNetId: number) {
        const prop = NetworkGetEntityFromNetworkId(propNetId);
        const model = GetEntityModel(prop);
        return this.PumpReplaceData.find((obj) => obj.objects.find((hash) => GetHashKey(hash) == model));
    }

    async OpenWorkerInteractMenu(player: number, playerLastVehicle: number | null) {
        const station = this.GetPlayerNearestStation(player);
        if (!station) throw new Error('No station nearest to player');

        const buyEmptyCan = async () => {
            const userid = await this.vRP.getUserId(player);
            const hasJerryCan = await this.vRP.hasInventoryItem(userid, 'wbody|WEAPON_PETROLCAN');
            const hasWeaponJerryCan = await this.vRPClient.getWeapons(player).then(([weapons]) => weapons['WEAPON_PETROLCAN'] != null);
            if (!hasJerryCan && !hasWeaponJerryCan) {
                this.playerService.OpenPaymentMenu(player, -10.0, station.brand).then(async ([ok]) => {
                    if (ok) {
                        this.vRP.giveInventoryItem(userid, 'wbody|WEAPON_PETROLCAN', 1, true, {petrol: 0, solvent: 0});
                        this.vRP.closeMenu(player);
                    } else {
                        this.vRPClient.notify(player, '~r~Недостаточно денег');
                    }
                });
            } else {
                this.vRPClient.notify(player, '~r~У вас уже есть канистра.');
            }
        };

        const refillLastVehicle = () => {
            const hosepipe = this.GetHosepipeFromVehicle(playerLastVehicle!);
            this.essenceService.RequestVehicleRefuel(player, playerLastVehicle!, hosepipe?.GetPump().IsElectric() ? station.GetElectricityCost() : station.GetFuelCost(), this);
        };

        const refillVehicleOnHosepipe = (hosepipe: Hosepipe) => {
            if (hosepipe.GetVehicle()) {
                this.essenceService.RequestVehicleRefuel(player, hosepipe.GetVehicle()!, hosepipe?.GetPump().IsElectric() ? station.GetElectricityCost() : station.GetFuelCost(), this);
            }
        };

        const refillJerryCanOnHosepipe = (hosepipe: Hosepipe) => {
            if (hosepipe.GetJerryCan()) {
                this.essenceService.RequestJerryCanRefuel(player, hosepipe, hosepipe.GetJerryCan()!, station.GetFuelCost());
            }
        };

        const isPlayerLastVeh = playerLastVehicle && this.GetHosepipeFromVehicle(playerLastVehicle);
        const menuData = {
            name: 'Gas station worker',
            ['1. Купить пустую канистру']: [buyEmptyCan, 'просто пустая канистра. или полная.. воздуха?'],
            [`2. Заправить транспорт ${isPlayerLastVeh ? GetVehicleNumberPlateText(NetworkGetEntityFromNetworkId(playerLastVehicle)) : ''}`]: playerLastVehicle ? [refillLastVehicle] : null,
        };

        for (const hosepipe of station.GetAllHosepipes()) {
            if (hosepipe?.IsTakenOut()) {
                if (hosepipe.GetVehicle()) {
                    menuData[`${hosepipe.GetPump().GetPumpNumber()}${hosepipe.GetHandlingName()}. Оплатить заправку Т/С`] = [refillVehicleOnHosepipe.bind(this, hosepipe)];
                } else if (hosepipe.GetJerryCan()) {
                    menuData[`${hosepipe.GetPump().GetPumpNumber()}${hosepipe.GetHandlingName()}. Оплатить заправку канистры`] = [refillJerryCanOnHosepipe.bind(this, hosepipe)];
                }
            }
        }

        this.vRP.openMenu(player, menuData);
    }

    public StaticElecticStations: ElecticPumpSpawnLocation[] = [];

    private IsCreateElecticStationLocked = false;

    async CreateElectricPumpProps(player: number, electicPumpsLocations?: ElecticPumpSpawnLocation[]) {
        if (this.IsCreateElecticStationLocked) return;
        this.IsCreateElecticStationLocked = true;

        this.StaticElecticStations = electicPumpsLocations || this.StaticElecticStations;

        for (const station of this.StaticElecticStations) {
            let found = false;
            for (const object of GetAllObjects()) {
                const model = GetEntityModel(object);
                const [ox, oy, oz] = GetEntityCoords(object);
                const [ex, ey, ez] = Vector3.fromXYZ(station.position).toArray();

                if ([GetHashKey('prop_electro_airunit01'), GetHashKey('prop_electro_airunit02')].includes(model) && vDist(ox, oy, oz, ex, ey, ez) <= 1.0) {
                    found = true;
                    break;
                }
            }
            console.log('CreateElectricPumpProps', found);

            if(!found) {
                this.CreateClientObject(player, 'prop_electro_airunit01', Vector3.fromXYZ(station.position), station.rotitation ? Vector3.fromXYZ(station.rotitation) : new Vector3(0,0,0));
            }
        }
    }
}