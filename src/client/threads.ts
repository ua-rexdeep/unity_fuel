import { Logger } from '../logger';
import { EventName, Wait } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';

export class Threads {
    private readonly logger = new Logger('Threads');
    
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
        }
        this.Create('VehicleEssence', this.VehicleEssence.bind(this), 100);
        this.Create('DrawFuelLevel', this.DrawFuelLevel.bind(this));
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

    private progress_level = 0;
    private progress_lock = 0;
    private DrawFuelLevel() {
        const playerPed = GetPlayerPed(-1);
        const vehicle = GetVehiclePedIsIn(playerPed, false);
        if(vehicle && IsVehicleEngineOn(vehicle) && this.vehicleService.CurrentVehicleMaxFuelLevel != 0) {
            const map = this.GetMinimapAnchor();
            let percent = (100 / this.vehicleService.CurrentVehicleMaxFuelLevel * this.vehicleService.CurrentVehicleFuelLevel) / 100;

            // console.log(this.progress_lock, this.progress_level, Math.exp(this.progress_level * 0.045));
            if(this.progress_lock == 0) {
                this.progress_level += 1.5;
                const original = (100 / this.vehicleService.CurrentVehicleMaxFuelLevel * this.vehicleService.CurrentVehicleFuelLevel) / 100;
                percent = Math.exp(this.progress_level * 0.045) / 100;
                // console.log(percent, original);
                if(percent > original) {
                    percent = original;
                    this.progress_lock = 1;
                }
            }
    
            DrawRect(map.x + map.width/2, map.y + map.height - 0.00899*2.5, map.width, 0.0159999999999998, 20, 20, 20, 130);
            DrawRect(map.x + map.width/2, map.y + map.height - 0.00899*2.5, map.width, 0.0089999999999998, 180,30,16, 130);
            DrawRect((map.x + map.width/2) - (map.width / 2) + (map.width * percent) / 2, map.y + map.height - 0.00899*2.5, map.width * percent, 0.0089999999999998, 180,30,16, 220);
        } else if(this.progress_level != 0) {
            this.progress_level = 0;
            this.progress_lock = 0;
        }
    }

    private GetMinimapAnchor() {
        const safezone = GetSafeZoneSize();
        const safezone_x = 1.0 / 20.0;
        const safezone_y = 1.0 / 20.0;
        const aspect_ratio = GetAspectRatio(false);
        const [res_x, res_y] = GetActiveScreenResolution();
        const xscale = 1.0 / res_x;
        const yscale = 1.0 / res_y;
        const Minimap: any = {};
        Minimap.width = xscale * (res_x / (4 * aspect_ratio));
        Minimap.height = yscale * (res_y / 5.674);
        Minimap.left_x = xscale * (res_x * (safezone_x * ((Math.abs(safezone - 1.0)) * 10)));
        Minimap.bottom_y = 1.0 - yscale * (res_y * (safezone_y * ((Math.abs(safezone - 1.0)) * 10)));
        Minimap.right_x = Minimap.left_x + Minimap.width;
        Minimap.top_y = Minimap.bottom_y - Minimap.height;
        Minimap.x = Minimap.left_x;
        Minimap.y = Minimap.top_y;
        Minimap.xunit = xscale;
        Minimap.yunit = yscale;
        return Minimap as {
            width: number,
            height: number,
            left_x: number,
            right_x: number,
            bottom_y: number,
            top_y: number,
            x: number,
            y: number,
            xunit: number,
            yunit: number,
        };
    }
}