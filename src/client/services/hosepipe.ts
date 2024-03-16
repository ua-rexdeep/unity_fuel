import { Logger } from '../../logger';
import { EventName, LoadModel, Vector3, Wait } from '../../utils';
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

    async Create(pumpEntity: number, slotOffset: [number, number, number], isElectical: boolean){
        const playerPed = GetPlayerPed(-1);
        const playerCoords = GetEntityCoords(playerPed);
        const pumpCoords = GetEntityCoords(pumpEntity) as [number, number, number];

        const model = await LoadModel(isElectical ? 'prop_cs_electro_nozle' : 'prop_cs_fuel_nozle');
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
        const worldPumpSlot = GetOffsetFromEntityInWorldCoords(pumpEntity, hosepipeOffset[0], hosepipeOffset[1], hosepipeOffset[2]);
        const ball = CreateObject(ballModel, worldPumpSlot[0], worldPumpSlot[1], worldPumpSlot[2], true, true, true);
        FreezeEntityPosition(ball, true);
        SetEntityVisible(ball, false, false);

        const ropeAttachements: RopeAttachements = {
            pumpCoords,
            from: {
                netEntity: NetworkGetNetworkIdFromEntity(ball),
                offset: { x: 0, y: 0, z: 0 }
            },
            to: {
                netEntity: NetworkGetNetworkIdFromEntity(nozzleId),
                offset: { x: 0.0, y: -0.033, z: -0.195 }
            },
            ropeLength: 5.0,
            ropeType: 4,
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

    AttachToEntity(nozzleEntity: number, entNetid: number, fuelCupOffset: { x: number, y: number, z: number }, vehicleConfig: VehicleConfig | null) {
        const nozzleId = NetworkGetEntityFromNetworkId(nozzleEntity);
        const entityId = NetworkGetEntityFromNetworkId(entNetid);
        const IsEntityAJerryCan = GetEntityModel(entityId) == GetHashKey('prop_jerrycan_01a');

        this.entityService.RequestEntityControl(nozzleId, [entNetid]);

        let { x: nozRotX, y: nozRotY, z: nozRotZ } = vehicleConfig?.refillNozzleRotation || new Vector3(-125.0, -90.0, -90.0);
        if(IsEntityAJerryCan) {
            nozRotX = -75.0;
            nozRotY = 0;
            nozRotZ = 90;
        }
        
        AttachEntityToEntity(
            nozzleId, entityId, 0, 
            fuelCupOffset.x, fuelCupOffset.y, fuelCupOffset.z, 
            nozRotX, nozRotY, nozRotZ, 
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