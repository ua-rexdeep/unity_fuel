import { Logger } from '../logger';
import { EventName, vDist, Wait } from '../utils';
import { FuelStationService } from './services/fuelStationService';
import { PlayerService } from './services/playerService';

export class Threads {
    private readonly logger = new Logger('Threads');
    constructor(
        private readonly service: FuelStationService,
        private readonly playerService: PlayerService
    ){
        this.Create('NozzleTooFarFromPump', this.NozzleTooFarFromPump.bind(this), 100);
        this.Create('StationsLogger', this.StationsLogger.bind(this), 2000);
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

    private async NozzleTooFarFromPump() {
        const stations = this.service.GetAllStations();
        for(const station of stations) {
            for(const pump of station.pumps) {
                for(const hosepipe of pump.hosepipes) {
                    if(hosepipe && hosepipe.nozzleEntity) { // exists
                        const [nozzX, nozzY, nozzZ] = GetEntityCoords(NetworkGetEntityFromNetworkId(hosepipe.nozzleEntity));
                        const [pumpX, pumpY, pumpZ] = GetEntityCoords(NetworkGetEntityFromNetworkId(pump.netEntity));

                        if(vDist(nozzX, nozzY, nozzZ, pumpX, pumpY, pumpZ) >= 5.0) {

                            if(hosepipe.pickedUpPlayer) {
                                emitNet(EventName('DropPlayerNozzle'), hosepipe.pickedUpPlayer, hosepipe.nozzleEntity);
                                hosepipe.pickedUpPlayer = null;
                            } else if(hosepipe.inVehicle) { // TODO

                            }

                        }
                    }
                }
            }
        }
    }

    private async StationsLogger() {
        const stations = this.service.GetAllStations();
        emitNet('propInt::Debugger', -1, {
            id: 'cm:2',
            text: `Stations: ${JSON.stringify(stations)}`,
            entity: 0,
            left: 50,
            top: 400,
            customPosition: true,
        });
    }
}