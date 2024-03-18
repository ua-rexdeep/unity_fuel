import { Logger } from '../../logger';
import { EventName, Vector3, Wait, vDist } from '../../utils';
import { PlayerDontHaveMoveCarOnRentError } from '../errors';
import { HelicopterParkingSlot } from '../models/heliParking';
import { FuelEssenceService } from './fuelEssenceService';
import { MySQLService } from './mysqlService';
import { PlayerService } from './playerService';

type RentedMoveCar = {
    vehicleNet: number,
    userId: number | null,
}
export class AircraftService {
    private readonly logger = new Logger('AircraftService');
    private parkingSlots: Record<string, HelicopterParkingSlot> = {};
    private rentedCerberus: {
        petrol: number,
        connectedToAircraft: number | null,
        userId: number,
        vehicleNet: number,
        firstSeat: boolean,
        refuelInterval: NodeJS.Timeout | number | null,
    }[] = [];

    private rentedMoveCars: Record<number, RentedMoveCar | null> = {};

    public readonly MoveCarsSpawnLocations: Vector3[] = [
        new Vector3(-1165.8676757812,-2789.1755371094,13.484511375427, 52.0),
        new Vector3(-1163.0689697266,-2784.5205078125,13.488617897034, 60.0),
        new Vector3(-1169.2629394531,-2802.4714355469,13.486329078674, 2.0),
    ];

