import { Wait } from '../utils';
import { Adapter, ClientAdapter } from './vRPAdapter';

const vRP = Adapter.getInterface('vRP');
const vRPClient = ClientAdapter.getInterface('vRP', 'vRP');

// setTick(async () => {
//     console.log('Fuel tick');
//     await Wait(1000);

//     console.log(await vRP.getUserDataTable(1));
// });