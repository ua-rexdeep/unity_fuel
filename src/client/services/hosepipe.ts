import { Logger } from '../../logger';
import { LoadModel } from '../../utils';
import { RopeService } from './ropes';

const PumpOffsets = {
    [GetHashKey('prop_gas_pump_1d')]: [
        [-0.34, 0.22, 2.10],
        [0.34, -0.22, 2.10],
    ]
};

export class HosepipeService {

    private _pumpEntity: number;
    private _nozzleId: number;
    private logger = new Logger('Hosepipe');
    constructor(private readonly ropeService: RopeService){}

    async Create(pumpEntity: number){
        const playerPed = GetPlayerPed(-1);
        const playerCoords = GetEntityCoords(playerPed);
        const pumpCoords = GetEntityCoords(pumpEntity);

        const model = await LoadModel('prop_cs_fuel_nozle');
        const nozzleId = CreateObject(
            model, 
            playerCoords[0], playerCoords[1], playerCoords[2], 
            true, true, true);

        const ballModel = await LoadModel('prop_golf_ball');
        const worldPumpSlot = GetOffsetFromEntityInWorldCoords(pumpEntity, -0.34, 0.22, 2.10);
        this.logger.Warn('Ball coords:', worldPumpSlot[0], worldPumpSlot[1], worldPumpSlot[2]);
        const ball = CreateObject(ballModel, worldPumpSlot[0], worldPumpSlot[1], worldPumpSlot[2], true, true, true);
        FreezeEntityPosition(ball, true);

        const ropeAttachements = {
            pumpCoords,
            from: {
                netEntity: NetworkGetNetworkIdFromEntity(ball),
                offset: {
                    x: 0,
                    y: 0,
                    z: 0,
                }
            },
            to: {
                netEntity: NetworkGetNetworkIdFromEntity(nozzleId),
                offset: {
                    x: 0.0,
                    y: -0.033,
                    z: -0.195,
                }
            }
        };

        return {
            pumpSlotEntity: ball,
            nozzleId,
            ropeAttachements,
        };
    }

    AttachToPlayer(nozzleId: number){
        const ped = GetPlayerPed(-1);
        DetachEntity(nozzleId, true, true);
        AttachEntityToEntity(nozzleId, ped, 
            GetPedBoneIndex(ped, 0xDEAD), 
            0.10, 0.01, -0.02,
            -80.0, -90.0, -15.0, 
            true, true, false, 
            true, 1, true);
        
        this._nozzleId = nozzleId;
        return nozzleId;
    }

    AttachToVehicle(vehicleNetId: number, fuelCupOffset: { x: number, y: number, z: number }) {
        const vehicleId = NetworkGetEntityFromNetworkId(vehicleNetId);
        this.logger.Warn(`Class of vehicle ${vehicleNetId}: ${GetVehicleClass(vehicleId)}`);
        const tankBoneIndex = GetEntityBoneIndexByName(vehicleId, 'petrolcap');
        // is bike AttachEntityToEntity(nozzle, vehicle, ptankBone, 0.0 + newTankPosition.x, -0.2 + newTankPosition.y, 0.2 + newTankPosition.z, -80.0, 0.0, 0.0, true, true, false, false, 1, true)
        AttachEntityToEntity(
            this._nozzleId, vehicleId, tankBoneIndex, 
            fuelCupOffset.x > 0 ? fuelCupOffset.x + 0.2 : fuelCupOffset.x - 0.2, fuelCupOffset.y, fuelCupOffset.z, 
            -125.0, -90.0, -90.0, 
            true, true, false, 
            false, 1, true);
        this._nozzleId = null;
    }

    Delete(nozzleId: number) {

        const ropeId = this.ropeService.GetRopeEntityAttachedTo(NetworkGetNetworkIdFromEntity(nozzleId));
        if(ropeId != null) {
            this.ropeService.DeleteRope(ropeId);
        }

        SetEntityAsMissionEntity(nozzleId, true, true);
        DeleteEntity(nozzleId);
        this._nozzleId = null;
    }

    SetNozzlePumpEntity(pumpEntity: number) {
        this._pumpEntity = pumpEntity;
    }

    GetNozzlePumpEntity(){
        return this._pumpEntity;
    }

    GetNozzleInHands() {
        return this._nozzleId;
    }

    GetOffsetForPumpHosepipeIndex(pumpEntity: number, hosepipeIndex: number) {
        return PumpOffsets[GetEntityModel(pumpEntity)][hosepipeIndex];
    }
}