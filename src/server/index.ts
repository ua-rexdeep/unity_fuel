import { Wait } from '../utils';
import { FuelStationHandler } from './handlers/fuelStationHandler';
import { FuelStationService } from './services/fuelStationService';
import { MySQLService } from './services/mysqlService';
import { PlayerService } from './services/playerService';
import { Threads } from './threads';
import { Adapter, ClientAdapter } from './vRPAdapter';

const vRP = Adapter.getInterface('vRP');
const vRPClient = ClientAdapter.getInterface('vRP', 'vRP');

const MySQL = new MySQLService();
const playerService = new PlayerService(vRP, vRPClient);
const fuelStationService = new FuelStationService(vRP, vRPClient, MySQL);

new FuelStationHandler(fuelStationService, playerService);

new Threads(fuelStationService, playerService);

// setTick(async () => {
//     console.log('Fuel tick');
//     await Wait(1000);

//     console.log(fuelStationService.GetPlayerNearestStation(1));
// });