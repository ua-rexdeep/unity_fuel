import { EventName } from '../utils';
import { FuelStationHandler } from './handlers/fuelStationHandler';
import { FuelEssenceService } from './services/fuelEssenceService';
import { FuelStationService } from './services/fuelStationService';
import { MySQLService } from './services/mysqlService';
import { PlayerService } from './services/playerService';
import { Threads } from './threads';
import { Adapter, ClientAdapter } from './vRPAdapter';

const vRP = Adapter.getInterface('vRP');
const vRPClient = ClientAdapter.getInterface('vRP', 'vRP');

const MySQL = new MySQLService();
const playerService = new PlayerService(vRP, vRPClient);
const fuelEssenceService = new FuelEssenceService(vRP, vRPClient, playerService, MySQL);
const fuelStationService = new FuelStationService(vRP, vRPClient, playerService, MySQL, fuelEssenceService);

new FuelStationHandler(fuelStationService, fuelEssenceService, playerService);

new Threads(fuelStationService, fuelEssenceService, playerService);

// setTick(async () => {
//     console.log('Fuel tick');
//     await Wait(1000);

//     console.log(fuelStationService.GetPlayerNearestStation(1));
// });

emit(EventName('RequestConfig'));