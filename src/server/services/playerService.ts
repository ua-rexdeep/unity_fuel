import { EventName, Vector3 } from '../../utils';
import { FuelPump } from '../models/fuelPump';
import { HelicopterParkingSlot } from '../models/heliParking';
import { FuelStation } from '../models/station';

export class PlayerService {
    constructor(
        private readonly vRP: vRPServerFunctions,
        private readonly vRPClient: vRPClientFunctions
    ) {
    }

    private playerVehicle: Record<number, number> = {};

    async IsPlayerAdmin(source: number) {
        const userId = await this.vRP.getUserId(source);
        const groups = await this.vRP.getUserGroups(userId);
        return ['admin'].some((key) => Object.keys(groups).includes(key));
    }

    Notification(source: number, notification: string) {
        this.vRPClient.notify(source, notification);
    }

    // source = -1 for all players to be target
    CreateRopeWithAttachments(source: Source, ropeAttachements: RopeAttachements) {
        // new Logger('CreateRopeWithAttachments', source, ropeAttachements);
        emitNet(EventName('CreateRopeWithAttachments'), source, ropeAttachements);
    }

    DeleteRopeForNozzle(player: number, nozzleNet: number) {
        emitNet(EventName('RemoveNozzleRope'), player, nozzleNet);
    }

    SetPlayerLastVehicle(player: number, vehicle: number) {
        this.playerVehicle[player] = vehicle;
        // emitNet(EventName('LastVehicleUpdated'), player, vehicle); // @unused
    }

    GetPlayerLastVehicle(player: number) {
        return this.playerVehicle[player];
    }

    OnPlayerDropNozzle(player: number) {
        emitNet(EventName('PlayerHoldNozzle'), player, false);
    }

    OnPlayerHoldsNozzle(player: number, nozzleNet: number) {
        emitNet(EventName('PlayerHoldNozzle'), player, nozzleNet);
    }

    GetPlayerByPed(ped: number) {
        for (const player of this.GetPlayers()) {
            if (GetPlayerPed(player) == ped) return player;
        }
        return null;
    }

    SendPlayerRefillData(player: number, fuelCost: string, fuelTank: string) {
        emitNet(EventName('PlayerOnNozzleViewDisplay'), player, fuelCost, fuelTank);
    }

    SendPlayerHideRefillData(player: number) {
        emitNet(EventName('PlayerHideRefillData'), player);
    }

    GetPlayers() {
        return getPlayers().map((player) => +player);
    }

    Prompt(player: number, title: string, placeholder: string) {
        return new Promise((done) => this.vRP.prompt(player, title, placeholder, done));
    }

    async GetPlayerDataTable(player: number) {
        const userid = await this.vRP.getUserId(player);
        return this.vRP.getUserDataTable(userid);
    }

    async UpdatePlayerDataTable(player: number, table: Partial<Record<keyof UserDataTable, any>>) {
        const userid = await this.vRP.getUserId(player);
        for (const [i, v] of Object.entries(table)) {
            if (v == null) table[i as keyof UserDataTable] = '__nullable__';
        }
        return this.vRP.updateUserDataTable(userid, table);
    }

    private activeBlips: Record<number, Record<'vehicleFuelStations' | 'vehicleElecticPump' | 'helicopterFuelParkings' | 'airportRestrict', Record<string, number>>> = {};

    private InitBlipsForPlayer(player: number) {
        if (!this.activeBlips[player]) this.activeBlips[player] = {
            airportRestrict: {},
            helicopterFuelParkings: {},
            vehicleFuelStations: {},
            vehicleElecticPump: {}
        };
    }

    async AddVehicleFuelStationBlip(player: number, station: FuelStation) {
        this.InitBlipsForPlayer(player);
        
        const blips = this.activeBlips[player].vehicleFuelStations;
        let blipId;
        if(station.isElecticParking) blipId = await this.vRPClient.setNamedBlip(player, `fuelStation_${station.id}`,
            station.x, station.y, 30.2, 354, 5, 'Станция електро-заправки');
        else blipId = await this.vRPClient.setNamedBlip(player, `fuelStation_${station.id}`,
            station.x, station.y, 30.2, 361, 1, 'Станция заправки');
        blips[`fuelStation_${station.id}`] = blipId;
    }

    async AddVehicleElecticPump(player: number, pump: FuelPump) {
        this.InitBlipsForPlayer(player);
        const blips = this.activeBlips[player].vehicleElecticPump;
        const blipId = await this.vRPClient.setNamedBlip(player, `electicPump_${pump.id}`,
            pump.worldCoords.x, pump.worldCoords.y, 30.2, 354, 5, 'Електро-заправка');
        blips[`fuelStation_${pump.id}`] = blipId;
    }

