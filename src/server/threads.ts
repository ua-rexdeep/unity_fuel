import { Logger } from '../logger';
import { EventName, vDist, Vector3, Wait } from '../utils';
import { AircraftService } from './services/aircraftService';
import { FuelEssenceService } from './services/fuelEssenceService';
import { FuelStationService } from './services/fuelStationService';
import { PlayerService } from './services/playerService';
import { PropInteractionAPI } from './services/propInteraction';

export class Threads {
    private readonly logger = new Logger('Threads');
    constructor(
        private readonly service: FuelStationService,
        private readonly essenceService: FuelEssenceService,
        private readonly playerService: PlayerService,
        private readonly aircraftService: AircraftService,
    ){
        this.Create('NozzleTooFarFromPump', this.NozzleTooFarFromPump.bind(this), 100);
        if(process.env.NODE_ENV == 'development') {
            // this.Create('StationsLogger', this.StationsLogger.bind(this), 50);
            // this.Create('VehicleFuelLogger', this.VehicleFuelLogger.bind(this), 1000);
        }
        this.Create('FuelEssence', this.FuelEssence.bind(this), 1000);
        this.Create('FuelStationViewDisplay', this.FuelStationViewDisplay.bind(this), 1000);
        this.Create('SelectedWeapon', this.SelectedWeapon.bind(this), 100);
        this.Create('HosepipeRopes', this.HosepipeRopes.bind(this), 100);
        this.Create('Blips', this.Blips.bind(this), 500);
        this.Create('AircraftVehicles', this.AircraftVehicles.bind(this), 1000);
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
        const allHosepipes = this.service.GetAllStations().map((station) => station.GetAllHosepipes()).flat(2);

        for(const hosepipe of allHosepipes) {
            if(!hosepipe) continue;
            const pump = hosepipe.GetPump();
            if(pump.GetBusy() || !DoesEntityExist(pump.GetPumpLocalId()!)) continue; // обхід зайнятості колонки, якщо вона змінює свою модель

            if(hosepipe.IsTakenOut()) { // в момент заміни моделі об'єкту - колонка не існує
                
                if(hosepipe.IsNozzleExistsAndValid()) {

                    if(hosepipe.IsTakenOut() && !hosepipe.IsBroken()) { // not broken and not in pump
                        const [nozzX, nozzY, nozzZ] = GetEntityCoords(hosepipe.GetNozzleLocalId());
                        const [pumpX, pumpY, pumpZ] = GetEntityCoords(hosepipe.GetPump().GetPumpLocalId()!);

                        if(vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ) >= 6.0) {

                            if(hosepipe.GetPlayer()) {
                                console.log('NozzleTooFarFromPump -> Drop', vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ).toFixed(2), 
                                    nozzX.toFixed(2), nozzY.toFixed(2), pumpX.toFixed(2), pumpY.toFixed(2), `PumpLocalID: ${pump.GetPumpLocalId()}`);
                                emitNet(EventName('DropPlayerNozzle'), hosepipe.GetPlayer(), hosepipe.GetNozzleNetId());
                                hosepipe.SetDropped();
                            } else if(hosepipe.GetVehicle()) {
                                console.log('NozzleTooFarFromPump -> Drop2', vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ).toFixed(2), 
                                    nozzX.toFixed(2), nozzY.toFixed(2), pumpX.toFixed(2), pumpY.toFixed(2), `PumpLocalID: ${pump.GetPumpLocalId()}`);
                                hosepipe.SetBroken();
                                emitNet(EventName('HosepipeSlotBrokenByVehicle'), NetworkGetEntityOwner(hosepipe.GetSlotLocalId()), hosepipe.GetSlotNetId());
                                
                                const refilling = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);
                                if(refilling.inProgress) this.essenceService.InterruptVehicleRefill(hosepipe.GetVehicle()!, null, false);
                            } else if(hosepipe.GetJerryCan()) {
                                const attachedTo = GetEntityAttachedTo(hosepipe.GetJerryCanLocalId()!);
                                if(attachedTo) {
                                    const propIntAPI = new PropInteractionAPI();
                                    propIntAPI.RequestDetachEntity(hosepipe.GetJerryCan()!);
                                }
                                
                                emitNet(EventName('DropPlayerNozzle'), NetworkGetEntityOwner(hosepipe.GetNozzleLocalId()), hosepipe.GetNozzleNetId());
                                hosepipe.SetDropped();
                            }

                        }
                    }
                }
            }
        }
    }

    private cache: Record<number, any> = {};
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
                id: 'cm:3',
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
                    if(hosepipe == null) continue;
                    if(hosepipe.GetVehicle() && this.essenceService.IsVehicleInMemory(hosepipe.GetVehicle()!)) {
                        const vehicleOnHosepipe = this.essenceService.GetVehicleRefillingData(hosepipe.GetVehicle()!);
                        const cost = pump.IsElectric() ? station.GetElectricityCost() : station.GetFuelCost();
                        const dist = vDist(hosepipe.viewDisplayWorldCoords.x, hosepipe.viewDisplayWorldCoords.y, hosepipe.viewDisplayWorldCoords.z, playerCoords[0], playerCoords[1], playerCoords[2]);
                        if(dist <= 2.5) {
                            playerOnAnyPump = true;
                            this.playerViewDisplayCache[player] = true;
                            this.playerService.SendPlayerRefillData(player, (cost * vehicleOnHosepipe.totalRefilled).toFixed(2), vehicleOnHosepipe.totalRefilled.toFixed(2));
                            break;
                        }
                    }

                    if(hosepipe.GetJerryCan() && this.essenceService.GetPlacedJerryCan(hosepipe.GetJerryCan()!)) {
                        const refillData = this.essenceService.GetPlacedJerryCan(hosepipe.GetJerryCan()!);
                        
                        const dist = vDist(hosepipe.viewDisplayWorldCoords.x, hosepipe.viewDisplayWorldCoords.y, hosepipe.viewDisplayWorldCoords.z, playerCoords[0], playerCoords[1], playerCoords[2]);
                        if(dist <= 2.5) {
                            playerOnAnyPump = true;
                            this.playerViewDisplayCache[player] = true;
                            this.playerService.SendPlayerRefillData(player, (station.GetFuelCost() * refillData.totalRefilled).toFixed(2), refillData.totalRefilled.toFixed(2));
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

    private pedsWeaponCache: Record<number, number> = {};
    private SelectedWeapon() {
        const nextCache: Record<number, number> = {};
        for(const player of this.playerService.GetPlayers()) {
            const ped = GetPlayerPed(player);
            const weapon = GetSelectedPedWeapon(ped);

            if(weapon == GetHashKey('WEAPON_PETROLCAN')) {
                nextCache[ped] = weapon;

                if(this.pedsWeaponCache[ped] != weapon) {
                    this.playerService.GetPlayerDataTable(player).then(({ jerryCanWeaponData }) => {
                        if(!jerryCanWeaponData) return this.logger.Warn('NO jerryCanWeaponData');
                        emitNet(EventName('PlayerJerryCanUpdated'), player, jerryCanWeaponData);
                    });
                }
            }
        }
        this.pedsWeaponCache = nextCache;
    }

    async HosepipeRopes() {
        for(const player of this.playerService.GetPlayers()) {
            const [px, py, pz] = GetEntityCoords(GetPlayerPed(player));
            const start = Date.now();
            const allHosepipes = this.service.GetAllStations().map((station) => station.GetAllHosepipes()).flat(2);
            for(const hosepipe of allHosepipes) {
                if(!hosepipe) continue;

                const IsPlayerHaveRope = hosepipe.playersInRange.includes(player);
                const IsPlayerInRange = vDist(px, py, pz, hosepipe.worldCoords.x, hosepipe.worldCoords.y, hosepipe.worldCoords.z) < 50;

                // console.log(`HS(${hosepipe.GetPump().id}/${hosepipe.index})`, hosepipe.IsTakenOut()?'takenout':'inpump', IsPlayerInRange ? 'playerinrange':'notinrange', IsPlayerHaveRope?'haverope':'donthaverope');

                if(hosepipe.IsTakenOut() && !IsPlayerHaveRope && IsPlayerInRange) {
                    hosepipe.CreateRopeForPlayer(this.playerService, player);
                } 
                else if((!hosepipe.IsTakenOut() && IsPlayerHaveRope) || hosepipe.IsTakenOut() && IsPlayerHaveRope && !IsPlayerInRange) {
                    hosepipe.DeleteRopeForPlayer(this.playerService, player);
                }
            }
            if(Date.now()-start > 10) console.log(`HosepipeRopes processed ${allHosepipes.length} hosepipes and took ${Logger.red(`${Date.now()-start}ms`)}`);
        }
    }

    private playersVehicle: Record<number, number> = {};
    async Blips() {
        for(const player of this.playerService.GetPlayers()) {
            const vehicle = GetVehiclePedIsIn(GetPlayerPed(player), false);
            
            if(this.playersVehicle[player] == null) this.playersVehicle[player] = 0;

            if(this.playersVehicle[player] != vehicle) {
                if(vehicle) {
                    const vehicleNet = NetworkGetNetworkIdFromEntity(vehicle);
                    const cache = await this.essenceService.GetVehicleCache(vehicleNet);
                    if(cache.class == 15) { // helicopters
                        for(const [id, station] of Object.entries(this.aircraftService.GetAircraftSlots())) {
                            this.playerService.AddHelicopterFuelParkingBlip(player, station);
                        }
                    } else {
                        for(const station of this.service.GetAllStations()) {
                            this.playerService.AddVehicleFuelStationBlip(player, station);
                        }

                        // const rentedCar = await this.aircraftService.GetPlayerRentedMoveCar(player);
                        const rentedFuelTruck = await this.aircraftService.GetPlayerRentedFuelTruck(player);
                        if(rentedFuelTruck == vehicleNet) {
                            this.playerService.AddAirportRestrictedAreaBlips(player, this.aircraftService.GetRestrictedAreaCorners());
                        }
                    }
                } else if(this.playersVehicle[player] && DoesEntityExist(this.playersVehicle[player])) {
                    const vehicleNet = NetworkGetNetworkIdFromEntity(this.playersVehicle[player]);
                    this.playerService.RemoveVehicleFuelStationBlips(player);
                    this.playerService.RemoveHelicopterFuelParkingBlips(player);
                    this.playerService.RemoveAirportRestrictedAreaBlips(player);
                    this.essenceService.SaveVehicleFuel(vehicleNet);
                }
                this.playersVehicle[player] = vehicle;
            }
        }
    }

    private playersInMoveCarsSpawnRange: Set<number> = new Set();
    async AircraftVehicles() {
        const nextList: Set<number> = new Set();
        for(const player of this.playerService.GetPlayers()) {
            const userid = await this.playerService.GetUserId(player);
            const playerVehicle = GetVehiclePedIsIn(GetPlayerPed(player), false);
            const [px, py, pz] = GetEntityCoords(GetPlayerPed(player));

            for(const {x,y,z} of this.aircraftService.MoveCarsSpawnLocations) {
                if(vDist(px, py, pz, x, y, z) <= 150.0) {
                    nextList.add(player);
                }
            }

            // rented move car lock state
            const rentedVehicleNet = await this.aircraftService.GetPlayerRentedMoveCar(player);
            if(rentedVehicleNet) {
                const rentedLocal = NetworkGetEntityFromNetworkId(rentedVehicleNet);
                const [rx, ry, rz] = GetEntityCoords(rentedLocal);
                const distToCar = vDist(px, py, pz, rx, ry, rz);
                
                if(process.env.NODE_ENV == 'development') {
                    console.log(`Player(${player}) distance to rent car`,rentedVehicleNet, `${distToCar}m`, `LockState(${GetVehicleDoorLockStatus(rentedLocal)})`);
                }

                if(GetVehicleDoorLockStatus(rentedLocal) == 2 && distToCar < 15.0) {
                    this.playerService.Notification(player, '~y~[Pegasus keyless] ~g~Транспорт открыт.');
                    SetVehicleDoorsLocked(rentedLocal, 1);
                } else if(GetVehicleDoorLockStatus(rentedLocal) != 2 && distToCar > 15.0) {
                    this.playerService.Notification(player, '~y~[Pegasus keyless] ~b~Транспорт закрыт.');
                    SetVehicleDoorsLocked(rentedLocal, 2);
                }
                //  else if(distToCar > 600.0) {
                //     this.aircraftService.CancelPlayerRentMoveCar(player);
                //     this.playerService.Notification(player, '~y~[Pegasus] ~r~The car was taken away by a service employee');
                // }
            }

            // rented fuel truck restricted area
            const fuelTruckNet = await this.aircraftService.GetPlayerRentedFuelTruck(player);
            if(fuelTruckNet) {
                const rentedLocal = NetworkGetEntityFromNetworkId(fuelTruckNet);
                const [tx, ty, tz] = GetEntityCoords(rentedLocal);
                const fuelTruckData = this.aircraftService.GetFuelTruckRefuelData(fuelTruckNet)!;

                if(playerVehicle == rentedLocal && !fuelTruckData.firstSeat) {
                    fuelTruckData.firstSeat = true;
                    this.playerService.AddEntityBlip(player, fuelTruckNet, 477, 3, '[!] Топливная цистерна');
                    this.playerService.RemoveNamedBlip(player, 'pegasus_fueltruck');
                    console.log('Rented fuel truck first seat locked');
                } else if(vDist(tx, ty, tz, px, py, pz) <= 20.0) {
                    this.aircraftService.SendPlayerFuelTruckData(player, fuelTruckNet);
                }

                // console.log('rentedFuelTruck', fuelTruckData.connectedToAircraft, GetVehicleDoorLockStatus(rentedLocal));

                if(GetVehicleDoorLockStatus(rentedLocal) == 0 && fuelTruckData.connectedToAircraft) {
                    SetVehicleDoorsLocked(rentedLocal, 2);
                    for(const seat of [-1, 0]) {
                        if(GetPedInVehicleSeat(rentedLocal, seat) != 0) TaskLeaveVehicle(GetPedInVehicleSeat(rentedLocal, seat), rentedLocal, 4160);
                    }
                } 

                if(GetVehicleDoorLockStatus(rentedLocal) == 2 && !fuelTruckData.connectedToAircraft) {
                    SetVehicleDoorsLocked(rentedLocal, 1);
                }

                if(GetIsVehicleEngineRunning(rentedLocal)) {
                    for(const corner of this.aircraftService.GetRestrictedAreaCorners()) {
                        if(vDist(tx, ty, tz, corner.x, corner.y, corner.z) <= 20.0) {
                            this.essenceService.SetVehicleFuel(fuelTruckNet, 0.0);
                            this.playerService.Notification(player, '~y~[Pegasus] ~r~Топливная цистерна не может выехать из аеропорта.');
                            this.playerService.Notification(player, '~y~[Pegasus] ~r~Покиньте машину.');
                            setTimeout(() => {
                                this.aircraftService.UserStopRentFuelTruck(userid);
                            }, 10_000);
                            break;
                        }
                    }
                }
            }
        }

        // if(this.playersInMoveCarsSpawnRange.size != 0 && nextList.size == 0) {
        //     nextList.clear();
        //     this.aircraftService.DeleteMoveCars();
        //     this.playersInMoveCarsSpawnRange = nextList;
        // }

        // if(this.playersInMoveCarsSpawnRange.size == 0 && nextList.size != 0) {
        //     await this.aircraftService.SpawnMoveCars();
        //     this.playersInMoveCarsSpawnRange = nextList;
        // }

    }
}