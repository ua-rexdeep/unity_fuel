import { Logger } from '../logger';
import { Wait } from '../utils';
import { HosepipeService } from './services/hosepipe';
import { RopeService } from './services/ropes';

export class Threads {
    private readonly logger = new Logger('Threads');
    constructor(
        private readonly hosepipeService: HosepipeService,
        private readonly ropeService: RopeService,
    ){
        this.Create('CatchClear', this.CatchClear.bind(this));
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
                if(GetEntityModel(object) == GetHashKey('prop_cs_fuel_nozle')) {
                    logger.Log('', object);
                    logger.Log(`Object(${object}) Net(${NetworkGetNetworkIdFromEntity(object)})`);
                    this.hosepipeService.Delete(object);
                }
            }
        }
    }
}