    RemoveVehicleFuelStationBlips(player: number) {
        if (!this.activeBlips[player]) return;
        const blips = this.activeBlips[player].vehicleFuelStations;
        for (const name of Object.keys(blips)) {
            this.vRPClient.removeNamedBlip(player, name);
        }
    }

    async AddHelicopterFuelParkingBlip(player: number, station: HelicopterParkingSlot) {
        this.InitBlipsForPlayer(player);
        const blips = this.activeBlips[player].helicopterFuelParkings;
        const isSlotBusy = await station.IsAnyVehicleOnSlot();
        const blipId = await this.vRPClient.setNamedBlip(player, `heliFuelParking_${station.id}`,
            station.x, station.y, 30.2, 542, isSlotBusy ? 1 : 3, 'Паркинг-слот аеропорт');
        blips[`heliFuelParking_${station.id}`] = blipId;
    }

    RemoveHelicopterFuelParkingBlips(player: number) {
        if (!this.activeBlips[player]) return;
        const blips = this.activeBlips[player].helicopterFuelParkings;
        for (const name of Object.keys(blips)) {
            this.vRPClient.removeNamedBlip(player, name);
        }
    }

    async AddAirportRestrictedAreaBlips(player: number, areaCorners: Vector3[]) {
        this.InitBlipsForPlayer(player);
        const blips = this.activeBlips[player].airportRestrict;

        for (const index in areaCorners) {
            const {x, y, z} = areaCorners[index];
            blips[`airportRestrict_${index}`] = await this.vRPClient.setNamedBlip(player, `airportRestrict_${index}`,
                x, y, z, 163, 1, '[!] Ограниченная зона');
        }
    }

    RemoveAirportRestrictedAreaBlips(player: number) {
        if (!this.activeBlips[player]) return;
        const blips = this.activeBlips[player].airportRestrict;
        for (const name of Object.keys(blips)) {
            this.vRPClient.removeNamedBlip(player, name);
        }
    }

    RemoveNamedBlip(player: number, name: string) {
        this.vRPClient.removeNamedBlip(player, name);
    }

    AddEntityBlip(player: number, entityNet: number, idtype: number, idcolor: number, text: string) {
        this.vRPClient.addEntityBlip(player, entityNet, idtype, idcolor, text);
    }

    async GetPlayerPhoneBankAccount(player: number) {
        const userId = await this.vRP.getUserId(player);
        return new Promise((done: (account: PlayerLynxAccount) => void) => {
            emit('UnityConnect::GetPlayerLynxAccount', userId, done);
        });
    }

    async OpenPaymentMenu(player: number, price: number, paymentTitle: string): Promise<[ok: boolean, method: 'BANK' | 'MONEY', payCard: string | null]> {
        const userId = await this.vRP.getUserId(player);
        const bankAccount = await this.GetPlayerPhoneBankAccount(player);
        return new Promise((done: any) => {

            const payByMoney = () => {
                this.vRP.tryPayment(userId, Math.abs(price)).then((ok) => done([ok, 'MONEY', null]));
            };

            const payByCard = () => {
                this.CreateLynxPayment(userId, -price, paymentTitle).then((ok) => done([ok, 'BANK', bankAccount.card]));
            };

            this.vRP.openMenu(player, {
                name: `Метод оплаты $${Math.abs(price).toFixed(2)}`,
                ['1. Отмена']: [() => this.vRP.closeMenu(player)],
                ['2. Наличные деньги']: [payByMoney],
                ['3. Банк']: bankAccount?.registerState ? [payByCard] : undefined,
                ['3. Банк [нельзя оплатить]']: bankAccount?.registerState ? undefined : [() => {
                }],
            });
        });
    }

    CreateLynxPayment(userId: number, price: number, paymentTitle: string) {
        return new Promise((done) => {
            emit('UnityConnect::CreatePlayerLynxPayment', userId, {
                value: price,
                label: paymentTitle,
                source: {account: 3},
                callback: done
            });
        });
    }

    GiveMoney(userId: number, money: number) {
        this.vRP.giveMoney(userId, money);
    }

    GetUserId(player: number): Promise<UserId> {
        return this.vRP.getUserId(player);
    }

    GetUserSource(userid: UserId): Promise<Source> {
        return this.vRP.getUserSource(userid);
    }

    SendUserPhoneMessage(userid: UserId, senderMessage: string, message: string) {
        emit('UnityConnect::SendUserPhoneNotification', userid, senderMessage, message);
    }
}