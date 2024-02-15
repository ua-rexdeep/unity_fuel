export class PlayerService {
    constructor(
        private readonly vRP: vRPServerFunctions, 
        private readonly vRPClient: vRPClientFunctions
    ){}

    async IsPlayerAdmin(source: number) {
        const userId = await this.vRP.getUserId(source);
        const groups = await this.vRP.getUserGroups(userId);

        return ['admin'].some((key) => Object.keys(groups).includes(key));
    }

    Notification(source: number, notification: string) {
        this.vRPClient.notify(source, notification);
    }
}