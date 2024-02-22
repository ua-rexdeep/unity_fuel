import { Logger } from '../logger';
import { EventName, LoadModel, Wait } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';

export class Threads {
    private readonly logger = new Logger('Threads');
    
    private gasWorker; // !DELETE
    private lastVehicle: number | null;

    constructor(
        private readonly hosepipeService: HosepipeService,
        private readonly ropeService: RopeService,
        private readonly vehicleService: VehicleService,
        private readonly UIService: UserInterface,
    ){

        if(process.env.NODE_ENV == 'development') {
            DisableIdleCamera(true);
            this.Create('CatchClear', this.CatchClear.bind(this));
            this.Create('StationWorkerds', this.StationWorkerds.bind(this), 1000);
        }
        this.Create('VehicleEssence', this.VehicleEssence.bind(this), 100);
    }

    private Create(name: string, func: () => void, interval?: number) {
        let errorCatched = false;
        setTick(async () => {
            try {
                errorCatched = false;
                func();
            } catch(e) {
                if(!errorCatched) {
                    errorCatched = true;
                    this.logger.Error(`Error cathed in thread(${name})`);
                    console.trace(e);
                }
            }
            if(interval != null) await Wait(interval);
        });
        this.logger.Log(`New thread(${name}) with interval ${interval}ms created.`);
    }

    private CatchClear() {
        DisableControlAction(0, 44, true);
        if(IsDisabledControlJustPressed(0, 44)) {
            const logger = new Logger('CatchClear');
            for(const object of GetGamePool('CObject')) {
                if(GetEntityModel(object) == GetHashKey('prop_golf_ball')) {
                    SetEntityAsMissionEntity(object, true, true);
                    DeleteEntity(object);
                }
                if(GetEntityModel(object) == GetHashKey('prop_cs_fuel_nozle')) {
                    logger.Log('', object);
                    logger.Log(`Object(${object}) Net(${NetworkGetNetworkIdFromEntity(object)})`);
                    this.hosepipeService.Delete(object);
                }
            }
        }
    }
    
    private async StationWorkerds() {
        if(!this.gasWorker) {
            const model = await LoadModel('s_m_y_garbage');
            this.gasWorker = CreatePed(0, model, 287.99749755859,-1265.1306152344,29.440757751465, 81, true, true);
        }
    }

    private async VehicleEssence() {
        const playerPed = GetPlayerPed(-1);
        const vehicle = GetVehiclePedIsIn(playerPed, false);
        if(vehicle) {

            if(this.lastVehicle != vehicle && GetPedInVehicleSeat(vehicle, -1) == playerPed) {
                emitNet(EventName('PlayerEnterVehicle'), NetworkGetNetworkIdFromEntity(vehicle), GetVehicleClass(vehicle), GetVehicleFuelLevel(vehicle));
                this.lastVehicle = vehicle;
            }

            // console.log('TURNITOFF', GetVehicleFuelLevel(vehicle), GetIsVehicleEngineRunning(vehicle));
            this.vehicleService.ProcessVehicleFuelState(vehicle);
        } else if(this.lastVehicle) {
            this.lastVehicle = null;
        }
    }
}