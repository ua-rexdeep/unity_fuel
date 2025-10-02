import { vDist } from '../../utils';
import { AircraftRefuelIsNotInProcessError, PlayerDontHaveMoveCarOnRentError } from '../errors';
import { AircraftService } from '../services/aircraftService';
import { FuelEssenceService } from '../services/fuelEssenceService';
import { PlayerService } from '../services/playerService';

export class HelicopterParkingSlot {
    private refuelProcess: null | {
        aircraftNet: number,
        requestedAt: number,
        requestedFuel: number,
        // player: Source,
        userid: UserId,
        refuelTimeout: NodeJS.Timeout,
        payMethod: null | string,
    } = null;
    constructor(
        private readonly aircraftService: AircraftService,
        private readonly playerService: PlayerService,
        private readonly essenceService: FuelEssenceService,
        public readonly id: string,
        public readonly x: number, 
        public readonly y: number,
        public readonly z: number,
        private readonly enableRefuelFeature: boolean) {

    }

    GetVehicleOnSlot() {
        for(const vehicle of GetAllVehicles() as number[]) {
            const [vx, vy, vz] = GetEntityCoords(vehicle);

            if(vDist(vx, vy, vz, this.x, this.y, this.z) <= 10.0) {
                return vehicle;
            }
        }
        return null;
    }

    GetVehicleOnSlotPlateText(): string | null {
        const vehicle = this.GetVehicleOnSlot();
        if(!vehicle) return null;
        return GetVehicleNumberPlateText(vehicle);
    }

    async IsAnyVehicleOnSlot(): Promise<boolean> {
        return Boolean(await this.GetVehicleOnSlot());
    }

    IsRefuelFeatureEnabled() {
        return this.enableRefuelFeature;
    }

    IsRefuelInProgress() {
        return this.refuelProcess != null;
    }

    GetRefuelData() {
        return this.refuelProcess;
    }

    async DoesVehicleOnSlotCanBeRefilled() {
        const vehicleOnSlot = this.GetVehicleOnSlot();
        if(vehicleOnSlot == null || vehicleOnSlot == 0) return false;
        const aircraftCache = await this.essenceService.GetVehicleCache(NetworkGetNetworkIdFromEntity(vehicleOnSlot));
        if(!aircraftCache || aircraftCache.class != 15) return false;
        return true;
    }

