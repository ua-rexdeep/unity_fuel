import { Logger } from '../logger';
import { DrawText3D, EventName, Wait, vDist } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { JerryCanService } from './services/jerrycan';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';

// @ts-expect-error
if(!global.LoadAnimDict) {
    (global as any).LoadAnimDict = (_: string)  => {
        console.error('NO LoadAnimDict FUNC');
    };
}

export class Threads {
    private readonly logger = new Logger('Threads');
    
    private lastVehicle: number | null = null;

    constructor(
        private readonly hosepipeService: HosepipeService,
        private readonly ropeService: RopeService,
        private readonly vehicleService: VehicleService,
        private readonly UIService: UserInterface,
        private readonly JerryCanService: JerryCanService,
    ){

        if(process.env.NODE_ENV == 'development') {
            DisableIdleCamera(true);
            this.Create('CatchClear', this.CatchClear.bind(this));
        }
        this.Create('VehicleEssence', this.VehicleEssence.bind(this), 100);
        this.Create('DrawFuelLevel', this.DrawFuelLevel.bind(this));
        this.Create('JerryCanFire', this.JerryCanFire.bind(this));
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
                if(GetEntityModel(object) == GetHashKey('prop_cs_electro_nozle') || GetEntityModel(object) == GetHashKey('prop_cs_fuel_nozle')) {
                    logger.Log('', object);
                    logger.Log(`Object(${object}) Net(${NetworkGetNetworkIdFromEntity(object)})`);
                    this.hosepipeService.Delete(object);
                }
            }
        }
    }

    private isVehicleEngineRunning = false;
    private async VehicleEssence() {
        const playerPed = GetPlayerPed(-1);
        const vehicle = GetVehiclePedIsIn(playerPed, false);
        if(vehicle) {

            if(this.lastVehicle != vehicle && GetPedInVehicleSeat(vehicle, -1) == playerPed) {
                emitNet(EventName('PlayerEnterVehicle'), NetworkGetNetworkIdFromEntity(vehicle));
                this.lastVehicle = vehicle;

                if(GetEntityModel(vehicle) == GetHashKey('cerberus2')) {
                    ClearPrints();
                    SetTextEntry_2('STRING');
                    AddTextComponentString('~y~Движение разрешено только по ~r~аеропорту~y~.');
                    DrawSubtitleTimed(10_000, true);
                }
            }

            if(this.isVehicleEngineRunning == false && IsVehicleEngineOn(vehicle) == true) {
                emitNet(EventName('PlayerEnterVehicle'), NetworkGetNetworkIdFromEntity(vehicle));
            }
            this.isVehicleEngineRunning = IsVehicleEngineOn(vehicle);

            this.vehicleService.ProcessVehicleFuelState(vehicle);


        } else if(this.lastVehicle) {
            this.lastVehicle = null;
            this.isVehicleEngineRunning = false;
        }

    }

    count = 0;
    private async JerryCanFire() {
        const playerPed = GetPlayerPed(-1);
        
        if(GetSelectedPedWeapon(playerPed) == GetHashKey('WEAPON_PETROLCAN')) {
            
            SetPedAmmo(playerPed, GetHashKey('WEAPON_PETROLCAN'), 100);

            const [offx, offy, offz] = GetWorldPositionOfEntityBone(playerPed, GetPedBoneIndex(playerPed, 57005));
            DrawText3D(offx, offy, offz, this.JerryCanService.GetContentAmount() > 0 ? `${this.JerryCanService.GetContentAmount().toFixed(2)}L` : 'Empty');

            const RefillNearestVehicle = this.VehicleJerryCanRefill();
            const PreventFiring = RefillNearestVehicle || this.JerryCanService.GetContentAmount() == 0;
            if(PreventFiring) {
                DisablePlayerFiring(PlayerId(), true);
                DisableControlAction(2, 24, true);
                DisableControlAction(2, 142, true);
                DisableControlAction(2, 257, true);
            }

            if(IsPedShooting(playerPed) || IsDisabledControlPressed(0, 24)) {                
                if(PreventFiring) {
                    ClearPedTasks(playerPed);
                    return;
                }

                this.count++;
                if(this.count > 50) {
                    this.JerryCanService.OnWeaponFire();
                }
                return;
            }
        }

        if(this.count > 50) {
            emitNet(EventName('UpdatePlayerJerryCanData'), this.JerryCanService.GetData());// updates server data about jerry can content
        }
        // emit('propInt::Debugger', {
        //     id: 'cm:1',
        //     text: `Stay ${this.JerryCanService.GetContentAmount()}`,
        //     entity: playerPed,
        //     left: 150,
        //     top: 300,
        //     customPosition: true,
        // });
        this.count = 0;
    }

    private progress_level = 0;
    private progress_lock = 0;
    private DrawFuelLevel() {
        const playerPed = GetPlayerPed(-1);
        const vehicle = GetVehiclePedIsIn(playerPed, false);
        if(vehicle && IsVehicleEngineOn(vehicle) && this.vehicleService.CurrentVehicleMaxFuelLevel != 0 && GetVehicleClass(vehicle) != 13) {
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

    private IsJerryCanRefilling = false;
    private refillCount = 0;
    private refilledData: Record<string, number> = {};
    private refilledVehicle: number | null = null;
    private VehicleJerryCanRefill() {
        let retval: 'NOTINRANGE' | 'INRANGE' | 'REFILL' = 'NOTINRANGE';
        const playerPed = GetPlayerPed(-1);
        const [px, py, pz] = GetEntityCoords(playerPed);
        for(const vehicle of this.vehicleService.GetAllVehicles()) {
            const [vx, vy, vz] = GetEntityCoords(vehicle);
            const vehicleRefillConfig = this.vehicleService.GetVehicleRefillConfig(vehicle);
            // console.log(`REFILL: ${vehicle} / ${vDist(px, py, pz, vx, vy, vz).toFixed(2)}`);
            if(vehicleRefillConfig && !vehicleRefillConfig.isElectic && vDist(px, py, pz, vx, vy ,vz) < 5.0) {
                const { x: rx, y: ry, z: rz } = vehicleRefillConfig.refillNozzleOffset;
                const [ worldX, worldY, worldZ ] = GetOffsetFromEntityInWorldCoords(vehicle, rx, ry, rz);
                const [_, groundZ] = GetGroundZFor_3dCoord(worldX, worldY, worldZ, false);
                DrawText3D(worldX, worldY, worldZ, 'Заправить из канистры');
                if(vDist(px, py, pz, worldX, worldY ,groundZ) < 1.5) {
                    if(IsDisabledControlPressed(1, 24) && this.JerryCanService.GetContentAmount() > 0) {
                        (DrawMarker as any)(1, worldX, worldY, groundZ, 0, 0, 0, 0, 0, 0, 2.0, 2.0, 0.1, 0, 255, 0, 255);

                        if(!this.IsJerryCanRefilling) {
                            RequestAnimDict('weapon@w_sp_jerrycan');
                            if(HasAnimDictLoaded('weapon@w_sp_jerrycan')) { 
                                this.IsJerryCanRefilling = true;
                                this.refilledVehicle = NetworkGetNetworkIdFromEntity(vehicle);
                                console.log('PLAY');
                                TaskPlayAnim(GetPlayerPed(-1),'weapon@w_sp_jerrycan','fire', 8.0, -8, -1, 49, 0, true, true, true);
                            }
                        } else {
                            this.refillCount++;
                            if(this.refillCount % 5 == 0) {
                                const ret = this.JerryCanService.OnWeaponFire();
                                if(ret && ret.content) {
                                    if(ret.content in this.refilledData) this.refilledData[ret.content] += ret.value;
                                    else this.refilledData[ret.content] = ret.value;
                                }
                            }
                            if(this.refillCount % 100 == 0) {
                                console.log('currently refilled for', this.refilledData);
                                emitNet(EventName('UpdatePlayerVehicleRefillJerryCan'), this.refilledVehicle, this.refilledData);
                                this.refilledData = {};
                            }
                        }

                        retval = 'REFILL';
                    }
                    else {
                        (DrawMarker as any)(1, worldX, worldY, groundZ, 0, 0, 0, 0, 0, 0, 2.0, 2.0, 0.1, 255, 0, 0, 255);
                        retval = 'INRANGE';
                    }
                }
                else (DrawMarker as any)(1, worldX, worldY, groundZ, 0, 0, 0, 0, 0, 0, 2.0, 2.0, 0.1, 255, 255, 255, 255);
                
            }
        }
        if(this.IsJerryCanRefilling && (retval == 'INRANGE' || retval == 'NOTINRANGE')) {
            emitNet(EventName('UpdatePlayerJerryCanData'), this.JerryCanService.GetData()); // updates server data about jerry can content
            emitNet(EventName('UpdatePlayerVehicleRefillJerryCan'), this.refilledVehicle, this.refilledData);
            this.refillCount = 0;
            this.IsJerryCanRefilling = false;
            this.refilledData = {};
            this.refilledVehicle = null;
            ClearPedTasks(playerPed);
        }
        return retval != 'NOTINRANGE';
    }
}