    public readonly FuelTruckSpawnLocation = new Vector3(-1455.36,-3245.00,13.81, -84);

    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions,
        private readonly playerService: PlayerService,
        private readonly MySQL: MySQLService,
        private readonly essenceService: FuelEssenceService,
    ){   
        this.AddAircraftSlot('mainairport_1', -1178.39,-2845.87,13.94, true);
        this.AddAircraftSlot('mainairport_2', -1145.65,-2864.63,13.94, true);
        this.AddAircraftSlot('mainairport_3', -1112.44,-2883.88,13.94, true);
    }

    GetAircraftFuelCost() {
        return 3.82;
    }

    GetMoveCarRentPrice(){
        return 238;
    }

    GetAircraftSlots() {
        return this.parkingSlots;
    }

    AddAircraftSlot(id: string, x: number, y: number, z: number, enableRefuelFeature: boolean) {
        const slot = new HelicopterParkingSlot(this, this.playerService, this.essenceService, id, x, y, z, enableRefuelFeature);
        this.parkingSlots[id] = slot;
        return slot;
    }
    
    async SpawnMoveCars() {
        const vehiclesToMove = ['bison', 'dilettante', 'utillitruck3', 'contender'];

        for(const index in this.MoveCarsSpawnLocations) {
            const {x,y,z,h} = this.MoveCarsSpawnLocations[index];
            if(!this.rentedMoveCars[index] || !this.rentedMoveCars[index]!.vehicleNet) {
                const vehicle = CreateVehicle(vehiclesToMove[(Math.random()*(vehiclesToMove.length + 1) - 1)|0], x, y, z, h || 0.0, true, true);
                while(!DoesEntityExist(vehicle)) await Wait(100);
                if(this.rentedMoveCars[index]) this.rentedMoveCars[index]!.vehicleNet = NetworkGetNetworkIdFromEntity(vehicle);
                else this.rentedMoveCars[index] = {
                    userId: null,
                    vehicleNet: NetworkGetNetworkIdFromEntity(vehicle),
                };

                SetVehicleDoorsLocked(vehicle, 2);
                SetVehicleNumberPlateText(vehicle, `PEGASUS${(+index)+1}`);
            }
        }
    }

    DeleteMoveCars() {
        for(const [index, rentedCar] of Object.entries(this.rentedMoveCars)) {
            if(rentedCar && !rentedCar.userId) {
                emit('AdvancedParking:deleteVehicle', NetworkGetEntityFromNetworkId(rentedCar.vehicleNet));
                DeleteEntity(NetworkGetEntityFromNetworkId(rentedCar.vehicleNet));
                this.rentedMoveCars[+index] = null;
            }
        }
    }

    async PlayerRentMoveCar(player: number): Promise<null | { userId: number, vehicleNet: number }> {
        const userid = await this.vRP.getUserId(player);
        const freeVehicles = Object.entries(this.rentedMoveCars).filter(([_, data]) => data && data.vehicleNet && !data.userId && DoesEntityExist(NetworkGetEntityFromNetworkId(data.vehicleNet)));
        if(freeVehicles.length == 0) {
            this.vRPClient.notify(player, `~r~Нет свободных машин. ~b~Возврат: $${this.GetMoveCarRentPrice()}`);
            // TODO: refund car price
            return null;
        }
        else {
            const [index, freeVehicle] = freeVehicles[(Math.random()*(freeVehicles.length + 1) - 1)|0];
            if(!freeVehicle) return null;

            this.rentedMoveCars[+index]!.userId = userid;
            // SetVehicleDoorsLocked(NetworkGetEntityFromNetworkId(vehicleNet), 1);
    
            this.vRPClient.addEntityBlip(player, freeVehicle.vehicleNet, 853, 3, '[!] Временный транспорт');
            this.vRPClient.notify(player, '~y~[Pegasus]: ~w~Временный транспорт помечен на карте.');
            this.vRPClient.notify(player, '~y~Вы можете пользоваться им, пока идет заправка.');

            return this.rentedMoveCars[+index] as { userId: number, vehicleNet: number } | null;
        }
    }

    async CancelPlayerRentMoveCar(userid: UserId) {
        const player = await this.vRP.getUserSource(userid);
        const rentIndex = Object.entries(this.rentedMoveCars).find(([_, data]) => data?.userId == userid)?.[0];
        if(rentIndex == undefined) throw new PlayerDontHaveMoveCarOnRentError(player);
        const vehicleLocal = NetworkGetEntityFromNetworkId(this.rentedMoveCars[+rentIndex]!.vehicleNet);
        emit('AdvancedParking:deleteVehicle', GetVehicleNumberPlateText(vehicleLocal));
        DeleteEntity(vehicleLocal);
        this.rentedMoveCars[+rentIndex] = null;
        this.logger.Log('Move car rent cancelled for player', player);
        this.playerService.Notification(player, '~y~[Pegasus] ~r~Временный транспорт забрал работник службы.');
    }

    async PlayerRentFuelTruck(player: number){
        const userid = await this.vRP.getUserId(player);

        // const playerRentedTruck = await this.GetPlayerRentedFuelTruck(player);
        // if(playerRentedTruck) {
        //     this.vRPClient.notify(player, '~r~You already have rented fuel truck.');
        //     return;
        // }

        if(GetAllVehicles().some((vehicle: number) => {
            const [vx, vy, vz] = GetEntityCoords(vehicle);
            return vDist(vx, vy, vz, this.FuelTruckSpawnLocation.x,this.FuelTruckSpawnLocation.y, this.FuelTruckSpawnLocation.z) <= 10.0;
        })) {
            this.vRPClient.notify(player, '~r~Наша топливная цистерна занята. Попробуйте позже.');
            return;
        }
        
        this.PlayerRentMoveCar(player);

        const cerberus = CreateVehicle('cerberus2', this.FuelTruckSpawnLocation.x,this.FuelTruckSpawnLocation.y, this.FuelTruckSpawnLocation.z, this.FuelTruckSpawnLocation.h!, true, true);
        // SetVehicleDoorsLocked(cerberus, 2);
        SetVehicleNumberPlateText(cerberus, 'PEGASUSF');
        while(!DoesEntityExist(cerberus)) {
            await Wait(100);
        }
        this.rentedCerberus.push({
            connectedToAircraft: null,
            petrol: 500,
            userId: userid,
            vehicleNet: NetworkGetNetworkIdFromEntity(cerberus),
            firstSeat: false,
            refuelInterval: null,
        });
        
        this.vRPClient.setGPS(player, this.FuelTruckSpawnLocation.x,this.FuelTruckSpawnLocation.y);
        this.vRPClient.setNamedBlip(player, 'pegasus_fueltruck', this.FuelTruckSpawnLocation.x,this.FuelTruckSpawnLocation.y, this.FuelTruckSpawnLocation.z, 477, 3, '[!] Топливная цистерна');
    }

    async GetPlayerRentedMoveCar(player: number) {
        const playerUserId = await this.vRP.getUserId(player);
        for(const [_, moveCarData] of Object.entries(this.rentedMoveCars)) {
            if(!moveCarData) continue;
            if(playerUserId == moveCarData.userId) return moveCarData.vehicleNet;
        }
        return null;
    }

    async GetPlayerRentedFuelTruck(userid: UserId) {
        for(const data of this.rentedCerberus) {
            if(!data) continue;
            if(userid == data.userId) return data.vehicleNet;
        }
        return null;
    }

    GetFuelTruckRefuelData(vehicleNet: number | null) {
        if(vehicleNet == null) return null;
        for(const data of this.rentedCerberus) {
            if(!data) continue;
            if(vehicleNet == data.vehicleNet) return data;
        }
        return null;
    }

    async OpenAirHostessInteractMenu(player: number) {
        const userid = await this.vRP.getUserId(player);
        const playerRentedTruck = await this.GetPlayerRentedFuelTruck(userid);
        const fuelTruckData = this.GetFuelTruckRefuelData(playerRentedTruck);
        const aircraftSlots = this.GetAircraftSlots();

        const fullFuelTruckPrice = this.GetAircraftFuelCost() * 500 + (1850 + this.GetMoveCarRentPrice());
        const rentFuelTruck = async (player: number) => {
            await this.PlayerRentFuelTruck(player);
            this.OpenAirHostessInteractMenu(player);
        };

        const stopRentFuelTruck = async (player: number) => {
            await this.UserStopRentFuelTruck(userid);
            this.OpenAirHostessInteractMenu(player);
        };

        const fullRefuelPrice = 2600 + this.GetMoveCarRentPrice();
        const requestRefuelSlot = (slot: string) => async (player: number) => {
            const vehOnSlot = aircraftSlots[slot].GetVehicleOnSlot();
            if(!vehOnSlot) return this.playerService.Notification;
            const cache = await this.essenceService.GetVehicleCache(NetworkGetNetworkIdFromEntity(vehOnSlot));
            const maxFuel = this.essenceService.GetVehicleMaxFuel(NetworkGetNetworkIdFromEntity(vehOnSlot));

            this.vRP.prompt(player, 'Кол-во топлива для заправки', (maxFuel - cache.fuel).toFixed(1), (player, value) => {
                try {
                    const fuelToRefill = parseFloat(value) * 0.997;
    
                    if(isNaN(fuelToRefill) || fuelToRefill == 0) return;
                    if(fuelToRefill < 0) return this.vRPClient.notify(player, '~r~Значение должно быть больше 0.');
    
                    this.playerService.OpenPaymentMenu(player, +(fullRefuelPrice + this.GetAircraftFuelCost() * fuelToRefill).toFixed(2), 'Pegasus')
                        .then(([ok, method, card]) => {
                            if(ok) {
                                aircraftSlots[slot].RequestRefuelProcess(userid, fuelToRefill, method == 'BANK' ? card : null).then(() => {
                                    this.OpenAirHostessInteractMenu(player);
                                });
                            } else {
                                this.vRPClient.notify(player, '~r~Недостаточно денег');
                            }
                        });
    
                } catch(e) {
                    this.vRPClient.notify(player, '~r~Неверное значение.');
                }
                return;
            });
            return;
        };

        const interruptRefuelSlot = (slot: string) => (player: number) => {
            aircraftSlots[slot].InterruptRefuel();
            this.OpenAirHostessInteractMenu(player);
        };
        
        const getRefuelSlotBusyMenuData = (slot: string): [() => void] | undefined => {
            if(aircraftSlots[slot].IsRefuelInProgress()) {
                if(aircraftSlots[slot].GetRefuelRequestUserId() != userid) return [() =>  {}];
                else return undefined;
            } else return undefined;
        };
        
        const getRefuelSlotMenuData = (slot: string): [(_: number) => void, string] | undefined => {
            if(aircraftSlots[slot].IsRefuelInProgress()) return undefined;
            else return [requestRefuelSlot(slot), 
                `Цена керосина за литр: $${this.GetAircraftFuelCost()}<br>Цена за услугу: $2600<br>Цена за временный транспорт: $${this.GetMoveCarRentPrice()}<br>Сумма за услуги: <font style="color:orange";>$${fullRefuelPrice}</font>`];
        };
        
        const getRefuelSlotInterruptMenuData = (slot: string): [(_: number) => void] | undefined => {
            if(aircraftSlots[slot].IsRefuelInProgress() && aircraftSlots[slot].GetRefuelRequestUserId() == userid) return [interruptRefuelSlot(slot)];
            else return undefined;
        };

        this.vRP.openMenu(player, {
            name: 'Airport hostess',
            ['1. Арендовать топливную цистерну [Недоступно]']: playerRentedTruck ? void 0 : [() => {}, 
                `<span style="color:orange;font-weight:bold;">[Недоступно] Заправка вручную через автоцистерну</span><br><br>
Цена керосина за литр: $${this.GetAircraftFuelCost()}<br>
Кол-во топлива в цистерне: 500L<br>
Цена за оренду: $1850<br>
Цена за временный транспорт: $${this.GetMoveCarRentPrice()}<br>
Загалом: <font style="color:orange";>$${fullFuelTruckPrice}</font>`],
            ['1. Закончить оренду цистерны']: fuelTruckData ? [stopRentFuelTruck, 'Вернем стоимость не использованого топлива'] : undefined,
            ['2. Заправка слот #1']: getRefuelSlotMenuData('mainairport_1'),
            ['2. Слот #1 занят']: getRefuelSlotBusyMenuData('mainairport_1'),
            ['2. Прервать заправку слот #1']: getRefuelSlotInterruptMenuData('mainairport_1'),

            ['3. Заправка слот #2']: getRefuelSlotMenuData('mainairport_2'),
            ['3. Слот #2 занят']: getRefuelSlotBusyMenuData('mainairport_2'),
            ['3. Прервать заправку слот #2']: getRefuelSlotInterruptMenuData('mainairport_2'),

            ['4. Заправка слот #3']: getRefuelSlotMenuData('mainairport_3'),
            ['4. Слот #3 занят']: getRefuelSlotBusyMenuData('mainairport_3'),
            ['4. Прервать заправку слот #3']: getRefuelSlotInterruptMenuData('mainairport_3'),
        });
    }

    async ConnectFuelTruckToAircraft(player: number, fuelTruckNet: number, aircraftNet: number, offset: { x: number, y: number, z: number }){
        const fuelTruckLocal = NetworkGetEntityFromNetworkId(fuelTruckNet);
        const [fx, fy, fz] = GetEntityCoords(fuelTruckLocal);
        const [ax, ay, az] = GetEntityCoords(NetworkGetEntityFromNetworkId(aircraftNet));
        
        const rentData = this.rentedCerberus.find((cerberus) => cerberus.vehicleNet == fuelTruckNet);
        if(rentData) {
            if(rentData.connectedToAircraft) return this.playerService.Notification(player, '~r~Цистерна уже подключена');
            rentData.connectedToAircraft = aircraftNet;
        }
        else {
            throw new Error('Unknown cerberus');
        }
        
        this.playerService.CreateRopeWithAttachments(player, {
            pumpCoords: [fx, fy, fz],
            from: {
                netEntity: fuelTruckNet,
                offset: new Vector3(offset.x, offset.y, offset.z).toObject(),
            },
            to: {
                netEntity: aircraftNet,
                offset: new Vector3(0, -1.306, -0.021).toObject(),
            },
            ropeLength: vDist(fx, fy, fz, ax, ay, az) + 3.0,
            ropeType: 2,
        });
    }

    DisconnectFuelTruck(player: number, fuelTruckNet: number) {
        const rentData = this.rentedCerberus.find((cerberus) => cerberus.vehicleNet == fuelTruckNet);
        if(!rentData) throw new Error('No rent data for fuel truck');
        this.playerService.DeleteRopeForNozzle(player, rentData.connectedToAircraft!);
        if(rentData.refuelInterval) {
            this.ToggleFuelTruckRefuel(player, fuelTruckNet);
            this.playerService.Notification(player, '~y~Заправка ~r~прервана~y~.');
        }
        rentData.connectedToAircraft = null;
    }

    GetRestrictedAreaCorners() {
        return [            
            new Vector3(-1132.0750732422,-2706.4328613281,14.239081382751),
            new Vector3(-964.41796875,-2799.6579589844,14.239092826843),
            new Vector3(-927.37268066406,-2767.2502441406,13.944486618042),
            new Vector3(-770.96270751953,-2847.4458007812,13.947419166565),
            new Vector3(-1003.6857299805,-2417.7485351562,14.241647720337),
            new Vector3(-989.48626708984,-2347.3041992188,13.924918174744),
        ];
    }

    ToggleFuelTruckRefuel(player: number, vehicleNet: number) {
        const fuelTruckData = this.GetFuelTruckRefuelData(vehicleNet);
        if(!fuelTruckData) throw new Error(`No refuel data for fuel truck ${vehicleNet}`);

        if(!fuelTruckData.refuelInterval) {
            fuelTruckData.refuelInterval = setInterval((() => {
                if(!fuelTruckData.connectedToAircraft) {
                    this.ToggleFuelTruckRefuel(player, vehicleNet); // interrupt
                    throw new Error('No aircraft connected to truck');
                }

                if(!this.essenceService.IsVehicleInMemory(fuelTruckData.connectedToAircraft)) {
                    this.ToggleFuelTruckRefuel(player, vehicleNet); // interrupt
                    this.DisconnectFuelTruck(player, vehicleNet);
                    throw new Error('aircraft not longer exists');
                }

                const aircraftFuel = this.essenceService.GetVehicleFuel(fuelTruckData.connectedToAircraft);
                const aircraftMaxFuel = this.essenceService.GetVehicleMaxFuel(fuelTruckData.connectedToAircraft);
                if(aircraftFuel == null) {
                    this.ToggleFuelTruckRefuel(player, vehicleNet); // interrupt
                    throw new Error('no aircraft essence');
                }

                const fuelToAdd = (Math.random()*(7-3)+3) / 10;
                if(aircraftFuel + fuelToAdd > aircraftMaxFuel) {
                    this.playerService.Notification(player, '~y~Заправка ~r~остановлена~y~.');
                    return this.ToggleFuelTruckRefuel(player, vehicleNet);
                }

                fuelTruckData.petrol -= fuelToAdd;
                this.essenceService.SetVehicleFuel(fuelTruckData.connectedToAircraft, aircraftFuel + fuelToAdd);
                
            }).bind(this), 1000);
        } else {
            clearInterval(fuelTruckData.refuelInterval);
            fuelTruckData.refuelInterval = null;
        }

        this.SendPlayerFuelTruckData(player, vehicleNet);
    }

    SendPlayerFuelTruckData(player: number, vehicleNet: number) {
        const fuelTruckData = this.GetFuelTruckRefuelData(vehicleNet);
        if(!fuelTruckData) throw new Error(`No refuel data for fuel truck ${vehicleNet}`);
        emitNet(EventName('FuelTruckRefuelData'), player, vehicleNet, fuelTruckData.connectedToAircraft, fuelTruckData.petrol, !!fuelTruckData.refuelInterval);
    }

    // TODO
    async UserStopRentFuelTruck(userid: UserId) {
        const player = await this.playerService.GetUserSource(userid);
        const truckNet = await this.GetPlayerRentedFuelTruck(player);
        if(!truckNet) throw new Error('Player does not have rented fuel truck');
        const truckData = this.GetFuelTruckRefuelData(truckNet);
        if(!truckData) throw new Error(`No rent data for truck ${truckNet}`);

        if(truckData.refuelInterval) this.ToggleFuelTruckRefuel(player, truckNet);
        
        this.CancelPlayerRentMoveCar(player).catch((e) => {
            if(e instanceof PlayerDontHaveMoveCarOnRentError) { console.log('[PlayerStopRentFuelTruck] prevent error due to player dont have rent car'); }
            else throw e;
        });
        DeleteEntity(NetworkGetEntityFromNetworkId(truckNet));

        const remainingFuelCost = truckData.petrol * this.GetAircraftFuelCost();
        if(truckData.firstSeat) { // without service
            this.playerService.Notification(player, `~y~Возврат: $${remainingFuelCost.toFixed(2)}(без стоимость услуги)`);
            // TODO: refund
        }
        else {
            this.playerService.Notification(player, `~y~Возврат: $${(remainingFuelCost + 1850).toFixed(2)}(без стоимость временной машины)`);
            // TODO: refund
        }

        const rentTruckIndex = this.rentedCerberus.findIndex((data) => data?.vehicleNet == truckNet);
        delete this.rentedCerberus[rentTruckIndex];
    }
}