    async RequestRefuelProcess(userid: UserId, fuelToRefill: number, payMethod: null | string) {
        const player = await this.playerService.GetUserSource(userid);
        if(this.refuelProcess) throw new Error('already refilling');

        const vehicleOnSlot = this.GetVehicleOnSlot();
        if(vehicleOnSlot == null) return this.playerService.Notification(player, '~r~Нет транспорта на слоте парковки');
        const vehicleCanBeRefilled = await this.DoesVehicleOnSlotCanBeRefilled();
        if(!vehicleCanBeRefilled) return this.playerService.Notification(player, '~r~Транспорт на слоте парковни не может быть заправлен');
        const aircraftMaxFuel = this.essenceService.GetVehicleMaxFuel(NetworkGetNetworkIdFromEntity(vehicleOnSlot));

        // const playerRentCarBefore = await this.aircraftService.GetPlayerRentedMoveCar(player);
        // if(playerRentCarBefore) this.aircraftService.CancelPlayerRentMoveCar(userid);
        // const moveCar = await this.aircraftService.PlayerRentMoveCar(player);
        const aircraftCurrentFuel = this.essenceService.GetVehicleFuel(NetworkGetNetworkIdFromEntity(vehicleOnSlot));

        this.refuelProcess = {
            aircraftNet: NetworkGetNetworkIdFromEntity(vehicleOnSlot),
            userid: userid,
            payMethod,
            requestedAt: Date.now(),
            requestedFuel: fuelToRefill,
            refuelTimeout: setTimeout(async () => {
                if(!this.refuelProcess) return; // refilling was interrupted before
                if(!DoesEntityExist(vehicleOnSlot)) return this.InterruptRefuel(); // aircraft not exists

                const aircraftNet = NetworkGetNetworkIdFromEntity(vehicleOnSlot);
                await this.essenceService.GetVehicleCache(aircraftNet); // get information from client about vehilcle
                const newAircraftCurrentFuel = this.essenceService.GetVehicleFuel(aircraftNet);
                this.playerService.Notification(player, '~g~Транспорт заправлен.');

                if((newAircraftCurrentFuel! + fuelToRefill) > aircraftMaxFuel) {
                    this.essenceService.SetVehicleFuel(aircraftNet, aircraftMaxFuel);

                    const refund = +(((newAircraftCurrentFuel! + fuelToRefill) - aircraftMaxFuel) * this.aircraftService.GetAircraftFuelCost()).toFixed(2);
                    if(payMethod == null) {
                        this.playerService.GiveMoney(userid, refund);
                    } else {
                        this.playerService.CreateLynxPayment(userid, refund, 'Pegasus');
                    }
                } else {
                    this.essenceService.SetVehicleFuel(aircraftNet, newAircraftCurrentFuel! + fuelToRefill);
                    this.playerService.Notification(player, '~g~Транспорт заправлен.');
                    this.playerService.SendUserPhoneMessage(userid, '555-0122', 'Ваш транспорт в аэропорту Los-Santos был заправлен.');
                }
                this.refuelProcess = null;
            }, ((60 * 3) + (aircraftMaxFuel - aircraftCurrentFuel!)) * 1000)
        };
        
        const interval = setInterval(() => {

            // if(!moveCar || !moveCar.vehicleNet || !DoesEntityExist(NetworkGetEntityFromNetworkId(moveCar.vehicleNet))) {
            //     this.aircraftService.CancelPlayerRentMoveCar(userid).catch((_) => {});
            // }

            // if interrupted or end and player starts engine of vehicle. thats means, player want to leave
            // if(!this.refuelProcess && GetIsVehicleEngineRunning(vehicleOnSlot)) {
            //     try { this.aircraftService.CancelPlayerRentMoveCar(userid); } catch(e) {}
            //     clearInterval(interval);
            //     return;
            // }

            // if vehicle engine is on - interrupt. prevent player escape from refilling
            // if(this.refuelProcess && GetIsVehicleEngineRunning(vehicleOnSlot)) {
            //     try { this.aircraftService.CancelPlayerRentMoveCar(userid); } catch(e) {}
            //     this.InterruptRefuel();
            //     clearInterval(interval);
            //     return;
            // }

            this.aircraftService.GetPlayerRentedMoveCar(player).then((rentCar) => {
                if(rentCar == null && !this.refuelProcess) { // no rent car and refilling was interrupted or end
                    clearInterval(interval);
                    return;
                }
            });
        }, 1000);

        this.playerService.Notification(player, '~g~Пожалуйста, подождите пока ваш Т/С будет заправлен.');
        this.playerService.Notification(player, `~y~Это может занять до ${Math.ceil((aircraftMaxFuel + 60*3)/60)+1} минут.`);
    }

    GetRefuelRequestUserId() {
        return this.refuelProcess?.userid;
    }

    async InterruptRefuel() {
        if(!this.refuelProcess) throw new AircraftRefuelIsNotInProcessError(this.id);
        
        const requestedDiffInSec = (Date.now() - this.refuelProcess.requestedAt) / 1000;
        const player = await this.playerService.GetUserSource(this.refuelProcess.userid);
        
        if(requestedDiffInSec > 60 * 3) {
            const refund = this.refuelProcess.requestedFuel * this.aircraftService.GetAircraftFuelCost();
            this.playerService.Notification(player, `~r~Заправка прервана. ~y~Возврат: ${refund}(без стоимости услуги)`);
            if(this.refuelProcess.payMethod == null) this.playerService.GiveMoney(this.refuelProcess.userid, refund);
            else this.playerService.CreateLynxPayment(this.refuelProcess.userid, refund, 'Pegasus');
        } else { // full refund
            const refund = this.refuelProcess.requestedFuel * this.aircraftService.GetAircraftFuelCost() + 2550 + 238;
            this.playerService.Notification(player, `~r~Заправка прервана. ~y~Возврат: ${refund}`);
            if(this.refuelProcess.payMethod == null) this.playerService.GiveMoney(this.refuelProcess.userid, refund);
            else this.playerService.CreateLynxPayment(this.refuelProcess.userid, refund, 'Pegasus');
        }

        // this.aircraftService.CancelPlayerRentMoveCar(this.refuelProcess.userid).catch((error) => {
        //     if(error instanceof PlayerDontHaveMoveCarOnRentError) { console.log('[InterruptRefuel] Error catch prevented: player dont have move car to cancel'); }
        //     else console.error(error);
        // });
        this.refuelProcess = null;
    }
}