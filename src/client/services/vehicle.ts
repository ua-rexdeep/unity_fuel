import { EventName, Wait } from '../../utils';
import { GUIButton, GUIFloat, GUIPanel, GetGUI, ImGUI } from '../libs/imgui';
import { UserInterface } from './userinterface';

export class VehicleService {
    private DegradeFuelLevel = 0.5;
    public CurrentVehicleFuelLevel = 0;
    public CurrentVehicleMaxFuelLevel = 0;
    public IndividualVehiclesConfig: Record<number, VehicleConfig> = {};

    GetDegradeFuelLevel() {
        return this.DegradeFuelLevel;
    }
    SetDegradeFuelLevel(level: number) {
        this.DegradeFuelLevel = level;
    }

    GetAllVehicles(): number[] {
        return GetGamePool('CVehicle');
    }

    ProcessVehicleFuelState(vehicle: number) {
        
        // BUG: якщо на surge кудись врізатись, гра ставить її топливо на 0
        if(GetVehicleFuelLevel(vehicle) == 0 && GetEntityModel(vehicle) == GetHashKey('surge')) {
            
            new UserInterface().ShowNotification('~b~[Surge] ~r~Удар обнаружен. ~w~Транспорт выключается.');
            
            SetVehicleFuelLevel(vehicle, 20);
            return;
        }

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
            .On('change', (_, value: string | number | boolean) => {
                console.log('DEVSetFuelLevel', vehicleEntity, value, DoesEntityExist(vehicleEntity));
                if(!DoesEntityExist(vehicleEntity)) return;
                emitNet(EventName('DEVSetFuelLevel'), NetworkGetNetworkIdFromEntity(vehicleEntity), value);
            });
    }

    VehicleFuelUpdated(vehicleEntity: number, fuel: number, maxFuel: number, badFuelContent: number) {
        const minSpeed = 10;
        const maxSpeed = GetVehicleEstimatedMaxSpeed(vehicleEntity);
        const isBadFuelConsistency = (badFuelContent / fuel * 100) > 2; // TODO

        this.CurrentVehicleFuelLevel = fuel;
        this.CurrentVehicleMaxFuelLevel = maxFuel;

        GetGUI(`vehicle${vehicleEntity}`).then(async (gui) => {
            if(!gui) return;
            const mainPanel = await gui.GetComponentById<GUIPanel>('main');
            const button = await gui.GetComponentById<GUIButton>('openFuelControl');
            if(!button) {
                mainPanel.AddButton('openFuelControl', 'Fuel control');
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

            const rnd = (Math.random()*(100-0)+0);
            if(fuel <= (this.GetDegradeFuelLevel()/2) && rnd > 55 && rnd < 60) { // шанс заглохнути
                SetVehicleEngineOn(vehicleEntity, false, true, true);
            }

        } else {
            SetVehicleMaxSpeed(vehicleEntity, 200 / 3.6);
        }
    }

    private requestedIndividualConfigs: Record<number, (cfg: VehicleConfig) => unknown> = [];
    // поверне конфігурацію машини, якщо така є в кеші. якщо в кеші немає, і не було запитано - запитує у серверу
    GetSyncVehicleRefillConfig(vehicleEntity: number): VehicleConfig | null {
        const model = GetEntityModel(vehicleEntity);
        if(this.IndividualVehiclesConfig[model]) {
            // console.log(`[VehicleService - GetSyncVehicleRefillConfig] hash(${model}): ${JSON.stringify(this.IndividualVehiclesConfig[model])}`);
            return this.IndividualVehiclesConfig[model];
        } else {
            console.log(`[VehicleService - GetSyncVehicleRefillConfig] hash(${model}): no config, requested`);
            emitNet(EventName('RequestVehicleIndividualConfig'), model);
        }
        return null;
    }

    // гарантовано поверне конфігурацію машини, якщо така існує
    async GetAsyncVehicleRefillConfig(vehicleEntity: number): Promise<VehicleConfig | null> {
        const model = GetEntityModel(vehicleEntity);
        if(this.IndividualVehiclesConfig[model]) {
            // console.log(`[VehicleService - GetAsyncVehicleRefillConfig] hash(${model}): ${JSON.stringify(this.IndividualVehiclesConfig[model])}`);
            return this.IndividualVehiclesConfig[model];
        } else {
            console.log(`[VehicleService - GetAsyncVehicleRefillConfig] hash(${model}): no config, requested`);
            emitNet(EventName('RequestVehicleIndividualConfig'), model);
            return new Promise((done) => {
                this.requestedIndividualConfigs[model] = done;
            });
        }
    }

    SetIndividualVehiclesConfig(cfg: Record<string, VehicleConfig>) {
        this.IndividualVehiclesConfig = Object.entries(cfg).reduce((acc, [k,v]) => ({ ...acc, [GetHashKey(k)]: v }), {});
    }

    SetIndividualVehicleConfig(hash: number, cfg: VehicleConfig) {
        this.IndividualVehiclesConfig[hash] = cfg;
        console.log(`[VehicleService - SetIndividualVehicleConfig] hash(${hash}): ${JSON.stringify(cfg)}`);
        if(this.requestedIndividualConfigs[hash]) {
            this.requestedIndividualConfigs[hash](cfg);
            delete this.requestedIndividualConfigs[hash];
        }
    }
}