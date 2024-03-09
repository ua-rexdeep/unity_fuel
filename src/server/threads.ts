import { Logger } from '../logger';
import { EventName, vDist, Vector3, Wait } from '../utils';
import { FuelEssenceService } from './services/fuelEssenceService';
import { FuelStationService } from './services/fuelStationService';
import { PlayerService } from './services/playerService';

export class Threads {
    private readonly logger = new Logger('Threads');
    constructor(
        private readonly service: FuelStationService,
        private readonly essenceService: FuelEssenceService,
        private readonly playerService: PlayerService,
    ){
        this.Create('NozzleTooFarFromPump', this.NozzleTooFarFromPump.bind(this), 100);
        // this.Create('StationsLogger', this.StationsLogger.bind(this), 50);
        this.Create('VehicleFuelLogger', this.VehicleFuelLogger.bind(this), 1000);
        this.Create('FuelEssence', this.FuelEssence.bind(this), 1000);
        this.Create('FuelStationViewDisplay', this.FuelStationViewDisplay.bind(this), 1000);
        this.Create('SelectedWeapon', this.SelectedWeapon.bind(this), 100);
    }

    private Create(name: string, func: () => void, interval?: number) {
        let errorCatched = false;
        setTimeout(() => {
            setTick(async () => {
                try {
                    errorCatched = false;
                    func();
                } catch(e) {
                    if(!errorCatched) {
                        errorCatched = true;
                        this.logger.Error(`Error cathed in thread(${name})`);
                        console.trace(e);
                    }
                }
                if(interval != null) await Wait(interval);
            });
        }, 1000);
        this.logger.Log(`New thread(${name}) with interval ${interval}ms created.`);
    }

