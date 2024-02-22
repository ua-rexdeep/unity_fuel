import { Logger } from '../../logger';
import { EventName, LoadModel, Wait } from '../../utils';
import { EntityService } from './entity';
import { RopeService } from './ropes';

const prop_gas_pump_1d = GetHashKey('prop_gas_pump_1d');

const PumpOffsets = {
    [prop_gas_pump_1d]: [
        [0.345, -0.22, 2.08],
        [-0.346, 0.215, 2.05],
    ]
};

const PumpProps = {
    [prop_gas_pump_1d]: prop_gas_pump_1d,
    [GetHashKey('prop_gas_pump_1d_1')]: prop_gas_pump_1d,
    [GetHashKey('prop_gas_pump_1d_2')]: prop_gas_pump_1d,
};

export class HosepipeService {

    private logger = new Logger('Hosepipe');
    constructor(
        private readonly ropeService: RopeService,
        private readonly entityService: EntityService,
    ){}

    async Create(pumpEntity: number, slotOffset: [number, number, number]){
        const playerPed = GetPlayerPed(-1);
        const playerCoords = GetEntityCoords(playerPed);
        const pumpCoords = GetEntityCoords(pumpEntity);

        const model = await LoadModel('prop_cs_fuel_nozle');
        const nozzleId = CreateObject(
            model, 
            playerCoords[0], playerCoords[1], playerCoords[2], 
            true, true, true);

        while(!NetworkGetEntityIsNetworked(nozzleId)) {
            console.log('Waiting until nozzle will be networked');
            await Wait(10);
        }

        const ballModel = await LoadModel('prop_golf_ball');
        const hosepipeOffset = slotOffset;
        this.logger.Log('OFFSET FOR INDEX:', pumpEntity, hosepipeOffset);
        this.logger.Warn(`Bug check: ${pumpEntity} ${DoesEntityExist(pumpEntity) ? 'pump exists' : 'pump not exists'}`);
        const worldPumpSlot = GetOffsetFromEntityInWorldCoords(pumpEntity, hosepipeOffset[0], hosepipeOffset[1], hosepipeOffset[2]);
        this.logger.Warn('Ball coords:', worldPumpSlot[0], worldPumpSlot[1], worldPumpSlot[2]);
        const ball = CreateObject(ballModel, worldPumpSlot[0], worldPumpSlot[1], worldPumpSlot[2], true, true, true);
        FreezeEntityPosition(ball, true);
        // SetEntityVisible(ball, false, false);

        const ropeAttachements: RopeAttachements = {
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

    async AttachToPlayer(nozzleId: number){
        const ped = GetPlayerPed(-1);
        if((IsEntityAttachedToAnyVehicle(nozzleId) && NetworkGetEntityOwner(nozzleId) != PlayerId())) {
            emitNet(EventName('RequestDetachNozzle'), NetworkGetNetworkIdFromEntity(nozzleId));
            for(let i = 0; i < 10; i++) {
                if(NetworkGetEntityOwner(nozzleId) == PlayerId()) break;
                await Wait(100);
            }
            if(NetworkGetEntityOwner(nozzleId) != PlayerId()) {
                this.logger.Error('Cant get entity owner');
                return;
            }
        }
        if(NetworkGetEntityOwner(nozzleId) != PlayerId()) {
            nozzleId = await this.entityService.RequestEntityControl(nozzleId);
        }
        DetachEntity(nozzleId, true, true);
        AttachEntityToEntity(nozzleId, ped, 
            GetPedBoneIndex(ped, 0xDEAD), 
            0.10, 0.01, -0.02,
            -80.0, -90.0, -15.0, 
            true, true, false, 
            true, 1, true);
        
        return nozzleId;
    }

    AttachToVehicle(nozzleEntity: number, vehicleNetId: number, fuelCupOffset: { x: number, y: number, z: number }) {
        const nozzleId = NetworkGetEntityFromNetworkId(nozzleEntity);
        const vehicleId = NetworkGetEntityFromNetworkId(vehicleNetId);
        this.logger.Warn(`Class of vehicle ${vehicleNetId}: ${GetVehicleClass(vehicleId)}`);
        const tankBoneIndex = GetEntityBoneIndexByName(vehicleId, 'petrolcap');
        // is bike AttachEntityToEntity(nozzle, vehicle, ptankBone, 0.0 + newTankPosition.x, -0.2 + newTankPosition.y, 0.2 + newTankPosition.z, -80.0, 0.0, 0.0, true, true, false, false, 1, true)

        this.entityService.RequestEntityControl(nozzleId, [vehicleNetId]);

        AttachEntityToEntity(
            nozzleId, vehicleId, tankBoneIndex, 
            fuelCupOffset.x > 0 ? fuelCupOffset.x + 0.2 : fuelCupOffset.x - 0.2, fuelCupOffset.y, fuelCupOffset.z, 
            -125.0, -90.0, -90.0, 
            true, true, true, 
            false, 1, true);
    }

    Delete(nozzleId: number) {

        const ropeId = this.ropeService.GetRopeEntityAttachedTo(NetworkGetNetworkIdFromEntity(nozzleId));
        if(ropeId != null) {
            this.ropeService.DeleteRope(ropeId);
        }

        this.entityService.Delete(nozzleId);
    }

    GetOffsetForPumpHosepipeIndex(pumpEntity: number, hosepipeIndex: number) {
        return PumpOffsets[PumpProps[GetEntityModel(pumpEntity)]][hosepipeIndex-1];
    }
}