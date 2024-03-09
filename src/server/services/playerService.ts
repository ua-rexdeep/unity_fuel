import { Logger } from '../../logger';
import { EventName } from '../../utils';

export class PlayerService {
    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions
    ){}

    private playersVehicle: Record<number, number> = {};

    async IsPlayerAdmin(source: number) {
        const userId = await this.vRP.getUserId(source);
        const groups = await this.vRP.getUserGroups(userId);
        return ['admin'].some((key) => Object.keys(groups).includes(key));
    }

    Notification(source: number, notification: string) {
        this.vRPClient.notify(source, notification);
    }

    // source = -1 for all players to be target
    CreateRopeWithAttachments(source, ropeAttachements) {
        new Logger('CreateRopeWithAttachments', source, ropeAttachements);
        emitNet(EventName('CreateRopeWithAttachments'), source, ropeAttachements);
    }

    SetPlayerLastVehicle(player: number, vehicle: number) {
        this.playersVehicle[player] = vehicle;
        // emitNet(EventName('LastVehicleUpdated'), player, vehicle); // @unused
    }

    GetPlayerLastVehicle(player: number) {
        return this.playersVehicle[player];
    }

    OnPlayerDropNozzle(player: number) {
        emitNet(EventName('PlayerHoldNozzle'), player, false);
    }

    OnPlayerHoldsNozzle(player: number, nozzleNet: number) {
        emitNet(EventName('PlayerHoldNozzle'), player, nozzleNet);
    }

    GetPlayerByPed(ped: number) {
        for(const player of this.GetPlayers()) {
            if(GetPlayerPed(player) == ped) return player;
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

    async UpdatePlayerDataTable(player: number, table: Partial<UserDataTable>) {
        const userid = await this.vRP.getUserId(player);
        return this.vRP.updateUserDataTable(userid, table);
    }
}