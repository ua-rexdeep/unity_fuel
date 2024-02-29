import { Wait } from '../../utils';
import { GUIButton, GUIFloat, GUIPanel, GetGUI, ImGUI } from '../libs/imgui';

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

    async CreateDevFuelGUI(vehicleEntity: number) {
        const fuelControl = new ImGUI({
            title: `FuelControl(${vehicleEntity})`,
            id: 'fuelControl',
            width: 300,
            height: 120,
        });
        fuelControl.Deploy();
        await Wait(100);
        const main = await fuelControl.GetComponentById<GUIPanel>('main');
        const levelPanel = main.AddPanel('levelPanel', 'horizontal');
        levelPanel.AddText('fuelLevel', 'Fuel level:');
        levelPanel.AddFloat('levelFloat', this.CurrentVehicleFuelLevel, 0, this.CurrentVehicleMaxFuelLevel, 1, { override: `%L / ${this.CurrentVehicleMaxFuelLevel}L` })
            .On('change', (_, value: number) => {
                if(!DoesEntityExist(vehicleEntity)) return;
                emitNet('DEVSetFuelLevel', NetworkGetNetworkIdFromEntity(vehicleEntity), value);
            });
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
                    this.CreateDevFuelGUI(vehicleEntity);
                });

                const fuelGUI = await GetGUI('fuelControl');
                if(fuelGUI) {
                    const levelFloat = await fuelGUI.GetComponentById<GUIFloat>('levelFloat');
                    if(levelFloat) levelFloat.SetValue(fuel);
                }
            }
        });

        GetGUI('fuelControl').then(async (gui) => {
            if(!gui) return;
            const fuelFloat = await gui.GetComponentById<GUIFloat>('levelFloat');
            if(fuelFloat) fuelFloat.SetValue(fuel);
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