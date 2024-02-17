import { LoadRopeTextures } from '../../utils';

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

    async Create(x: number, y: number, z: number){
        await LoadRopeTextures();
        const [ropeId] = AddRope(x, y, z, 
            0.0, 0.0, 0.0, 
            3.0, 1, 
            1000.0, 0.0, 1.0,
            false, false, false, 
            1.0, false);
        ActivatePhysics(ropeId);

        await Wait(50);

        return ropeId;
    }

    async CreateWithAttachments(ropeAttachements){
        const ropeId = await this.Create(ropeAttachements.pumpCoords[0], ropeAttachements.pumpCoords[1], ropeAttachements.pumpCoords[2]);
        this.AttachEntitiesToRope(ropeId, ropeAttachements);
    }

    GetEntitiesAttachedToRope(ropeId: number) {
        return this.list[ropeId] || [];
    }

    AttachEntitiesToRope(ropeId: number, attachData: { from: AttachDTO, to: AttachDTO }) {
        this.list[ropeId] = [attachData.from.netEntity, attachData.to.netEntity];

        const localEntityFrom = NetworkGetEntityFromNetworkId(attachData.from.netEntity);
        const fromOffset = GetOffsetFromEntityInWorldCoords(localEntityFrom, attachData.from.offset.x, attachData.from.offset.y, attachData.from.offset.z);

        const localEntityTo = NetworkGetEntityFromNetworkId(attachData.to.netEntity);
        const toOffset = GetOffsetFromEntityInWorldCoords(localEntityTo, attachData.to.offset.x, attachData.to.offset.y, attachData.to.offset.z);

        AttachEntitiesToRope(
            ropeId, localEntityFrom, localEntityTo, 
            fromOffset[0], fromOffset[1], fromOffset[2], 
            toOffset[0], toOffset[1], toOffset[2], 
            5.0, false, false, null, null);

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
    }

}