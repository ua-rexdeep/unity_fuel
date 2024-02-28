import { Wait } from '../../utils';
import { GUIButton, GUIPanel, GetGUI, ImGUI } from '../imguilib';

export class VehicleService {
    private DegradeFuelLevel = 0;
    public CurrentVehicleFuelLevel = 0;
    public CurrentVehicleMaxFuelLevel = 0;

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

    VehicleFuelUpdated(vehicleEntity: number, fuel: number, maxFuel: number) {
        const minSpeed = 10;
        const maxSpeed = GetVehicleEstimatedMaxSpeed(vehicleEntity);

        this.CurrentVehicleFuelLevel = fuel;
        this.CurrentVehicleMaxFuelLevel = maxFuel;

        GetGUI(`vehicle${vehicleEntity}`).then(async (gui) => {
            // console.log('GUI', gui ? 'yes' : 'no');
            if(!gui) return;
            const actionsPanel = await gui.GetComponentById<GUIPanel>('actionsPanel');
            const button = await gui.GetComponentById<GUIButton>('openFuelControl');
            if(!button) {
                actionsPanel.AddButton('openFuelControl', 'Fuel control');
            } else {
                button.On('click', async () => {
                    console.log('Fuel control');
                    const fuelControl = new ImGUI({
                        title: `FuelControl(${vehicleEntity})`,
                        id: 'fuelControl',
                        width: 300,
                        height: 400,
                    });
                    fuelControl.Deploy();
                    await Wait(100);
                    const main = await fuelControl.GetComponentById<GUIPanel>('main');
                    main.AddText('test', 'TEST!');
                });
            }
        });

        GetGUI('fuelControl').then(async (gui) => {
            if(!gui) return;
            
        });

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