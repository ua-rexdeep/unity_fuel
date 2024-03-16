import { Logger } from '../../logger';
import { LoadRopeTextures, Wait } from '../../utils';

interface AttachDTO {
    netEntity: number,
    offset: {
        x: number,
        y: number,
        z: number,
    },
}

export class RopeService {
    
    private list: Record<number, number[]> = {};

    async Create(x: number, y: number, z: number, ropeType: 2 | 3 | 4){
        await LoadRopeTextures();
        const [ropeId] = AddRope(x, y, z, 
            0.0, 0.0, 0.0, 
            2.0, ropeType, 
            1000.0, 0.0, 1.0,
            false, false, false, 
            2.0, false);
        ActivatePhysics(ropeId);

        await Wait(50);

        return ropeId;
    }

    async CreateWithAttachments(ropeAttachements: RopeAttachements){

        console.log(NetworkDoesNetworkIdExist(ropeAttachements.from.netEntity), NetworkDoesNetworkIdExist(ropeAttachements.to.netEntity));

        while(!NetworkDoesNetworkIdExist(ropeAttachements.to.netEntity) || !NetworkDoesNetworkIdExist(ropeAttachements.from.netEntity)) {
            console.log('WAIT');
            await Wait(10);
        }

        const ropeId = await this.Create(ropeAttachements.pumpCoords[0], ropeAttachements.pumpCoords[1], ropeAttachements.pumpCoords[2], ropeAttachements.ropeType);
        this.AttachEntitiesToRope(ropeId, ropeAttachements);
    }

    GetEntitiesAttachedToRope(ropeId: number) {
        return this.list[ropeId] || [];
    }

    AttachEntitiesToRope(ropeId: number, attachData: RopeAttachements) {
        this.list[ropeId] = [attachData.from.netEntity, attachData.to.netEntity];

        const localEntityFrom = NetworkGetEntityFromNetworkId(attachData.from.netEntity);
        const fromOffset = GetOffsetFromEntityInWorldCoords(localEntityFrom, attachData.from.offset.x, attachData.from.offset.y, attachData.from.offset.z);

        const localEntityTo = NetworkGetEntityFromNetworkId(attachData.to.netEntity);
        const toOffset = GetOffsetFromEntityInWorldCoords(localEntityTo, attachData.to.offset.x, attachData.to.offset.y, attachData.to.offset.z);

        new Logger('AttachEntitiesToRope', attachData.from.netEntity, attachData.to.netEntity);
        new Logger('AttachEntitiesToRope', localEntityFrom, localEntityTo);

        AttachEntitiesToRope(
            ropeId, localEntityFrom, localEntityTo, 
            fromOffset[0], fromOffset[1], fromOffset[2], 
            toOffset[0], toOffset[1], toOffset[2], 
            attachData.ropeLength, false, false, '', '');

        return this.list[ropeId];
    }

    DeleteRope(ropeId: number) {
        DeleteRope(ropeId);
        delete this.list[ropeId];
    }

    GetRopeEntityAttachedTo(netEntity: number) {
        for(const [ropeId, entities] of Object.entries(this.list)) {
            if(entities.some((entity) => netEntity == entity)) {
                return +ropeId;
            }
        }
        return null;
    }

}