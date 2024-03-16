
export class PlayerDontHaveMoveCarOnRentError extends Error {
    constructor(public readonly player: number) {
        super(`Player ${player} dont have move car on rent`);
    }
}
export class AircraftRefuelIsNotInProcessError extends Error {
    constructor(public readonly slot: string) {
        super(`Aircraft refuel is not in process on slot ${slot}`);
    }
}