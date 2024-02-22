export class VehicleService {
    private DegradeFuelLevel = 0;
    constructor() {

    }

    GetDegradeFuelLevel() {
        return this.DegradeFuelLevel;
    }
    SetDegradeFuelLevel(level: number) {
        this.DegradeFuelLevel = level;
    }

    ProcessVehicleFuelState(vehicle: number) {
        if(GetVehicleFuelLevel(vehicle) <= 20) {
            SetVehicleUndriveable(vehicle, false);

            if(GetIsVehicleEngineRunning(vehicle)) {
                SetVehicleUndriveable(vehicle, true);
                Wait(500);
                SetVehicleEngineOn(vehicle, false, false, true);
            }
        }
    }

    VehicleFuelUpdated(vehicleEntity: number, fuel: number) {
        const minSpeed = 10;
        const maxSpeed = GetVehicleEstimatedMaxSpeed(vehicleEntity);
        if(fuel <= this.GetDegradeFuelLevel()) {
            SetVehicleMaxSpeed(vehicleEntity, (minSpeed + maxSpeed) * (fuel / this.GetDegradeFuelLevel()));
            console.log('UPDATEDMAXSPEED', `degrade(${this.GetDegradeFuelLevel()})`,
                GetVehicleEstimatedMaxSpeed(vehicleEntity) * 3.6, 
                (minSpeed + maxSpeed) * (fuel / this.GetDegradeFuelLevel()));

            const rnd = (Math.random()*(100-0)+0);
            if(fuel <= (this.GetDegradeFuelLevel()/2) && rnd > 55 && rnd < 60) {
                SetVehicleEngineOn(vehicleEntity, false, true, true);
            }

        } else {
            SetVehicleMaxSpeed(vehicleEntity, 200 / 3.6);
        }
    }
}