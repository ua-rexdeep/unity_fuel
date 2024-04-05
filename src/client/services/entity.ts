import { Logger } from '../../logger';
import { Wait } from '../../utils';

export class EntityService {
    constructor(
        private readonly vRPClient: Record<string, (...args: unknown[]) => Promise<void>>,
    ){}
    async RequestEntityControl(object: number, bucketReserveNetEntities: number[] = [], allowBucketMethod = true) {
        const logger = new Logger('RequestEntityControl', object, `reserved(${bucketReserveNetEntities.join(', ')})`);
        logger.Log('^4 RequestEntityControl', object, NetworkGetNetworkIdFromEntity(object), NetworkGetEntityIsNetworked(object));
        if(!DoesEntityExist(object)) {
            throw new Error('Object not exists');
        }
        const netid = NetworkGetNetworkIdFromEntity(object);
        // ------------------------- реєстрація об'єкту в мережі
        if(!NetworkGetEntityIsNetworked(object)) {
            this.vRPClient.notify('~r~Object not networked');
            throw new Error('Object not networked');
        }
        // -------------------------

        logger.Log('^3', NetworkHasControlOfEntity(object) ? 'have control' : 'dont have control');

        let tries = 0;
        while(!NetworkHasControlOfEntity(object) && tries < 10) {
            NetworkRequestControlOfEntity(object);
            await Wait(100);
            tries = tries + 1;
        }

        // -- second method for requesting entity control. using buckets
        if(!NetworkHasControlOfEntity(object) && allowBucketMethod) {
            const bucketReserved = [netid, ...bucketReserveNetEntities];
            if(IsEntityAttached(object)) { // -- якщо сутність приєднана, власність розповсюджується від батьківської
                bucketReserved.push(NetworkGetNetworkIdFromEntity(GetEntityAttachedTo(object)));
            }

            logger.Log('^3Bucket:', ...bucketReserved);

            SetNetworkIdCanMigrate(netid, true);
            TriggerServerEvent('propInt:requestEntityControl', bucketReserved);
            while(!NetworkHasControlOfEntity(object)) {
                NetworkRequestControlOfNetworkId(netid);
                await Wait(1);
            }
        }

        logger.Log('RequestEntityControl Details', netid, object, DoesEntityExist(object), NetworkHasControlOfEntity(object), NetworkHasControlOfNetworkId(netid), GetEntityModel(object));
        
        logger.Log('^4 RequestEntityControl ending', object, netid);
        return object;
    }

    Delete(entity: number) {
        SetEntityAsMissionEntity(entity, true, true);
        DeleteEntity(entity);
    }
}