    private async NozzleTooFarFromPump() {
        const stations = this.service.GetAllStations();
        for(const station of stations) {
            for(const pump of station.GetAllPumps()) {

                // перевірити, чи на зміні об'єкту, воно не спрацює
                // if(pump.netEntity && !DoesEntityExist(NetworkGetEntityFromNetworkId(pump.netEntity))) {
                //     pump.hosepipes.forEach((_, i) => this.DeleteNozzle(pump.id, i));
                //     break;
                // }

                for(const hosepipe of pump.GetAllHosepipes()) {
                    if(hosepipe && pump.netEntity && NetworkGetEntityFromNetworkId(pump.netEntity) && hosepipe.GetNozzleNetId() && hosepipe.GetNozzleNetId()) { // в момент заміни моделі об'єкту - колонка не існує
                        
                        if(hosepipe.IsNozzleExistsAndValid()) {

                            if((hosepipe.GetPlayer() || hosepipe.GetVehicle()) && !hosepipe.IsBroken()) { // not broken and not in pump
                                const [nozzX, nozzY, nozzZ] = GetEntityCoords(hosepipe.GetNozzleLocalId());
                                const [pumpX, pumpY, pumpZ] = GetEntityCoords(NetworkGetEntityFromNetworkId(pump.netEntity));
        
                                if(vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ) >= 6.0) {

                                    if(hosepipe.GetPlayer()) {
                                        console.log('NozzleTooFarFromPump -> Drop', vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ), nozzX, nozzY, pumpX, pumpY);
                                        emitNet(EventName('DropPlayerNozzle'), hosepipe.GetPlayer(), hosepipe.GetNozzleNetId());
                                        hosepipe.SetDropped();
                                    } else if(hosepipe.GetVehicle()) {
                                        console.log('NozzleTooFarFromPump -> Drop2', vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ), nozzX, nozzY, pumpX, pumpY);
                                        hosepipe.SetBroken();
                                        emitNet(EventName('HosepipeSlotBrokenByVehicle'), NetworkGetEntityOwner(hosepipe.GetSlotLocalId()), hosepipe.GetSlotNetId());
                                        
                                        const refilling = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);
                                        if(refilling.inProgress) this.essenceService.InterruptVehicleRefill(hosepipe.GetVehicle()!, false);
                                        
                                    }
        
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private cache = {};
    private async StationsLogger() {
        const stations = this.service.GetAllStations();
        for(const player of this.playerService.GetPlayers()) {
            const nearestStaion = this.service.GetPlayerNearestStation(player);
            if(!this.cache[player] || JSON.stringify(this.cache[player]) != JSON.stringify(nearestStaion || '{}')) {
                this.logger.Warn(`Station logger for player ${player} triggered`);
                emitNet('propInt::Debugger', player, {
                    id: 'cm:2',
                    text: `LV: ${this.playerService.GetPlayerLastVehicle(player)} | Stations: ${JSON.stringify(stations, null, 4)}`,
                    entity: 0,
                    left: 50,
                    top: 400,
                    customPosition: true,
                });
                this.cache[player] = JSON.parse(JSON.stringify(nearestStaion));
            }
        }
    }

    private mileage: { meliage: number, lastCoords: Vector3 | null } = { meliage: 0, lastCoords: null };
    private async VehicleFuelLogger() {
        for(const player of getPlayers()) {
            const vehicle = GetVehiclePedIsIn(GetPlayerPed(player), false);
            if(!vehicle) continue;
            const vehicleNet = NetworkGetNetworkIdFromEntity(vehicle);
            if(!this.essenceService.IsVehicleInMemory(vehicleNet)) continue;

            const [x,y,z] = GetEntityCoords(vehicle);
            if(!this.mileage.lastCoords) this.mileage.lastCoords = new Vector3(x,y,z);
            this.mileage.meliage += vDist(this.mileage.lastCoords.x, this.mileage.lastCoords.y, this.mileage.lastCoords.z, x,y,z);
            this.mileage.lastCoords = new Vector3(x,y,z);

            emitNet('propInt::Debugger', player, {
                id: 'cm:2',
                text: `Vehicle(${vehicleNet}) | Fuel: ${this.essenceService.GetVehicleFuel(vehicleNet)?.toFixed(2)}/${this.essenceService.GetVehicleMaxFuel(vehicleNet)} | Meliage: ${(this.mileage.meliage / 1000).toFixed(2)} km`,
                entity: 0,
                left: 200,
                top: 400,
                customPosition: true,
            });
        }
    }

    private FuelEssence() {
        this.essenceService.ProcessVehiclesFuelEssence();
    }

    private playerViewDisplayCache: Record<number, boolean> = {};
    private FuelStationViewDisplay() {
        for(const player of this.playerService.GetPlayers()) {
            const playerPed = GetPlayerPed(player);
            const playerCoords = GetEntityCoords(playerPed);

            const station = this.service.GetPlayerNearestStation(player);
            if(!station) continue;
            let playerOnAnyPump = false;
            for(const pump of station.GetAllPumps()) {
                for(const hosepipe of pump.GetAllHosepipes()) {
                    if(hosepipe != null && hosepipe.GetVehicle() && this.essenceService.IsVehicleInMemory(hosepipe.GetVehicle()!)) {
                        const vehicleOnHosepipe = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);

                        const dist = vDist(hosepipe.viewDisplayWorldCoords.x, hosepipe.viewDisplayWorldCoords.y, hosepipe.viewDisplayWorldCoords.z, playerCoords[0], playerCoords[1], playerCoords[2]);
                        console.log(`Player ${player} pump(${pump.id}) distance(${dist})`);
                        if(dist <= 2.5) {
                            playerOnAnyPump = true;
                            this.playerViewDisplayCache[player] = true;
                            this.playerService.SendPlayerRefillData(player, (56 * vehicleOnHosepipe.totalRefilled).toFixed(2), vehicleOnHosepipe.totalRefilled.toFixed(2));
                            break;
                        }
                    }
                }
            }

            // not in any view display
            if(playerOnAnyPump == false && this.playerViewDisplayCache[player] == true) {
                this.playerViewDisplayCache[player] = false;
                this.playerService.SendPlayerHideRefillData(player);
            }
        }
    }

    private pedsWeaponCache = {};
    private SelectedWeapon() {
        const nextCache = {};
        for(const player of this.playerService.GetPlayers()) {
            const ped = GetPlayerPed(player);
            const weapon = GetSelectedPedWeapon(ped);

            if(weapon == GetHashKey('WEAPON_PETROLCAN')) {
                nextCache[ped] = weapon;

                if(this.pedsWeaponCache[ped] != weapon) {
                    this.playerService.GetPlayerDataTable(player).then(({ jerryCanWeaponData }) => {
                        if(!jerryCanWeaponData) return this.logger.Warn('NO jerryCanWeaponData');
                        emitNet(EventName('PlayerJerryCanUpdated'), player, jerryCanWeaponData);
                        if((jerryCanWeaponData.petrol||0) + (jerryCanWeaponData.solvent||0) == 0) this.playerService.Notification(player, 'Jerry can is ~b~empty~w~.');
                    });
                }
            }
        }
        this.pedsWeaponCache = nextCache;
    }
}