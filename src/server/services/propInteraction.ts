export class PropInteractionAPI {
    
    DisableEntityDespawn(entityNet: number, disableState = true) {
        emit('propInt:DisableNetworkObjectDespawn', entityNet, disableState);
    }

    RequestDetachEntity(entityNet: number) {
        const local = NetworkGetEntityFromNetworkId(entityNet);
        const attachedTo = GetEntityAttachedTo(local);
        emitNet('propInt:entityOwner:RequestDetachEntity', NetworkGetEntityOwner(attachedTo || local), entityNet);
    }

}