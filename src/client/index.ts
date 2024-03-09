import { Adapter } from '../server/vRPAdapter';
import { EventName } from '../utils';
import { Handler } from './handlers';
import { EntityService } from './services/entity';
import { HosepipeService } from './services/hosepipe';
import { JerryCanService } from './services/jerrycan';
import { RopeService } from './services/ropes';
import { UserInterface } from './services/userinterface';
import { VehicleService } from './services/vehicle';
import { Threads } from './threads';

const vRPclient = Adapter.getInterface('vRP');

const entityService = new EntityService(vRPclient as any);
const UIService = new UserInterface();
const ropeService = new RopeService();
const hosepipeService = new HosepipeService(ropeService, entityService);
const vehicleService = new VehicleService();
const jerryCanService = new JerryCanService();

new Threads(hosepipeService, ropeService, vehicleService, UIService, jerryCanService);
new Handler(hosepipeService, ropeService, vehicleService, UIService, jerryCanService);

emitNet(EventName('RequestClientConfig'));